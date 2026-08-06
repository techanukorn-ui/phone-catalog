-- ==========================================================
-- Phone Catalog — Supabase schema
-- วางสคริปต์นี้ทั้งหมดใน Supabase Dashboard > SQL Editor แล้วกด Run
-- ==========================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------
-- ตาราง store_settings (มีแถวเดียวเสมอ — ใช้เก็บชื่อร้าน/โลโก้)
-- ----------------------------------------------------------
create table if not exists store_settings (
  id int primary key default 1,
  store_name text not null default 'ร้านมือถือมือสอง',
  logo_url text,
  phone1 text,
  phone2 text,
  updated_at timestamptz not null default now(),
  constraint store_settings_single_row check (id = 1)
);

-- สำหรับฐานข้อมูลที่สร้างตารางไว้ก่อนแล้ว (รันซ้ำได้ ไม่มีผลถ้าคอลัมน์มีอยู่แล้ว)
alter table store_settings add column if not exists phone1 text;
alter table store_settings add column if not exists phone2 text;

insert into store_settings (id, store_name)
values (1, 'ร้านมือถือมือสอง')
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- ตาราง products
-- ----------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null,
  category text not null default 'iPhone' check (category in ('iPhone','iPad','Mac','อื่นๆ')),
  model_name text not null,
  capacity text,
  price numeric not null default 0,
  battery_percent int check (battery_percent between 0 and 100),
  condition_percent int check (condition_percent between 0 and 100),
  warranty_until text,
  accessories text,
  defects text,
  cover_image_url text not null,
  gallery_images text[] not null default '{}',
  status text not null default 'พร้อมขาย' check (status in ('พร้อมขาย','ขายแล้ว')),
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on products (category);
create index if not exists products_created_at_idx on products (created_at desc);

-- ----------------------------------------------------------
-- Storage buckets (public read เพื่อให้ลูกค้าดูรูปได้โดยไม่ต้อง login)
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- ==========================================================
-- Row Level Security
--
-- ระบบนี้ตั้งใจ "ไม่มีระบบ Login" ตามที่ระบุในโจทย์ เพื่อความเร็ว
-- ในการใช้งานหน้าแอดมินผ่านมือถือ ดังนั้นนโยบายด้านล่างจะเปิดให้
-- ทุกคนที่ถือ anon key (คือทุกคนที่เข้าเว็บได้) อ่าน/เขียน/ลบข้อมูลได้
--
-- ข้อควรระวัง: ความปลอดภัยจึงอยู่ที่การ "ไม่เผยแพร่ลิงก์ /admin-manage"
-- เท่านั้น ไม่ใช่การพิสูจน์ตัวตนจริง เหมาะกับร้านเล็กที่เจ้าของร้าน
-- คนเดียวเป็นคนดูแล หากต้องการความปลอดภัยสูงขึ้นภายหลัง ให้เพิ่ม
-- Supabase Auth แล้วปรับ policy ให้ตรวจสอบ auth.uid() แทน
-- ==========================================================

alter table store_settings enable row level security;
alter table products enable row level security;

drop policy if exists "public read store_settings" on store_settings;
create policy "public read store_settings" on store_settings
  for select using (true);

drop policy if exists "public write store_settings" on store_settings;
create policy "public write store_settings" on store_settings
  for update using (true) with check (true);

drop policy if exists "public read products" on products;
create policy "public read products" on products
  for select using (true);

drop policy if exists "public insert products" on products;
create policy "public insert products" on products
  for insert with check (true);

drop policy if exists "public update products" on products;
create policy "public update products" on products
  for update using (true) with check (true);

drop policy if exists "public delete products" on products;
create policy "public delete products" on products
  for delete using (true);

-- Storage object policies (bucket ทั้งสองเป็น public อ่านได้อยู่แล้ว
-- แต่การ insert/update/delete ต้องเปิด policy ให้ anon เขียนได้ด้วย)
drop policy if exists "public read product-images" on storage.objects;
create policy "public read product-images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "public write product-images" on storage.objects;
create policy "public write product-images" on storage.objects
  for insert with check (bucket_id = 'product-images');

drop policy if exists "public update product-images" on storage.objects;
create policy "public update product-images" on storage.objects
  for update using (bucket_id = 'product-images');

drop policy if exists "public delete product-images" on storage.objects;
create policy "public delete product-images" on storage.objects
  for delete using (bucket_id = 'product-images');

drop policy if exists "public read store-assets" on storage.objects;
create policy "public read store-assets" on storage.objects
  for select using (bucket_id = 'store-assets');

drop policy if exists "public write store-assets" on storage.objects;
create policy "public write store-assets" on storage.objects
  for insert with check (bucket_id = 'store-assets');

drop policy if exists "public update store-assets" on storage.objects;
create policy "public update store-assets" on storage.objects
  for update using (bucket_id = 'store-assets');

drop policy if exists "public delete store-assets" on storage.objects;
create policy "public delete store-assets" on storage.objects
  for delete using (bucket_id = 'store-assets');
