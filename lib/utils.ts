import { supabase } from './supabaseClient'
import type { ProductCategory } from './types'

const CODE_PREFIX: Record<ProductCategory, string> = {
  IPHONE: 'IP',
  IPAD: 'PD',
  MACBOOK: 'MC',
  'APPLE PENCIL': 'AP',
  'APPLE WATCH': 'AW',
  อื่นๆ: 'OT',
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ตัดตัวที่อ่านสับสน (0,O,1,I)

export function generateProductCode(category: ProductCategory): string {
  let random = ''
  for (let i = 0; i < 6; i++) {
    random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return `${CODE_PREFIX[category]}-${random}`
}

/** ค่า sort_order สำหรับสินค้าใหม่ ให้ขึ้นแสดงบนสุดเสมอ (เหมือนพฤติกรรมเดิมของ "ล่าสุด") */
export async function getNextSortOrder(): Promise<number> {
  const { data } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.sort_order ?? 0) - 1
}

/** ค่า category_sort_order สำหรับสินค้าใหม่ ให้ขึ้นแสดงบนสุดของหมวดนั้นเสมอ (แยกอิสระจาก sort_order) */
export async function getNextCategorySortOrder(category: ProductCategory): Promise<number> {
  const { data } = await supabase
    .from('products')
    .select('category_sort_order')
    .eq('category', category)
    .order('category_sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.category_sort_order ?? 0) - 1
}

/** จำนวนวันที่ค้างสต็อกถึงจะถือว่า "ค้างนาน" (ใช้ทั้งในรายงานและป้ายเตือนที่หน้าสต็อก) */
export const STAGNANT_DAYS = 15

/** จำนวนวันนับจากวันที่ลงขาย (listed_at) ถึงวันนี้ */
export function daysSince(dateStr: string): number {
  const listed = new Date(dateStr)
  const listedUTC = Date.UTC(listed.getFullYear(), listed.getMonth(), listed.getDate())
  const now = new Date()
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((todayUTC - listedUTC) / (1000 * 60 * 60 * 24))
}

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('th-TH').format(price)} บาท`
}

function sanitizeFileName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : 'jpg'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

/** Storage key รองรับแค่อักขระ ASCII ปลอดภัย ตัดภาษาไทย/สัญลักษณ์อื่นออกก่อนใช้เป็นชื่อโฟลเดอร์ */
function sanitizeFolder(folder: string): string {
  const safe = folder
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safe || 'other'
}

/** อัปโหลดไฟล์รูปขึ้น Supabase Storage แล้วคืนค่า public URL */
export async function uploadImage(
  bucket: 'product-images' | 'store-assets',
  file: File,
  folder?: string
): Promise<string> {
  const path = folder
    ? `${sanitizeFolder(folder)}/${sanitizeFileName(file.name)}`
    : sanitizeFileName(file.name)
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** แปลง public URL กลับเป็น path ภายใน bucket เพื่อใช้ตอนลบ */
function extractStoragePath(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

/** ลบไฟล์รูปออกจาก Storage โดยรับ public URL เข้ามา (เงียบ ๆ ถ้าไม่เจอไฟล์) */
export async function deleteImageByUrl(
  bucket: 'product-images' | 'store-assets',
  url: string | null | undefined
): Promise<void> {
  if (!url) return
  const path = extractStoragePath(bucket, url)
  if (!path) return
  await supabase.storage.from(bucket).remove([path])
}

export async function deleteImagesByUrls(
  bucket: 'product-images' | 'store-assets',
  urls: (string | null | undefined)[]
): Promise<void> {
  const paths = urls
    .map((u) => (u ? extractStoragePath(bucket, u) : null))
    .filter((p): p is string => !!p)
  if (paths.length === 0) return
  await supabase.storage.from(bucket).remove(paths)
}
