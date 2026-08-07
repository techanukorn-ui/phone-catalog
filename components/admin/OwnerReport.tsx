'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { ProductOwner } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

type OwnerBucket = ProductOwner | 'ไม่ระบุ'

type Stats = {
  availableCount: number
  availableValue: number
  soldCount: number
  saleTotal: number
  profitTotal: number
}

function emptyStats(): Stats {
  return { availableCount: 0, availableValue: 0, soldCount: 0, saleTotal: 0, profitTotal: 0 }
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
      const { data } = await supabase.from('products').select('owner, status, price, sale_price, net_profit')
      const rows =
        (data as {
          owner: ProductOwner | null
          status: 'พร้อมขาย' | 'ขายแล้ว'
          price: number
          sale_price: number | null
          net_profit: number | null
        }[]) ?? []

      const next = {} as Record<OwnerBucket, Stats>
      BUCKETS.forEach((b) => (next[b] = emptyStats()))

      for (const p of rows) {
        const bucket: OwnerBucket = p.owner ?? 'ไม่ระบุ'
        if (p.status === 'พร้อมขาย') {
          next[bucket].availableCount += 1
          next[bucket].availableValue += p.price
        } else {
          next[bucket].soldCount += 1
          next[bucket].saleTotal += p.sale_price ?? 0
          next[bucket].profitTotal += p.net_profit ?? 0
        }
      }
      setStats(next)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายงาน…</p>
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-ink/50">
        สรุปสต็อกและยอดขายทั้งหมด (ไม่จำกัดช่วงเวลา) แยกตามเจ้าของทุนของแต่ละเครื่อง
      </p>

      {BUCKETS.map((owner) => {
        const s = stats[owner]
        const hasAny = s.availableCount > 0 || s.soldCount > 0
        const isUnassigned = owner === 'ไม่ระบุ'
        return (
          <div
            key={owner}
            className={`rounded-card border p-3 ${isUnassigned ? 'border-line bg-paper' : 'border-line bg-panel'}`}
          >
            <p className="mb-2 font-display text-sm font-semibold text-ink">{owner}</p>
            {!hasAny ? (
              <p className="font-mono text-xs text-ink/40">ยังไม่มีสินค้า</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">สต็อกคงเหลือ</p>
                  <p className="font-mono text-sm text-ink">
                    {s.availableCount} ชิ้น · {formatPrice(s.availableValue)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">ขายแล้วทั้งหมด</p>
                  <p className="font-mono text-sm text-ink">
                    {s.soldCount} ชิ้น · {formatPrice(s.saleTotal)}
                  </p>
                  <p className="font-mono text-xs font-semibold text-teal-dark">กำไรสุทธิ {formatPrice(s.profitTotal)}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
