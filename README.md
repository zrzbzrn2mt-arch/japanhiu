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
- **สั่งซื้อ**: ชื่อ เบอร์ LINE ที่อยู่ แนบสลิป (ไม่บังคับ, รูปภาพหรือ PDF ไม่เกิน 3.5 MB — รูปจากมือถือย่ออัตโนมัติที่เบราว์เซอร์) ได้เลขคำสั่งซื้อ `JH-YYMMDD-XXXX`
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

### ขึ้นเว็บฟรี (Vercel + Neon) — วิธีที่แนะนำ
ต้องมีบัญชี: **GitHub** (เก็บโค้ด), **Neon** (ฐานข้อมูลฟรี สิงคโปร์), **Vercel** (โฮสต์ฟรี Hobby ไม่ต้องผูกบัตร)

1. สร้าง repo บน GitHub แล้ว push โฟลเดอร์นี้ขึ้นไป
2. Neon: สร้างโปรเจกต์ (เลือก region Singapore) คัดลอก **pooled** connection string (`postgresql://...?sslmode=require`)
3. Vercel: New Project → Import repo จาก GitHub
   - Framework Preset: **Express** (หรือ Other ถ้าไม่ขึ้น Express)
   - Root Directory: `./`
   - Build Command: เว้นว่าง (อย่าใส่ `npm start`)
   - Output Directory: เว้นว่าง
   - Install Command: ค่าเริ่มต้น (`npm install` หรือ `npm ci`)
   - Node.js: 22.x
4. Environment Variables:
   - `DATABASE_URL` — ลิงก์ Neon แบบ pooled (สิงคโปร์)
   - `ADMIN_PASSWORD` — รหัสยาวๆ สำหรับ `/admin`
   - `SESSION_SECRET` — สุ่มข้อความยาว (แนะนำให้ตั้งเอง; ถ้าไม่ใส่ระบบจะคำนวณจากรหัสผ่าน)
   - `ZENROWS_API_KEY` — ไม่บังคับ ยังไม่ได้ใช้
5. Region ของ Function ตั้งเป็น **Singapore (`sin1`)** ไว้แล้วใน `vercel.json` (ควรตรงกับ Neon)
6. Deploy เสร็จจะได้ลิงก์ `https://….vercel.app` ตารางในฐานข้อมูลสร้างเองตอนคำขอแรก (idempotent) ไฟล์ใน `public/` (CSS, ฟอนต์, รูป, `slip.js`) Vercel เสิร์ฟให้เองผ่าน CDN
7. เข้า `/admin/settings` ใส่ LINE ID บัญชีธนาคาร พร้อมเพย์ และ **ค่าส่งญี่ปุ่น→ไทยจริง** (ค่าเริ่มต้นเป็นตัวเลขสมมติ)

ข้อจำกัดแบบฟรี (ตรวจเงื่อนไขล่าสุดอีกครั้ง): Vercel Hobby ไม่หลับเหมือน Render เลยเปิดได้เร็วกว่า ไฟล์ระบบอ่านอย่างเดียวยกเว้น `/tmp` — **เว็บนี้จึงเก็บรูปสลิปไว้ใน Postgres (bytea)** คำขอทั้งหมดรวมสลิปต้องไม่เกินประมาณ 4.5 MB ระบบเลยจำกัดสลิปที่ 3.5 MB และย่อรูปจากมือถือที่เบราว์เซอร์ก่อนอัปโหลด (ยาวด้านที่ยาวที่สุดไม่เกิน 1600 พิกเซล เป็น JPEG) Neon Free มีพื้นที่จำกัด (ประมาณ 0.5 GB)

ถ้า `maxDuration` 30 วินาทีใน `vercel.json` ติดเพดานแพ็กเกจ ให้ลดลงตามที่แดชบอร์ดแจ้ง (การดึงหน้า Mercari อาจใช้ได้ถึง 12 วินาที)

### ทางเลือก: Render + Neon
ยังใช้ `render.yaml` และ `Dockerfile` ได้เหมือนเดิม: Render New → Blueprint หรือ Web Service, Build `npm ci --omit=dev`, Start `npm start`, Plan Free, region Singapore, ใส่ `DATABASE_URL` กับ `ADMIN_PASSWORD` ข้อจำกัดของ Render Free คือเซิร์ฟเวอร์หลับเมื่อไม่มีคนเข้าราว 15 นาที (เปิดครั้งแรกช้า) และดิสก์ไม่ถาวร

