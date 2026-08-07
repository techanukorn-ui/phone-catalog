'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { ProductOwner } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

type OwnerBucket = ProductOwner | 'ไม่ระบุ'

type Item = { product_code: string; price: number }

const BUCKETS: OwnerBucket[] = [...OWNERS, 'ไม่ระบุ']

export default function OwnerReport() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Record<OwnerBucket, Item[]>>(() => {
    const init = {} as Record<OwnerBucket, Item[]>
    BUCKETS.forEach((b) => (init[b] = []))
    return init
  })
  const [expanded, setExpanded] = useState<OwnerBucket | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('owner, product_code, price')
        .eq('status', 'พร้อมขาย')
        .order('product_code', { ascending: true })
      const rows = (data as { owner: ProductOwner | null; product_code: string; price: number }[]) ?? []

      const next = {} as Record<OwnerBucket, Item[]>
      BUCKETS.forEach((b) => (next[b] = []))
      for (const p of rows) {
        const bucket: OwnerBucket = p.owner ?? 'ไม่ระบุ'
        next[bucket].push({ product_code: p.product_code, price: p.price })
      }
      setItems(next)
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
      const list = items[owner]
      return [owner, list.length, list.reduce((sum, p) => sum + p.price, 0)]
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
        ดูได้ที่แท็บ &quot;รายงานการขาย&quot; แทน (กรองตามเจ้าของทุนได้เหมือนกัน) — กดชื่อแต่ละคนเพื่อดูรายการรหัสสินค้า
      </p>

      <button
        type="button"
        onClick={handleExportExcel}
        className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
      >
        ดาวน์โหลด Excel (.xlsx)
      </button>

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {BUCKETS.map((owner) => {
          const list = items[owner]
          const value = list.reduce((sum, p) => sum + p.price, 0)
          const isUnassigned = owner === 'ไม่ระบุ'
          const isOpen = expanded === owner

          return (
            <div
              key={owner}
              className={`rounded-card border ${isUnassigned ? 'border-line bg-paper' : 'border-line bg-panel'}`}
            >
              <button
                type="button"
                onClick={() => list.length > 0 && setExpanded(isOpen ? null : owner)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <p className="font-display text-sm font-semibold text-ink">{owner}</p>
                  {list.length > 0 && (
                    <span className={`text-[10px] text-ink/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  )}
                </span>
                {list.length === 0 ? (
                  <span className="font-mono text-xs text-ink/40">ไม่มีสต็อกคงเหลือ</span>
                ) : (
                  <span className="font-mono text-sm text-ink">
                    {list.length} ชิ้น · {formatPrice(value)}
                  </span>
                )}
              </button>

              {isOpen && list.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-line px-3 pb-3 pt-2">
                  {list.map((p) => (
                    <span
                      key={p.product_code}
                      className="rounded-tag border border-line bg-paper px-2 py-0.5 font-mono text-[11px] text-ink/70"
                    >
                      {p.product_code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
