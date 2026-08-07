'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import type { Product } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

const STAGNANT_DAYS = 15

function daysSince(dateStr: string): number {
  const listed = new Date(dateStr)
  const listedUTC = Date.UTC(listed.getFullYear(), listed.getMonth(), listed.getDate())
  const now = new Date()
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((todayUTC - listedUTC) / (1000 * 60 * 60 * 24))
}

export default function StagnantStockReport() {
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'พร้อมขาย')
        .order('listed_at', { ascending: true })
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const stagnant = rows.filter((p) => daysSince(p.listed_at) > STAGNANT_DAYS)

  function handleExportExcel() {
    const headers = ['รหัสสินค้า', 'หมวดหมู่', 'ชื่อรุ่น', 'ราคา', 'วันที่ลงขาย', 'ค้างมาแล้ว (วัน)']
    const dataRows = stagnant.map((p) => [
      p.product_code,
      p.category,
      p.model_name,
      p.price,
      p.listed_at,
      daysSince(p.listed_at),
    ])
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'ค้างสต็อก')
    XLSX.writeFile(workbook, `สินค้าค้างสต็อกเกิน-${STAGNANT_DAYS}-วัน.xlsx`)
  }

  return (
    <div className="space-y-3">
      {loading && <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายงาน…</p>}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <p className="font-mono text-xs text-ink/50">
          สินค้าพร้อมขายที่ลงขายมาแล้วเกิน {STAGNANT_DAYS} วัน ยังไม่ถูกขาย — พบ {stagnant.length} รายการ
        </p>
      )}

      {!loading && !error && stagnant.length > 0 && (
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
        >
          ดาวน์โหลด Excel (.xlsx)
        </button>
      )}

      {!loading && !error && stagnant.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-ink/50">
          ไม่มีสินค้าค้างสต็อกเกิน {STAGNANT_DAYS} วัน
        </p>
      )}

      {!loading && !error && stagnant.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="min-w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-ink/60">
                <th className="whitespace-nowrap px-3 py-2">รหัสสินค้า</th>
                <th className="whitespace-nowrap px-3 py-2">หมวดหมู่</th>
                <th className="whitespace-nowrap px-3 py-2">ชื่อรุ่น</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ราคา</th>
                <th className="whitespace-nowrap px-3 py-2">วันที่ลงขาย</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ค้างมาแล้ว</th>
              </tr>
            </thead>
            <tbody>
              {stagnant.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.product_code}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.category}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.model_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{formatPrice(p.price)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{p.listed_at}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-danger">
                    {daysSince(p.listed_at)} วัน
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
