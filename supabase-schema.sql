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

-- ลำดับหมวดหมู่ที่ร้านค้ากำหนดเอง (ใช้ทั้งหลังบ้านและหน้าร้าน)
-- รวม "ทั้งหมด" เป็นสมาชิกแรกของลำดับด้วย เพื่อให้ลากสลับตำแหน่งได้เหมือนหมวดอื่น
alter table store_settings add column if not exists category_order text[];
update store_settings set category_order = array['ทั้งหมด','IPAD','IPHONE','MACBOOK','APPLE PENCIL','APPLE WATCH','อื่นๆ']
where category_order is null;
-- สำหรับฐานข้อมูลที่รันสคริปต์เวอร์ชันก่อนหน้าไปแล้ว (ตอนนั้นยังไม่มี "ทั้งหมด" อยู่ในลำดับ)
update store_settings set category_order = array['ทั้งหมด'] || category_order
where not ('ทั้งหมด' = any(category_order));
alter table store_settings alter column category_order set default array['ทั้งหมด','IPAD','IPHONE','MACBOOK','APPLE PENCIL','APPLE WATCH','อื่นๆ'];
alter table store_settings alter column category_order set not null;

insert into store_settings (id, store_name)
values (1, 'ร้านมือถือมือสอง')
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- ตาราง products
-- ----------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null,
  category text not null default 'IPHONE' check (category in ('IPHONE','IPAD','MACBOOK','APPLE PENCIL','APPLE WATCH','อื่นๆ')),
  model_name text not null,
  capacity text,
  color text,
  price numeric not null default 0,
  battery_percent int check (battery_percent between 0 and 100),
  condition_percent int check (condition_percent between 0 and 100),
  charge_cycles int check (charge_cycles >= 0),
  warranty_until text,
  accessories text,
  defects text,
  cover_image_url text not null,
  gallery_images text[] not null default '{}',
  status text not null default 'พร้อมขาย' check (status in ('พร้อมขาย','ขายแล้ว')),
  listed_at date not null default current_date,
  sold_at date,
  cost_device numeric,
  cost_other numeric,
  total_cost numeric generated always as (coalesce(cost_device, 0) + coalesce(cost_other, 0)) stored,
  sale_price numeric,
  net_profit numeric generated always as (sale_price - (coalesce(cost_device, 0) + coalesce(cost_other, 0))) stored,
  dividend_wallet numeric,
  dividend_bow numeric,
  dividend_magic numeric,
  dividend_boat numeric,
  created_at timestamptz not null default now()
);

-- สำหรับฐานข้อมูลที่สร้างตารางไว้ก่อนแล้ว (รันซ้ำได้ ไม่มีผลถ้าคอลัมน์มีอยู่แล้ว)
alter table products add column if not exists color text;
alter table products add column if not exists charge_cycles int check (charge_cycles >= 0);
alter table products add column if not exists listed_at date;
update products set listed_at = created_at::date where listed_at is null;
alter table products alter column listed_at set default current_date;
alter table products alter column listed_at set not null;

-- เปลี่ยนหมวดหมู่ "Mac" เป็น "MACBOOK", "iPhone"/"iPad" เป็นตัวพิมพ์ใหญ่ทั้งหมด
-- และเพิ่ม "APPLE PENCIL", "APPLE WATCH"
-- (ต้องถอด constraint เดิมออกก่อน ไม่งั้น update ค่าใหม่จะชนกับ constraint เก่า)
alter table products drop constraint if exists products_category_check;

update products set category = 'MACBOOK' where category = 'Mac';
update products set category = 'IPHONE' where category = 'iPhone';
update products set category = 'IPAD' where category = 'iPad';

alter table products alter column category set default 'IPHONE';
alter table products add constraint products_category_check
  check (category in ('IPHONE','IPAD','MACBOOK','APPLE PENCIL','APPLE WATCH','อื่นๆ'));

-- ข้อมูลต้นทุน/กำไร/ปันผล กรอกตอนกดปุ่ม "ขายแล้ว"
alter table products add column if not exists sold_at date;
alter table products add column if not exists cost_device numeric;
alter table products add column if not exists cost_other numeric;
alter table products add column if not exists total_cost numeric generated always as (coalesce(cost_device, 0) + coalesce(cost_other, 0)) stored;
alter table products add column if not exists sale_price numeric;
alter table products add column if not exists net_profit numeric generated always as (sale_price - (coalesce(cost_device, 0) + coalesce(cost_other, 0))) stored;
alter table products add column if not exists dividend_wallet numeric;
alter table products add column if not exists dividend_bow numeric;
alter table products add column if not exists dividend_magic numeric;
alter table products add column if not exists dividend_boat numeric;

