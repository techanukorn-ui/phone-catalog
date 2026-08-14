'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { PaymentVoucher, Product } from '@/lib/types'
import {
  buildLastMonths,
  formatPrice,
  formatThaiDate,
  nextPaymentVoucherDocNumber,
  thaiBahtText,
  toDateInputStr,
} from '@/lib/utils'

const PAYEE = 'เมจิ' as const

type Props = {
  owner: string
}

export default function PaymentVoucherMagic({ owner }: Props) {
  const months = useMemo(() => buildLastMonths(12), [])
  const [selectedKey, setSelectedKey] = useState(months[0].key)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const oldestStart = months[months.length - 1].start

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [productsRes, vouchersRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('status', 'ขายแล้ว')
          .eq('owner', owner)
          .not('dividend_magic', 'is', null)
          .gte('sold_at', toDateInputStr(oldestStart)),
        supabase.from('payment_vouchers').select('*').eq('payee', PAYEE).eq('owner', owner),
      ])
      if (cancelled) return
      setProducts((productsRes.data as Product[]) ?? [])
      setVouchers((vouchersRes.data as PaymentVoucher[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // oldestStart มาจาก months ซึ่ง stable อยู่แล้วผ่าน useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const selectedMonth = months.find((m) => m.key === selectedKey)!
  const existingVoucher = vouchers.find((v) => v.period_month === selectedKey) ?? null

  // เครื่องที่เคยรวมอยู่ในใบสำคัญจ่ายไปแล้ว (ทุกเดือน) — กันดึงมารวมซ้ำ
  const paidProductIds = useMemo(() => new Set(vouchers.flatMap((v) => v.product_ids)), [vouchers])
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const monthProducts = products
    .filter((p) => {
      if (!p.sold_at) return false
      const d = new Date(p.sold_at)
      return d >= selectedMonth.start && d < selectedMonth.end && !paidProductIds.has(p.id)
    })
    .sort((a, b) => (a.sold_at! < b.sold_at! ? -1 : a.sold_at! > b.sold_at! ? 1 : 0))

  useEffect(() => {
    setError(null)
    if (!existingVoucher) {
      setSelectedIds(monthProducts.map((p) => p.id))
    }
    // เปลี่ยนเดือนที่เลือก ให้ติ๊กเลือกทุกเครื่องในเดือนนั้นเป็นค่าเริ่มต้นใหม่เสมอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, existingVoucher])

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleIssue() {
    const selected = monthProducts.filter((p) => selectedIds.includes(p.id))
    if (selected.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 เครื่อง')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const total = selected.reduce((sum, p) => sum + (p.dividend_magic ?? 0), 0)
      const doc_number = await nextPaymentVoucherDocNumber()
      const { data, error: insertError } = await supabase
        .from('payment_vouchers')
        .insert({
          doc_number,
          doc_type: 'ใบสำคัญจ่าย',
          payee: PAYEE,
          owner,
          period_month: selectedKey,
          total_amount: total,
          product_ids: selected.map((p) => p.id),
        })
        .select()
        .single()
      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('มีใบสำคัญจ่ายของเดือนนี้อยู่แล้ว')
        }
        throw insertError
      }
      setVouchers((prev) => [...prev, data as PaymentVoucher])
    } catch (err: any) {
      setError(err?.message ?? 'ออกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!existingVoucher) return
    if (!window.confirm(`ยกเลิกใบสำคัญจ่าย ${existingVoucher.doc_number} ใช่หรือไม่? เครื่องในใบนี้จะกลับไปให้เลือกออกเอกสารใหม่ได้อีกครั้ง`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('payment_vouchers').delete().eq('id', existingVoucher.id)
      if (deleteError) throw deleteError
      setVouchers((prev) => prev.filter((v) => v.id !== existingVoucher.id))
    } catch (err: any) {
      setError(err?.message ?? 'ยกเลิกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
        <p className="text-sm text-[#8A8FA3]">กำลังโหลดข้อมูล…</p>
      </div>
    )
  }

  const docProducts = existingVoucher
    ? existingVoucher.product_ids.map((id) => productsById.get(id)).filter((p): p is Product => !!p)
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 print:hidden">
        {months.map((m) => {
          const issued = vouchers.some((v) => v.period_month === m.key)
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedKey(m.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                selectedKey === m.key
                  ? 'border-[#3B5BFF] bg-[#3B5BFF] text-white'
                  : 'border-[#E4E6EF] bg-white text-[#1B1E2B] hover:bg-[#F3F4F8]'
              }`}
            >
              {m.label}
              {issued && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${selectedKey === m.key ? 'bg-white' : 'bg-teal-500'}`}
                />
              )}
            </button>
          )
        })}
      </div>

      {!existingVoucher ? (
        <div className="space-y-3">
          {monthProducts.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
              <p className="text-sm font-medium text-[#1B1E2B]">ไม่มีเครื่องที่ต้องจ่ายปันผลเมจิในเดือนนี้</p>
              <p className="mt-1 text-[13px] text-[#8A8FA3]">{selectedMonth.label}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {monthProducts.map((p) => {
                  const checked = selectedIds.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E4E6EF] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(p.id)}
                        className="h-4 w-4 shrink-0 accent-[#3B5BFF]"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.cover_image_url}
                        alt={p.model_name}
                        className="h-12 w-12 shrink-0 rounded-lg border border-[#E4E6EF] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1B1E2B]">
                          {p.model_name} {p.capacity} {p.color}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-[#8A8FA3]">
                          {p.product_code} · ขายวันที่ {p.sold_at}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-[#1B1E2B]">
                        {formatPrice(p.dividend_magic ?? 0)}
                      </p>
                    </label>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#3B5BFF]/20 bg-[#EEF1FF] p-4">
                <p className="text-sm font-medium text-[#1B1E2B]">
                  รวม {selectedIds.length} เครื่อง
                </p>
                <p className="text-base font-semibold text-[#3B5BFF]">
                  {formatPrice(monthProducts.filter((p) => selectedIds.includes(p.id)).reduce((s, p) => s + (p.dividend_magic ?? 0), 0))}
                </p>
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}

              <button
                type="button"
                onClick={handleIssue}
                disabled={saving || selectedIds.length === 0}
                className="w-full rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'กำลังออกเอกสาร…' : 'ออกใบสำคัญจ่าย'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 print:hidden">{error}</p>}

          <div className="flex justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {saving ? 'กำลังยกเลิก…' : 'ยกเลิกเอกสาร'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              พิมพ์ / บันทึกเป็น PDF
            </button>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border border-[#E4E6EF] bg-white p-8 text-[#1B1E2B] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <div className="border-b-2 border-double border-black pb-3 text-center">
              <h1 className="text-lg font-semibold">ใบสำคัญจ่าย</h1>
              <p className="text-xs tracking-wide text-[#4B4F5B]">(PAYMENT VOUCHER)</p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
              <p>
                <span className="text-[#4B4F5B]">ผู้จ่ายเงิน: </span>Marcuz Mobile ({existingVoucher.owner})
              </p>
              <p>
                <span className="text-[#4B4F5B]">เลขที่เอกสาร: </span>
                {existingVoucher.doc_number}
              </p>
              <p>
                <span className="text-[#4B4F5B]">ผู้รับเงิน: </span>
                {existingVoucher.payee}
              </p>
              <p>
                <span className="text-[#4B4F5B]">งวดจ่าย: </span>
                {selectedMonth.label}
              </p>
              <p className="col-span-2">
                <span className="text-[#4B4F5B]">วันที่ออกเอกสาร: </span>
                {formatThaiDate(existingVoucher.created_at)}
              </p>
            </div>

            <div className="border-b border-[#E4E6EF] py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4B4F5B]">
                รายการปันผลเมจิ (Commission Details)
              </p>
              <table className="w-full table-fixed border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-black/70 text-left">
                    <th className="w-8 pb-1.5">ลำดับ</th>
                    <th className="w-[16%] pb-1.5">รหัสสินค้า</th>
                    <th className="w-[40%] pb-1.5">รายการสินค้า</th>
                    <th className="w-[18%] pb-1.5">วันที่ขาย</th>
                    <th className="pb-1.5 text-right">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {docProducts.map((p, i) => (
                    <tr key={p.id}>
                      <td className="py-2 align-top">{i + 1}.</td>
                      <td className="break-words py-2 align-top font-mono">{p.product_code}</td>
                      <td className="break-words py-2 align-top">
                        {p.model_name} {p.capacity} {p.color}
                      </td>
                      <td className="py-2 align-top">{p.sold_at}</td>
                      <td className="py-2 text-right align-top">
                        {(p.dividend_magic ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E6EF] py-4 text-[13px]">
              <p>
                <span className="text-[#4B4F5B]">จำนวนเงินตัวอักษร: </span>({thaiBahtText(existingVoucher.total_amount)})
              </p>
              <p className="font-semibold">จำนวนเงินรวมทั้งสิ้น: {formatPrice(existingVoucher.total_amount)}</p>
            </div>

            <div className="grid grid-cols-2 gap-8 py-8 text-center text-[13px]">
              <div>
                <p className="mb-1">ลงชื่อ.........................................ผู้จ่ายเงิน</p>
                <p>(Marcuz Mobile)</p>
              </div>
              <div>
                <p className="mb-1">ลงชื่อ.........................................ผู้รับเงิน</p>
                <p>({existingVoucher.payee})</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
