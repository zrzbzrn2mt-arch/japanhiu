const { chromium } = require('playwright-core');
const OUT = '/workspace/japanhiu/screenshots/';
const B = 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--font-render-hinting=none'] });
  async function ready(p) { await p.waitForLoadState('networkidle'); await p.evaluate(() => { document.body.classList.add('capture-full'); return document.fonts.ready; }); await p.waitForTimeout(300); }
  async function shots(vp, scale, suffix) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, locale: 'th-TH' });
    const p = await ctx.newPage();
    const pub = [['home', '/'], ['product', '/p/1'], ['order', '/order/new?src=featured&id=1'], ['track', '/track?no=JH-261114-96CE&phone=0812345678'], ['terms', '/terms']];
    for (const [n, u] of pub) { await p.goto(B + u); await ready(p); await p.screenshot({ path: `${OUT}${n}_${suffix}.png`, fullPage: true }); }
    await p.goto(B + '/admin/login'); await p.fill('input[name=password]', 'devpass-123'); await p.click('button[type=submit]'); await ready(p);
    const adm = [['admin_orders', '/admin'], ['admin_order_detail', '/admin/orders/1'], ['admin_featured', '/admin/featured'], ['admin_settings', '/admin/settings']];
    for (const [n, u] of adm) { await p.goto(B + u); await ready(p); await p.screenshot({ path: `${OUT}${n}_${suffix}.png`, fullPage: true }); }
    await ctx.close();
  }
  await shots({ width: 390, height: 844 }, 2, 'mobile');
  await shots({ width: 1280, height: 800 }, 1, 'desktop');
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
