'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Product } from '@/lib/types'
import { buildLastMonths, deleteImageByUrl, deleteImagesByUrls, toDateInputStr } from '@/lib/utils'

export default function SoldCleanupReport() {
  const months = useMemo(() => buildLastMonths(3), [])
  const oldestStart = months[months.length - 1].start
  const cutoffLabel = months[months.length - 1].label

  const [cleanupCandidates, setCleanupCandidates] = useState<Product[] | null>(null)
  const [checkingCleanup, setCheckingCleanup] = useState(false)
  const [deletingCleanup, setDeletingCleanup] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<number | null>(null)

  async function checkCleanupCandidates() {
    setCheckingCleanup(true)
    setCleanupDone(null)
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'ขายแล้ว')
      .lt('sold_at', toDateInputStr(oldestStart))
      .neq('cover_image_url', '')
      .order('sold_at', { ascending: true })
    if (!fetchError) {
      setCleanupCandidates((data as Product[]) ?? [])
    }
    setCheckingCleanup(false)
  }

  async function handleCleanup() {
    if (!cleanupCandidates || cleanupCandidates.length === 0) return
    const confirmed = window.confirm(
      `ลบรูปภาพของสินค้าที่ขายแล้วเกิน 3 เดือนทั้งหมด ${cleanupCandidates.length} รายการถาวร ไม่สามารถย้อนกลับได้ (ข้อมูลตัวเลข/รายงานยังเก็บไว้เหมือนเดิม) ยืนยันหรือไม่?`
    )
    if (!confirmed) return

    setDeletingCleanup(true)
    let done = 0
    for (const p of cleanupCandidates) {
      try {
        await deleteImageByUrl('product-images', p.cover_image_url)
        if (p.gallery_images?.length) {
          await deleteImagesByUrls('product-images', p.gallery_images)
        }
        const { error: updateError } = await supabase
          .from('products')
          .update({ cover_image_url: '', gallery_images: [] })
          .eq('id', p.id)
        if (updateError) throw updateError
        done++
      } catch {
        // ข้ามรายการที่ลบไม่สำเร็จ แล้วลบรายการถัดไปต่อ
      }
    }
    setDeletingCleanup(false)
    setCleanupCandidates(null)
    setCleanupDone(done)
  }

  return (
    <div className="space-y-2 rounded-card border border-line bg-panel p-3">
      <p className="font-display text-sm font-semibold text-ink">ลบรูปภาพสินค้าที่ขายแล้วเกิน 3 เดือน</p>
      <p className="font-mono text-xs text-ink/50">
        ลบเฉพาะ<strong>รูปภาพ</strong>ของสินค้าที่สถานะ &quot;ขายแล้ว&quot; และวันที่ขายเก่ากว่า {cutoffLabel} ออกจาก Storage ถาวร
        เพื่อประหยัดพื้นที่ ส่วนข้อมูลตัวเลข (ต้นทุน/ราคาขาย/กำไร) ยังเก็บไว้เหมือนเดิม ดูย้อนหลังในรายงานได้ต่อ
      </p>

      {cleanupDone != null && (
        <p className="rounded-tag bg-teal-light px-3 py-2 text-sm text-teal-dark">ลบรูปภาพเรียบร้อย {cleanupDone} รายการ</p>
      )}

      {!cleanupCandidates && (
        <button
          type="button"
          onClick={checkCleanupCandidates}
          disabled={checkingCleanup}
          className="w-full rounded-tag border border-danger px-4 py-2.5 font-mono text-sm font-semibold text-danger disabled:opacity-60"
        >
          {checkingCleanup ? 'กำลังตรวจสอบ…' : 'ตรวจสอบรายการที่จะลบ'}
        </button>
      )}

      {cleanupCandidates && cleanupCandidates.length === 0 && (
        <p className="font-mono text-sm text-ink/50">ไม่มีรูปภาพที่เก่าเกิน 3 เดือนต้องลบแล้ว</p>
      )}

      {cleanupCandidates && cleanupCandidates.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-tag border border-line bg-paper p-2">
            {cleanupCandidates.map((p) => (
              <p key={p.id} className="font-mono text-xs text-ink/70">
                {p.product_code} · {p.model_name} · {p.sold_at}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCleanup}
              disabled={deletingCleanup}
              className="flex-1 rounded-tag bg-danger px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
            >
              {deletingCleanup ? 'กำลังลบ…' : `ลบทั้งหมด ${cleanupCandidates.length} รายการ`}
            </button>
            <button
              type="button"
              onClick={() => setCleanupCandidates(null)}
              disabled={deletingCleanup}
              className="rounded-tag border border-line px-4 py-2.5 font-mono text-sm text-ink/70"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
