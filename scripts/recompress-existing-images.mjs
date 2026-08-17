#!/usr/bin/env node
// scripts/recompress-existing-images.mjs
//
// ไล่บีบอัด "รูปเก่า" ที่อัปโหลดไปแล้วใน Supabase Storage (product-images, store-assets)
// ให้เล็กลงแบบเดียวกับรูปใหม่ (resize + แปลงเป็น WebP) แล้วอัปเดต URL ในฐานข้อมูลให้ตรง
//
// ⚠️ ต้องรันจากเครื่องคุณเอง (ไม่ใช่ผ่าน Claude) เพราะต้องใช้ service_role key
//    ซึ่งเป็นกุญแจสิทธิ์สูงสุด ห้ามหลุดออกไปที่ไหนเด็ดขาด (ไม่ควรวางในแชท ไม่ควร commit ขึ้น git)
//
// วิธีใช้:
//   1) ติดตั้งไลบรารีสำหรับแปลงรูป (ใช้ครั้งเดียว):
//        npm install sharp
//
//   2) เปิด Supabase Dashboard > Project Settings > API > คัดลอกค่า "service_role" (secret)
//      แล้วเปิดไฟล์ .env.local (ไฟล์เดิมในโปรเจกต์ ถูก gitignore ไว้แล้ว ไม่หลุดขึ้น git แน่นอน)
//      เพิ่มบรรทัดนี้ต่อท้าย:
//        SUPABASE_SERVICE_ROLE_KEY=วางค่าที่คัดลอกมาตรงนี้
//
//   3) รันโหมดพรีวิวก่อน (แค่ดูว่าจะเกิดอะไรขึ้น ยังไม่แก้อะไรจริง):
//        node scripts/recompress-existing-images.mjs --dry-run
//
//   4) ถ้าผลลัพธ์ในพรีวิวดูโอเค ค่อยรันจริง:
//        node scripts/recompress-existing-images.mjs
//
//      สคริปต์จะ: อัปโหลดไฟล์ที่บีบอัดแล้วขึ้นก่อน -> อัปเดต URL ในตาราง products/store_settings
//      ให้ชี้ไฟล์ใหม่ -> ค่อยลบไฟล์เก่าทิ้ง (เรียงลำดับแบบนี้เพื่อกันข้อมูลหายถ้าขั้นตอนกลางทางล้มเหลว)
//      พร้อมเซฟไฟล์ image-migration-backup-<timestamp>.json ไว้เป็นสำเนารายการ URL เก่า/ใหม่เผื่อต้องย้อนกลับ

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// ---------- โหลดตัวแปรจาก .env.local (parser ง่าย ๆ ไม่พึ่ง dependency เพิ่ม) ----------
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌ ขาด NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local\n' +
      '   ดูคำแนะนำวิธีตั้งค่าที่คอมเมนต์ด้านบนของไฟล์นี้'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const DRY_RUN = process.argv.includes('--dry-run')

// ต้องตรงกับค่าที่ใช้ใน lib/utils.ts (uploadImage) เพื่อให้รูปใหม่/เก่าสม่ำเสมอกัน
const BUCKET_CONFIG = {
  'product-images': { maxDimension: 1600, quality: 82 },
  'store-assets': { maxDimension: 800, quality: 85 },
}

// ไฟล์ที่ข้าม: gif (กันแอนิเมชันเสีย) และ webp (แปลงไปแล้วจากการอัปโหลดรอบใหม่)
const SKIP_EXT = new Set(['gif', 'webp'])

async function listAllObjects(bucket, prefix = '') {
  let out = []
  let offset = 0
  const limit = 1000
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // เป็นโฟลเดอร์ ไล่ลงไปอีกชั้น
        const sub = await listAllObjects(bucket, fullPath)
        out = out.concat(sub)
      } else {
        out.push({ path: fullPath, size: item.metadata?.size ?? 0 })
      }
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

function publicUrl(bucket, objectPath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return data.publicUrl
}

