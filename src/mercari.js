'use strict';
// Polite, single-IP fetch of a public Mercari item page.
// - Plain HTTPS GET of https://jp.mercari.com/item/<id> (allowed by robots.txt)
// - Honest User-Agent, no proxies, no IP rotation, no stealth/headless tricks
// - Never calls Mercari's /v1/ or /v2/ APIs
// - 10-minute in-memory cache, max 1 request in flight per item, min gap between requests
const fs = require('fs');
const path = require('path');

const UA = process.env.FETCH_USER_AGENT ||
  'JapanHiuBot/0.1 (+proxy-buying shop; fetches single item pages on customer request)';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 2000; // at most one Mercari request every 2 s from this server
const cache = new Map(); // id -> { at, data }
const inflight = new Map();
let lastRequestAt = 0;

const ID_RE = /^m\d{8,14}$/;

// Accepts a full URL or a bare id. Returns 'm123..' or null.
function parseItemId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (ID_RE.test(s)) return s;
  let u;
  try { u = new URL(s.startsWith('http') ? s : 'https://' + s); } catch { return null; }
  if (!/(^|\.)mercari\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/item\/(m\d{8,14})/);
  return m ? m[1] : null;
}

function isMercariUrl(input) {
  try {
    const s = String(input).trim();
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    return /(^|\.)mercari\.(com|jp)$/.test(u.hostname) || /merc\.li$/.test(u.hostname);
  } catch { return false; }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function meta(html, key) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[:.]/g, '\\$&')}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key.replace(/[:.]/g, '\\$&')}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() : null;
}

function parseItemHtml(html) {
  let title = meta(html, 'og:title') || meta(html, 'twitter:title');
  if (title) title = title.replace(/\s*[-|]\s*メルカリ.*$/, '').replace(/\s*by メルカリ$/, '').trim();
  const priceStr = meta(html, 'product:price:amount');
  const price = priceStr ? Number(String(priceStr).replace(/[^\d.]/g, '')) : null;
  const currency = meta(html, 'product:price:currency');
  const image = meta(html, 'og:image');
  const description = meta(html, 'og:description') || meta(html, 'description');
  const availability = meta(html, 'product:availability') || null;
  return { title, price_jpy: Number.isFinite(price) && price > 0 ? Math.round(price) : null, currency, image, description, availability };
}

async function politeGap() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function doFetch(id) {
  await politeGap();
  const url = `https://jp.mercari.com/item/${id}`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    return { ok: false, id, url, reason: 'network', detail: e.message };
  }
  const html = await res.text();
  console.log(`[mercari] GET ${url} -> ${res.status} (${html.length} bytes, ${Date.now() - started} ms)`);
  if (process.env.MERCARI_DEBUG_DIR) {
    try { fs.writeFileSync(path.join(process.env.MERCARI_DEBUG_DIR, `${id}.html`), html); } catch {}
  }
  if (res.status === 404) return { ok: false, id, url, reason: 'not_found', status: 404 };
  if (res.status === 403 || res.status === 429 || res.status === 503 || /cf-chl|challenge-platform/i.test(html.slice(0, 5000))) {
    return { ok: false, id, url, reason: 'blocked', status: res.status };
  }
  if (!res.ok) return { ok: false, id, url, reason: 'http', status: res.status };
  const p = parseItemHtml(html);
  if (!p.title || !p.price_jpy) return { ok: false, id, url, reason: 'parse', status: res.status, partial: p };
  const soldOut = (p.availability && /out ?of ?stock|sold/i.test(p.availability)) || false;
  return { ok: true, id, url, ...p, sold_out: soldOut, fetched_at: new Date().toISOString() };
}

// opts.maxAgeMs: accept cache younger than this (default 10 min). Use small value to force re-check.
async function getItem(id, opts = {}) {
  if (!ID_RE.test(id)) return { ok: false, id, reason: 'bad_id' };
  const maxAge = opts.maxAgeMs ?? CACHE_TTL_MS;
  const c = cache.get(id);
  if (c && Date.now() - c.at < maxAge) return { ...c.data, cached: true };
  if (inflight.has(id)) return inflight.get(id);
  const p = doFetch(id).then((data) => {
    // cache successes for 10 min, failures for 2 min to avoid hammering
    cache.set(id, { at: data.ok ? Date.now() : Date.now() - CACHE_TTL_MS + 2 * 60 * 1000, data });
    return data;
  }).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

module.exports = { parseItemId, isMercariUrl, getItem, parseItemHtml };
