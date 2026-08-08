'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { Product, ProductOwner } from '@/lib/types'
import { buildLastMonths, toDateInputStr } from '@/lib/utils'
import SalesComparisonChart from './SalesComparisonChart'

type OwnerFilter = 'ทั้งหมด' | ProductOwner

function fmt(n: number | null): string {
  if (n == null) return '-'
  return n.toLocaleString('th-TH')
}

export default function ReportView() {
  const months = useMemo(() => buildLastMonths(3), [])
  const [selectedKey, setSelectedKey] = useState(months[0].key)
  const [activeOwner, setActiveOwner] = useState<OwnerFilter>('ทั้งหมด')
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const oldestStart = months[months.length - 1].start

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'ขายแล้ว')
        .gte('sold_at', toDateInputStr(oldestStart))
        .order('sold_at', { ascending: false })
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
    // oldestStart is derived from `months`, which is stable via useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ownerFilteredRows = activeOwner === 'ทั้งหมด' ? rows : rows.filter((p) => p.owner === activeOwner)

  const selectedMonth = months.find((m) => m.key === selectedKey)!
  const filtered = ownerFilteredRows.filter((p) => {
    if (!p.sold_at) return false
    const d = new Date(p.sold_at)
    return d >= selectedMonth.start && d < selectedMonth.end
  })

  const totals = filtered.reduce(
    (acc, p) => {
      acc.total_cost += p.total_cost ?? 0
      acc.sale_price += p.sale_price ?? 0
      acc.net_profit += p.net_profit ?? 0
      acc.dividend_wallet += p.dividend_wallet ?? 0
      acc.dividend_bow += p.dividend_bow ?? 0
      acc.dividend_magic += p.dividend_magic ?? 0
      acc.dividend_boat += p.dividend_boat ?? 0
      return acc
    },
    {
      total_cost: 0,
      sale_price: 0,
      net_profit: 0,
      dividend_wallet: 0,
      dividend_bow: 0,
      dividend_magic: 0,
      dividend_boat: 0,
    }
  )

  function handleExportExcel() {
    const headers = [
      'รหัสสินค้า',
      'ชื่อรุ่น',
      'เจ้าของทุน',
      'ต้นทุนรวม',
      'ราคาขายจริง',
      'กำไรสุทธิ(ก่อนแบ่งปันผล)',
      'ปันผลวอลเล่',
      'ปันผลโบว์',
      'ปันผลเมจิ',
      'ปันผลโบ๊ท',
      'วันที่ขาย',
    ]
    const dataRows = filtered.map((p) => [
      p.product_code,
      p.model_name,
      p.owner ?? 'ไม่ระบุ',
      p.total_cost ?? 0,
      p.sale_price ?? 0,
      p.net_profit ?? 0,
      p.dividend_wallet ?? 0,
      p.dividend_bow ?? 0,
      p.dividend_magic ?? 0,
      p.dividend_boat ?? 0,
      p.sold_at ?? '',
    ])
    const totalRow = [
      'รวม',
      '',
      '',
      totals.total_cost,
      totals.sale_price,
      totals.net_profit,
      totals.dividend_wallet,
      totals.dividend_bow,
      totals.dividend_magic,
      totals.dividend_boat,
      '',
    ]
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'รายงาน')
    const ownerSuffix = activeOwner !== 'ทั้งหมด' ? `-${activeOwner}` : ''
    XLSX.writeFile(workbook, `รายงาน-${selectedMonth.key}${ownerSuffix}.xlsx`)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedKey(m.key)}
            className={`flex-1 rounded-tag border px-3 py-2 font-mono text-xs ${
              selectedKey === m.key ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="pill-row sm:justify-center">
        {(['ทั้งหมด', ...OWNERS] as OwnerFilter[]).map((o) => (
          <button
            key={o}
            onClick={() => setActiveOwner(o)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activeOwner === o
                ? 'border-teal bg-teal text-white'
                : 'border-line bg-panel text-ink/70 active:bg-line/40'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายงาน…</p>}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-ink/50">ไม่มีรายการขายในเดือนนี้</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="min-w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-ink/60">
                <th className="whitespace-nowrap px-3 py-2">รหัสสินค้า</th>
                <th className="whitespace-nowrap px-3 py-2">ชื่อรุ่น</th>
                {activeOwner === 'ทั้งหมด' && <th className="whitespace-nowrap px-3 py-2">เจ้าของทุน</th>}
                <th className="whitespace-nowrap px-3 py-2 text-right">ต้นทุนรวม</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ราคาขายจริง</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">กำไรสุทธิ(ก่อนแบ่งปันผล)</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ปันผลวอลเล่</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ปันผลโบว์</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ปันผลเมจิ</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ปันผลโบ๊ท</th>
                <th className="whitespace-nowrap px-3 py-2">วันที่ขาย</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.product_code}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.model_name}</td>
                  {activeOwner === 'ทั้งหมด' && (
                    <td className="whitespace-nowrap px-3 py-2 text-ink/70">{p.owner ?? 'ไม่ระบุ'}</td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.total_cost)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.sale_price)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-teal-dark">
                    {fmt(p.net_profit)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.dividend_wallet)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.dividend_bow)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.dividend_magic)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(p.dividend_boat)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.sold_at}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-paper font-semibold">
                <td className="whitespace-nowrap px-3 py-2 text-ink" colSpan={activeOwner === 'ทั้งหมด' ? 3 : 2}>
                  รวม
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.total_cost)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.sale_price)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-teal-dark">{fmt(totals.net_profit)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.dividend_wallet)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.dividend_bow)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.dividend_magic)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{fmt(totals.dividend_boat)}</td>
                <td className="whitespace-nowrap px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
        >
          ดาวน์โหลด Excel (.xlsx) — {selectedMonth.label}
        </button>
      )}

      {!loading && !error && (
        <SalesComparisonChart
          rows={ownerFilteredRows}
          months={months}
          titleSuffix={activeOwner !== 'ทั้งหมด' ? activeOwner : undefined}
        />
      )}
    </div>
  )
}