### ย้ายไปโฮสต์เสียเงิน
1. สำรองฐานข้อมูล: `pg_dump "$OLD_DATABASE_URL" -Fc -f japanhiu.dump`
2. กู้คืนที่ใหม่: `pg_restore --no-owner -d "$NEW_DATABASE_URL" japanhiu.dump` (หรือใช้ Neon ต่อก็ได้ ไม่ต้องย้าย)
3. Deploy โค้ดเดิม (Vercel, Render Starter, Railway, Fly.io, VPS ด้วย `Dockerfile`, หรือ Replit) ตั้ง env ชุดเดิม
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
- Orders with optional slip upload (stored in Postgres `bytea`, max 3.5 MB, image/PDF; phone photos are resized in the browser to max 1600 px JPEG), order number `JH-YYMMDD-XXXX`, tracking by order number + phone, later slip upload.
- Admin (`ADMIN_PASSWORD`, HMAC-signed HttpOnly SameSite=Strict cookie, 7 days, login lockout after 5 failures): orders, status updates with history, slip view, Mercari re-check, quote requests, featured items (paste URL → autofill, Thai title, condition, category, weight, publish/sold/remove), settings.
- Thai terms page.

### Free deploy (Vercel + Neon) — recommended
Accounts needed: GitHub, Neon, Vercel (Hobby, no credit card). Push the repo → Neon project in Singapore (copy the **pooled** `DATABASE_URL`) → Vercel New Project, import the GitHub repo.

Dashboard settings:
- Framework Preset: **Express** (or Other)
- Root Directory: `./`
- Build Command: leave empty (do not set `npm start`)
- Output Directory: leave empty
- Install Command: default (`npm install` / `npm ci`)
- Node.js: 22.x
- Env: `DATABASE_URL` (Neon pooled, Singapore), `ADMIN_PASSWORD`, and preferably `SESSION_SECRET`. `ZENROWS_API_KEY` is optional and unused.
- Function region is already `sin1` (Singapore) in `vercel.json` so it sits next to Neon.

The Express app is exported from `src/server.js` (Vercel detects this entrypoint; no `api/` rewrites). Static files in `public/` are served by Vercel’s CDN (`express.static` is still used for local / Docker / Render). Schema migrations run once per instance on the first request (idempotent `CREATE IF NOT EXISTS`). Then fill in shop settings and real shipping tiers in `/admin/settings`.

Free-tier caveats (verify current terms): Vercel Hobby does not sleep like Render Free. The function filesystem is read-only except `/tmp`, which is why slips live in Postgres. Request bodies must stay under ~4.5 MB, so slip uploads are capped at 3.5 MB and images are downscaled in the browser. Neon Free has limited storage (~0.5 GB). If `maxDuration: 30` in `vercel.json` exceeds the plan cap, lower it in the dashboard (Mercari fetches may take up to 12 s).

### Alternative: Render + Neon
`render.yaml` and the `Dockerfile` still work: Blueprint or Web Service (`npm ci --omit=dev` / `npm start`, Free, Singapore) with `DATABASE_URL` and `ADMIN_PASSWORD`. Render Free sleeps after ~15 min idle (slow cold start) and has an ephemeral disk.

### Migrating to a paid host
`pg_dump -Fc` → `pg_restore --no-owner` into the new database (or keep Neon), deploy the same code (Vercel, Node 20+ , or the `Dockerfile`), set the same env vars, point your domain. If slips outgrow Postgres, move `order_slips.data` to S3/R2 and keep a URL column.

### Known limitations
- Mercari item pages served to a plain GET do not reliably expose a "sold" flag; the admin re-check confirms the page and price still exist, but always open the link before buying.
- Mercari Shops (`/shops/product/…`) and short links go to the manual quote form.
- Mercari search/category pulls are not implemented (featured items are curated in admin). `ZENROWS_API_KEY` is reserved.
- Customer-facing times are shown in Thai time; admin times in Japan time.
