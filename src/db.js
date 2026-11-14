'use strict';
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (Postgres connection string).');
  process.exit(1);
}

const needSsl = /sslmode=require|neon\.tech|render\.com/.test(process.env.DATABASE_URL) && !/sslmode=disable/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS featured_items (
     id SERIAL PRIMARY KEY,
     mercari_id TEXT,
     mercari_url TEXT NOT NULL,
     title_jp TEXT,
     title_th TEXT NOT NULL,
     condition_th TEXT,
     category TEXT,
     price_jpy INTEGER NOT NULL,
     image_url TEXT,
     weight_kg NUMERIC(6,2),
     jp_shipping_jpy INTEGER,
     status TEXT NOT NULL DEFAULT 'draft',  -- draft | published | sold
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id SERIAL PRIMARY KEY,
     order_no TEXT UNIQUE NOT NULL,
     status TEXT NOT NULL DEFAULT 'รอชำระเงิน',
     customer_name TEXT NOT NULL,
     phone TEXT NOT NULL,
     phone_digits TEXT NOT NULL,
     line_id TEXT,
     address TEXT NOT NULL,
     note TEXT,
     featured_item_id INTEGER REFERENCES featured_items(id) ON DELETE SET NULL,
     mercari_id TEXT,
     mercari_url TEXT NOT NULL,
     title_jp TEXT,
     title_th TEXT,
     image_url TEXT,
     price_jpy INTEGER NOT NULL,
     quote JSONB NOT NULL,
     total_thb INTEGER NOT NULL,
     admin_note TEXT,
     tracking_no TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS order_slips (
     id SERIAL PRIMARY KEY,
     order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     filename TEXT,
     mime TEXT NOT NULL,
     size INTEGER NOT NULL,
     data BYTEA NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS order_events (
     id SERIAL PRIMARY KEY,
     order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     status TEXT NOT NULL,
     note TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS quote_requests (
     id SERIAL PRIMARY KEY,
     url TEXT NOT NULL,
     customer_name TEXT NOT NULL,
     phone TEXT NOT NULL,
     line_id TEXT,
     note TEXT,
     reason TEXT,
     handled BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS featured_status_idx ON featured_items(status, created_at DESC)`,
];

async function migrate() {
  for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = { pool, query: (t, p) => pool.query(t, p), migrate };
