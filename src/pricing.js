'use strict';
const settings = require('./settings');

const RATE_URL = 'https://open.er-api.com/v6/latest/JPY';
const RATE_TTL_MS = 24 * 60 * 60 * 1000;
let inflight = null;

// Returns { raw, effective, source, fetchedAt }
async function getRate() {
  const s = await settings.getAll();
  const buffer = Number(s.rate_buffer_pct) || 0;
  const cached = s.rate_cache;
  const fresh = cached && cached.raw && Date.now() - new Date(cached.fetched_at).getTime() < RATE_TTL_MS;
  let raw, source, fetchedAt;
  if (fresh) {
    raw = cached.raw; source = 'open.er-api.com'; fetchedAt = cached.fetched_at;
  } else {
    try {
      inflight = inflight || fetchLive();
      const r = await inflight;
      await settings.set('rate_cache', r);
      raw = r.raw; source = 'open.er-api.com'; fetchedAt = r.fetched_at;
    } catch (e) {
      console.warn('[rate] live fetch failed:', e.message);
      if (cached && cached.raw) { raw = cached.raw; source = 'open.er-api.com (เก่า)'; fetchedAt = cached.fetched_at; }
      else { raw = Number(s.fallback_rate); source = 'fallback'; fetchedAt = null; }
    } finally { inflight = null; }
  }
  return { raw, effective: raw * (1 + buffer / 100), buffer, source, fetchedAt };
}

async function fetchLive() {
  const res = await fetch(RATE_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const thb = j && j.rates && j.rates.THB;
  if (j.result !== 'success' || !thb) throw new Error('bad payload');
  return { raw: thb, fetched_at: new Date().toISOString(), provider_updated: j.time_last_update_utc };
}

function tierFor(tiers, kg) {
  const sorted = [...tiers].sort((a, b) => a.max_kg - b.max_kg);
  return sorted.find((t) => kg <= Number(t.max_kg)) || null;
}

// Build a full quote. Every line is rounded up to whole baht.
async function quote({ priceJpy, weightKg, jpShippingJpy }) {
  const s = await settings.getAll();
  const rate = await getRate();
  const tiers = s.shipping_tiers || [];
  const kg = Number(weightKg) || Number(s.default_weight_kg) || 1;
  const jpShip = jpShippingJpy === 0 || jpShippingJpy ? Number(jpShippingJpy) : Number(s.jp_shipping_jpy);
  const itemThb = Math.ceil(priceJpy * rate.effective);
  const fee = Math.ceil(Math.max(itemThb * (Number(s.fee_percent) / 100), Number(s.fee_min_thb)));
  const jpShipThb = Math.ceil(jpShip * rate.effective);
  const tier = tierFor(tiers, kg);
  const intlThb = tier ? Math.ceil(Number(tier.thb)) : null; // null = over max tier, quote manually
  const total = itemThb + fee + jpShipThb + (intlThb || 0);
  return {
    price_jpy: priceJpy,
    rate: Number(rate.effective.toFixed(4)),
    rate_raw: rate.raw,
    rate_buffer_pct: rate.buffer,
    rate_source: rate.source,
    item_thb: itemThb,
    fee_percent: Number(s.fee_percent),
    fee_min_thb: Number(s.fee_min_thb),
    fee_thb: fee,
    jp_shipping_jpy: jpShip,
    jp_shipping_thb: jpShipThb,
    weight_kg: kg,
    intl_shipping_thb: intlThb,
    total_thb: total,
    tiers: [...tiers].sort((a, b) => a.max_kg - b.max_kg),
  };
}

module.exports = { getRate, quote, tierFor };
