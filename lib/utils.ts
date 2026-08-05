import { supabase } from './supabaseClient'
import type { ProductCategory } from './types'

const CODE_PREFIX: Record<ProductCategory, string> = {
  iPhone: 'IP',
  iPad: 'PD',
  Mac: 'MC',
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

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('th-TH').format(price)} บาท`
}

function sanitizeFileName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : 'jpg'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

/** อัปโหลดไฟล์รูปขึ้น Supabase Storage แล้วคืนค่า public URL */
export async function uploadImage(
  bucket: 'product-images' | 'store-assets',
  file: File,
  folder?: string
): Promise<string> {
  const path = folder ? `${folder}/${sanitizeFileName(file.name)}` : sanitizeFileName(file.name)
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