// รายชื่อโฟลเดอร์บางอันที่ listAllObjects() รายงานตัวพิมพ์มาไม่ตรงกับ object key จริง
// (เช่นโฟลเดอร์ที่เคยตั้งชื่อจากค่า category ตอนยังสะกดไม่ตรงกัน) ทำให้ download() ด้วย path ตามที่ list()
// รายงานมาแล้วไม่เจอไฟล์ (Object not found) ทั้งที่ไฟล์จริงมีอยู่ — ลองสลับตัวพิมพ์ของโฟลเดอร์บนสุดเป็นตัวใหญ่ทั้งหมดซ้ำอีกที
async function downloadWithCaseFallback(bucket, objectPath) {
  const direct = await supabase.storage.from(bucket).download(objectPath)
  if (!direct.error) return { blob: direct.data, path: objectPath }

  const segments = objectPath.split('/')
  if (segments.length > 1) {
    const altPath = [segments[0].toUpperCase(), ...segments.slice(1)].join('/')
    if (altPath !== objectPath) {
      const retry = await supabase.storage.from(bucket).download(altPath)
      if (!retry.error) return { blob: retry.data, path: altPath }
    }
  }
  return { blob: null, error: direct.error, path: objectPath }
}

async function compressOne(bucket, objectPath) {
  const ext = objectPath.split('.').pop()?.toLowerCase() ?? ''
  if (SKIP_EXT.has(ext)) return null

  const { blob, error: dlErr, path: realPath } = await downloadWithCaseFallback(bucket, objectPath)
  if (dlErr) {
    console.warn(`  ⚠ ดาวน์โหลดไม่สำเร็จ: ${objectPath} (${dlErr.message})`)
    return null
  }
  objectPath = realPath // ใช้ path จริงที่ดาวน์โหลดสำเร็จ (เผื่อสลับตัวพิมพ์ไปแล้ว) ต่อจากนี้
  const inputBuffer = Buffer.from(await blob.arrayBuffer())
  const { maxDimension, quality } = BUCKET_CONFIG[bucket]

  let outputBuffer
  try {
    outputBuffer = await sharp(inputBuffer)
      .rotate() // เคารพ EXIF orientation ก่อน resize กันรูปหมุนผิดด้าน
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()
  } catch (err) {
    console.warn(`  ⚠ แปลงไฟล์ไม่สำเร็จ: ${objectPath} (${err.message})`)
    return null
  }

  if (outputBuffer.length >= inputBuffer.length) {
    return null // บีบแล้วไม่เล็กลง ไม่คุ้มเปลี่ยน
  }

  const newPath = objectPath.replace(/\.[^./]+$/, '') + '.webp'

  return {
    oldPath: objectPath,
    newPath,
    oldSize: inputBuffer.length,
    newSize: outputBuffer.length,
    buffer: outputBuffer,
  }
}

async function processBucket(bucket) {
  console.log(`\n=== ${bucket} ===`)
  const objects = await listAllObjects(bucket)
  console.log(`พบ ${objects.length} ไฟล์`)

  const changes = [] // { oldUrl, newUrl, oldPath, newPath }
  let savedBytes = 0

  for (const obj of objects) {
    const result = await compressOne(bucket, obj.path)
    if (!result) continue

    const saved = result.oldSize - result.newSize
    savedBytes += saved
    console.log(
      `  ${result.oldPath} : ${(result.oldSize / 1024).toFixed(0)}KB → ${(result.newSize / 1024).toFixed(0)}KB (ประหยัด ${(saved / 1024).toFixed(0)}KB)`
    )

    if (DRY_RUN) continue

    // อัปโหลดไฟล์ใหม่ก่อน (ยังไม่ลบของเก่า กันข้อมูลหายถ้าล้มเหลวกลางทาง)
    const { error: upErr } = await supabase.storage.from(bucket).upload(result.newPath, result.buffer, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: true,
    })
    if (upErr) {
      console.warn(`  ⚠ อัปโหลดไฟล์ใหม่ไม่สำเร็จ: ${result.newPath} (${upErr.message}) — ข้ามไฟล์นี้`)
      continue
    }

    changes.push({
      oldUrl: publicUrl(bucket, result.oldPath),
      newUrl: publicUrl(bucket, result.newPath),
      oldPath: result.oldPath,
      newPath: result.newPath,
    })
  }

  return { changes, savedBytes, totalFiles: objects.length }
}

