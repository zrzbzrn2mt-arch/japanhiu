'use strict';
const { esc, thb, jpy, dt: dtTh, STATUSES } = require('./views');
// Admin sees Japan time (shop operator is in Japan). Set ADMIN_TZ to change.
const ADMIN_TZ = process.env.ADMIN_TZ || 'Asia/Tokyo';
const dt = (d) => d ? dtTh(d, ADMIN_TZ) + ' (เวลาญี่ปุ่น)'.replace(' (เวลาญี่ปุ่น)', ADMIN_TZ === 'Asia/Tokyo' ? ' JST' : '') : '';

function adminLayout(title, body, { flash } = {}) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" /><title>${esc(title)} — แอดมิน JapanHiu</title>
<link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/app.css" /></head>
<body class="admin">
<header class="header"><div class="header-inner">
  <a class="logo" href="/admin"><span class="mark">JH</span><span class="logo-text"><span class="name">แอดมิน</span><span class="tag">JapanHiu</span></span></a>
  <nav class="admin-nav">
    <a href="/admin">คำสั่งซื้อ</a><a href="/admin/quotes">ขอราคา</a><a href="/admin/featured">สินค้าแนะนำ</a><a href="/admin/settings">ตั้งค่า</a>
    <form method="post" action="/admin/logout"><button type="submit">ออก</button></form>
  </nav>
</div></header>
<main class="wrap admin-main">
${flash ? `<div class="alert ok">${esc(flash)}</div>` : ''}
${body}
</main></body></html>`;
}

function login({ error }) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" /><title>เข้าสู่ระบบแอดมิน</title><link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/app.css" /></head>
<body class="admin"><div class="wrap narrow"><div class="panel" style="margin-top:60px">
<h1>เข้าสู่ระบบแอดมิน</h1>
${error ? `<div class="alert err">${esc(error)}</div>` : ''}
<form method="post" action="/admin/login" class="form"><label>รหัสผ่าน<input type="password" name="password" required autofocus /></label><button class="btn" type="submit">เข้าสู่ระบบ</button></form>
</div></div></body></html>`;
}

function statusPill(st) {
  const i = STATUSES.indexOf(st);
  return `<span class="pill s${i}">${esc(st)}</span>`;
}

