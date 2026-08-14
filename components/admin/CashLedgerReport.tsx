'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { PaymentVoucher, Product } from '@/lib/types'
import { formatPrice, toDateInputStr } from '@/lib/utils'

type Props = {
  owner: string
}

type LedgerEntry = {
  date: string
  label: string
  reference: string
  amount: number // บวก = รับเข้า, ลบ = จ่ายออก
}

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

function periodMonthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
}

export default function CashLedgerReport({ owner }: Props) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [fromDate, setFromDate] = useState(defaultFrom())
  const [toDate, setToDate] = useState(toDateInputStr(new Date()))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [productsRes, vouchersRes] = await Promise.all([
        supabase.from('products').select('*').eq('owner', owner).or('purchase_bank.eq.TTB,sale_bank.eq.TTB'),
        supabase.from('payment_vouchers').select('*').eq('payee', 'เมจิ').eq('owner', owner),
      ])
      if (cancelled) return
      if (productsRes.error || vouchersRes.error) {
        setError(productsRes.error?.message ?? vouchersRes.error?.message ?? 'โหลดข้อมูลไม่สำเร็จ')
        setLoading(false)
        return
      }

      const built: LedgerEntry[] = []

      for (const p of (productsRes.data as Product[]) ?? []) {
        if (p.purchase_payment_method === 'โอน' && p.purchase_bank === 'TTB' && p.purchase_date) {
          built.push({
            date: p.purchase_date,
            label: `ซื้อ ${p.model_name} ${p.capacity ?? ''} ${p.color ?? ''}`.trim(),
            reference: p.product_code,
            amount: -(p.cost_device ?? 0),
          })
        }
        if (p.status === 'ขายแล้ว' && p.sale_payment_method === 'โอน' && p.sale_bank === 'TTB' && p.sold_at) {
          built.push({
            date: p.sold_at,
            label: `ขาย ${p.model_name} ${p.capacity ?? ''} ${p.color ?? ''}`.trim(),
            reference: p.product_code,
            amount: p.sale_price ?? 0,
          })
        }
      }

      for (const v of (vouchersRes.data as PaymentVoucher[]) ?? []) {
        built.push({
          date: v.created_at.slice(0, 10),
          label: `จ่ายปันผลเมจิ งวด ${periodMonthLabel(v.period_month)}`,
          reference: v.doc_number,
          amount: -v.total_amount,
        })
      }

      built.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      setEntries(built)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [owner])

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
        <p className="text-sm text-[#8A8FA3]">กำลังโหลดข้อมูล…</p>
      </div>
    )
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>
  }

  const displayEntries = entries.filter((e) => e.date >= fromDate && e.date <= toDate)

  // ยอดคงเหลือสะสมนับจากรายการแรกสุดในช่วงที่กรอง (ไม่ใช่ยอดยกมาจากก่อนหน้าช่วง — เป็นยอดสุทธิเฉพาะช่วงที่ดูอยู่)
  let running = 0
  const rows = displayEntries.map((e) => {
    running += e.amount
    return { ...e, balance: running }
  })

  const totalIn = displayEntries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const totalOut = displayEntries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ตั้งแต่วันที่</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-[#E4E6EF] bg-white px-3 py-2 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ถึงวันที่</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-[#E4E6EF] bg-white px-3 py-2 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            พิมพ์ / บันทึกเป็น PDF
          </button>
        )}
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-[#1B1E2B]">รายงานเงินสดรับ-จ่าย — เจ้าของทุน {owner}</h1>
        <p className="text-[13px] text-[#4B4F5B]">
          วันที่ {fromDate} ถึง {toDate} · {rows.length} รายการ
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[13px]">
        <div className="rounded-2xl border border-[#E4E6EF] bg-white p-3 text-center">
          <p className="text-[#8A8FA3]">รับเข้ารวม</p>
          <p className="mt-0.5 text-base font-semibold text-[#0E7C6B]">{formatPrice(totalIn)}</p>
        </div>
        <div className="rounded-2xl border border-[#E4E6EF] bg-white p-3 text-center">
          <p className="text-[#8A8FA3]">จ่ายออกรวม</p>
          <p className="mt-0.5 text-base font-semibold text-red-600">{formatPrice(Math.abs(totalOut))}</p>
        </div>
        <div className="rounded-2xl border border-[#3B5BFF]/20 bg-[#EEF1FF] p-3 text-center">
          <p className="text-[#3B5BFF]">คงเหลือสุทธิ (ช่วงนี้)</p>
          <p className="mt-0.5 text-base font-semibold text-[#3B5BFF]">{formatPrice(totalIn + totalOut)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
          <p className="text-sm font-medium text-[#1B1E2B]">ไม่มีรายการในช่วงวันที่ที่เลือก</p>
          <p className="mt-1 text-[13px] text-[#8A8FA3]">เจ้าของทุน {owner}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)] print:rounded-none print:border-0 print:shadow-none">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#E4E6EF] bg-[#F8F9FC] text-left text-[#4B4F5B] print:bg-white">
                <th className="w-[12%] px-3 py-2.5">วันที่</th>
                <th className="w-[38%] px-3 py-2.5">รายการ</th>
                <th className="w-[16%] px-3 py-2.5">อ้างอิง</th>
                <th className="w-[12%] px-3 py-2.5 text-right">รับเข้า</th>
                <th className="w-[12%] px-3 py-2.5 text-right">จ่ายออก</th>
                <th className="w-[10%] px-3 py-2.5 text-right">คงเหลือสะสม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#E4E6EF] text-[#1B1E2B] last:border-b-0 print:break-inside-avoid">
                  <td className="px-3 py-2 align-top">{r.date}</td>
                  <td className="break-words px-3 py-2 align-top">{r.label}</td>
                  <td className="break-words px-3 py-2 align-top font-mono">{r.reference}</td>
                  <td className="px-3 py-2 text-right align-top text-[#0E7C6B]">
                    {r.amount > 0 ? formatPrice(r.amount) : ''}
                  </td>
                  <td className="px-3 py-2 text-right align-top text-red-600">
                    {r.amount < 0 ? formatPrice(Math.abs(r.amount)) : ''}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-medium">{formatPrice(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
