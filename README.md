# แค็ตตาล็อกมือถือ-แท็บเล็ตมือสอง

เว็บแอปแค็ตตาล็อกสต็อกมือถือ/แท็บเล็ตมือสอง สำหรับส่งลิงก์ให้ลูกค้าดูทาง Facebook Inbox
สร้างด้วย **Next.js (App Router) + Tailwind CSS + Supabase**

- หน้าบ้าน (`/`) — แค็ตตาล็อกสินค้าดูง่ายบนมือถือ กรองตามหมวดหมู่ ค้นหารุ่น เปิดดูรูป/รายละเอียดแบบเต็ม
- หลังบ้าน (`/admin-manage`) — จัดการชื่อร้าน/โลโก้ เพิ่มสินค้าใหม่ แก้ไข/ลบสินค้า ดูรายงานยอดขาย **ต้อง login ด้วย Supabase Auth (อีเมล + รหัสผ่าน)**

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

- เข้าไปที่ `/admin-manage` ต้อง login ด้วยบัญชี Supabase Auth (อีเมล + รหัสผ่าน) ก่อนถึงจะเข้าใช้งานได้ — ทีมร้าน (โบ๊ท/วอลเล่/โบว์) ใช้บัญชีเดียวร่วมกัน
- แท็บ **ภาพรวม**: สรุปยอดสต็อก มูลค่าคงเหลือ ยอดขาย/กำไรเดือนนี้เทียบเดือนก่อน
- แท็บ **ข้อมูลร้านค้า**: ตั้งชื่อร้าน + อัปโหลดโลโก้ (แสดงผลที่หน้าบ้านทันที)
- แท็บ **เพิ่มสินค้า**: กรอกข้อมูลเครื่อง เลือกรูปปก (จำเป็น) และรูปประกอบเพิ่มเติมได้หลายรูป ระบบจะสร้าง **รหัสสินค้า** ให้อัตโนมัติ (เช่น `IP-7F3K9A`)
- แท็บ **สต็อกสินค้าพร้อมขาย / สินค้าขายแล้ว**: ดูรายการแยกตามสถานะ กด **แก้ไข** เพื่อแก้ข้อมูล/รูป, **ขายแล้ว** เพื่อบันทึกข้อมูลการขาย, หรือ **ลบ** เพื่อลบสินค้าออกจากเว็บและลบไฟล์รูปทั้งหมดออกจาก Storage ทันที
- แท็บ **รายงาน**: รายงานยอดขาย/กำไร แยกตามเจ้าของทุน (โบ๊ท/วอลเล่/โบว์) ต่อเดือน พร้อมกราฟเทียบย้อนหลังและ export Excel

> การเพิ่ม/แก้ไข/ลบสินค้าและตั้งค่าร้านทั้งหมดต้อง login ก่อนเสมอ (บังคับด้วย Supabase Auth + RLS policy ในไฟล์ `supabase-schema.sql`) หน้าบ้าน (`/`) เปิดดูได้สาธารณะโดยไม่ต้อง login

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
