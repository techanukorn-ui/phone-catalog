'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { Product, ProductOwner, ProductPaymentMethod } from '@/lib/types'
import { formatPrice, toDateInputStr } from '@/lib/utils'

type MethodFilter = 'ทั้งหมด' | ProductPaymentMethod
type OwnerFilter = 'ทั้งหมด' | ProductOwner

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

export default function PurchaseEvidenceReport() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(toDateInputStr(new Date()))
  const [activeMethod, setActiveMethod] = useState<MethodFilter>('ทั้งหมด')
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
        .gte('purchase_date', from)
        .lte('purchase_date', to)
        .order('purchase_date', { ascending: false })
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [from, to])

  const filtered = rows
    .filter((p) => activeMethod === 'ทั้งหมด' || p.purchase_payment_method === activeMethod)
    .filter((p) => activeOwner === 'ทั้งหมด' || p.owner === activeOwner)
  const totalCost = filtered.reduce((sum, p) => sum + (p.cost_device ?? 0), 0)

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
        {(['ทั้งหมด', 'เงินสด', 'โอน'] as MethodFilter[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setActiveMethod(m)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activeMethod === m
                ? 'border-teal bg-teal text-white'
                : 'border-line bg-panel text-ink/70 active:bg-line/40'
            }`}
          >
            {m}
          </button>
        ))}
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
        <p className="font-mono text-xs text-ink/50 print:hidden">
          {activeOwner !== 'ทั้งหมด' && <>เจ้าของทุน {activeOwner} · </>}
          พบ {filtered.length} รายการ ({from} ถึง {to}) — ต้นทุนรวม {formatPrice(totalCost)}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="hidden print:block">
          <h1 className="font-display text-lg font-semibold text-ink">
            หลักฐานการซื้อเครื่อง{activeOwner !== 'ทั้งหมด' && ` — เจ้าของทุน ${activeOwner}`}
          </h1>
          <p className="font-mono text-xs text-ink/70">
            วันที่ {from} ถึง {to} · {filtered.length} รายการ · ต้นทุนรวม {formatPrice(totalCost)}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white print:hidden"
        >
          พิมพ์ / บันทึกเป็น PDF
        </button>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-ink/50">ไม่มีรายการซื้อในช่วงเวลาที่เลือก</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex gap-3 rounded-card border border-line bg-panel p-3 print:break-inside-avoid print:border-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.cover_image_url}
                alt={p.model_name}
                className="h-16 w-16 shrink-0 rounded-tag border border-line object-cover"
              />
              <div className="flex-1 space-y-1">
                <p className="font-display text-sm font-semibold text-ink">
                  {p.model_name} {p.capacity} {p.color}
                </p>
                <p className="font-mono text-xs text-ink/60">
                  {p.product_code} · เจ้าของทุน {p.owner ?? 'ไม่ระบุ'} · ซื้อวันที่ {p.purchase_date ?? '-'}
                </p>
                <p className="font-mono text-xs text-ink">
                  ต้นทุน {formatPrice(p.cost_device ?? 0)} ·{' '}
                  <span
                    className={`rounded-tag border px-1.5 py-0.5 text-[10px] uppercase ${
                      p.purchase_payment_method === 'โอน'
                        ? 'border-amber-dark text-amber-dark'
                        : 'border-line text-ink/60'
                    }`}
                  >
                    {p.purchase_payment_method ?? 'เงินสด'}
                  </span>
                </p>
              </div>
              <div className="shrink-0">
                {p.purchase_slip_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.purchase_slip_url}
                    alt="สลิปโอนเงิน"
                    onClick={() => setLightboxUrl(p.purchase_slip_url)}
                    className="h-16 w-16 cursor-zoom-in rounded-tag border border-line object-cover print:cursor-default"
                  />
                ) : (
                  <p className="flex h-16 w-16 items-center justify-center rounded-tag border border-dashed border-line text-center font-mono text-[10px] text-ink/40">
                    ไม่มีสลิป
                  </p>
                )}
              </div>
            </div>
          ))}
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
