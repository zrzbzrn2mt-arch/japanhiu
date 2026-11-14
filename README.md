# JapanHiu — ฝากซื้อจากญี่ปุ่น (Mercari → ไทย)

เว็บฝากซื้อสินค้าจาก Mercari ญี่ปุ่น ส่งถึงลูกค้าในไทย · Node.js (Express) + PostgreSQL

---

## ภาษาไทย

### มีอะไรบ้าง
- **หน้าแรก**: ช่องเดียว "วางลิงก์ Mercari หรือพิมพ์ชื่อสินค้า"
  - วางลิงก์ `jp.mercari.com/item/m...` → ระบบดึงชื่อ ราคา รูป แล้วแสดงใบเสนอราคาเป็นบาท
  - พิมพ์ข้อความ → ค้นหาเฉพาะ "สินค้าแนะนำ" ของร้าน (ไม่ค้นใน Mercari)
  - หมวดสินค้า, สินค้าแนะนำ (ราคาบาทตัวใหญ่ เยนตัวเล็ก), วิธีสั่งซื้อ 4 ขั้น, ปุ่ม LINE ลอย
- **ดึงข้อมูลสินค้า**: GET หน้าเว็บสินค้าแบบธรรมดาจาก IP เดียว บอกตัวตนตรงๆ ใน User-Agent ไม่ใช้ proxy ไม่หมุน IP ไม่ใช้ API `/v1` `/v2` ของ Mercari เก็บแคช 10 นาที เว้นระยะ 2 วินาทีต่อคำขอ ถ้าดึงไม่ได้จะเปลี่ยนเป็นฟอร์ม "ขอใบเสนอราคา"
- **คำนวณราคา**: อัตรา JPY→THB รายวันจาก open.er-api.com + เผื่อ 3% · ค่าบริการ 10% ขั้นต่ำ 100 บาท · ค่าส่งในญี่ปุ่น 1,500 เยน · ค่าส่งญี่ปุ่น→ไทยตามน้ำหนัก (แก้ได้ทั้งหมดในหน้าตั้งค่า)
- **สั่งซื้อ**: ชื่อ เบอร์ LINE ที่อยู่ แนบสลิป (ไม่บังคับ) ได้เลขคำสั่งซื้อ `JH-YYMMDD-XXXX`
- **ติดตามคำสั่งซื้อ**: เลขคำสั่งซื้อ + เบอร์โทร แนบสลิปภายหลังได้
- **แอดมิน** `/admin`: คำสั่งซื้อ เปลี่ยนสถานะ ดูสลิป ตรวจสต็อกบน Mercari อีกครั้ง คำขอใบเสนอราคา จัดการสินค้าแนะนำ (วางลิงก์แล้วดึงข้อมูลให้) ตั้งค่าร้าน/บัญชีธนาคาร/ราคา
- **หน้าเงื่อนไข** `/terms`

สถานะคำสั่งซื้อ: รอชำระเงิน → ชำระแล้ว → ซื้อแล้ว → ถึงโกดังญี่ปุ่น → ส่งไปไทยแล้ว → ส่งถึงแล้ว (และ ยกเลิก)

### ตัวแปรสภาพแวดล้อม
| ชื่อ | จำเป็น | ความหมาย |
|---|---|---|
| `DATABASE_URL` | ใช่ | Postgres connection string |
| `ADMIN_PASSWORD` | ใช่ | รหัสผ่านเข้า `/admin` |
| `SESSION_SECRET` | ไม่ | ใช้เซ็นคุกกี้แอดมิน (ถ้าไม่ใส่จะใช้ค่าจากรหัสผ่าน) |
| `ZENROWS_API_KEY` | ไม่ | สำรองไว้ ยังไม่ได้ใช้ |
| `PORT` | ไม่ | ค่าเริ่มต้น 3000 |
| `ADMIN_TZ` | ไม่ | เขตเวลาในหน้าแอดมิน (ค่าเริ่มต้น Asia/Tokyo) |

### ขึ้นเว็บฟรี (Render + Neon)
ต้องมีบัญชี: **GitHub** (เก็บโค้ด), **Neon** (ฐานข้อมูลฟรี), **Render** (โฮสต์ฟรี)

1. สร้าง repo บน GitHub แล้ว push โฟลเดอร์นี้ขึ้นไป
2. Neon: สร้างโปรเจกต์ (เลือก region Singapore) คัดลอก connection string (`postgresql://...?sslmode=require`)
3. Render: New → Blueprint → เลือก repo (ใช้ `render.yaml`) หรือ New → Web Service: Build `npm ci --omit=dev`, Start `npm start`, Plan Free
4. ใส่ Environment: `DATABASE_URL` (จาก Neon), `ADMIN_PASSWORD` (รหัสยาวๆ)
5. Deploy เสร็จจะได้ลิงก์ `https://japanhiu.onrender.com` (ชื่อจริงขึ้นกับชื่อที่ว่าง) ตารางในฐานข้อมูลสร้างเองตอนเริ่มเซิร์ฟเวอร์
6. เข้า `/admin/settings` ใส่ LINE ID บัญชีธนาคาร พร้อมเพย์ และ **ค่าส่งญี่ปุ่น→ไทยจริง** (ค่าเริ่มต้นเป็นตัวเลขสมมติ)