create index if not exists products_category_idx on products (category);
create index if not exists products_created_at_idx on products (created_at desc);

-- ลำดับการแสดงผลที่ร้านค้ากำหนดเอง (ใช้ทั้งหลังบ้านและหน้าร้าน)
-- ค่าน้อย = แสดงก่อน ของเดิมที่ยังไม่เคยตั้งจะได้ลำดับตามวันที่สร้างล่าสุดก่อน (คงหน้าตาเดิมไว้)
alter table products add column if not exists sort_order integer;
update products set sort_order = sub.rn
from (
  select id, row_number() over (order by created_at desc) as rn
  from products
) sub
where products.id = sub.id and products.sort_order is null;
alter table products alter column sort_order set default 0;
alter table products alter column sort_order set not null;
create index if not exists products_sort_order_idx on products (sort_order);

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
-- อ่านข้อมูล (select) เปิดสาธารณะเสมอ เพราะหน้าร้าน (storefront)
-- ไม่มี login และต้องโชว์สินค้าให้ลูกค้าทุกคนเห็นได้
--
-- แก้ไข/เพิ่ม/ลบ (insert, update, delete) ต้อง login ผ่าน Supabase
-- Auth ก่อนเท่านั้น (auth.role() = 'authenticated') — ต้องสร้างบัญชี
-- ผู้ใช้ใน Supabase Dashboard > Authentication > Users ก่อนใช้งานได้
-- ==========================================================

alter table store_settings enable row level security;
alter table products enable row level security;

drop policy if exists "public read store_settings" on store_settings;
create policy "public read store_settings" on store_settings
  for select using (true);

drop policy if exists "public write store_settings" on store_settings;
drop policy if exists "authenticated write store_settings" on store_settings;
create policy "authenticated write store_settings" on store_settings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read products" on products;
create policy "public read products" on products
  for select using (true);

drop policy if exists "public insert products" on products;
drop policy if exists "authenticated insert products" on products;
create policy "authenticated insert products" on products
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "public update products" on products;
drop policy if exists "authenticated update products" on products;
create policy "authenticated update products" on products
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public delete products" on products;
drop policy if exists "authenticated delete products" on products;
create policy "authenticated delete products" on products
  for delete using (auth.role() = 'authenticated');

-- Storage object policies (bucket ทั้งสองเป็น public อ่านได้อยู่แล้ว
-- แต่การ insert/update/delete ต้อง login ก่อนเท่านั้น)
drop policy if exists "public read product-images" on storage.objects;
create policy "public read product-images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "public write product-images" on storage.objects;
drop policy if exists "authenticated write product-images" on storage.objects;
create policy "authenticated write product-images" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "public update product-images" on storage.objects;
drop policy if exists "authenticated update product-images" on storage.objects;
create policy "authenticated update product-images" on storage.objects
  for update using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "public delete product-images" on storage.objects;
drop policy if exists "authenticated delete product-images" on storage.objects;
create policy "authenticated delete product-images" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "public read store-assets" on storage.objects;
create policy "public read store-assets" on storage.objects
  for select using (bucket_id = 'store-assets');

drop policy if exists "public write store-assets" on storage.objects;
drop policy if exists "authenticated write store-assets" on storage.objects;
create policy "authenticated write store-assets" on storage.objects
  for insert with check (bucket_id = 'store-assets' and auth.role() = 'authenticated');

drop policy if exists "public update store-assets" on storage.objects;
drop policy if exists "authenticated update store-assets" on storage.objects;
create policy "authenticated update store-assets" on storage.objects
  for update using (bucket_id = 'store-assets' and auth.role() = 'authenticated');

drop policy if exists "public delete store-assets" on storage.objects;
drop policy if exists "authenticated delete store-assets" on storage.objects;
create policy "authenticated delete store-assets" on storage.objects
  for delete using (bucket_id = 'store-assets' and auth.role() = 'authenticated');
