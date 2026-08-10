export type ProductCategory = 'IPHONE' | 'IPAD' | 'MACBOOK' | 'APPLE PENCIL' | 'APPLE WATCH' | 'อื่นๆ'
export type ProductStatus = 'พร้อมขาย' | 'ขายแล้ว'

export const CATEGORIES: ProductCategory[] = [
  'IPAD',
  'IPHONE',
  'MACBOOK',
  'APPLE PENCIL',
  'APPLE WATCH',
  'อื่นๆ',
]

// "ทั้งหมด" คือแท็บรวมทุกหมวด ไม่ใช่หมวดหมู่จริงของสินค้า แต่เข้าไปอยู่ในลำดับที่ลากสลับได้ด้วย
export type CategoryTab = 'ทั้งหมด' | ProductCategory

export const CATEGORY_TABS: CategoryTab[] = ['ทั้งหมด', ...CATEGORIES]

// เจ้าของทุนของเครื่องนี้ — ใครเป็นคนหาเครื่องมาลง ไม่ใช่ทุกคนลงขันร่วมกัน 1 เครื่องมีเจ้าของทุนคนเดียว
// (เมจิไม่ได้ลงทุน แค่ช่วยขาย จึงไม่อยู่ในตัวเลือกนี้ — ดู dividend_magic สำหรับส่วนแบ่งตอนช่วยขาย)
export type ProductOwner = 'โบ๊ท' | 'วอลเล่' | 'โบว์' | 'น้าเหน่ง'

export const OWNERS: ProductOwner[] = ['โบ๊ท', 'วอลเล่', 'โบว์', 'น้าเหน่ง']

export interface Product {
  id: string
  product_code: string
  category: ProductCategory
  owner: ProductOwner | null
  model_name: string
  capacity: string | null
  color: string | null
  price: number
  battery_percent: number | null
  condition_percent: number | null
  charge_cycles: number | null
  warranty_until: string | null
  accessories: string | null
  defects: string | null
  cover_image_url: string
  gallery_images: string[]
  status: ProductStatus
  listed_at: string
  sold_at: string | null
  cost_device: number | null
  cost_other: number | null
  total_cost: number | null
  sale_price: number | null
  net_profit: number | null
  dividend_wallet: number | null
  dividend_bow: number | null
  dividend_magic: number | null
  dividend_boat: number | null
  dividend_neng: number | null
  sort_order: number
  category_sort_order: number
  created_at: string
}

export type ProductFormValues = {
  category: ProductCategory
  model_name: string
  capacity: string
  color: string
  price: string
  battery_percent: string
  condition_percent: string
  charge_cycles: string
  warranty_until: string
  accessories: string
  defects: string
  status: ProductStatus
  listed_at: string
}

export type StoreTheme = 'teal' | 'blue' | 'rose' | 'violet' | 'slate'

// พรีเซ็ตธีมสี — ให้เลือกจากชุดที่คุมคอนทราสต์ไว้แล้วแทนกรอกสีอิสระ กันสีอ่านยาก/มืดไป
export const THEME_PRESETS: { value: StoreTheme; label: string; swatch: string }[] = [
  { value: 'teal', label: 'เขียวเทียล', swatch: '#0E7C6B' },
  { value: 'blue', label: 'น้ำเงิน', swatch: '#2563EB' },
  { value: 'rose', label: 'แดงกุหลาบ', swatch: '#E11D48' },
  { value: 'violet', label: 'ม่วง', swatch: '#7C3AED' },
  { value: 'slate', label: 'เทาเข้ม', swatch: '#334155' },
]

export interface StoreSettings {
  id: number
  store_name: string
  logo_url: string | null
  phone1: string | null
  phone2: string | null
  category_order: CategoryTab[] | null
  tagline: string | null
  theme: StoreTheme
  updated_at: string
}
