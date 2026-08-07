'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { STAGNANT_DAYS, buildLastMonths, daysSince, formatPrice, toDateInputStr, type MonthOption } from '@/lib/utils'

type AvailableStats = { count: number; totalValue: number; stagnantCount: number }
type SoldStats = { count: number; profit: number }

function aggregateSold(
  rows: { sale_price: number | null; net_profit: number | null; sold_at: string | null }[],
  month: MonthOption
): SoldStats {
  const inMonth = rows.filter((p) => {
    if (!p.sold_at) return false
    const d = new Date(p.sold_at)
    return d >= month.start && d < month.end
  })
  return {
    count: inMonth.length,
    profit: inMonth.reduce((sum, p) => sum + (p.net_profit ?? 0), 0),
  }
}

function StatTile({ label, value, delta }: { label: string; value: string; delta?: { text: string; good: boolean | null } }) {
  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 break-words font-display text-xl font-semibold text-ink">{value}</p>
      {delta && (
        <p className={`mt-0.5 font-mono text-[11px] ${delta.good === null ? 'text-ink/40' : delta.good ? 'text-success' : 'text-ink/50'}`}>
          {delta.text}
        </p>
      )}
    </div>
  )
}

export default function OverviewDashboard() {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<AvailableStats>({ count: 0, totalValue: 0, stagnantCount: 0 })
  const [thisMonth, setThisMonth] = useState<SoldStats>({ count: 0, profit: 0 })
  const [lastMonth, setLastMonth] = useState<SoldStats>({ count: 0, profit: 0 })
  const [months] = useState(() => buildLastMonths(2))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: availableRows }, { data: soldRows }] = await Promise.all([
        supabase.from('products').select('price, listed_at').eq('status', 'พร้อมขาย'),
        supabase
          .from('products')
          .select('sale_price, net_profit, sold_at')
          .eq('status', 'ขายแล้ว')
          .gte('sold_at', toDateInputStr(months[1].start)),
      ])

      const avail = (availableRows as { price: number; listed_at: string }[]) ?? []
      setAvailable({
        count: avail.length,
        totalValue: avail.reduce((sum, p) => sum + p.price, 0),
        stagnantCount: avail.filter((p) => daysSince(p.listed_at) > STAGNANT_DAYS).length,
      })

      const sold = (soldRows as { sale_price: number | null; net_profit: number | null; sold_at: string | null }[]) ?? []
      setThisMonth(aggregateSold(sold, months[0]))
      setLastMonth(aggregateSold(sold, months[1]))
      setLoading(false)
    }
    load()
  }, [months])

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดภาพรวม…</p>
  }

  const soldDelta = thisMonth.count - lastMonth.count
  const profitDelta = thisMonth.profit - lastMonth.profit

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="มูลค่าสต็อกคงเหลือ" value={formatPrice(available.totalValue)} />
        <StatTile label="สินค้าพร้อมขาย" value={`${available.count} ชิ้น`} />
        <StatTile
          label={`ขายแล้ว — ${months[0].label}`}
          value={`${thisMonth.count} ชิ้น`}
          delta={{
            text: soldDelta === 0 ? 'เท่ากับเดือนก่อน' : `${soldDelta > 0 ? '▲' : '▼'} ${Math.abs(soldDelta)} ชิ้น เทียบเดือนก่อน`,
            good: soldDelta === 0 ? null : soldDelta > 0,
          }}
        />
        <StatTile
          label={`กำไรสุทธิ(ก่อนแบ่งปันผล) — ${months[0].label}`}
          value={formatPrice(thisMonth.profit)}
          delta={{
            text: profitDelta === 0 ? 'เท่ากับเดือนก่อน' : `${profitDelta > 0 ? '▲' : '▼'} ${formatPrice(Math.abs(profitDelta))} เทียบเดือนก่อน`,
            good: profitDelta === 0 ? null : profitDelta > 0,
          }}
        />
      </div>

      <div
        className={`flex items-center gap-3 rounded-card border p-3 ${
          available.stagnantCount > 0 ? 'border-danger bg-danger/5' : 'border-line bg-panel'
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${
            available.stagnantCount > 0 ? 'bg-danger text-white' : 'bg-success text-white'
          }`}
        >
          {available.stagnantCount > 0 ? '!' : '✓'}
        </span>
        <div className="min-w-0">
          <p className={`font-mono text-sm font-semibold ${available.stagnantCount > 0 ? 'text-danger' : 'text-ink'}`}>
            {available.stagnantCount > 0
              ? `มีสินค้าค้างสต็อกเกิน ${STAGNANT_DAYS} วัน ${available.stagnantCount} ชิ้น`
              : `ไม่มีสินค้าค้างสต็อกเกิน ${STAGNANT_DAYS} วัน`}
          </p>
          <p className="font-mono text-[11px] text-ink/50">ดูรายละเอียดได้ที่แท็บ &quot;รายงาน&quot;</p>
        </div>
      </div>
    </div>
  )
}
