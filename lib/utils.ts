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

export type MonthOption = {
  key: string // YYYY-MM
  label: string
  start: Date
  end: Date // exclusive
}

/** สร้างรายการ "เดือนล่าสุด count เดือน" ย้อนหลัง ใช้เลือกช่วงเวลาในหน้ารายงาน */
export function buildLastMonths(count: number): MonthOption[] {
  const now = new Date()
  const months: MonthOption[] = []
  for (let i = 0; i < count; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    const label = start.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
    months.push({ key, start, end, label })
  }
  return months
}

export function toDateInputStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

/** วันที่แบบไทย เช่น "13 สิงหาคม 2026" — ใช้ปี ค.ศ. ตรงตามที่แสดงทั้งระบบ ไม่แปลงเป็น พ.ศ. */
export function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const THAI_DIGIT_NAMES = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const THAI_PLACE_NAMES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

function readThaiDigitGroup(group: string): string {
  let result = ''
  const len = group.length
  for (let i = 0; i < len; i++) {
    const digit = parseInt(group[i], 10)
    const placeIndex = len - i - 1
    if (digit === 0) continue
    if (placeIndex === 0 && digit === 1 && len > 1) {
      result += 'เอ็ด'
    } else if (placeIndex === 1 && digit === 1) {
      result += 'สิบ'
    } else if (placeIndex === 1 && digit === 2) {
      result += 'ยี่สิบ'
    } else {
      result += THAI_DIGIT_NAMES[digit] + THAI_PLACE_NAMES[placeIndex]
    }
  }
  return result
}

function readThaiInteger(numStr: string): string {
  const trimmed = numStr.replace(/^0+(?=\d)/, '')
  if (trimmed === '0') return 'ศูนย์'
  const groups: string[] = []
  let s = trimmed
  while (s.length > 0) {
    groups.unshift(s.slice(-6))
    s = s.slice(0, -6)
  }
  let result = ''
  for (let g = 0; g < groups.length; g++) {
    const groupNum = parseInt(groups[g], 10)
    if (groupNum === 0) continue
    result += readThaiDigitGroup(String(groupNum))
    if (g < groups.length - 1) result += 'ล้าน'
  }
  return result
}

/** แปลงจำนวนเงินเป็นตัวอักษรไทย เช่น 12000 → "หนึ่งหมื่นสองพันบาทถ้วน" ใช้ในเอกสารบัญชี */
export function thaiBahtText(amount: number): string {
  const negative = amount < 0
  const rounded = Math.round(Math.abs(amount) * 100) / 100
  const [intPartStr, decPartStr] = rounded.toFixed(2).split('.')
  const satang = parseInt(decPartStr, 10)
  let text = readThaiInteger(intPartStr) + 'บาท'
  text += satang === 0 ? 'ถ้วน' : readThaiInteger(String(satang)) + 'สตางค์'
  return (negative ? 'ลบ' : '') + text
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
