'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { OwnerProfile, Product, ReceiptVoucher } from '@/lib/types'
import { formatPrice, formatThaiDate, thaiBahtText, toDateInputStr } from '@/lib/utils'

type Props = {
  owner: string
}

type View = 'list' | 'form' | 'print'

function docNumberPrefix(): string {
  const now = new Date()
  return `RC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

async function nextDocNumber(): Promise<string> {
  const prefix = docNumberPrefix()
  const { count } = await supabase
    .from('receipt_vouchers')
    .select('id', { count: 'exact', head: true })
    .eq('doc_type', 'ใบสำคัญรับเงิน')
    .ilike('doc_number', `${prefix}-%`)
  const next = (count ?? 0) + 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

export default function ReceiptVoucherTTB({ owner }: Props) {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [fromDate, setFromDate] = useState(defaultFrom())
  const [toDate, setToDate] = useState(toDateInputStr(new Date()))
  const [vouchers, setVouchers] = useState<Record<string, ReceiptVoucher>>({})
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeVoucher, setActiveVoucher] = useState<ReceiptVoucher | null>(null)
  const [sellerName, setSellerName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'save' | null>(null)
  const [savingPdf, setSavingPdf] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setView('list')
      const [profileRes, productsRes] = await Promise.all([
        supabase.from('owner_profiles').select('*').eq('owner', owner).maybeSingle(),
        supabase
          .from('products')
          .select('*')
          .eq('owner', owner)
          .eq('purchase_payment_method', 'โอน')
          .eq('purchase_bank', 'TTB')
          .order('purchase_date', { ascending: false }),
      ])
      if (cancelled) return
      setOwnerProfile(profileRes.data as OwnerProfile | null)
      const productList = (productsRes.data as Product[]) ?? []
      setProducts(productList)

      if (productList.length > 0) {
        const { data: voucherRows } = await supabase
          .from('receipt_vouchers')
          .select('*')
          .eq('doc_type', 'ใบสำคัญรับเงิน')
          .in(
            'product_id',
            productList.map((p) => p.id)
          )
        if (!cancelled) {
          const map: Record<string, ReceiptVoucher> = {}
          for (const v of (voucherRows as ReceiptVoucher[]) ?? []) map[v.product_id] = v
          setVouchers(map)
        }
      } else {
        setVouchers({})
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [owner])

  function openProduct(p: Product, action?: 'save') {
    setSelectedProduct(p)
    setError(null)
    const existing = vouchers[p.id]
    if (existing) {
      setActiveVoucher(existing)
      setView('print')
      if (action) setPendingAction(action)
    } else {
      // ชื่อผู้ขาย: ถ้ากรอกไว้ตอนเพิ่มสินค้าแล้ว (p.seller_name) ให้ยึดตามนั้นเป็นอันดับแรกเสมอ
      // ถ้าไม่ได้กรอกไว้ (ว่าง) ค่อยเปิดให้กรอก/อ่านจากสลิปโอนเงินแทน — อย่าข้ามไปอ่านสลิปทั้งที่มีชื่อกรอกไว้แล้ว
      setSellerName(p.seller_name ?? '')
      setActiveVoucher(null)
      setView('form')
    }
  }

  function editFromList(p: Product) {
    const existing = vouchers[p.id]
    if (!existing) return
    setSelectedProduct(p)
    setActiveVoucher(existing)
    setSellerName(existing.seller_name ?? '')
    setError(null)
    setView('form')
  }

  function backToList() {
    setView('list')
    setSelectedProduct(null)
    setActiveVoucher(null)
    setError(null)
  }

  function cancelForm() {
    setError(null)
    if (activeVoucher) {
      setView('print')
    } else {
      backToList()
    }
  }

  function openEdit() {
    if (!activeVoucher) return
    setSellerName(activeVoucher.seller_name ?? '')
    setError(null)
    setView('form')
  }

  async function handleSavePdf() {
    if (!docRef.current || !activeVoucher) return
    setSavingPdf(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      } else {
        // เอกสารยาวเกินหน้าเดียว — ตัดแบ่งเป็นหลายหน้า
        let heightLeft = imgHeight
        let position = 0
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        while (heightLeft > 0) {
          position -= pageHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
      }

      pdf.save(`${activeVoucher.doc_number}.pdf`)
    } catch (err: any) {
      setError('บันทึก PDF ไม่สำเร็จ ลองใช้ปุ่มพิมพ์แล้วเลือก "บันทึกเป็น PDF" แทนได้')
    } finally {
      setSavingPdf(false)
    }
  }

  useEffect(() => {
    if (view !== 'print' || !pendingAction) return
    setPendingAction(null)
    handleSavePdf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pendingAction])

  async function handleSave() {
    if (!selectedProduct) return
    setSaving(true)
    setError(null)
    try {
      const fields = {
        seller_name: sellerName.trim() || null,
      }

      if (activeVoucher) {
        const { data, error: updateError } = await supabase
          .from('receipt_vouchers')
          .update(fields)
          .eq('id', activeVoucher.id)
          .select()
          .single()
        if (updateError) throw updateError
        const voucher = data as ReceiptVoucher
        setVouchers((prev) => ({ ...prev, [selectedProduct.id]: voucher }))
        setActiveVoucher(voucher)
        setView('print')
      } else {
        const doc_number = await nextDocNumber()
        const { data, error: insertError } = await supabase
          .from('receipt_vouchers')
          .insert({
            doc_number,
            doc_type: 'ใบสำคัญรับเงิน',
            owner,
            product_id: selectedProduct.id,
            method: 'TTB',
            ...fields,
          })
          .select()
          .single()
        if (insertError) throw insertError
        const voucher = data as ReceiptVoucher
        setVouchers((prev) => ({ ...prev, [selectedProduct.id]: voucher }))
        setActiveVoucher(voucher)
        setView('print')
      }
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
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

  const profileIncomplete =
    !ownerProfile?.full_name || !ownerProfile?.id_card_number || !ownerProfile?.address

  if (view === 'list') {
    const displayProducts = products.filter(
      (p) => p.purchase_date && p.purchase_date >= fromDate && p.purchase_date <= toDate
    )

    return (
      <div className="space-y-4">
        {profileIncomplete && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            ข้อมูลส่วนตัวของ {owner} ยังไม่ครบ (ชื่อ / เลขบัตรประชาชน / ที่อยู่) — แนะนำให้กรอกในแท็บ &quot;ข้อมูลส่วนตัว&quot;
            ก่อนออกเอกสาร เพื่อให้เอกสารมีข้อมูลครบถ้วน
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ตั้งแต่วันที่ซื้อ</span>
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
          <button
            type="button"
            onClick={() => {
              const today = toDateInputStr(new Date())
              setFromDate(today)
              setToDate(today)
            }}
            className="rounded-lg border border-[#E4E6EF] px-3.5 py-2 text-xs font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8]"
          >
            เฉพาะวันนี้
          </button>
        </div>

        {displayProducts.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
            <p className="text-sm font-medium text-[#1B1E2B]">
              {products.length === 0 ? 'ยังไม่มีสินค้าที่ซื้อผ่าน TTB' : 'ไม่มีสินค้าในช่วงวันที่ที่เลือก'}
            </p>
            <p className="mt-1 text-[13px] text-[#8A8FA3]">ของเจ้าของทุน {owner}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayProducts.map((p) => {
              const existing = vouchers[p.id]
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-2xl border border-[#E4E6EF] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.cover_image_url}
                    alt={p.model_name}
                    className="h-14 w-14 shrink-0 rounded-lg border border-[#E4E6EF] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1B1E2B]">
                      {p.model_name} {p.capacity} {p.color}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-[#8A8FA3]">
                      {p.product_code} · {p.purchase_date} · {formatPrice(p.cost_device ?? 0)}
                    </p>
                  </div>
                  {existing ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openProduct(p)}
                        className="rounded-lg border border-[#E4E6EF] px-3 py-2 text-xs font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8]"
                      >
                        ดูเอกสาร ({existing.doc_number})
                      </button>
                      <button
                        type="button"
                        onClick={() => editFromList(p)}
                        className="rounded-lg border border-[#E4E6EF] px-3 py-2 text-xs font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8]"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => openProduct(p, 'save')}
                        className="rounded-lg border border-[#E4E6EF] px-3 py-2 text-xs font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8]"
                      >
                        เซฟ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openProduct(p)}
                      className="shrink-0 rounded-lg bg-[#3B5BFF] px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    >
                      สร้างใบสำคัญรับเงิน
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (view === 'form' && selectedProduct) {
    return (
      <div className="max-w-xl space-y-4">
        <button type="button" onClick={backToList} className="text-[13px] font-medium text-[#3B5BFF]">
          ‹ กลับไปรายการสินค้า
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="rounded-2xl border border-[#E4E6EF] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]"
        >
          <p className="mb-1 text-sm font-semibold text-[#1B1E2B]">
            {selectedProduct.model_name} {selectedProduct.capacity} {selectedProduct.color}
          </p>
          <p className="mb-5 text-[13px] text-[#8A8FA3]">
            {selectedProduct.product_code} · ซื้อวันที่ {selectedProduct.purchase_date} ·{' '}
            {formatPrice(selectedProduct.cost_device ?? 0)}
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ชื่อ-นามสกุล ผู้ขาย</span>
              <input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="ไม่ระบุ — อ่านจากสลิปแทนได้"
                className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
              />
            </label>
          </div>

          {selectedProduct.purchase_slip_url && (
            <div className="mt-4">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">
                สลิปโอนเงินที่แนบไว้ — ดูรายละเอียดจากรูปนี้มากรอกด้านบนได้
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProduct.purchase_slip_url}
                alt="สลิปโอนเงิน"
                onClick={() => setLightboxUrl(selectedProduct.purchase_slip_url)}
                className="h-20 w-20 cursor-zoom-in rounded-lg border border-[#E4E6EF] object-cover"
              />
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก…' : activeVoucher ? 'บันทึกการแก้ไข' : 'ยืนยันออกเอกสาร'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="rounded-lg border border-[#E4E6EF] px-4 py-2.5 text-sm font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8] disabled:opacity-60"
            >
              ยกเลิก
            </button>
          </div>
        </form>

        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="ดูรูปขยาย"
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        )}
      </div>
    )
  }

  if (view === 'print' && selectedProduct && activeVoucher) {
    const cost = selectedProduct.cost_device ?? 0
    // ลำดับความสำคัญ: ชื่อที่กรอก/แก้ไว้ในเอกสารก่อน (มาจากช่องกรอกตอนเพิ่มสินค้า หรือพิมพ์เพิ่มจากสลิปทีหลัง)
    // ตกมาที่ชื่อในข้อมูลสินค้าเป็นสำรอง ไม่ใช้ค่าจากสลิปเว้นแต่ทั้งสองช่องนี้ว่าง
    const sellerDisplayName = activeVoucher.seller_name || selectedProduct.seller_name || '-'

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <button type="button" onClick={backToList} className="text-[13px] font-medium text-[#3B5BFF]">
            ‹ กลับไปรายการสินค้า
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openEdit}
              className="rounded-lg border border-[#E4E6EF] px-4 py-2.5 text-sm font-medium text-[#1B1E2B] transition-colors hover:bg-[#F3F4F8]"
            >
              แก้ไข
            </button>
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={savingPdf}
              className="rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {savingPdf ? 'กำลังเซฟ…' : 'เซฟ'}
            </button>
          </div>
        </div>

        <div
          ref={docRef}
          className="mx-auto max-w-3xl rounded-2xl border border-[#E4E6EF] bg-white p-8 text-[#1B1E2B] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <div className="border-b-2 border-double border-black pb-3 text-center">
            <h1 className="text-lg font-semibold">ใบสำคัญรับเงิน / ใบรับซื้อสินค้า</h1>
            <p className="text-xs tracking-wide text-[#8A8FA3]">(RECEIVING VOUCHER)</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p>
              <span className="text-[#8A8FA3]">ชื่อร้าน/ผู้รับซื้อ: </span>
              {ownerProfile?.full_name || owner}
            </p>
            <p>
              <span className="text-[#8A8FA3]">เลขที่เอกสาร: </span>
              {activeVoucher.doc_number}
            </p>
            <p>
              <span className="text-[#8A8FA3]">เลขประจำตัวผู้เสียภาษี: </span>
              {ownerProfile?.id_card_number || '-'}
            </p>
            <p>
              <span className="text-[#8A8FA3]">วันที่ทำรายการ: </span>
              {formatThaiDate(selectedProduct.purchase_date ?? activeVoucher.created_at)}
            </p>
            <p>
              <span className="text-[#8A8FA3]">ที่อยู่: </span>
              {ownerProfile?.address || '-'}
            </p>
            <p>
              <span className="text-[#8A8FA3]">เบอร์โทรศัพท์: </span>
              {ownerProfile?.phone || '-'}
            </p>
          </div>

          <div className="space-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
              ข้อมูลผู้ขาย (Seller Details)
            </p>
            <p>
              <span className="text-[#8A8FA3]">ชื่อ-นามสกุล ผู้ขาย: </span>
              {sellerDisplayName}
            </p>
          </div>

          <div className="border-b border-[#E4E6EF] py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
              รายการสินค้า (Item Details)
            </p>
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-black/70 text-left">
                  <th className="w-8 pb-1.5">ลำดับ</th>
                  <th className="w-[34%] pb-1.5">รายการสินค้า / สเปก</th>
                  <th className="w-[28%] pb-1.5">เลข IMEI / Serial</th>
                  <th className="pb-1.5 text-right">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 align-top">1.</td>
                  <td className="break-words py-2 align-top">
                    {selectedProduct.model_name} {selectedProduct.capacity} {selectedProduct.color}
                    {selectedProduct.accessories && (
                      <p className="mt-0.5 text-xs text-[#8A8FA3]">(อุปกรณ์: {selectedProduct.accessories})</p>
                    )}
                  </td>
                  <td className="break-all py-2 align-top">{selectedProduct.imei_serial || '-'}</td>
                  <td className="py-2 text-right align-top">{cost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p>
              <span className="text-[#8A8FA3]">จำนวนเงินตัวอักษร: </span>({thaiBahtText(cost)})
            </p>
            <p className="font-semibold">
              จำนวนเงินรวมทั้งสิ้น: {formatPrice(cost)}
            </p>
          </div>

          <div className="space-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
              รายละเอียดการชำระเงิน (Payment Method)
            </p>
            <p>☑ โอนเงินผ่านธนาคาร (รายละเอียดตามสลิปที่แนบ)</p>
          </div>

          <div className="py-8 text-center text-[13px]">
            <p className="mb-1">ลงชื่อ.........................................ผู้รับซื้อ/ผู้จ่ายเงิน</p>
            <p>({ownerProfile?.full_name || owner})</p>
            <p className="mt-1 text-[#8A8FA3]">วันที่ ..... / ..... / ..........</p>
          </div>

          <p className="border-t border-[#E4E6EF] pt-3 text-[11px] text-[#8A8FA3]">
            * เอกสารฉบับนี้จัดทำขึ้นโดยระบบ ยืนยันการชำระเงินสำเร็จผ่านหลักฐานสลิปโอนเงินธนาคารที่แนบไว้ท้ายเอกสาร
            แทนการลงลายมือชื่อสดของผู้ขาย
          </p>

          {(selectedProduct.purchase_slip_url || selectedProduct.purchase_evidence_urls?.length > 0) && (
            <div className="mt-6 border-t border-[#E4E6EF] pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8A8FA3] print:break-after-avoid">
                หลักฐานแนบประกอบ (Attachments)
              </p>
              <div className="flex flex-col gap-4">
                {selectedProduct.purchase_slip_url && (
                  <div className="print:break-inside-avoid">
                    <p className="mb-1 text-[11px] text-[#8A8FA3]">รูปสลิปโอนเงิน ttb</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedProduct.purchase_slip_url}
                      alt="สลิปโอนเงิน"
                      onClick={() => setLightboxUrl(selectedProduct.purchase_slip_url)}
                      className="h-auto w-56 max-h-72 cursor-zoom-in rounded-lg border border-[#E4E6EF] object-contain print:cursor-default"
                    />
                  </div>
                )}
                {selectedProduct.purchase_evidence_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {selectedProduct.purchase_evidence_urls.map((url) => (
                      <div key={url} className="print:break-inside-avoid">
                        <p className="mb-1 text-[11px] text-[#8A8FA3]">หลักฐานประกอบอื่นๆ</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="หลักฐานการซื้อ"
                          onClick={() => setLightboxUrl(url)}
                          className="h-auto w-56 max-h-72 cursor-zoom-in rounded-lg border border-[#E4E6EF] object-contain print:cursor-default"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 print:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="ดูรูปขยาย"
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        )}
      </div>
    )
  }

  return null
}
