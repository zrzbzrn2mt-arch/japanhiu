'use strict';
const db = require('./db');

// Defaults. Everything here can be edited in /admin/settings.
const DEFAULTS = {
  shop_name: 'JapanHiu',
  line_id: '@japanhiu',
  fee_percent: 10,
  fee_min_thb: 100,
  jp_shipping_jpy: 1500,
  rate_buffer_pct: 3,
  fallback_rate: 0.22, // THB per 1 JPY, used only when the live rate cannot be fetched
  default_weight_kg: 1,
  // JP -> TH shipping by weight. PLACEHOLDER numbers: set your real carrier prices in admin.
  shipping_tiers: [
    { max_kg: 0.5, thb: 350 },
    { max_kg: 1, thb: 500 },
    { max_kg: 2, thb: 800 },
    { max_kg: 5, thb: 1600 },
    { max_kg: 10, thb: 2900 },
  ],
  bank_name: '',
  bank_account_name: '',
  bank_account_no: '',
  promptpay: '',
  prohibited_keywords: ['食品', 'お菓子', '電池', 'バッテリー', 'リチウム', '香水', 'スプレー', '液体', 'ライター', '刃物', '医薬品', 'サプリ'],
  categories: ['ฟิกเกอร์', 'กันพลา', 'การ์ด', 'แบรนด์เนม', 'กล้อง', 'เกม'],
};

let cache = null;
let cacheAt = 0;

async function getAll() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const { rows } = await db.query('SELECT key, value FROM settings');
  const s = { ...DEFAULTS };
  for (const r of rows) s[r.key] = r.value;
  cache = s;
  cacheAt = Date.now();
  return s;
}

async function set(key, value) {
  await db.query(
    `INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
  cache = null;
}

module.exports = { DEFAULTS, getAll, set };
