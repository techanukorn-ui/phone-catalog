'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { Product, ProductOwner } from '@/lib/types'
import { formatPrice, toDateInputStr } from '@/lib/utils'

const BANK = 'TTB' as const

type OwnerFilter = 'ทั้งหมด' | ProductOwner

type LedgerEntry = {
  key: string
  date: string
  type: 'ซื้อ' | 'ขาย'
  amount: number
  product: Product
  slipUrl: string | null
}

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

export default function BankReconcileReport() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(toDateInputStr(new Date()))
  const [activeOwner, setActiveOwner] = useState<OwnerFilter>('ทั้งหมด')
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .or(`purchase_bank.eq.${BANK},sale_bank.eq.${BANK}`)
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const ledger = useMemo(() => {
    const entries: LedgerEntry[] = []
    const ownerRows = activeOwner === 'ทั้งหมด' ? rows : rows.filter((p) => p.owner === activeOwner)
    for (const p of ownerRows) {
      if (
        p.purchase_payment_method === 'โอน' &&
        p.purchase_bank === BANK &&
        p.purchase_date &&
        p.purchase_date >= from &&
        p.purchase_date <= to
      ) {
        entries.push({
          key: `${p.id}-buy`,
          date: p.purchase_date,
          type: 'ซื้อ',
          amount: -(p.cost_device ?? 0),
          product: p,
          slipUrl: p.purchase_slip_url,
        })
      }
      if (
        p.sale_payment_method === 'โอน' &&
        p.sale_bank === BANK &&
        p.sold_at &&
        p.sold_at >= from &&
        p.sold_at <= to
      ) {
        entries.push({
          key: `${p.id}-sale`,
          date: p.sold_at,
          type: 'ขาย',
          amount: p.sale_price ?? 0,
          product: p,
          slipUrl: p.sale_slip_url,
        })
      }
    }
    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    let running = 0
    return entries.map((e) => {
      running += e.amount
      return { ...e, balance: running }
    })
  }, [rows, from, to, activeOwner])

  const totalIn = ledger.filter((e) => e.type === 'ขาย').reduce((sum, e) => sum + e.amount, 0)
  const totalOut = ledger.filter((e) => e.type === 'ซื้อ').reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const net = totalIn - totalOut

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ตั้งแต่วันที่</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ถึงวันที่</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
      </div>

      <div className="pill-row print:hidden">
        {(['ทั้งหมด', ...OWNERS] as OwnerFilter[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setActiveOwner(o)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activeOwner === o
                ? 'border-amber-dark bg-amber-dark text-white'
                : 'border-amber-dark bg-panel text-amber-dark'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center font-mono text-sm text-ink/50 print:hidden">กำลังโหลดรายงาน…</p>}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger print:hidden">{error}</p>}

      {!loading && !error && (
        <div className="hidden print:block">
          <h1 className="font-display text-lg font-semibold text-ink">
            หลักฐานการซื้อขายธนาคาร {BANK}
            {activeOwner !== 'ทั้งหมด' && ` — เจ้าของทุน ${activeOwner}`}
          </h1>
          <p className="font-mono text-xs text-ink/70">
            วันที่ {from} ถึง {to} · {ledger.length} รายการ
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">เงินเข้า (ขาย)</p>
            <p className="text-sm font-semibold text-teal-dark">{formatPrice(totalIn)}</p>
          </div>
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">เงินออก (ซื้อ)</p>
            <p className="text-sm font-semibold text-danger">{formatPrice(totalOut)}</p>
          </div>
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">ยอดสุทธิ</p>
            <p className={`text-sm font-semibold ${net >= 0 ? 'text-teal-dark' : 'text-danger'}`}>
              {formatPrice(net)}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && ledger.length > 0 && (
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white print:hidden"
        >
          พิมพ์ / บันทึกเป็น PDF
        </button>
      )}

      {!loading && !error && ledger.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-ink/50">ไม่มีรายการโอนผ่านธนาคาร {BANK} ในช่วงเวลาที่เลือก</p>
      )}

      {!loading && !error && ledger.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="min-w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-ink/60">
                <th className="whitespace-nowrap px-3 py-2">วันที่</th>
                <th className="whitespace-nowrap px-3 py-2">รายการ</th>
                <th className="whitespace-nowrap px-3 py-2">ประเภท</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">จำนวนเงิน</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ยอดคงเหลือสะสม</th>
                <th className="whitespace-nowrap px-3 py-2">สลิป</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.key} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{e.date}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">
                    {e.product.model_name} {e.product.capacity} {e.product.color}
                    <span className="ml-1 text-ink/50">({e.product.product_code})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded-tag border px-1.5 py-0.5 text-[10px] uppercase ${
                        e.type === 'ขาย'
                          ? 'border-teal-dark text-teal-dark'
                          : 'border-danger text-danger'
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                      e.amount >= 0 ? 'text-teal-dark' : 'text-danger'
                    }`}
                  >
                    {e.amount >= 0 ? '+' : ''}
                    {formatPrice(e.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{formatPrice(e.balance)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {e.slipUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.slipUrl}
                        alt="สลิปโอนเงิน"
                        onClick={() => setLightboxUrl(e.slipUrl)}
                        className="h-14 w-14 cursor-zoom-in rounded-tag border border-line object-cover print:cursor-default print:break-inside-avoid"
                      />
                    ) : (
                      <span className="text-ink/30">ไม่มีสลิป</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-paper font-semibold">
                <td className="whitespace-nowrap px-3 py-2 text-ink" colSpan={3}>
                  รวม
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{formatPrice(net)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink"></td>
                <td className="whitespace-nowrap px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6 print:hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="ดูสลิปขยาย"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-card object-contain"
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="ปิด"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
