'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import type { Product } from '@/lib/types'
import { deleteImageByUrl, deleteImagesByUrls } from '@/lib/utils'

type MonthOption = {
  key: string // YYYY-MM
  label: string
  start: Date
  end: Date // exclusive
}

function buildLastMonths(count: number): MonthOption[] {
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

function toDateInputStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n: number | null): string {
  if (n == null) return '-'
  return n.toLocaleString('th-TH')
}

export default function ReportView() {
  const months = useMemo(() => buildLastMonths(3), [])
  const [selectedKey, setSelectedKey] = useState(months[0].key)
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cleanupCandidates, setCleanupCandidates] = useState<Product[] | null>(null)
  const [checkingCleanup, setCheckingCleanup] = useState(false)
  const [deletingCleanup, setDeletingCleanup] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<number | null>(null)

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

  async function checkCleanupCandidates() {
    setCheckingCleanup(true)
    setCleanupDone(null)
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'ขายแล้ว')
      .lt('sold_at', toDateInputStr(oldestStart))
      .order('sold_at', { ascending: true })
    if (!fetchError) {
      setCleanupCandidates((data as Product[]) ?? [])
    }
    setCheckingCleanup(false)
  }

  async function handleCleanup() {
    if (!cleanupCandidates || cleanupCandidates.length === 0) return
    const confirmed = window.confirm(
      `ลบสินค้าที่ขายแล้วเกิน 3 เดือนทั้งหมด ${cleanupCandidates.length} รายการ พร้อมรูปภาพทั้งหมดถาวร ไม่สามารถย้อนกลับได้ ยืนยันหรือไม่?`
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
        const { error: deleteError } = await supabase.from('products').delete().eq('id', p.id)
        if (deleteError) throw deleteError
        done++
      } catch {
        // ข้ามรายการที่ลบไม่สำเร็จ แล้วลบรายการถัดไปต่อ
      }
    }
    setDeletingCleanup(false)
    setCleanupCandidates(null)
    setCleanupDone(done)
  }

  const selectedMonth = months.find((m) => m.key === selectedKey)!
  const filtered = rows.filter((p) => {
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
      'ต้นทุนรวม',
      'ราคาขายจริง',
      'กำไรสุทธิ',
      'ปันผลวอลเล่',
      'ปันผลโบว์',
      'ปันผลเมจิ',
      'ปันผลโบ๊ท',
      'วันที่ขาย',
    ]
    const dataRows = filtered.map((p) => [
      p.product_code,
      p.model_name,
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
    XLSX.writeFile(workbook, `รายงาน-${selectedMonth.key}.xlsx`)
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

      {!loading && !error && filtered.length > 0 && (
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
        >
          ดาวน์โหลด Excel (.xlsx) — {selectedMonth.label}
        </button>
      )}

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
                <th className="whitespace-nowrap px-3 py-2 text-right">ต้นทุนรวม</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ราคาขายจริง</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">กำไรสุทธิ</th>
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
                <td className="whitespace-nowrap px-3 py-2 text-ink" colSpan={2}>
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

      <div className="space-y-2 rounded-card border border-line bg-panel p-3">
        <p className="font-display text-sm font-semibold text-ink">ล้างข้อมูลสินค้าที่ขายแล้วเกิน 3 เดือน</p>
        <p className="font-mono text-xs text-ink/50">
          ลบสินค้าที่สถานะ &quot;ขายแล้ว&quot; และวันที่ขายเก่ากว่า {months[months.length - 1].label} ออกจากฐานข้อมูล
          พร้อมรูปภาพทั้งหมดถาวร (รายการเหล่านี้ไม่แสดงในรายงานอยู่แล้วเพราะเกิน 3 เดือน)
        </p>

        {cleanupDone != null && (
          <p className="rounded-tag bg-teal-light px-3 py-2 text-sm text-teal-dark">
            ลบเรียบร้อย {cleanupDone} รายการ
          </p>
        )}

        {!cleanupCandidates && (
          <button
            type="button"
            onClick={checkCleanupCandidates}
            disabled={checkingCleanup}
            className="w-full rounded-tag border border-line px-4 py-2.5 font-mono text-sm text-ink/70 disabled:opacity-60"
          >
            {checkingCleanup ? 'กำลังตรวจสอบ…' : 'ตรวจสอบรายการที่จะลบ'}
          </button>
        )}

        {cleanupCandidates && cleanupCandidates.length === 0 && (
          <p className="font-mono text-sm text-ink/50">ไม่มีรายการที่เก่าเกิน 3 เดือน ไม่ต้องล้างข้อมูล</p>
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
    </div>
  )
}
