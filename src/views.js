'use strict';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const thb = (n) => '฿' + n0(n);
const jpy = (n) => '¥' + n0(n);
const dt = (d, tz = 'Asia/Bangkok') => d ? new Date(d).toLocaleString('th-TH', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }) : '';

const STATUSES = ['รอชำระเงิน', 'ชำระแล้ว', 'ซื้อแล้ว', 'ถึงโกดังญี่ปุ่น', 'ส่งไปไทยแล้ว', 'ส่งถึงแล้ว', 'ยกเลิก'];

function lineUrl(id) {
  const s = String(id || '').trim();
  if (!s) return '#';
  if (/^https?:/.test(s)) return s;
  return s.startsWith('@') ? `https://line.me/R/ti/p/${encodeURIComponent(s)}` : `https://line.me/ti/p/~${encodeURIComponent(s)}`;
}

const LINE_SVG_SMALL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2C6.36 2.2 1.8 6.05 1.8 10.8c0 4.22 3.73 7.76 8.8 8.44.36.07.85.23.98.53.11.27.07.73.03 1.07l-.14 1.18c-.04.38.17.77.55.9.08.03.16.04.24.04.26 0 .52-.13.68-.36 1.97-2.73 10.56-6.22 10.56-11.8C23.5 6.05 18.64 2.2 12 2.2z"/></svg>';
const LINE_SVG_FAB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24.941.836.541 1.07-.4 5.64-3.318 7.688-5.684C22.96 15.166 24 12.859 24 10.314"/></svg>';
const SEARCH_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
const BACK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';

const CAT_ICONS = {
  'ฟิกเกอร์': '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.2" r="2.3"/><path d="M9 9.2h6c.6 0 1 .5 1 1.1L15.4 20h-6.8L8 10.3c0-.6.4-1.1 1-1.1z"/><path d="M9.2 10.2L6.8 16.5M14.8 10.2L17.2 16.5"/></svg>',
  'กันพลา': '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="12" rx="1.6"/><path d="M9 8V6.2h6V8"/><path d="M12 3.2v3"/><path d="M8.5 12.2h7M8.5 15.2h7"/></svg>',
  'การ์ด': '<svg viewBox="0 0 24 24"><rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5"/></svg>',
  'แบรนด์เนม': '<svg viewBox="0 0 24 24"><path d="M6.5 8.5h11l-1 11.5h-9L6.5 8.5z"/><path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7"/></svg>',
  'กล้อง': '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="12" cy="14" r="3.6"/><circle cx="12" cy="14" r="1.6"/><path d="M8 8l1.6-3h4.8L16 8"/></svg>',
  'เกม': '<svg viewBox="0 0 24 24"><path d="M6.4 8.8h11.2A3.9 3.9 0 0 1 21 13.8a3.6 3.6 0 0 1-3.2 3.4H6.4A3.9 3.9 0 0 1 3 13.8a3.6 3.6 0 0 1 3.4-5z"/><path d="M8.2 12.2v4M6.2 14.2h4"/><circle cx="15.1" cy="12.6" r="1" style="fill:#D7263D;stroke:none"/><circle cx="17.2" cy="14.5" r="1" style="fill:#D7263D;stroke:none"/></svg>',
};
const DEFAULT_ICON = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>';

function layout(ctx, { title, body, bodyClass = '', buyBar = '', noindex = false }) {
  const s = ctx.s; const rate = ctx.rate;
  const shop = esc(s.shop_name || 'JapanHiu');
  const rateTxt = rate ? `1 เยน ≈ ${rate.effective.toFixed(3)} บาท` : '';
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title ? esc(title) + ' — ' : ''}${shop} ฝากซื้อจากญี่ปุ่น</title>
  ${noindex ? '<meta name="robots" content="noindex" />' : ''}
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/app.css" />
</head>
<body class="${esc(bodyClass)}">
  ${rate ? `<div class="topbar"><span class="topbar-full">อัตราแลกเปลี่ยนวันนี้ <strong>${rateTxt}</strong> · รวมเผื่อความผันผวน ${esc(rate.buffer)}%</span><span class="topbar-short">วันนี้ <strong>${rateTxt}</strong></span></div>` : ''}
  <header class="header">
    <div class="header-inner">
      <a class="logo" href="/">
        <span class="mark">JH</span>
        <span class="logo-text"><span class="name">${shop}</span><span class="tag">ฝากซื้อจากญี่ปุ่น</span></span>
      </a>
      <nav class="nav">
        <a href="/#featured">สินค้าแนะนำ</a>
        <a href="/#how">วิธีสั่งซื้อ</a>
        <a href="/track">ติดตามพัสดุ</a>
        <a href="/terms">เงื่อนไข</a>
      </nav>
      <a class="header-line" href="${esc(lineUrl(s.line_id))}" target="_blank" rel="noopener" aria-label="ติดต่อทาง LINE">${LINE_SVG_SMALL} ทัก LINE</a>
    </div>
  </header>
  ${body}
  ${footer(ctx)}
  ${buyBar}
  <a class="line-fab" href="${esc(lineUrl(s.line_id))}" target="_blank" rel="noopener" title="ทัก LINE" aria-label="ทัก LINE">${LINE_SVG_FAB}</a>
