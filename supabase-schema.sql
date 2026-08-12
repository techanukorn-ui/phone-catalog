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

-- ข้อความสโลแกนใต้ชื่อร้าน (ถ้าไม่ตั้งจะใช้ข้อความเริ่มต้นในโค้ด)
alter table store_settings add column if not exists tagline text;

-- ธีมสีของหน้าร้าน เลือกได้จากพรีเซ็ตที่กำหนดไว้ (ดู THEME_PRESETS ใน lib/types.ts)
-- ใช้พรีเซ็ตแทนให้กรอกสีเองอิสระ เพื่อคุมคุณภาพสี (คอนทราสต์/ความเข้ม-อ่อน) ให้อ่านง่ายเสมอ
alter table store_settings add column if not exists theme text not null default 'teal';
alter table store_settings drop constraint if exists store_settings_theme_check;
alter table store_settings add constraint store_settings_theme_check check (theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

-- ธีมสีข้อความ/พื้นหลังของหน้าร้าน แยกอิสระทีละจุดจากธีมสีปุ่มกด (ซึ่งคุมแค่พื้นหลัง/ขอบปุ่ม)
alter table store_settings add column if not exists name_theme text not null default 'black';
alter table store_settings drop constraint if exists store_settings_name_theme_check;
alter table store_settings add constraint store_settings_name_theme_check check (name_theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

alter table store_settings add column if not exists price_theme text not null default 'amber';
alter table store_settings drop constraint if exists store_settings_price_theme_check;
alter table store_settings add constraint store_settings_price_theme_check check (price_theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

alter table store_settings add column if not exists tagline_theme text not null default 'teal';
alter table store_settings drop constraint if exists store_settings_tagline_theme_check;
alter table store_settings add constraint store_settings_tagline_theme_check check (tagline_theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

alter table store_settings add column if not exists bg_theme text not null default 'cream';
alter table store_settings drop constraint if exists store_settings_bg_theme_check;
alter table store_settings add constraint store_settings_bg_theme_check check (bg_theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

alter table store_settings add column if not exists pill_text_theme text not null default 'white';
alter table store_settings drop constraint if exists store_settings_pill_text_theme_check;
alter table store_settings add constraint store_settings_pill_text_theme_check check (pill_text_theme in (
  'teal','blue','indigo','violet','purple','pink','rose','red','orange','amber','green','emerald',
  'cyan','sky','slate','pastel-blue','pastel-pink','pastel-mint','pastel-lavender','pastel-gray','black','white','cream','gold'
));

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
  dividend_neng numeric,
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
alter table products add column if not exists dividend_neng numeric;

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

-- ลำดับแสดงผล "เฉพาะภายในหมวดหมู่" แยกอิสระจาก sort_order (ซึ่งใช้กับมุมมอง "ทั้งหมด"/"แนะนำ" เท่านั้น)
-- ตอน migrate ครั้งแรก คงลำดับปัจจุบันของแต่ละหมวดไว้ตาม sort_order เดิม
alter table products add column if not exists category_sort_order integer;
update products set category_sort_order = sub.rn
from (
  select id, row_number() over (partition by category order by sort_order asc) as rn
  from products
) sub
where products.id = sub.id and products.category_sort_order is null;
alter table products alter column category_sort_order set default 0;
alter table products alter column category_sort_order set not null;
create index if not exists products_category_sort_order_idx on products (category, category_sort_order);

-- เจ้าของทุนของเครื่องนี้ (ใครหาเครื่องมาลง ไม่ใช่ปันผลตอนขาย — ดู dividend_* ด้านบนสำหรับส่วนแบ่งตอนขาย)
-- เว้นว่างได้ (nullable) เครื่องเก่าที่มีอยู่แล้วก่อนเพิ่มคอลัมน์นี้จะว่างไว้ก่อน ต้องไล่แก้ไขทีละตัวเอาเอง
alter table products add column if not exists owner text check (owner in ('โบ๊ท','วอลเล่','โบว์','น้าเหน่ง'));

-- เพิ่ม "น้าเหน่ง" เข้าไปในตัวเลือกเจ้าของทุน (สำหรับฐานข้อมูลที่สร้างคอลัมน์ owner ไว้ก่อนหน้านี้แล้ว
-- ต้องถอด constraint เดิมออกก่อน ไม่งั้นจะชนกับ constraint เก่าที่ไม่มี "น้าเหน่ง")
alter table products drop constraint if exists products_owner_check;
alter table products add constraint products_owner_check
  check (owner in ('โบ๊ท','วอลเล่','โบว์','น้าเหน่ง'));
create index if not exists products_owner_idx on products (owner);

-- วิธีจ่ายเงินตอนซื้อเครื่องเข้าร้าน (เงินสด/โอน) และสลิปโอนเงิน (ถ้ามี)
-- เก็บไว้เป็นหลักฐานการซื้อเผื่อสรรพากรขอดูย้อนหลัง — กรอกตอนเพิ่มสินค้า ไม่บังคับแนบสลิป
alter table products add column if not exists purchase_payment_method text default 'เงินสด';
alter table products drop constraint if exists products_purchase_payment_method_check;
alter table products add constraint products_purchase_payment_method_check
  check (purchase_payment_method in ('เงินสด','โอน'));
alter table products add column if not exists purchase_slip_url text;

-- ธนาคารที่ใช้โอน (เลือกตอนวิธีจ่ายเงินเป็น "โอน") — TTB หรืออื่นๆ
alter table products add column if not exists purchase_bank text;
alter table products drop constraint if exists products_purchase_bank_check;
alter table products add constraint products_purchase_bank_check
  check (purchase_bank in ('TTB','อื่นๆ'));

-- วันที่ซื้อเครื่องจริง แยกจาก listed_at (วันที่ลงสินค้า) เพราะบางทีลงระบบช้ากว่าวันที่ซื้อจริง
-- ใช้เป็นตัวกรองหลักในรายงานหลักฐานการซื้อ ให้ตรงกับวันที่บนสลิปจริง
alter table products add column if not exists purchase_date date default current_date;
update products set purchase_date = listed_at where purchase_date is null;

-- วิธีจ่ายเงินตอนขายเครื่อง (เงินสด/โอน) และธนาคาร (TTB/อื่นๆ ถ้าโอน) — กรอกตอนบันทึกการขาย
alter table products add column if not exists sale_payment_method text;
alter table products drop constraint if exists products_sale_payment_method_check;
alter table products add constraint products_sale_payment_method_check
  check (sale_payment_method in ('เงินสด','โอน'));
alter table products add column if not exists sale_bank text;
alter table products drop constraint if exists products_sale_bank_check;
alter table products add constraint products_sale_bank_check
  check (sale_bank in ('TTB','อื่นๆ'));
alter table products add column if not exists sale_slip_url text;

-- IMEI/Serial Number, ชื่อ-นามสกุลผู้ขาย, และรูปหลักฐานการซื้อเพิ่มเติม (ไม่บังคับกรอก) — กรอกตอนเพิ่มสินค้า
alter table products add column if not exists imei_serial text;
alter table products add column if not exists seller_name text;

-- หลักฐานการซื้อรองรับหลายรูป — ย้ายจากคอลัมน์เดี่ยว purchase_evidence_url (ถ้ามี) มาเป็น array
alter table products add column if not exists purchase_evidence_urls text[] default '{}';
update products set purchase_evidence_urls = array[purchase_evidence_url]
  where purchase_evidence_url is not null and (purchase_evidence_urls is null or purchase_evidence_urls = '{}');
alter table products drop column if exists purchase_evidence_url;

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
