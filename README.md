# แค็ตตาล็อกมือถือ-แท็บเล็ตมือสอง

เว็บแอปแค็ตตาล็อกสต็อกมือถือ/แท็บเล็ตมือสอง สำหรับส่งลิงก์ให้ลูกค้าดูทาง Facebook Inbox
สร้างด้วย **Next.js (App Router) + Tailwind CSS + Supabase**

- หน้าบ้าน (`/`) — แค็ตตาล็อกสินค้าดูง่ายบนมือถือ กรองตามหมวดหมู่ ค้นหารุ่น เปิดดูรูป/รายละเอียดแบบเต็ม
- หลังบ้าน (`/admin-manage`) — จัดการชื่อร้าน/โลโก้ เพิ่มสินค้าใหม่ แก้ไข/ลบสินค้า **ไม่มีระบบ login** (เข้าได้ทันทีผ่านลิงก์)

## 1) ติดตั้งและรันโปรเจกต์

ต้องมี [Node.js](https://nodejs.org) เวอร์ชัน 18 ขึ้นไป

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 สำหรับหน้าบ้าน และ http://localhost:3000/admin-manage สำหรับหลังบ้าน

## 2) ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com) (มี Free Plan ให้ใช้)
2. ไปที่เมนู **SQL Editor** แล้ววางโค้ดทั้งหมดจากไฟล์ [`supabase-schema.sql`](./supabase-schema.sql) ในโปรเจกต์นี้ แล้วกด **Run**
   - สคริปต์นี้จะสร้างตาราง `products`, `store_settings`, สร้าง Storage bucket ชื่อ `product-images` และ `store-assets` (ตั้งเป็น public เพื่อให้ลูกค้าดูรูปได้) พร้อม RLS policy ที่จำเป็น
3. ไปที่เมนู **Settings > API** แล้วคัดลอกค่า:
   - `Project URL`
   - `anon public` key
4. คัดลอกไฟล์ `.env.local.example` เป็น `.env.local` แล้วนำค่าที่ได้มาใส่:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

5. รัน `npm run dev` ใหม่อีกครั้งให้ค่า env ถูกโหลด

## 3) ใช้งานหลังบ้าน (Admin)

- เข้าไปที่ `/admin-manage`
- แท็บ **ข้อมูลร้านค้า**: ตั้งชื่อร้าน + อัปโหลดโลโก้ (แสดงผลที่หน้าบ้านทันที)
- แท็บ **เพิ่มสินค้า**: กรอกข้อมูลเครื่อง เลือกรูปปก (จำเป็น) และรูปประกอบเพิ่มเติมได้หลายรูป ระบบจะสร้าง **รหัสสินค้า** ให้อัตโนมัติ (เช่น `IP-7F3K9A`)
- แท็บ **สต็อกสินค้า**: ดูรายการทั้งหมด กด **แก้ไข** เพื่อแก้ข้อมูล/รูป หรือกด **ขายแล้ว / ลบ** เพื่อลบสินค้าออกจากเว็บและลบไฟล์รูปทั้งหมดออกจาก Storage ทันที

> ⚠️ **ข้อควรระวังเรื่องความปลอดภัย**: หน้า `/admin-manage` ไม่มีการล็อกอินตามที่ระบุในโจทย์ (เพื่อความรวดเร็วในการใช้งานผ่านมือถือ) ความปลอดภัยจึงขึ้นอยู่กับการ **ไม่เผยแพร่ลิงก์นี้ให้คนอื่น** เท่านั้น เหมาะสำหรับร้านเล็กที่เจ้าของร้านเป็นคนเดียวที่ดูแล หากต้องการเพิ่มความปลอดภัยภายหลัง แนะนำให้เพิ่ม Supabase Auth แล้วปรับ RLS policy ในไฟล์ `supabase-schema.sql`

## 4) Deploy ขึ้น Vercel

1. Push โค้ดนี้ขึ้น GitHub repository
2. ไปที่ [vercel.com](https://vercel.com) → New Project → เลือก repository นี้
3. ในหน้า **Environment Variables** ใส่ค่าเดียวกับใน `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. กด Deploy — เสร็จแล้วจะได้ลิงก์เว็บสำหรับหน้าบ้าน (ส่งให้ลูกค้าดูใน Inbox ได้เลย) และลิงก์ `/admin-manage` สำหรับตัวเอง

## โครงสร้างโปรเจกต์

```
app/
  page.tsx                 หน้าบ้าน (storefront)
  admin-manage/page.tsx    หลังบ้าน (admin dashboard)
  layout.tsx, globals.css
components/
  Header.tsx, FilterBar.tsx, ProductCard.tsx, ProductModal.tsx, ConditionDial.tsx
  admin/StoreSettingsForm.tsx, admin/ProductForm.tsx, admin/ProductList.tsx
lib/
  supabaseClient.ts        Supabase client
  types.ts                 TypeScript types
  utils.ts                 สร้างรหัสสินค้า, format ราคา, อัปโหลด/ลบรูปใน Storage
supabase-schema.sql         SQL สำหรับสร้างตาราง + storage bucket + policy
```

## เทคโนโลยีที่ใช้

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Supabase** — Postgres database + Storage (ฟรี quota เพียงพอสำหรับร้านขนาดเล็ก-กลาง)
- ฟอนต์: Chakra Petch (หัวข้อ), IBM Plex Sans Thai (เนื้อหา), IBM Plex Mono (รหัสสินค้า/ราคา)