async function updateProductsTable(changes) {
  if (changes.length === 0) return
  const { data: products, error } = await supabase.from('products').select('id, cover_image_url, gallery_images')
  if (error) throw error

  const urlMap = new Map(changes.map((c) => [c.oldUrl, c.newUrl]))

  for (const p of products) {
    let changed = false
    let cover = p.cover_image_url
    if (cover && urlMap.has(cover)) {
      cover = urlMap.get(cover)
      changed = true
    }
    const gallery = p.gallery_images ?? []
    const newGallery = gallery.map((u) => {
      if (urlMap.has(u)) {
        changed = true
        return urlMap.get(u)
      }
      return u
    })

    if (!changed) continue

    if (DRY_RUN) {
      console.log(`  [dry-run] จะอัปเดตสินค้า ${p.id}`)
      continue
    }
    const { error: updErr } = await supabase
      .from('products')
      .update({ cover_image_url: cover, gallery_images: newGallery })
      .eq('id', p.id)
    if (updErr) console.warn(`  ⚠ อัปเดตตาราง products แถว ${p.id} ไม่สำเร็จ: ${updErr.message}`)
  }
}

async function updateStoreSettings(changes) {
  if (changes.length === 0) return
  const { data: settings, error } = await supabase
    .from('store_settings')
    .select('id, logo_url')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!settings?.logo_url) return

  const match = changes.find((c) => c.oldUrl === settings.logo_url)
  if (!match) return

  if (DRY_RUN) {
    console.log('  [dry-run] จะอัปเดตโลโก้ร้าน')
    return
  }
  const { error: updErr } = await supabase.from('store_settings').update({ logo_url: match.newUrl }).eq('id', 1)
  if (updErr) console.warn(`  ⚠ อัปเดต logo_url ไม่สำเร็จ: ${updErr.message}`)
}

async function deleteOldFiles(bucket, changes) {
  if (DRY_RUN || changes.length === 0) return
  const paths = changes.map((c) => c.oldPath)
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) console.warn(`  ⚠ ลบไฟล์เก่าใน ${bucket} ไม่สำเร็จบางไฟล์: ${error.message}`)
}

async function main() {
  console.log(DRY_RUN ? '🔍 โหมดพรีวิว (ยังไม่มีการแก้ไขอะไรจริง)' : '🚀 กำลังบีบอัดรูปเก่าจริง — จะแก้ไข Storage และฐานข้อมูล')

  let totalSaved = 0
  const backup = { generatedAt: new Date().toISOString(), buckets: {} }

  for (const bucket of Object.keys(BUCKET_CONFIG)) {
    const { changes, savedBytes } = await processBucket(bucket)
    totalSaved += savedBytes
    backup.buckets[bucket] = changes

    if (bucket === 'product-images') await updateProductsTable(changes)
    if (bucket === 'store-assets') await updateStoreSettings(changes)

    // ลบไฟล์เก่าหลังอัปเดตฐานข้อมูลให้ชี้ไฟล์ใหม่สำเร็จแล้วเท่านั้น
    await deleteOldFiles(bucket, changes)
  }

  if (!DRY_RUN) {
    const backupPath = path.resolve(process.cwd(), `image-migration-backup-${Date.now()}.json`)
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2))
    console.log(`\n📝 บันทึกรายการ URL เก่า/ใหม่ไว้ที่: ${backupPath} (เผื่อต้องย้อนกลับ)`)
  }

  console.log(`\n✅ รวมพื้นที่ที่ประหยัดได้: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`)
  if (DRY_RUN) {
    console.log('(นี่คือโหมดพรีวิว ยังไม่มีอะไรถูกแก้ไขจริง — รันโดยไม่ใส่ --dry-run เพื่อทำจริง)')
  }
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err)
  process.exit(1)
})
