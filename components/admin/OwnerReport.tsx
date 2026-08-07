'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { ProductOwner } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

type OwnerBucket = ProductOwner | 'ไม่ระบุ'

type Stats = {
  availableCount: number
  availableValue: number
}

function emptyStats(): Stats {
  return { availableCount: 0, availableValue: 0 }
}

const BUCKETS: OwnerBucket[] = [...OWNERS, 'ไม่ระบุ']

export default function OwnerReport() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<OwnerBucket, Stats>>(() => {
    const init = {} as Record<OwnerBucket, Stats>
    BUCKETS.forEach((b) => (init[b] = emptyStats()))
    return init
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('products').select('owner, price').eq('status', 'พร้อมขาย')
      const rows = (data as { owner: ProductOwner | null; price: number }[]) ?? []

      const next = {} as Record<OwnerBucket, Stats>
      BUCKETS.forEach((b) => (next[b] = emptyStats()))

      for (const p of rows) {
        const bucket: OwnerBucket = p.owner ?? 'ไม่ระบุ'
        next[bucket].availableCount += 1
        next[bucket].availableValue += p.price
      }
      setStats(next)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายงาน…</p>
  }

  function handleExportExcel() {
    const headers = ['เจ้าของทุน', 'สต็อกคงเหลือ (ชิ้น)', 'มูลค่าสต็อกคงเหลือ']
    const dataRows = BUCKETS.map((owner) => {
      const s = stats[owner]
      return [owner, s.availableCount, s.availableValue]
    })
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'สต็อกคงเหลือ')
    XLSX.writeFile(workbook, 'สต็อกคงเหลือตามเจ้าของทุน.xlsx')
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-ink/50">
        สรุปสต็อกที่ยังไม่ขาย (มูลค่าอิงราคาตั้งขาย) แยกตามเจ้าของทุนของแต่ละเครื่อง — ยอดขาย/กำไรของสินค้าที่ขายไปแล้ว
        ดูได้ที่แท็บ &quot;รายงานการขาย&quot; แทน (กรองตามเจ้าของทุนได้เหมือนกัน)
      </p>

      <button
        type="button"
        onClick={handleExportExcel}
        className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
      >
        ดาวน์โหลด Excel (.xlsx)
      </button>

      {BUCKETS.map((owner) => {
        const s = stats[owner]
        const isUnassigned = owner === 'ไม่ระบุ'
        return (
          <div
            key={owner}
            className={`flex items-center justify-between rounded-card border p-3 ${
              isUnassigned ? 'border-line bg-paper' : 'border-line bg-panel'
            }`}
          >
            <p className="font-display text-sm font-semibold text-ink">{owner}</p>
            {s.availableCount === 0 ? (
              <p className="font-mono text-xs text-ink/40">ไม่มีสต็อกคงเหลือ</p>
            ) : (
              <p className="font-mono text-sm text-ink">
                {s.availableCount} ชิ้น · {formatPrice(s.availableValue)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
