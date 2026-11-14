'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const settings = require('./settings');
const pricing = require('./pricing');
const mercari = require('./mercari');
const V = require('./views');
const A = require('./admin-views');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) console.warn('[warn] ADMIN_PASSWORD is not set: admin login is disabled.');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('jh:' + ADMIN_PASSWORD).digest('hex');
const SESSION_DAYS = 7;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1d' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif|gif)$|^application\/pdf$/.test(file.mimetype)),
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function ctx() {
  const [s, rate] = await Promise.all([settings.getAll(), pricing.getRate()]);
  return { s, rate };
}

// ---------- helpers ----------
function genOrderNo() {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // Thai date
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (const b of crypto.randomBytes(4)) r += alphabet[b % alphabet.length];
  return `JH-${ymd}-${r}`;
}
const digits = (p) => String(p || '').replace(/\D/g, '');
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function prohibitedWarnings(s, title) {
  const hits = (s.prohibited_keywords || []).filter((k) => k && title && title.includes(k));
  return hits.length ? [`ชื่อสินค้ามีคำที่อาจเป็นสินค้าต้องห้ามในการส่งระหว่างประเทศ (${hits.map(V.esc).join(', ')}) กรุณาทัก LINE สอบถามก่อนสั่ง <a href="/terms">ดูเงื่อนไข</a>`] : [];
}

async function withTotals(items) {
  return Promise.all(items.map(async (it) => {
    const q = await pricing.quote({ priceJpy: it.price_jpy, weightKg: it.weight_kg, jpShippingJpy: it.jp_shipping_jpy });
    return { ...it, total_thb: q.total_thb };
  }));
}

// Resolve the item to quote/order from either a featured id or a Mercari id.
async function resolveItem(src, id, { maxAgeMs } = {}) {
  if (src === 'featured') {
    const { rows } = await db.query('SELECT * FROM featured_items WHERE id = $1 AND status <> $2', [Number(id) || 0, 'draft']);
    const it = rows[0];
    if (!it) return { ok: false, reason: 'not_found' };
    return { ok: true, item: { ...it, sold: it.status === 'sold' } };
  }
  const r = await mercari.getItem(String(id), { maxAgeMs });
  if (!r.ok) return { ok: false, reason: r.reason, fetch: r };
  return {
    ok: true,
    fetch: r,
    item: {
      mercari_id: r.id, mercari_url: r.url, title_jp: r.title, title_th: '', image_url: r.image,
      price_jpy: r.price_jpy, sold: r.sold_out, weight_kg: null, jp_shipping_jpy: null,
    },
  };
}

// ---------- public ----------
app.get('/healthz', wrap(async (req, res) => { await db.query('SELECT 1'); res.json({ ok: true }); }));

app.get('/', wrap(async (req, res) => {
  const c = await ctx();
  const cat = clean(req.query.cat, 50) || null;
  const params = ['published'];
  let where = 'status = $1';
  if (cat) { params.push(cat); where += ' AND category = $2'; }
  const { rows } = await db.query(`SELECT * FROM featured_items WHERE ${where} ORDER BY created_at DESC LIMIT 48`, params);
  const items = await withTotals(rows);
  const heroRow = cat ? null : items[0] || null;
  res.send(V.home(c, { items, hero: heroRow, cats: c.s.categories || [], cat }));
}));