ข้อจำกัดแบบฟรี (ตรวจเงื่อนไขล่าสุดของแต่ละเจ้าอีกครั้ง): Render Free จะหลับเมื่อไม่มีคนเข้าราว 15 นาที เปิดครั้งแรกช้าหลายสิบวินาที และดิสก์ไม่ถาวร (ไฟล์หายเมื่อ deploy/restart) — **เว็บนี้จึงเก็บรูปสลิปไว้ใน Postgres (bytea)** ไม่ได้เก็บบนดิสก์ Neon Free มีพื้นที่จำกัด (ประมาณ 0.5 GB) พอสำหรับสลิปหลายพันใบ ฐานข้อมูลฟรีของ Render เองมีอายุจำกัด จึงแนะนำ Neon

### ย้ายไปโฮสต์เสียเงิน
1. สำรองฐานข้อมูล: `pg_dump "$OLD_DATABASE_URL" -Fc -f japanhiu.dump`
2. กู้คืนที่ใหม่: `pg_restore --no-owner -d "$NEW_DATABASE_URL" japanhiu.dump` (หรือใช้ Neon ต่อก็ได้ ไม่ต้องย้าย)
3. Deploy โค้ดเดิม (Render Starter, Railway, Fly.io, VPS ด้วย `Dockerfile`, หรือ Replit) ตั้ง env ชุดเดิม
4. ชี้โดเมนไปที่ใหม่ (แนะนำซื้อโดเมนของร้านไว้ตั้งแต่ตอนนี้ ลูกค้าจะเห็นลิงก์เดิมตลอด)

### รันบนเครื่อง
```bash
npm install
cp .env.example .env   # แก้ค่า แล้ว export ตัวแปร
DATABASE_URL=postgres://... ADMIN_PASSWORD=... npm start
```

---

## English

### Features
- Smart input: a `jp.mercari.com/item/m…` URL fetches the item and shows a THB quote; plain text searches the shop's own featured items only.
- Item fetch: one plain HTTPS GET of the public item page from a single IP with an honest User-Agent. No proxies, no IP rotation, no stealth, no Mercari `/v1` `/v2` APIs. Parses `og:title`, `product:price:amount`, `og:image`. 10-minute cache, ≥2 s between requests, failures cached 2 min. Falls back to a manual quote-request form.
- Price engine: daily JPY→THB from open.er-api.com (cached 24 h in DB) + 3 % buffer, fallback rate if offline; 10 % fee (min 100 THB); 1,500 JPY Japan shipping default; JP→TH weight tiers. All editable in `/admin/settings`.
- Orders with optional slip upload (stored in Postgres `bytea`, max 5 MB, image/PDF), order number `JH-YYMMDD-XXXX`, tracking by order number + phone, later slip upload.
- Admin (`ADMIN_PASSWORD`, HMAC-signed HttpOnly SameSite=Strict cookie, 7 days, login lockout after 5 failures): orders, status updates with history, slip view, Mercari re-check, quote requests, featured items (paste URL → autofill, Thai title, condition, category, weight, publish/sold/remove), settings.
- Thai terms page.

### Free deploy (Render + Neon)
Accounts needed: GitHub, Neon, Render. Push repo → create Neon project (Singapore) → Render Blueprint from `render.yaml` (or Web Service: `npm ci --omit=dev` / `npm start`, Free plan) → set `DATABASE_URL`, `ADMIN_PASSWORD` → deploy. Tables are created automatically on boot (`src/db.js`, idempotent). Then fill in shop settings and real shipping tiers in `/admin/settings`.

Free-tier caveats (verify current terms): Render Free sleeps after ~15 min idle (slow cold start) and has an ephemeral disk, which is why slips live in Postgres. Neon Free has limited storage (~0.5 GB). Render's own free Postgres expires, so Neon is recommended.

### Migrating to a paid host
`pg_dump -Fc` → `pg_restore --no-owner` into the new database (or keep Neon), deploy the same code (Node 20+ or the `Dockerfile`), set the same env vars, point your domain. If slips outgrow Postgres, move `order_slips.data` to S3/R2 and keep a URL column.

### Known limitations
- Mercari item pages served to a plain GET do not reliably expose a "sold" flag; the admin re-check confirms the page and price still exist, but always open the link before buying.
- Mercari Shops (`/shops/product/…`) and short links go to the manual quote form.
- Mercari search/category pulls are not implemented (featured items are curated in admin). `ZENROWS_API_KEY` is reserved.
- Customer-facing times are shown in Thai time; admin times in Japan time.
