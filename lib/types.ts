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

export type StoreTheme =
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'cyan'
  | 'sky'
  | 'slate'
  | 'pastel-blue'
  | 'pastel-pink'
  | 'pastel-mint'
  | 'pastel-lavender'
  | 'pastel-gray'
  | 'black'
  | 'white'
  | 'cream'
  | 'gold'

// พรีเซ็ตธีมสี — ให้เลือกจากชุดที่คุมคอนทราสต์ไว้แล้วแทนกรอกสีอิสระ กันสีอ่านยาก/มืดไป
export const THEME_PRESETS: { value: StoreTheme; label: string; swatch: string }[] = [
  { value: 'teal', label: 'เขียวเทียล', swatch: '#0E7C6B' },
  { value: 'blue', label: 'น้ำเงิน', swatch: '#2563EB' },
  { value: 'indigo', label: 'คราม', swatch: '#4F46E5' },
  { value: 'violet', label: 'ม่วง', swatch: '#7C3AED' },
  { value: 'purple', label: 'ม่วงเข้ม', swatch: '#9333EA' },
  { value: 'pink', label: 'ชมพู', swatch: '#DB2777' },
  { value: 'rose', label: 'แดงกุหลาบ', swatch: '#E11D48' },
  { value: 'red', label: 'แดง', swatch: '#DC2626' },
  { value: 'orange', label: 'ส้ม', swatch: '#EA580C' },
  { value: 'amber', label: 'เหลืองอำพัน', swatch: '#D97706' },
  { value: 'green', label: 'เขียว', swatch: '#16A34A' },
  { value: 'emerald', label: 'เขียวมรกต', swatch: '#059669' },
  { value: 'cyan', label: 'ฟ้าอมเขียว', swatch: '#0891B2' },
  { value: 'sky', label: 'ฟ้า', swatch: '#0284C7' },
  { value: 'slate', label: 'เทาเข้ม', swatch: '#334155' },
  { value: 'pastel-blue', label: 'ฟ้าพาสเทล', swatch: '#60A5FA' },
  { value: 'pastel-pink', label: 'ชมพูพาสเทล', swatch: '#F472B6' },
  { value: 'pastel-mint', label: 'มินต์พาสเทล', swatch: '#34D399' },
  { value: 'pastel-lavender', label: 'ลาเวนเดอร์พาสเทล', swatch: '#A78BFA' },
  { value: 'pastel-gray', label: 'เทาอ่อน', swatch: '#9CA3AF' },
  { value: 'black', label: 'ดำ', swatch: '#18181B' },
  { value: 'white', label: 'ขาว', swatch: '#FFFFFF' },
  { value: 'cream', label: 'ครีม (สีพื้นหลังเดิม)', swatch: '#F1F0EC' },
  { value: 'gold', label: 'ทอง', swatch: '#C9A227' },
]

/** แปลง swatch hex ของธีมที่เลือกเป็น "R G B" สำหรับตั้งเป็น CSS custom property */
export function themeToRgbSpace(theme: StoreTheme | null | undefined, fallback: StoreTheme = 'teal'): string {
  const hex = (THEME_PRESETS.find((p) => p.value === theme) ?? THEME_PRESETS.find((p) => p.value === fallback))!.swatch
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

export interface StoreSettings {
  id: number
  store_name: string
  logo_url: string | null
  phone1: string | null
  phone2: string | null
  category_order: CategoryTab[] | null
  tagline: string | null
  theme: StoreTheme
  name_theme: StoreTheme
  price_theme: StoreTheme
  tagline_theme: StoreTheme
  bg_theme: StoreTheme
  pill_text_theme: StoreTheme
  updated_at: string
}
