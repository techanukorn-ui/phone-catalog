export type ProductCategory = 'iPhone' | 'iPad' | 'Mac' | 'อื่นๆ'
export type ProductStatus = 'พร้อมขาย' | 'ขายแล้ว'

export const CATEGORIES: ProductCategory[] = ['iPhone', 'iPad', 'Mac', 'อื่นๆ']

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
  warranty_until: string | null
  accessories: string | null
  defects: string | null
  cover_image_url: string
  gallery_images: string[]
  status: ProductStatus
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
  warranty_until: string
  accessories: string
  defects: string
  status: ProductStatus
}

export interface StoreSettings {
  id: number
  store_name: string
  logo_url: string | null
  phone1: string | null
  phone2: string | null
  updated_at: string
}