// One smart input: Mercari link -> product page, anything else -> search our featured items
app.get('/go', (req, res) => {
  const q = clean(req.query.q, 300);
  if (!q) return res.redirect('/');
  const id = mercari.parseItemId(q);
  if (id) return res.redirect('/item/' + id);
  if (mercari.isMercariUrl(q) || /^https?:\/\//.test(q)) return res.redirect('/quote-request?reason=unsupported&url=' + encodeURIComponent(q));
  res.redirect('/search?q=' + encodeURIComponent(q));
});

app.get('/search', wrap(async (req, res) => {
  const c = await ctx();
  const q = clean(req.query.q, 100);
  if (!q) return res.redirect('/');
  const like = '%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%';
  const { rows } = await db.query(
    `SELECT * FROM featured_items WHERE status IN ('published','sold')
       AND (title_th ILIKE $1 OR title_jp ILIKE $1 OR category ILIKE $1) ORDER BY status = 'sold', created_at DESC LIMIT 48`, [like]);
  res.send(V.home(c, { items: await withTotals(rows), hero: null, cats: c.s.categories || [], q, searchMode: true }));
}));

app.get('/item/:id', wrap(async (req, res) => {
  const id = req.params.id;
  if (!/^m\d{8,14}$/.test(id)) return res.redirect('/quote-request?reason=bad_id&url=' + encodeURIComponent(id));
  // If this item is one of our featured items, show that (with Thai title).
  const f = await db.query(`SELECT id FROM featured_items WHERE mercari_id = $1 AND status <> 'draft' ORDER BY id DESC LIMIT 1`, [id]);
  if (f.rows[0]) return res.redirect('/p/' + f.rows[0].id);
  const c = await ctx();
  const r = await resolveItem('item', id);
  if (!r.ok) return res.status(200).send(V.manualQuote(c, { url: `https://jp.mercari.com/item/${id}`, reason: r.reason }));
  const q = await pricing.quote({ priceJpy: r.item.price_jpy });
  const note = 'ชื่อสินค้าเป็นภาษาญี่ปุ่นตามหน้า Mercari ขนาดและน้ำหนักเป็นค่าประมาณ ร้านจะยืนยันอีกครั้ง';
  res.send(V.product(c, { item: r.item, q, orderBase: `/order/new?src=item&id=${id}`, warnings: [...prohibitedWarnings(c.s, r.item.title_jp), ...(r.item.sold ? ['สินค้านี้ขายแล้ว'] : [])], sourceNote: note }));
}));

app.get('/p/:id', wrap(async (req, res) => {
  const c = await ctx();
  const r = await resolveItem('featured', req.params.id);
  if (!r.ok) return res.status(404).send(V.errorPage(c, { msg: 'ไม่พบสินค้านี้' }));
  const it = r.item;
  const q = await pricing.quote({ priceJpy: it.price_jpy, weightKg: it.weight_kg, jpShippingJpy: it.jp_shipping_jpy });
  res.send(V.product(c, { item: it, q, orderBase: `/order/new?src=featured&id=${it.id}`, warnings: prohibitedWarnings(c.s, it.title_jp) }));
}));

app.get('/quote-request', wrap(async (req, res) => {
  const c = await ctx();
  res.send(V.manualQuote(c, { url: clean(req.query.url, 500), reason: clean(req.query.reason, 30) }));
}));
app.post('/quote-request', wrap(async (req, res) => {
  const c = await ctx();
  const b = req.body;
  if (!clean(b.url) || !clean(b.customer_name) || digits(b.phone).length < 9) {
    return res.status(400).send(V.manualQuote(c, { url: clean(b.url), reason: clean(b.reason), error: 'กรุณากรอกลิงก์ ชื่อ และเบอร์โทรให้ครบ' }));
  }
  await db.query('INSERT INTO quote_requests(url, customer_name, phone, line_id, note, reason) VALUES ($1,$2,$3,$4,$5,$6)',
    [clean(b.url), clean(b.customer_name, 120), clean(b.phone, 30), clean(b.line_id, 60), clean(b.note, 1000), clean(b.reason, 30)]);
  res.send(V.manualQuote(c, { done: true }));
}));

app.get('/order/new', wrap(async (req, res) => {
  const c = await ctx();
  const { src, id } = req.query;
  const r = await resolveItem(src === 'featured' ? 'featured' : 'item', id);
  if (!r.ok) return res.send(V.manualQuote(c, { url: src === 'item' ? `https://jp.mercari.com/item/${clean(id, 20)}` : '', reason: r.reason }));
  if (r.item.sold) return res.send(V.errorPage(c, { code: 410, msg: 'สินค้านี้ขายแล้ว' }));
  const w = Number(req.query.w) || r.item.weight_kg;
  const q = await pricing.quote({ priceJpy: r.item.price_jpy, weightKg: w, jpShippingJpy: r.item.jp_shipping_jpy });
  res.send(V.orderForm(c, { item: r.item, q, src: src === 'featured' ? 'featured' : 'item', id, w: q.weight_kg }));
}));

app.post('/order', upload.single('slip'), wrap(async (req, res) => {
  const c = await ctx();
  const b = req.body;
  const src = b.src === 'featured' ? 'featured' : 'item';
  // Re-check: for link orders, re-use the page fetch only if it is < 10 min old, otherwise fetch again.
  const r = await resolveItem(src, b.id);
  if (!r.ok) return res.send(V.manualQuote(c, { url: src === 'item' ? `https://jp.mercari.com/item/${clean(b.id, 20)}` : '', reason: r.reason }));
  if (r.item.sold) return res.send(V.errorPage(c, { code: 410, msg: 'ขออภัย สินค้านี้ขายแล้ว' }));
  const q = await pricing.quote({ priceJpy: r.item.price_jpy, weightKg: Number(b.w) || r.item.weight_kg, jpShippingJpy: r.item.jp_shipping_jpy });
  const values = { customer_name: b.customer_name, phone: b.phone, line_id: b.line_id, address: b.address, note: b.note };
  const errs = [];
  if (!clean(b.customer_name)) errs.push('กรุณากรอกชื่อ');
  if (digits(b.phone).length < 9) errs.push('กรุณากรอกเบอร์โทรให้ถูกต้อง');
  if (clean(b.address).length < 10) errs.push('กรุณากรอกที่อยู่ให้ครบ');
  if (!b.agree) errs.push('กรุณายอมรับเงื่อนไขการให้บริการ');
  if (req.body && req.file === undefined && req.headers['content-type'] && req.fileValidationError) errs.push('ไฟล์สลิปไม่ถูกต้อง');
  if (errs.length) return res.status(400).send(V.orderForm(c, { item: r.item, q, src, id: b.id, w: q.weight_kg, values, error: errs.join('<br />') }));

  const it = r.item;
  const client = await db.pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO orders(order_no, customer_name, phone, phone_digits, line_id, address, note, featured_item_id, mercari_id, mercari_url, title_jp, title_th, image_url, price_jpy, quote, total_thb)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [genOrderNo(), clean(b.customer_name, 120), clean(b.phone, 30), digits(b.phone), clean(b.line_id, 60), clean(b.address, 1000), clean(b.note, 1000),
        src === 'featured' ? it.id : null, it.mercari_id || mercari.parseItemId(it.mercari_url), it.mercari_url, it.title_jp, it.title_th || null, it.image_url,
        it.price_jpy, JSON.stringify({ ...q, tiers: undefined }), q.total_thb]);
    order = ins.rows[0];
    await client.query('INSERT INTO order_events(order_id, status, note) VALUES ($1,$2,$3)', [order.id, order.status, 'รับคำสั่งซื้อ']);
    if (req.file) {
      await client.query('INSERT INTO order_slips(order_id, filename, mime, size, data) VALUES ($1,$2,$3,$4,$5)',
        [order.id, clean(req.file.originalname, 200), req.file.mimetype, req.file.size, req.file.buffer]);
      await client.query('INSERT INTO order_events(order_id, status, note) VALUES ($1,$2,$3)', [order.id, order.status, 'แนบสลิปแล้ว รอร้านตรวจสอบ']);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  console.log(`[order] ${order.order_no} ${order.total_thb} THB ${order.mercari_url}`);
  res.redirect(303, `/order/done/${encodeURIComponent(order.order_no)}?k=${digits(order.phone).slice(-4)}`);
}));

app.get('/order/done/:no', wrap(async (req, res) => {
  const c = await ctx();
  const { rows } = await db.query('SELECT * FROM orders WHERE order_no = $1', [req.params.no]);
  const o = rows[0];
  if (!o || o.phone_digits.slice(-4) !== String(req.query.k)) return res.status(404).send(V.errorPage(c, {}));
  res.send(V.orderDone(c, { order: o }));
}));

async function findOrder(no, phone) {
  const { rows } = await db.query('SELECT * FROM orders WHERE order_no = $1 AND phone_digits = $2', [clean(no, 40).toUpperCase(), digits(phone)]);
  return rows[0] || null;
}

app.get('/track', wrap(async (req, res) => {
  const c = await ctx();
  const no = clean(req.query.no, 40); const phone = clean(req.query.phone, 30);
  if (!no || !phone) return res.send(V.track(c, { no, phone }));
  const o = await findOrder(no, phone);
  if (!o) return res.send(V.track(c, { no, phone, error: 'ไม่พบคำสั่งซื้อ ตรวจเลขคำสั่งซื้อและเบอร์โทรอีกครั้ง' }));
  const ev = await db.query('SELECT status, note, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at DESC', [o.id]);
  res.send(V.track(c, { order: o, events: ev.rows, no, phone, uploaded: req.query.uploaded }));
}));

app.post('/track/slip', upload.single('slip'), wrap(async (req, res) => {
  const o = await findOrder(req.body.no, req.body.phone);
  const back = `/track?no=${encodeURIComponent(clean(req.body.no, 40))}&phone=${encodeURIComponent(clean(req.body.phone, 30))}`;
  if (!o || !req.file) return res.redirect(303, back);
  await db.query('INSERT INTO order_slips(order_id, filename, mime, size, data) VALUES ($1,$2,$3,$4,$5)', [o.id, clean(req.file.originalname, 200), req.file.mimetype, req.file.size, req.file.buffer]);
  await db.query('INSERT INTO order_events(order_id, status, note) VALUES ($1,$2,$3)', [o.id, o.status, 'แนบสลิปแล้ว รอร้านตรวจสอบ']);
  res.redirect(303, back + '&uploaded=1');
}));

app.get('/terms', wrap(async (req, res) => res.send(V.terms(await ctx()))));

// ---------- admin ----------
function sign(v) { return crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url'); }
function makeSession() { const exp = String(Date.now() + SESSION_DAYS * 864e5); return `${exp}.${sign(exp)}`; }
function validSession(tok) {
  if (!tok || !ADMIN_PASSWORD) return false;
  const [exp, sig] = tok.split('.');
  if (!exp || !sig) return false;
  const good = sign(exp);
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig)) && Number(exp) > Date.now();
}
function cookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
const isHttps = (req) => req.secure;
function requireAdmin(req, res, next) {
  if (validSession(cookie(req, 'jh_admin'))) return next();
  res.redirect('/admin/login');
}