</body>
</html>`;
}

function footer(ctx) {
  const s = ctx.s;
  return `<footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="name">${esc(s.shop_name)}</div>
          <div class="tag">ฝากซื้อจากญี่ปุ่น · ส่งตรงถึงบ้านคุณ</div>
          <p>วางลิงก์ Mercari หรือเลือกสินค้าที่เราคัดมา แล้วให้เราซื้อ ตรวจสภาพ และจัดส่งให้</p>
        </div>
        <div>
          <strong style="color:#fff;display:block;margin-bottom:8px">ช่วยเหลือ</strong>
          <a href="/#how">วิธีสั่งซื้อ</a><br />
          <a href="/track">ติดตามคำสั่งซื้อ</a><br />
          <a href="/terms">เงื่อนไขการให้บริการ</a>
        </div>
        <div>
          <strong style="color:#fff;display:block;margin-bottom:8px">ติดต่อ</strong>
          LINE: <a href="${esc(lineUrl(s.line_id))}" target="_blank" rel="noopener">${esc(s.line_id)}</a><br />
          ส่งจากญี่ปุ่นถึงที่อยู่ในไทย
        </div>
      </div>
      <div class="legal">
        ราคาในเว็บเป็นราคาประมาณการ คำนวณจากอัตราแลกเปลี่ยนรายวันบวกเผื่อความผันผวน ยอดจริงยืนยันก่อนชำระเงิน<br />
        ${esc(s.shop_name)} เป็นบริการฝากซื้ออิสระ ไม่ได้เป็นตัวแทนหรือพันธมิตรของ Mercari รูปและข้อมูลสินค้าเป็นของผู้ขายบน Mercari<br />
        © ${new Date().getFullYear()} ${esc(s.shop_name)}
      </div>
    </div>
  </footer>`;
}

function searchForm(q = '') {
  return `<form class="search" action="/go" method="get">
        <input type="text" name="q" value="${esc(q)}" placeholder="วางลิงก์ Mercari หรือพิมพ์ชื่อสินค้า" aria-label="วางลิงก์ Mercari หรือพิมพ์ชื่อสินค้า" required />
        <button type="submit">${SEARCH_SVG} ดูราคา</button>
      </form>`;
}

function card(it, cls = 'card') {
  const sold = it.status === 'sold';
  return `<a class="${cls}${sold ? ' is-sold' : ''}" href="/p/${it.id}">
      <div class="thumb">
        ${it.image_url ? `<img src="${esc(it.image_url)}" alt="${esc(it.title_th)}" loading="lazy" referrerpolicy="no-referrer" />` : '<div class="noimg">ไม่มีรูป</div>'}
        <span class="badge">${sold ? 'ขายแล้ว' : 'เหลือ 1 ชิ้น'}</span>
      </div>
      <div class="card-body">
        ${it.category ? `<div class="card-cat">${esc(it.category)}</div>` : ''}
        <div class="card-title">${esc(it.title_th)}</div>
        <div class="price-thb">${thb(it.total_thb)}</div>
        <div class="price-jpy">${jpy(it.price_jpy)} · ราคารวมโดยประมาณ</div>
      </div>
    </a>`;
}

function heroCard(it) {
  return `<a class="hero-card" href="/p/${it.id}">
      <div class="thumb">
        ${it.image_url ? `<img src="${esc(it.image_url)}" alt="${esc(it.title_th)}" referrerpolicy="no-referrer" />` : '<div class="noimg">ไม่มีรูป</div>'}
        <span class="badge">เหลือ 1 ชิ้น</span>
      </div>
      <div class="card-body">
        <div class="card-cat">สินค้าแนะนำวันนี้${it.category ? ' · ' + esc(it.category) : ''}</div>
        <div class="card-title">${esc(it.title_th)}</div>
        <div class="price-thb">${thb(it.total_thb)}</div>
        <div class="price-jpy">${jpy(it.price_jpy)}</div>
      </div>
    </a>`;
}

function catChips(cats, active) {
  return `<div class="cats">
    ${cats.map((c) => `<a class="cat${c === active ? ' active' : ''}" href="/?cat=${encodeURIComponent(c)}#featured"><span class="ico">${CAT_ICONS[c] || DEFAULT_ICON}</span>${esc(c)}</a>`).join('')}
  </div>`;
}

const STEPS = `<section class="section steps-sec" id="how">
    <div class="wrap">
      <div class="section-head"><h2>วิธีสั่งซื้อ 4 ขั้น</h2></div>
      <div class="steps">
        <div class="step"><div class="num">01</div><div><h3>วางลิงก์หรือเลือกสินค้า</h3><p>ส่งลิงก์ Mercari มา หรือเลือกจากสินค้าแนะนำบนเว็บเรา</p></div></div>
        <div class="step"><div class="num">02</div><div><h3>โอนเงินตามใบเสนอราคา</h3><p>เห็นราคารวมเป็นบาทชัดเจน แยกค่าสินค้า ค่าบริการ และค่าส่ง</p></div></div>
        <div class="step"><div class="num">03</div><div><h3>เราซื้อและตรวจของให้</h3><p>กดซื้อที่ญี่ปุ่น ตรวจสภาพ แล้วถ่ายรูปส่งให้ดูก่อนจัดส่ง</p></div></div>
        <div class="step"><div class="num">04</div><div><h3>ส่งถึงบ้านคุณ</h3><p>ส่งจากญี่ปุ่นถึงที่อยู่ในไทย ติดตามสถานะได้ด้วยเลขคำสั่งซื้อ</p></div></div>
      </div>
    </div>
  </section>`;

function home(ctx, { items, hero, cats, cat, q, searchMode }) {
  const heading = searchMode ? `ผลการค้นหา “${esc(q)}”` : cat ? `หมวด ${esc(cat)}` : 'สินค้าแนะนำ';
  const empty = searchMode
    ? `<div class="empty"><p>ยังไม่มีสินค้าแนะนำที่ตรงกับ “${esc(q)}”</p><p>เปิดหาสินค้าใน <a href="https://jp.mercari.com/search?keyword=${encodeURIComponent(q)}" target="_blank" rel="noopener">Mercari</a> แล้วคัดลอกลิงก์มาวางในช่องด้านบน เราจะคำนวณราคาให้ทันที หรือ <a href="${esc(lineUrl(ctx.s.line_id))}" target="_blank" rel="noopener">ทัก LINE</a> ให้ช่วยหา</p></div>`
    : `<div class="empty"><p>${cat ? 'ยังไม่มีสินค้าในหมวดนี้' : 'ยังไม่มีสินค้าแนะนำ'}</p><p>วางลิงก์สินค้าจาก Mercari ในช่องด้านบนเพื่อดูราคาได้เลย</p></div>`;
  const body = `
  <section class="hero">
    <div class="hero-pattern" aria-hidden="true"></div>
    <div class="wrap">
    <div class="hero-grid">
      <div class="hero-copy">
      <div class="kicker"><i></i> รับหิ้วของจาก Mercari ญี่ปุ่น</div>
      <h1>ของจากญี่ปุ่น<br />ส่งถึงบ้านคุณ <em>ง่ายๆ</em></h1>
      <p class="hero-lead">วางลิงก์ Mercari หรือพิมพ์ชื่อสินค้า แล้วดูราคารวมเป็นบาทได้ทันที เราซื้อให้ที่ญี่ปุ่น ตรวจสภาพ แล้วส่งถึงบ้าน</p>
      ${searchForm(q)}
      <div class="trust">
        <span>${CHECK_SVG} ไม่ต้องสมัครสมาชิกก่อนสั่ง</span>
        <span>${CHECK_SVG} ตรวจสภาพก่อนส่ง</span>
        <span>${CHECK_SVG} คืนส่วนต่างค่าส่ง</span>
      </div>
      </div>
      ${hero ? heroCard(hero) : ''}
    </div>
    </div>
  </section>
  <section class="section cats-sec">
    <div class="wrap">
      <div class="section-head"><h2>หมวดยอดนิยม</h2></div>
      ${catChips(cats, cat)}
    </div>
  </section>
  <section class="section" id="featured">
    <div class="wrap">
      <div class="section-head">
        <div><h2>${heading}</h2><p>คัดมาให้แล้ว · ของมือสองมีชิ้นเดียว</p></div>
        ${cat || searchMode ? '<a class="more" href="/#featured">ดูทั้งหมด</a>' : ''}
      </div>
      ${items.length ? `<div class="grid">${items.map((i) => card(i)).join('')}</div>` : empty}
    </div>
  </section>
  ${STEPS}`;
  return layout(ctx, { title: searchMode ? q : '', body });
}

function breakdown(q) {
  return `<div class="breakdown">
    <h2>สรุปราคาโดยประมาณ</h2>
    <div class="rows">
      <div class="row"><div class="lbl">ค่าสินค้า<small>${jpy(q.price_jpy)} × ${q.rate}</small></div><div class="amt">${thb(q.item_thb)}</div></div>
      <div class="row"><div class="lbl">ค่าบริการ ${q.fee_percent}%<small>ขั้นต่ำ ${thb(q.fee_min_thb)}</small></div><div class="amt">${thb(q.fee_thb)}</div></div>
      <div class="row"><div class="lbl">ค่าส่งในญี่ปุ่น<small>ประมาณการ ${jpy(q.jp_shipping_jpy)} · ส่วนต่างคืนให้</small></div><div class="amt">${thb(q.jp_shipping_thb)}</div></div>
      <div class="row"><div class="lbl">ค่าส่งญี่ปุ่น → ไทย<small>
        <label class="wsel">น้ำหนักประมาณ
          <select id="weightSel">${q.tiers.map((t) => `<option value="${t.max_kg}" data-thb="${t.thb}" ${Number(t.max_kg) === Number(PRICE_TIER(q)) ? 'selected' : ''}>ไม่เกิน ${t.max_kg} กก.</option>`).join('')}</select>
        </label></small></div><div class="amt" id="intlAmt">${q.intl_shipping_thb == null ? 'แจ้งภายหลัง' : thb(q.intl_shipping_thb)}</div></div>
    </div>
    <div class="row total"><div class="lbl">รวม</div><div class="amt" id="totalAmt">${thb(q.total_thb)}</div></div>
  </div>`;
}
function PRICE_TIER(q) {
  const t = q.tiers.find((x) => q.weight_kg <= Number(x.max_kg));
  return t ? t.max_kg : null;
}

function product(ctx, { item, q, orderBase, warnings = [], sourceNote }) {
  const sold = item.sold;
  const body = `
  <div class="wrap">
    <a class="back" href="/">${BACK_SVG} กลับหน้าแรก</a>
    <div class="product-layout">
      <div class="gallery">
        <div class="gallery-main">${item.image_url ? `<img id="mainPhoto" src="${esc(item.image_url)}" alt="${esc(item.title_th || item.title_jp)}" referrerpolicy="no-referrer" />` : '<div class="noimg">ไม่มีรูป</div>'}</div>
      </div>
      <div class="product">
        ${item.condition_th ? `<span class="condition">${esc(item.condition_th)}</span>` : ''}
        ${sold ? '<span class="condition sold">ขายแล้ว</span>' : ''}
        <h1>${esc(item.title_th || item.title_jp)}</h1>
        ${item.title_th && item.title_jp && item.title_th !== item.title_jp ? `<details class="jp-details"><summary>ดูชื่อต้นฉบับภาษาญี่ปุ่น</summary><div class="jp-original show">${esc(item.title_jp)}</div></details>` : ''}
        ${warnings.map((w) => `<div class="alert warn">${w}</div>`).join('')}
        ${breakdown(q)}
        <p class="note">
          อัตรา ${q.rate} บาท/เยน (${esc(q.rate_source)} + เผื่อ ${q.rate_buffer_pct}%) หากค่าส่งจริงต่ำกว่าที่ประมาณไว้ จะคืนส่วนต่างให้
          สินค้ามือสองมีชิ้นเดียว เราตรวจสต็อกอีกครั้งก่อนยืนยันคำสั่งซื้อ
          ${sourceNote ? '<br />' + sourceNote : ''}
          <br /><a href="${esc(item.mercari_url)}" target="_blank" rel="noopener">ดูหน้าสินค้าต้นฉบับบน Mercari ↗</a>
        </p>
      </div>
    </div>
  </div>
  <script>
    (function(){
      var base = ${JSON.stringify({ item: q.item_thb, fee: q.fee_thb, jp: q.jp_shipping_thb })};
      var sel = document.getElementById('weightSel');
      var link = document.getElementById('orderLink');
      function fmt(n){ return '฿' + n.toLocaleString('en-US'); }
      function upd(){
        var o = sel.options[sel.selectedIndex]; var intl = Number(o.dataset.thb);
        var total = base.item + base.fee + base.jp + intl;
        document.getElementById('intlAmt').textContent = fmt(intl);
        document.getElementById('totalAmt').textContent = fmt(total);
        var bt = document.getElementById('barTotal'); if (bt) bt.textContent = fmt(total);
        if (link) { var u = new URL(link.href); u.searchParams.set('w', sel.value); link.href = u.toString(); }
      }
      if (sel) { sel.addEventListener('change', upd); upd(); }
    })();
  </script>`;
  const buyBar = `<div class="buy-bar">
    <div class="sum"><span>ยอดรวมโดยประมาณ</span><strong id="barTotal">${thb(q.total_thb)}</strong></div>
    ${sold ? '<button type="button" disabled>ขายแล้ว</button>' : `<a class="btn-buy" id="orderLink" href="${esc(orderBase)}">สั่งซื้อเลย</a>`}
  </div>`;
  return layout(ctx, { title: item.title_th || item.title_jp, body, bodyClass: 'product-page', buyBar });
}

const REASONS = {
  not_found: 'ไม่พบสินค้านี้บน Mercari อาจถูกลบหรือปิดการขายไปแล้ว',
  blocked: 'ตอนนี้ระบบดึงข้อมูลจาก Mercari ไม่ได้ชั่วคราว',
  network: 'เชื่อมต่อ Mercari ไม่สำเร็จ',
  http: 'Mercari ตอบกลับผิดปกติ',
  parse: 'อ่านราคาหรือชื่อสินค้าจากหน้านี้ไม่ได้',
  bad_id: 'ลิงก์นี้ไม่ใช่ลิงก์สินค้า Mercari ที่ระบบรองรับ',
  unsupported: 'ระบบยังคำนวณราคาอัตโนมัติให้ลิงก์แบบนี้ไม่ได้ (เช่น Mercari Shops หรือลิงก์ย่อ)',
};

function manualQuote(ctx, { url, reason, done, error }) {
  const body = `<div class="wrap narrow">
    <a class="back" href="/">${BACK_SVG} กลับหน้าแรก</a>
    ${done ? `<div class="panel"><h1>ส่งคำขอแล้ว</h1><p>เราจะตรวจสอบสินค้าและแจ้งราคาให้ทาง LINE หรือโทรศัพท์โดยเร็ว</p><p><a class="btn" href="${esc(lineUrl(ctx.s.line_id))}" target="_blank" rel="noopener">ทัก LINE ${esc(ctx.s.line_id)}</a></p></div>` : `
    <div class="panel">
      <h1>ขอใบเสนอราคา</h1>
      <div class="alert warn">${esc(REASONS[reason] || 'ระบบคำนวณราคาอัตโนมัติไม่ได้')} ส่งคำขอไว้ได้เลย เราจะเช็กให้เองและแจ้งราคากลับ</div>
      ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
      <form method="post" action="/quote-request" class="form">
        <label>ลิงก์สินค้า<input name="url" value="${esc(url)}" required /></label>
        <label>ชื่อ<input name="customer_name" required /></label>
        <label>เบอร์โทร<input name="phone" inputmode="tel" required /></label>
        <label>LINE ID<input name="line_id" /></label>
        <label>รายละเอียดเพิ่มเติม<textarea name="note" rows="3" placeholder="เช่น สี ขนาด จำนวน"></textarea></label>
        <input type="hidden" name="reason" value="${esc(reason)}" />
        <button class="btn" type="submit">ส่งคำขอ</button>
      </form>
    </div>`}
  </div>`;
  return layout(ctx, { title: 'ขอใบเสนอราคา', body });
}

function orderForm(ctx, { item, q, src, id, w, values = {}, error }) {
  const s = ctx.s;
  const v = (k) => esc(values[k] || '');
  const body = `<div class="wrap narrow">
    <a class="back" href="${src === 'featured' ? '/p/' + esc(id) : '/item/' + esc(id)}">${BACK_SVG} กลับไปหน้าสินค้า</a>
    <div class="panel">
      <h1>สั่งซื้อ</h1>
      <div class="mini-item">
        ${item.image_url ? `<img src="${esc(item.image_url)}" alt="" referrerpolicy="no-referrer" />` : ''}
        <div><div class="t">${esc(item.title_th || item.title_jp)}</div><div class="p">${jpy(item.price_jpy)} · รวมโดยประมาณ <strong>${thb(q.total_thb)}</strong></div></div>
      </div>
      ${error ? `<div class="alert err">${error}</div>` : ''}
      <form method="post" action="/order" enctype="multipart/form-data" class="form">
        <input type="hidden" name="src" value="${esc(src)}" />
        <input type="hidden" name="id" value="${esc(id)}" />
        <input type="hidden" name="w" value="${esc(w)}" />
        <label>ชื่อ-นามสกุล<input name="customer_name" value="${v('customer_name')}" required autocomplete="name" /></label>
        <label>เบอร์โทร<input name="phone" value="${v('phone')}" inputmode="tel" required autocomplete="tel" /></label>
        <label>LINE ID<input name="line_id" value="${v('line_id')}" /></label>
        <label>ที่อยู่จัดส่งในไทย<textarea name="address" rows="4" required placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์">${v('address')}</textarea></label>
        <label>หมายเหตุ<textarea name="note" rows="2">${v('note')}</textarea></label>
        <div class="bank">
          <h3>ชำระเงินโดยโอนเข้าบัญชี</h3>
          ${s.bank_account_no || s.promptpay ? `
          ${s.bank_name ? `<div>ธนาคาร: <strong>${esc(s.bank_name)}</strong></div>` : ''}
          ${s.bank_account_name ? `<div>ชื่อบัญชี: <strong>${esc(s.bank_account_name)}</strong></div>` : ''}
          ${s.bank_account_no ? `<div>เลขบัญชี: <strong>${esc(s.bank_account_no)}</strong></div>` : ''}
          ${s.promptpay ? `<div>พร้อมเพย์: <strong>${esc(s.promptpay)}</strong></div>` : ''}` : '<div>ร้านจะแจ้งเลขบัญชีทาง LINE หลังยืนยันสต็อก</div>'}
          <div class="small">ยอดโอน <strong>${thb(q.total_thb)}</strong> (ยอดประมาณการ หากค่าส่งจริงต่ำกว่าจะคืนส่วนต่าง) แนะนำให้รอร้านยืนยันสต็อกก่อนโอน หรือแนบสลิปภายหลังได้ที่หน้าติดตามคำสั่งซื้อ</div>
        </div>
        <label>แนบสลิป (ไม่บังคับ, รูปภาพหรือ PDF ไม่เกิน 5 MB)<input type="file" name="slip" accept="image/*,application/pdf" /></label>
        <label class="check"><input type="checkbox" name="agree" value="1" required /> ฉันอ่านและยอมรับ <a href="/terms" target="_blank">เงื่อนไขการให้บริการ</a></label>
        <button class="btn" type="submit">ยืนยันสั่งซื้อ</button>
      </form>
    </div>
  </div>`;
  return layout(ctx, { title: 'สั่งซื้อ', body, noindex: true });
}

function orderDone(ctx, { order }) {
  const body = `<div class="wrap narrow"><div class="panel">
    <h1>รับคำสั่งซื้อแล้ว</h1>
    <p>เลขคำสั่งซื้อของคุณ</p>
    <div class="order-no">${esc(order.order_no)}</div>
    <p>ยอดรวมโดยประมาณ <strong>${thb(order.total_thb)}</strong> · สถานะ <strong>${esc(order.status)}</strong></p>
    <p>เก็บเลขนี้ไว้ ใช้คู่กับเบอร์โทรเพื่อติดตามสถานะ ร้านจะตรวจสต็อกบน Mercari และติดต่อกลับทาง LINE หรือโทรศัพท์</p>
    <p class="actions"><a class="btn" href="/track?no=${encodeURIComponent(order.order_no)}">ติดตามคำสั่งซื้อ</a> <a class="btn ghost" href="${esc(lineUrl(ctx.s.line_id))}" target="_blank" rel="noopener">ทัก LINE แจ้งเลขคำสั่งซื้อ</a></p>
  </div></div>`;
  return layout(ctx, { title: 'รับคำสั่งซื้อแล้ว', body, noindex: true });
}

function timeline(status) {
  const flow = STATUSES.filter((x) => x !== 'ยกเลิก');
  const idx = flow.indexOf(status);
  if (status === 'ยกเลิก') return '<div class="alert err">คำสั่งซื้อนี้ถูกยกเลิก</div>';
  return `<ol class="timeline">${flow.map((st, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${esc(st)}</li>`).join('')}</ol>`;
}

function track(ctx, { order, events = [], error, no = '', phone = '', uploaded }) {
  const body = `<div class="wrap narrow"><div class="panel">
    <h1>ติดตามคำสั่งซื้อ</h1>
    <form method="get" action="/track" class="form inline">
      <label>เลขคำสั่งซื้อ<input name="no" value="${esc(no)}" placeholder="JH-XXXXXX-XXXX" required /></label>
      <label>เบอร์โทรที่ใช้สั่ง<input name="phone" value="${esc(phone)}" inputmode="tel" required /></label>
      <button class="btn" type="submit">ค้นหา</button>
    </form>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    ${uploaded ? '<div class="alert ok">ได้รับสลิปแล้ว ร้านจะตรวจสอบและอัปเดตสถานะ</div>' : ''}
    ${order ? `
      <div class="mini-item">
        ${order.image_url ? `<img src="${esc(order.image_url)}" alt="" referrerpolicy="no-referrer" />` : ''}
        <div><div class="t">${esc(order.title_th || order.title_jp)}</div><div class="p">${esc(order.order_no)} · ${thb(order.total_thb)}</div></div>
      </div>
      ${timeline(order.status)}
      ${order.tracking_no ? `<p>เลขพัสดุ: <strong>${esc(order.tracking_no)}</strong></p>` : ''}
      ${events.length ? `<ul class="events">${events.map((e) => `<li><span>${dt(e.created_at)}</span> ${esc(e.status)}${e.note ? ' · ' + esc(e.note) : ''}</li>`).join('')}</ul>` : ''}
      ${order.status === 'รอชำระเงิน' ? `
      <form method="post" action="/track/slip" enctype="multipart/form-data" class="form">
        <input type="hidden" name="no" value="${esc(no)}" /><input type="hidden" name="phone" value="${esc(phone)}" />
        <label>แนบสลิปโอนเงิน<input type="file" name="slip" accept="image/*,application/pdf" required /></label>
        <button class="btn" type="submit">ส่งสลิป</button>
      </form>` : ''}` : ''}
  </div></div>`;
  return layout(ctx, { title: 'ติดตามคำสั่งซื้อ', body, noindex: true });
}

function terms(ctx) {
  const s = ctx.s;
  const body = `<div class="wrap narrow"><div class="panel prose">
    <h1>เงื่อนไขการให้บริการ</h1>
    <h2>1. บริการของเรา</h2>
    <p>${esc(s.shop_name)} เป็นบริการฝากซื้อสินค้าจากเว็บไซต์ Mercari ประเทศญี่ปุ่น เราซื้อสินค้าในนามของลูกค้า รับสินค้าที่ญี่ปุ่น ตรวจสภาพภายนอก และจัดส่งถึงที่อยู่ในประเทศไทย เราไม่ได้เป็นผู้ขายสินค้าและไม่ได้เป็นตัวแทนของ Mercari</p>
    <h2>2. ราคาและการชำระเงิน</h2>
    <ul>
      <li>ราคาบนเว็บเป็นราคาประมาณการ คำนวณจากอัตราแลกเปลี่ยนรายวันบวกเผื่อความผันผวน ${esc(s.rate_buffer_pct)}%</li>
      <li>ค่าบริการ ${esc(s.fee_percent)}% ของค่าสินค้า ขั้นต่ำ ${thb(s.fee_min_thb)} ต่อรายการ</li>
      <li>ค่าส่งภายในญี่ปุ่นประมาณการไว้ที่ ${jpy(s.jp_shipping_jpy)} หากค่าส่งจริงต่ำกว่า เราคืนส่วนต่างให้ หากสูงกว่าจะแจ้งก่อนดำเนินการ</li>
      <li>ค่าส่งญี่ปุ่น–ไทยคิดตามน้ำหนักจริงหลังแพ็ก หากต่างจากที่ประมาณไว้ จะแจ้งและเก็บหรือคืนส่วนต่าง</li>
      <li>เราซื้อสินค้าหลังได้รับชำระเงินครบเท่านั้น</li>
    </ul>
    <h2>3. สต็อกและการยกเลิก</h2>
    <ul>
      <li>สินค้ามือสองบน Mercari มีชิ้นเดียว เราตรวจสอบสต็อกอีกครั้งก่อนยืนยันคำสั่งซื้อ</li>
      <li>หากสินค้าถูกขายไปก่อนที่เราจะซื้อได้ หรือผู้ขายยกเลิก เราคืนเงินเต็มจำนวน</li>
      <li>เมื่อเราซื้อสินค้าแล้ว ลูกค้ายกเลิกไม่ได้</li>
    </ul>
    <h2>4. การคืนสินค้า</h2>
    <p>ไม่รับคืนหรือเปลี่ยนสินค้าทุกกรณี ยกเว้นสินค้าเสียหายร้ายแรงระหว่างขนส่ง โดยลูกค้าต้องถ่ายวิดีโอขณะแกะพัสดุ และแจ้งภายใน 48 ชั่วโมงหลังได้รับ เราจะช่วยเคลมกับผู้ขายหรือบริษัทขนส่งตามเงื่อนไขของแต่ละฝ่าย สินค้ามือสองอาจมีร่องรอยการใช้งานตามที่ผู้ขายระบุ ซึ่งไม่ถือเป็นความเสียหาย</p>
    <h2>5. สินค้าต้องห้าม</h2>
    <p>เราไม่รับฝากซื้อสินค้าที่ส่งทางไปรษณีย์ระหว่างประเทศไม่ได้หรือผิดกฎหมายไทย/ญี่ปุ่น เช่น อาหารและเครื่องดื่ม ของเหลว น้ำหอม สเปรย์ แบตเตอรี่ลิเธียมแยกชิ้น ไฟแช็ก อาวุธและของมีคม ยาและอาหารเสริม พืช สัตว์ สินค้าละเมิดลิขสิทธิ์ หากตรวจพบหลังสั่ง เราจะยกเลิกและคืนเงินก่อนซื้อ</p>
    <h2>6. ภาษีและศุลกากร</h2>
    <p>ภาษีนำเข้าหรือค่าธรรมเนียมศุลกากรที่เรียกเก็บในประเทศไทย (ถ้ามี) ลูกค้าเป็นผู้รับผิดชอบ</p>
    <h2>7. ติดต่อ</h2>
    <p>LINE <a href="${esc(lineUrl(s.line_id))}" target="_blank" rel="noopener">${esc(s.line_id)}</a></p>
  </div></div>`;
  return layout(ctx, { title: 'เงื่อนไขการให้บริการ', body });
}

function errorPage(ctx, { code = 404, msg = 'ไม่พบหน้านี้' }) {
  return layout(ctx, { title: String(code), body: `<div class="wrap narrow"><div class="panel"><h1>${esc(msg)}</h1><p><a class="btn" href="/">กลับหน้าแรก</a></p></div></div>` });
}

module.exports = { esc, thb, jpy, dt, n0, STATUSES, lineUrl, layout, home, product, manualQuote, orderForm, orderDone, track, terms, errorPage, REASONS, BACK_SVG };