function orders({ rows, status, counts }) {
  const tabs = ['ทั้งหมด', ...STATUSES].map((st) => {
    const active = (st === 'ทั้งหมด' && !status) || st === status;
    const c = st === 'ทั้งหมด' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[st] || 0;
    return `<a class="tab${active ? ' active' : ''}" href="/admin${st === 'ทั้งหมด' ? '' : '?status=' + encodeURIComponent(st)}">${esc(st)} <b>${c}</b></a>`;
  }).join('');
  const body = `<h1>คำสั่งซื้อ</h1>
  <div class="tabs">${tabs}</div>
  ${rows.length ? `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>เลขที่</th><th>สินค้า</th><th>ลูกค้า</th><th>ยอด</th><th>สถานะ</th><th>สลิป</th><th>วันที่</th></tr></thead>
    <tbody>${rows.map((o) => `<tr>
      <td><a href="/admin/orders/${o.id}"><strong>${esc(o.order_no)}</strong></a></td>
      <td class="it">${o.image_url ? `<img src="${esc(o.image_url)}" alt="" referrerpolicy="no-referrer" />` : ''}<span>${esc(o.title_th || o.title_jp)}</span></td>
      <td>${esc(o.customer_name)}<br /><small>${esc(o.phone)}</small></td>
      <td>${thb(o.total_thb)}<br /><small>${jpy(o.price_jpy)}</small></td>
      <td>${statusPill(o.status)}</td>
      <td>${o.slip_count > 0 ? `<span class="pill s1">${o.slip_count}</span>` : '-'}</td>
      <td><small>${dt(o.created_at)}</small></td>
    </tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>ยังไม่มีคำสั่งซื้อ</p></div>'}`;
  return adminLayout('คำสั่งซื้อ', body);
}

function orderDetail({ o, slips, events, recheck, flash }) {
  const q = o.quote || {};
  const body = `<a class="back" href="/admin">← คำสั่งซื้อทั้งหมด</a>
  <h1>${esc(o.order_no)} ${statusPill(o.status)}</h1>
  <div class="admin-grid">
    <section class="panel">
      <h2>สินค้า</h2>
      <div class="mini-item">${o.image_url ? `<img src="${esc(o.image_url)}" alt="" referrerpolicy="no-referrer" />` : ''}
        <div><div class="t">${esc(o.title_th || '')}</div><div class="small">${esc(o.title_jp || '')}</div>
        <div><a href="${esc(o.mercari_url)}" target="_blank" rel="noopener">เปิดใน Mercari ↗</a> · ${esc(o.mercari_id || '')}</div></div></div>
      <form method="post" action="/admin/orders/${o.id}/recheck"><button class="btn ghost small" type="submit">ตรวจสต็อก/ราคาบน Mercari อีกครั้ง</button></form>
      ${recheck ? `<div class="alert ${recheck.ok ? (recheck.price_jpy === o.price_jpy ? 'ok' : 'warn') : 'err'}">${recheck.ok
        ? `ยังเปิดหน้าได้ · ราคาปัจจุบัน ${jpy(recheck.price_jpy)} ${recheck.price_jpy === o.price_jpy ? '(เท่าเดิม)' : `(ตอนสั่ง ${jpy(o.price_jpy)})`}${recheck.sold_out ? ' · <strong>ขายแล้ว</strong>' : ''} · ระบบอ่านสถานะ "ขายแล้ว" จากหน้าเว็บแบบธรรมดาไม่ได้เสมอ กรุณาเปิดลิงก์ยืนยันด้วยตาก่อนซื้อ`
        : `ดึงข้อมูลไม่ได้ (${esc(recheck.reason)}${recheck.status ? ' ' + recheck.status : ''}) อาจถูกลบหรือปิดการขาย`}</div>` : ''}
      <h2>ราคา (ตอนสั่ง)</h2>
      <table class="kv">
        <tr><td>ค่าสินค้า</td><td>${jpy(q.price_jpy)} × ${q.rate} = ${thb(q.item_thb)}</td></tr>
        <tr><td>ค่าบริการ</td><td>${thb(q.fee_thb)}</td></tr>
        <tr><td>ค่าส่งในญี่ปุ่น</td><td>${jpy(q.jp_shipping_jpy)} = ${thb(q.jp_shipping_thb)}</td></tr>
        <tr><td>ค่าส่งไทย (≤${q.weight_kg} กก.)</td><td>${q.intl_shipping_thb == null ? 'ยังไม่คิด' : thb(q.intl_shipping_thb)}</td></tr>
        <tr><td><strong>รวม</strong></td><td><strong>${thb(o.total_thb)}</strong></td></tr>
      </table>
    </section>
    <section class="panel">
      <h2>ลูกค้า</h2>
      <table class="kv">
        <tr><td>ชื่อ</td><td>${esc(o.customer_name)}</td></tr>
        <tr><td>โทร</td><td><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></td></tr>
        <tr><td>LINE</td><td>${esc(o.line_id || '-')}</td></tr>
        <tr><td>ที่อยู่</td><td class="pre">${esc(o.address)}</td></tr>
        <tr><td>หมายเหตุ</td><td class="pre">${esc(o.note || '-')}</td></tr>
        <tr><td>สั่งเมื่อ</td><td>${dt(o.created_at)}</td></tr>
      </table>
      <h2>สลิป</h2>
      ${slips.length ? slips.map((sl) => `<div class="slip">${/^image\//.test(sl.mime) ? `<a href="/admin/slips/${sl.id}" target="_blank"><img src="/admin/slips/${sl.id}" alt="สลิป" /></a>` : `<a href="/admin/slips/${sl.id}" target="_blank">เปิดไฟล์ ${esc(sl.filename || 'slip')}</a>`}<small>${dt(sl.created_at)}</small></div>`).join('') : '<p class="small">ยังไม่มีสลิป</p>'}
    </section>
    <section class="panel">
      <h2>อัปเดตสถานะ</h2>
      <form method="post" action="/admin/orders/${o.id}/status" class="form">
        <label>สถานะ<select name="status">${STATUSES.map((st) => `<option ${st === o.status ? 'selected' : ''}>${esc(st)}</option>`).join('')}</select></label>
        <label>เลขพัสดุ (ถ้ามี)<input name="tracking_no" value="${esc(o.tracking_no || '')}" /></label>
        <label>ข้อความถึงลูกค้า (แสดงในหน้าติดตาม)<input name="note" /></label>
        <label>บันทึกภายใน (ลูกค้าไม่เห็น)<textarea name="admin_note" rows="2">${esc(o.admin_note || '')}</textarea></label>
        <button class="btn" type="submit">บันทึก</button>
      </form>
      <h2>ประวัติ</h2>
      <ul class="events">${events.map((e) => `<li><span>${dt(e.created_at)}</span> ${esc(e.status)}${e.note ? ' · ' + esc(e.note) : ''}</li>`).join('')}</ul>
    </section>
  </div>`;
  return adminLayout(o.order_no, body, { flash });
}

function quotes({ rows }) {
  const body = `<h1>คำขอใบเสนอราคา</h1>
  ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ลิงก์</th><th>ลูกค้า</th><th>หมายเหตุ</th><th>สาเหตุ</th><th>วันที่</th><th></th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="${r.handled ? 'muted' : ''}"><td class="url"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></td>
    <td>${esc(r.customer_name)}<br /><small>${esc(r.phone)} ${r.line_id ? '· LINE ' + esc(r.line_id) : ''}</small></td>
    <td class="pre">${esc(r.note || '')}</td><td><small>${esc(r.reason || '')}</small></td><td><small>${dt(r.created_at)}</small></td>
    <td>${r.handled ? 'จัดการแล้ว' : `<form method="post" action="/admin/quotes/${r.id}/done"><button class="btn small" type="submit">จัดการแล้ว</button></form>`}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty"><p>ยังไม่มีคำขอ</p></div>'}`;
  return adminLayout('ขอราคา', body);
}

function featuredList({ rows, flash }) {
  const body = `<h1>สินค้าแนะนำ</h1>
  <div class="panel">
    <h2>เพิ่มสินค้าจากลิงก์ Mercari</h2>
    <form method="get" action="/admin/featured/new" class="form inline">
      <label>ลิงก์ Mercari<input name="url" placeholder="https://jp.mercari.com/item/m..." required /></label>
      <button class="btn" type="submit">ดึงข้อมูล</button>
    </form>
  </div>
  ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>สินค้า</th><th>หมวด</th><th>ราคา</th><th>สถานะ</th><th></th></tr></thead><tbody>
  ${rows.map((r) => `<tr>
    <td class="it">${r.image_url ? `<img src="${esc(r.image_url)}" alt="" referrerpolicy="no-referrer" />` : ''}<span><a href="/admin/featured/${r.id}">${esc(r.title_th)}</a><br /><small>${esc(r.mercari_id || '')}</small></span></td>
    <td>${esc(r.category || '-')}</td><td>${jpy(r.price_jpy)}</td>
    <td><span class="pill ${r.status === 'published' ? 's1' : r.status === 'sold' ? 's6' : ''}">${{ published: 'เผยแพร่', draft: 'ฉบับร่าง', sold: 'ขายแล้ว' }[r.status] || esc(r.status)}</span></td>
    <td class="row-actions">
      ${r.status !== 'published' ? `<form method="post" action="/admin/featured/${r.id}/status"><input type="hidden" name="status" value="published" /><button class="btn small" type="submit">เผยแพร่</button></form>` : `<form method="post" action="/admin/featured/${r.id}/status"><input type="hidden" name="status" value="draft" /><button class="btn small ghost" type="submit">ซ่อน</button></form>`}
      ${r.status !== 'sold' ? `<form method="post" action="/admin/featured/${r.id}/status"><input type="hidden" name="status" value="sold" /><button class="btn small ghost" type="submit">ขายแล้ว</button></form>` : ''}
      <form method="post" action="/admin/featured/${r.id}/delete" onsubmit="return confirm('ลบสินค้านี้?')"><button class="btn small danger" type="submit">ลบ</button></form>
    </td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty"><p>ยังไม่มีสินค้าแนะนำ</p></div>'}`;
  return adminLayout('สินค้าแนะนำ', body, { flash });
}

function featuredForm({ it, cats, fetchInfo, error }) {
  const isNew = !it.id;
  const body = `<a class="back" href="/admin/featured">← สินค้าแนะนำ</a>
  <h1>${isNew ? 'เพิ่มสินค้าแนะนำ' : 'แก้ไขสินค้าแนะนำ'}</h1>
  ${fetchInfo ? `<div class="alert ${fetchInfo.ok ? 'ok' : 'warn'}">${fetchInfo.ok ? 'ดึงข้อมูลจาก Mercari แล้ว ตรวจและแปลชื่อเป็นภาษาไทยก่อนบันทึก' : `ดึงข้อมูลอัตโนมัติไม่ได้ (${esc(fetchInfo.reason)}${fetchInfo.status ? ' ' + fetchInfo.status : ''}) กรอกเองได้`}</div>` : ''}
  ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
  <div class="admin-grid two">
  <form method="post" action="${isNew ? '/admin/featured' : '/admin/featured/' + it.id}" class="form panel">
    <label>ลิงก์ Mercari<input name="mercari_url" value="${esc(it.mercari_url)}" required /></label>
    <label>ชื่อภาษาญี่ปุ่น (ต้นฉบับ)<input name="title_jp" value="${esc(it.title_jp)}" /></label>
    <label>ชื่อภาษาไทย (แสดงบนเว็บ)<input name="title_th" value="${esc(it.title_th)}" required /></label>
    <label>สภาพ<input name="condition_th" value="${esc(it.condition_th)}" placeholder="เช่น ใหม่ ไม่แกะกล่อง / มือสอง สภาพดี" list="conds" /></label>
    <datalist id="conds"><option>ใหม่ ไม่แกะกล่อง</option><option>ใหม่ เปิดกล่องแล้ว</option><option>มือสอง สภาพดีมาก</option><option>มือสอง สภาพดี</option><option>มือสอง มีรอยใช้งาน</option></datalist>
    <label>หมวด<select name="category"><option value="">-</option>${cats.map((c) => `<option ${c === it.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label>ราคา (เยน)<input name="price_jpy" type="number" min="1" value="${esc(it.price_jpy)}" required /></label>
    <label>รูป (URL)<input name="image_url" value="${esc(it.image_url)}" /></label>
    <label>น้ำหนักประมาณ (กก.)<input name="weight_kg" type="number" step="0.1" min="0.1" value="${esc(it.weight_kg ?? '')}" placeholder="ว่าง = ใช้ค่าเริ่มต้น" /></label>
    <label>ค่าส่งในญี่ปุ่น (เยน)<input name="jp_shipping_jpy" type="number" min="0" value="${esc(it.jp_shipping_jpy ?? '')}" placeholder="ว่าง = ใช้ค่าเริ่มต้น, 0 = ผู้ขายส่งฟรี (送料込み)" /></label>
    <label>สถานะ<select name="status">${[['published', 'เผยแพร่'], ['draft', 'ฉบับร่าง'], ['sold', 'ขายแล้ว']].map(([v, l]) => `<option value="${v}" ${v === (it.status || 'published') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn" type="submit">บันทึก</button>
  </form>
  <div class="panel">${it.image_url ? `<img class="preview" src="${esc(it.image_url)}" alt="" referrerpolicy="no-referrer" />` : '<p class="small">ไม่มีรูป</p>'}
  ${it.mercari_url ? `<p><a href="${esc(it.mercari_url)}" target="_blank" rel="noopener">เปิดใน Mercari ↗</a></p>` : ''}</div>
  </div>`;
  return adminLayout(isNew ? 'เพิ่มสินค้า' : 'แก้ไขสินค้า', body);
}

function settingsPage({ s, rate, flash }) {
  const v = (k) => esc(s[k] ?? '');
  const tiers = (s.shipping_tiers || []).map((t) => `${t.max_kg}=${t.thb}`).join('\n');
  const body = `<h1>ตั้งค่า</h1>
  <form method="post" action="/admin/settings" class="form">
  <div class="admin-grid">
    <section class="panel">
      <h2>ร้าน</h2>
      <label>ชื่อร้าน<input name="shop_name" value="${v('shop_name')}" /></label>
      <label>LINE ID (เช่น @japanhiu หรือลิงก์ line.me)<input name="line_id" value="${v('line_id')}" /></label>
      <h2>บัญชีรับเงิน</h2>
      <label>ธนาคาร<input name="bank_name" value="${v('bank_name')}" /></label>
      <label>ชื่อบัญชี<input name="bank_account_name" value="${v('bank_account_name')}" /></label>
      <label>เลขบัญชี<input name="bank_account_no" value="${v('bank_account_no')}" /></label>
      <label>พร้อมเพย์<input name="promptpay" value="${v('promptpay')}" /></label>
    </section>
    <section class="panel">
      <h2>ราคา</h2>
      <label>ค่าบริการ (%)<input name="fee_percent" type="number" step="0.1" value="${v('fee_percent')}" /></label>
      <label>ค่าบริการขั้นต่ำ (บาท)<input name="fee_min_thb" type="number" value="${v('fee_min_thb')}" /></label>
      <label>ค่าส่งในญี่ปุ่นเริ่มต้น (เยน)<input name="jp_shipping_jpy" type="number" value="${v('jp_shipping_jpy')}" /></label>
      <label>เผื่ออัตราแลกเปลี่ยน (%)<input name="rate_buffer_pct" type="number" step="0.1" value="${v('rate_buffer_pct')}" /></label>
      <label>อัตราสำรอง บาท/เยน (ใช้เมื่อดึงอัตราจริงไม่ได้)<input name="fallback_rate" type="number" step="0.0001" value="${v('fallback_rate')}" /></label>
      <p class="small">อัตราตอนนี้: ${rate.raw.toFixed(4)} (${esc(rate.source)}${rate.fetchedAt ? ', ดึงเมื่อ ' + dt(rate.fetchedAt) : ''}) → ใช้จริง ${rate.effective.toFixed(4)}</p>
      <label>น้ำหนักเริ่มต้นต่อชิ้น (กก.)<input name="default_weight_kg" type="number" step="0.1" value="${v('default_weight_kg')}" /></label>
      <label>ค่าส่งญี่ปุ่น→ไทยตามน้ำหนัก (บรรทัดละ กก.สูงสุด=บาท)<textarea name="shipping_tiers" rows="6">${esc(tiers)}</textarea></label>
      <p class="small">ค่าเริ่มต้นเป็นตัวเลขสมมติ กรุณาใส่ราคาขนส่งจริงของคุณ</p>
    </section>
    <section class="panel">
      <h2>สินค้าต้องห้าม</h2>
      <label>คำในชื่อสินค้า (ภาษาญี่ปุ่น) ที่จะขึ้นคำเตือน คั่นด้วยจุลภาค<textarea name="prohibited_keywords" rows="4">${esc((s.prohibited_keywords || []).join(', '))}</textarea></label>
      <h2>หมวดสินค้า</h2>
      <label>คั่นด้วยจุลภาค<input name="categories" value="${esc((s.categories || []).join(', '))}" /></label>
    </section>
  </div>
  <button class="btn" type="submit">บันทึกการตั้งค่า</button>
  </form>`;
  return adminLayout('ตั้งค่า', body, { flash });
}

module.exports = { login, orders, orderDetail, quotes, featuredList, featuredForm, settingsPage };