const loginFails = new Map();
app.get('/admin/login', (req, res) => res.send(A.login({ error: ADMIN_PASSWORD ? null : 'ยังไม่ได้ตั้งค่า ADMIN_PASSWORD บนเซิร์ฟเวอร์' })));
app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  const f = loginFails.get(ip) || { n: 0, until: 0 };
  if (f.until > Date.now()) return res.status(429).send(A.login({ error: 'ลองผิดหลายครั้ง กรุณารอ 5 นาที' }));
  const pw = String(req.body.password || '');
  const ok = ADMIN_PASSWORD && pw.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(ADMIN_PASSWORD));
  if (!ok) {
    f.n += 1; if (f.n >= 5) { f.until = Date.now() + 5 * 60 * 1000; f.n = 0; }
    loginFails.set(ip, f);
    return res.status(401).send(A.login({ error: 'รหัสผ่านไม่ถูกต้อง' }));
  }
  loginFails.delete(ip);
  res.setHeader('Set-Cookie', `jh_admin=${encodeURIComponent(makeSession())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`);
  res.redirect(303, '/admin');
});
app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'jh_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.redirect(303, '/admin/login');
});

app.use('/admin', requireAdmin);

app.get('/admin', wrap(async (req, res) => {
  const status = V.STATUSES.includes(req.query.status) ? req.query.status : null;
  const { rows } = await db.query(
    `SELECT o.*, (SELECT count(*)::int FROM order_slips s WHERE s.order_id = o.id) AS slip_count
       FROM orders o ${status ? 'WHERE o.status = $1' : ''} ORDER BY o.created_at DESC LIMIT 200`, status ? [status] : []);
  const cnt = await db.query('SELECT status, count(*)::int AS n FROM orders GROUP BY status');
  res.send(A.orders({ rows, status, counts: Object.fromEntries(cnt.rows.map((r) => [r.status, r.n])) }));
}));

