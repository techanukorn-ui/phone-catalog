export type ProductCategory = 'iPhone' | 'iPad' | 'MACBOOK' | 'APPLE PENCIL' | 'APPLE WATCH' | 'อื่นๆ'
export type ProductStatus = 'พร้อมขาย' | 'ขายแล้ว'

export const CATEGORIES: ProductCategory[] = [
  'iPhone',
  'iPad',
  'MACBOOK',
  'APPLE PENCIL',
  'APPLE WATCH',
  'อื่นๆ',
]

export interface Product {
  id: string
  product_code: string
  category: ProductCategory
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

export interface StoreSettings {
  id: number
  store_name: string
  logo_url: string | null
  phone1: string | null
  phone2: string | null
  updated_at: string
}