async function loadOrder(id) {
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [Number(id) || 0]);
  if (!rows[0]) return null;
  const slips = await db.query('SELECT id, filename, mime, size, created_at FROM order_slips WHERE order_id = $1 ORDER BY id', [rows[0].id]);
  const ev = await db.query('SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at DESC', [rows[0].id]);
  return { o: rows[0], slips: slips.rows, events: ev.rows };
}

app.get('/admin/orders/:id', wrap(async (req, res) => {
  const d = await loadOrder(req.params.id);
  if (!d) return res.status(404).send('not found');
  res.send(A.orderDetail({ ...d, flash: req.query.saved ? 'บันทึกแล้ว' : null }));
}));

app.post('/admin/orders/:id/recheck', wrap(async (req, res) => {
  const d = await loadOrder(req.params.id);
  if (!d) return res.status(404).send('not found');
  let recheck = { ok: false, reason: 'no_mercari_id' };
  if (d.o.mercari_id) recheck = await mercari.getItem(d.o.mercari_id, { maxAgeMs: 60 * 1000 }); // force fresh unless < 1 min old
  res.send(A.orderDetail({ ...d, recheck }));
}));

app.post('/admin/orders/:id/status', wrap(async (req, res) => {
  const st = req.body.status;
  if (!V.STATUSES.includes(st)) return res.status(400).send('bad status');
  const { rows } = await db.query('SELECT status FROM orders WHERE id = $1', [Number(req.params.id) || 0]);
  if (!rows[0]) return res.status(404).send('not found');
  await db.query('UPDATE orders SET status = $1, tracking_no = $2, admin_note = $3, updated_at = now() WHERE id = $4',
    [st, clean(req.body.tracking_no, 80) || null, clean(req.body.admin_note, 2000) || null, Number(req.params.id)]);
  const note = clean(req.body.note, 300);
  if (st !== rows[0].status || note) await db.query('INSERT INTO order_events(order_id, status, note) VALUES ($1,$2,$3)', [Number(req.params.id), st, note || null]);
  res.redirect(303, `/admin/orders/${req.params.id}?saved=1`);
}));

app.get('/admin/slips/:id', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT mime, data, filename FROM order_slips WHERE id = $1', [Number(req.params.id) || 0]);
  if (!rows[0]) return res.status(404).send('not found');
  res.setHeader('Content-Type', rows[0].mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `inline; filename="slip"`);
  res.send(rows[0].data);
}));

app.get('/admin/quotes', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM quote_requests ORDER BY handled, created_at DESC LIMIT 200');
  res.send(A.quotes({ rows }));
}));
app.post('/admin/quotes/:id/done', wrap(async (req, res) => {
  await db.query('UPDATE quote_requests SET handled = true WHERE id = $1', [Number(req.params.id) || 0]);
  res.redirect(303, '/admin/quotes');
}));

app.get('/admin/featured', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM featured_items ORDER BY created_at DESC');
  res.send(A.featuredList({ rows, flash: req.query.saved ? 'บันทึกแล้ว' : null }));
}));

app.get('/admin/featured/new', wrap(async (req, res) => {
  const s = await settings.getAll();
  const url = clean(req.query.url, 500);
  const id = mercari.parseItemId(url);
  let it = { mercari_url: url, status: 'published' };
  let fetchInfo = null;
  if (id) {
    const r = await mercari.getItem(id);
    fetchInfo = r;
    it.mercari_url = `https://jp.mercari.com/item/${id}`;
    if (r.ok) it = { ...it, title_jp: r.title, title_th: '', price_jpy: r.price_jpy, image_url: r.image };
  } else if (url) fetchInfo = { ok: false, reason: 'ลิงก์ไม่ใช่ jp.mercari.com/item/...' };
  res.send(A.featuredForm({ it, cats: s.categories || [], fetchInfo }));
}));

function featuredFromBody(b) {
  const url = clean(b.mercari_url, 500);
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    mercari_url: url, mercari_id: mercari.parseItemId(url), title_jp: clean(b.title_jp, 300) || null, title_th: clean(b.title_th, 300),
    condition_th: clean(b.condition_th, 80) || null, category: clean(b.category, 50) || null, price_jpy: Math.round(Number(b.price_jpy) || 0),
    image_url: clean(b.image_url, 1000) || null, weight_kg: num(b.weight_kg), jp_shipping_jpy: num(b.jp_shipping_jpy),
    status: ['published', 'draft', 'sold'].includes(b.status) ? b.status : 'draft',
  };
}
const F_COLS = ['mercari_url', 'mercari_id', 'title_jp', 'title_th', 'condition_th', 'category', 'price_jpy', 'image_url', 'weight_kg', 'jp_shipping_jpy', 'status'];

app.post('/admin/featured', wrap(async (req, res) => {
  const f = featuredFromBody(req.body);
  if (!f.title_th || !f.price_jpy || !f.mercari_url) {
    const s = await settings.getAll();
    return res.status(400).send(A.featuredForm({ it: f, cats: s.categories || [], error: 'กรุณากรอกลิงก์ ชื่อภาษาไทย และราคา' }));
  }
  await db.query(`INSERT INTO featured_items(${F_COLS.join(',')}) VALUES (${F_COLS.map((_, i) => '$' + (i + 1)).join(',')})`, F_COLS.map((k) => f[k]));
  res.redirect(303, '/admin/featured?saved=1');
}));

app.get('/admin/featured/:id', wrap(async (req, res) => {
  const s = await settings.getAll();
  const { rows } = await db.query('SELECT * FROM featured_items WHERE id = $1', [Number(req.params.id) || 0]);
  if (!rows[0]) return res.status(404).send('not found');
  res.send(A.featuredForm({ it: rows[0], cats: s.categories || [] }));
}));

app.post('/admin/featured/:id', wrap(async (req, res) => {
  const f = featuredFromBody(req.body);
  if (!f.title_th || !f.price_jpy) {
    const s = await settings.getAll();
    return res.status(400).send(A.featuredForm({ it: { ...f, id: req.params.id }, cats: s.categories || [], error: 'กรุณากรอกชื่อภาษาไทยและราคา' }));
  }
  await db.query(`UPDATE featured_items SET ${F_COLS.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = now() WHERE id = $${F_COLS.length + 1}`,
    [...F_COLS.map((k) => f[k]), Number(req.params.id)]);
  res.redirect(303, '/admin/featured?saved=1');
}));

app.post('/admin/featured/:id/status', wrap(async (req, res) => {
  if (!['published', 'draft', 'sold'].includes(req.body.status)) return res.status(400).send('bad status');
  await db.query('UPDATE featured_items SET status = $1, updated_at = now() WHERE id = $2', [req.body.status, Number(req.params.id) || 0]);
  res.redirect(303, '/admin/featured?saved=1');
}));
app.post('/admin/featured/:id/delete', wrap(async (req, res) => {
  await db.query('DELETE FROM featured_items WHERE id = $1', [Number(req.params.id) || 0]);
  res.redirect(303, '/admin/featured?saved=1');
}));

app.get('/admin/settings', wrap(async (req, res) => {
  const [s, rate] = await Promise.all([settings.getAll(), pricing.getRate()]);
  res.send(A.settingsPage({ s, rate, flash: req.query.saved ? 'บันทึกการตั้งค่าแล้ว' : null }));
}));
app.post('/admin/settings', wrap(async (req, res) => {
  const b = req.body;
  const str = ['shop_name', 'line_id', 'bank_name', 'bank_account_name', 'bank_account_no', 'promptpay'];
  for (const k of str) if (k in b) await settings.set(k, clean(b[k], 200));
  const nums = ['fee_percent', 'fee_min_thb', 'jp_shipping_jpy', 'rate_buffer_pct', 'fallback_rate', 'default_weight_kg'];
  for (const k of nums) if (b[k] !== undefined && b[k] !== '' && Number.isFinite(Number(b[k])) && Number(b[k]) >= 0) await settings.set(k, Number(b[k]));
  if (typeof b.shipping_tiers === 'string') {
    const tiers = b.shipping_tiers.split(/\r?\n/).map((l) => l.split('=').map((x) => Number(String(x).trim())))
      .filter(([kg, t]) => kg > 0 && t >= 0).map(([max_kg, thb]) => ({ max_kg, thb })).sort((a, b2) => a.max_kg - b2.max_kg);
    if (tiers.length) await settings.set('shipping_tiers', tiers);
  }
  const list = (v) => String(v || '').split(/[,、\n]/).map((x) => x.trim()).filter(Boolean);
  if ('prohibited_keywords' in b) await settings.set('prohibited_keywords', list(b.prohibited_keywords));
  if ('categories' in b && list(b.categories).length) await settings.set('categories', list(b.categories));
  res.redirect(303, '/admin/settings?saved=1');
}));

// ---------- errors ----------
app.use(wrap(async (req, res) => res.status(404).send(V.errorPage(await ctx(), {}))));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).send('ไฟล์ใหญ่เกิน 5 MB หรือไม่ถูกต้อง <a href="javascript:history.back()">กลับ</a>');
  console.error(err);
  res.status(500).send('เกิดข้อผิดพลาด กรุณาลองใหม่ หรือทัก LINE');
});

db.migrate().then(() => {
  app.listen(PORT, () => console.log(`JapanHiu listening on http://localhost:${PORT}`));
}).catch((e) => { console.error('migration failed', e); process.exit(1); });
