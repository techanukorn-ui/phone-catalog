'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { OwnerProfile, Product, ReceiptVoucher } from '@/lib/types'
import {
  formatPrice,
  formatThaiDate,
  formatThaiDateNumeric,
  nextReceiptSaleDocNumber,
  thaiBahtText,
  toDateInputStr,
} from '@/lib/utils'

type Props = {
  owner: string
}

type View = 'list' | 'form' | 'print'

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

export default function ReceiptSaleTTB({ owner }: Props) {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [fromDate, setFromDate] = useState(defaultFrom())
  const [toDate, setToDate] = useState(toDateInputStr(new Date()))
  const [vouchers, setVouchers] = useState<Record<string, ReceiptVoucher>>({})
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeVoucher, setActiveVoucher] = useState<ReceiptVoucher | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [formFullName, setFormFullName] = useState('')
  const [formIdCard, setFormIdCard] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'save' | null>(null)
  const [savingPdf, setSavingPdf] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)
  const attachRef = useRef<HTMLDivElement>(null)

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
          .eq('status', 'ขายแล้ว')
          .eq('sale_payment_method', 'โอน')
          .eq('sale_bank', 'TTB')
          .order('sold_at', { ascending: false }),
      ])
      if (cancelled) return
      setOwnerProfile(profileRes.data as OwnerProfile | null)
      const productList = (productsRes.data as Product[]) ?? []
      setProducts(productList)

      if (productList.length > 0) {
        const { data: voucherRows } = await supabase
          .from('receipt_vouchers')
          .select('*')
          .eq('doc_type', 'ใบเสร็จรับเงิน')
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
      // ชื่อลูกค้า: ถ้ากรอกไว้ตอนบันทึกการขายแล้ว (p.buyer_name) ให้ยึดตามนั้นเป็นอันดับแรกเสมอ
      setCustomerName(p.buyer_name ?? '')
      // เอกสารยังไม่เคยออก — เอาข้อมูลส่วนตัวปัจจุบันมาเป็นค่าเริ่มต้นให้แก้ไขก่อนออกเอกสารจริง
      setFormFullName(ownerProfile?.full_name ?? '')
      setFormIdCard(ownerProfile?.id_card_number ?? '')
      setFormAddress(ownerProfile?.address ?? '')
      setFormPhone(ownerProfile?.phone ?? '')
      setActiveVoucher(null)
      setView('form')
    }
  }

  function editFromList(p: Product) {
    const existing = vouchers[p.id]
    if (!existing) return
    setSelectedProduct(p)
    setActiveVoucher(existing)
    setCustomerName(existing.customer_name ?? '')
    // เอกสารเก่าก่อนมีระบบแช่แข็งข้อมูล ยังไม่มีสำเนาเก็บไว้ → ใช้ข้อมูลปัจจุบันเป็นค่าเริ่มต้นไปก่อน
    setFormFullName(existing.owner_full_name ?? ownerProfile?.full_name ?? '')
    setFormIdCard(existing.owner_id_card_number ?? ownerProfile?.id_card_number ?? '')
    setFormAddress(existing.owner_address ?? ownerProfile?.address ?? '')
    setFormPhone(existing.owner_phone ?? ownerProfile?.phone ?? '')
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
    setCustomerName(activeVoucher.customer_name ?? '')
    setFormFullName(activeVoucher.owner_full_name ?? ownerProfile?.full_name ?? '')
    setFormIdCard(activeVoucher.owner_id_card_number ?? ownerProfile?.id_card_number ?? '')
    setFormAddress(activeVoucher.owner_address ?? ownerProfile?.address ?? '')
    setFormPhone(activeVoucher.owner_phone ?? ownerProfile?.phone ?? '')
    setError(null)
    setView('form')
  }

  async function handleSavePdf() {
    if (!mainRef.current || !activeVoucher) return
    setSavingPdf(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      async function addSection(el: HTMLElement, startNewPage: boolean) {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = pageWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        if (startNewPage) pdf.addPage()

        if (imgHeight <= pageHeight) {
          // เนื้อหาสั้นกว่าหน้ากระดาษ — เว้นระยะขอบบนคงที่พอประมาณแบบเอกสารทั่วไป (ไม่ชนขอบเป๊ะ ไม่กึ่งกลางเป๊ะ)
          // ที่เหลือปล่อยเป็นที่ว่างด้านล่างแทน
          const topMargin = 40
          const y = Math.min(topMargin, (pageHeight - imgHeight) / 2)
          pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight)
        } else {
          // ส่วนนี้ยาวเกินหน้าเดียว — ตัดแบ่งเป็นหลายหน้า
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
      }

      // แยกถ่ายภาพเป็น 2 ส่วน: เนื้อหาเอกสารหลัก (หน้า 1) กับหลักฐานแนบประกอบ (บังคับขึ้นหน้า 2 เสมอ)
      await addSection(mainRef.current, false)
      if (attachRef.current) {
        await addSection(attachRef.current, true)
      }

      pdf.save(`${activeVoucher.doc_number}.pdf`)
    } catch (err: any) {
      setError('บันทึก PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
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
        customer_name: customerName.trim() || null,
        owner_full_name: formFullName.trim() || null,
        owner_id_card_number: formIdCard.trim() || null,
        owner_address: formAddress.trim() || null,
        owner_phone: formPhone.trim() || null,
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
        const doc_number = await nextReceiptSaleDocNumber()
        const { data, error: insertError } = await supabase
          .from('receipt_vouchers')
          .insert({
            doc_number,
            doc_type: 'ใบเสร็จรับเงิน',
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
      (p) => p.sold_at && p.sold_at >= fromDate && p.sold_at <= toDate
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
            <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ตั้งแต่วันที่ขาย</span>
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
              {products.length === 0 ? 'ยังไม่มีสินค้าที่ขายผ่าน TTB' : 'ไม่มีสินค้าในช่วงวันที่ที่เลือก'}
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
                      {p.product_code} · {p.sold_at} · {formatPrice(p.sale_price ?? 0)}
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
                      สร้างใบเสร็จรับเงิน
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
            {selectedProduct.product_code} · ขายวันที่ {selectedProduct.sold_at} ·{' '}
            {formatPrice(selectedProduct.sale_price ?? 0)}
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ชื่อ-นามสกุล ลูกค้า</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ไม่ระบุ — อ่านจากสลิปแทนได้"
                className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
              />
            </label>

            <div className="border-t border-[#E4E6EF] pt-4">
              <p className="mb-3 text-[13px] font-medium text-[#1B1E2B]">
                ข้อมูลผู้ขาย/ผู้รับเงินในเอกสารนี้ — บันทึกไว้เฉพาะใบนี้ ไม่เปลี่ยนตามหน้า &quot;ข้อมูลส่วนตัว&quot;
                ในภายหลังอัตโนมัติ
              </p>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ชื่อร้าน/ผู้ขาย</span>
                  <input
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">เลขประจำตัวผู้เสียภาษี</span>
                  <input
                    value={formIdCard}
                    onChange={(e) => setFormIdCard(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ที่อยู่</span>
                  <input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">เบอร์โทรศัพท์</span>
                  <input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
                  />
                </label>
              </div>
            </div>
          </div>

          {selectedProduct.sale_slip_url && (
            <div className="mt-4">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">
                สลิปโอนเงินที่แนบไว้ — ดูรายละเอียดจากรูปนี้มากรอกด้านบนได้
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProduct.sale_slip_url}
                alt="สลิปโอนเงิน"
                onClick={() => setLightboxUrl(selectedProduct.sale_slip_url)}
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
    const amount = selectedProduct.sale_price ?? 0
    // ลำดับความสำคัญ: ชื่อที่กรอก/แก้ไว้ในเอกสารก่อน ตกมาที่ชื่อในข้อมูลสินค้าเป็นสำรอง
    const customerDisplayName = activeVoucher.customer_name || selectedProduct.buyer_name || '-'

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

        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E4E6EF] bg-white text-[#1B1E2B] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div ref={mainRef} className="p-8">
          <div className="border-b-2 border-double border-black pb-3 text-center">
            <h1 className="text-lg font-semibold">ใบเสร็จรับเงิน / ใบขายสินค้า</h1>
            <p className="text-xs tracking-wide text-[#4B4F5B]">(RECEIPT)</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p>
              <span className="text-[#4B4F5B]">ชื่อร้าน/ผู้ขาย: </span>
              {activeVoucher.owner_full_name ?? ownerProfile?.full_name ?? owner}
            </p>
            <p>
              <span className="text-[#4B4F5B]">เลขที่เอกสาร: </span>
              {activeVoucher.doc_number}
            </p>
            <p>
              <span className="text-[#4B4F5B]">เลขประจำตัวผู้เสียภาษี: </span>
              {activeVoucher.owner_id_card_number ?? ownerProfile?.id_card_number ?? '-'}
            </p>
            <p>
              <span className="text-[#4B4F5B]">วันที่ทำรายการ: </span>
              {formatThaiDate(selectedProduct.sold_at ?? activeVoucher.created_at)}
            </p>
            <p>
              <span className="text-[#4B4F5B]">ที่อยู่: </span>
              {activeVoucher.owner_address ?? ownerProfile?.address ?? '-'}
            </p>
            <p>
              <span className="text-[#4B4F5B]">เบอร์โทรศัพท์: </span>
              {activeVoucher.owner_phone ?? ownerProfile?.phone ?? '-'}
            </p>
          </div>

          <div className="space-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4B4F5B]">
              ข้อมูลผู้ซื้อ (Customer Details)
            </p>
            <p>
              <span className="text-[#4B4F5B]">ชื่อ-นามสกุล ลูกค้า: </span>
              {customerDisplayName}
            </p>
          </div>

          <div className="border-b border-[#E4E6EF] py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4B4F5B]">
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
                      <p className="mt-0.5 text-xs text-[#4B4F5B]">(อุปกรณ์: {selectedProduct.accessories})</p>
                    )}
                  </td>
                  <td className="break-all py-2 align-top">{selectedProduct.imei_serial || '-'}</td>
                  <td className="py-2 text-right align-top">
                    {amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p>
              <span className="text-[#4B4F5B]">จำนวนเงินตัวอักษร: </span>({thaiBahtText(amount)})
            </p>
            <p className="font-semibold">
              ยอดเงินรวมทั้งสิ้น: {formatPrice(amount)}
            </p>
          </div>

          <div className="space-y-1.5 border-b border-[#E4E6EF] py-4 text-[13px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4B4F5B]">
              รายละเอียดการชำระเงิน (Payment Method)
            </p>
            <p>☑ โอนเงินผ่านธนาคาร (รายละเอียดตามสลิปที่แนบ) — ชำระเงินเรียบร้อยแล้ว (Paid)</p>
          </div>

          <div className="py-8 text-center text-[13px]">
            <p className="mb-1">ลงชื่อ.........................................ผู้ขาย/ผู้รับเงิน</p>
            <p>({activeVoucher.owner_full_name ?? ownerProfile?.full_name ?? owner})</p>
            <p className="mt-1 text-[#4B4F5B]">
              วันที่ {formatThaiDateNumeric(selectedProduct.sold_at ?? activeVoucher.created_at)}
            </p>
          </div>

          <p className="border-t border-[#E4E6EF] pt-3 text-[11px] text-[#4B4F5B]">
            * เอกสารฉบับนี้จัดทำขึ้นโดยระบบ ยืนยันการชำระเงินสำเร็จผ่านหลักฐานสลิปโอนเงินธนาคารที่แนบไว้ท้ายเอกสาร
            แทนการลงลายมือชื่อสดของลูกค้า
          </p>
        </div>

        {selectedProduct.sale_slip_url && (
          <div ref={attachRef} className="border-t border-[#E4E6EF] px-8 pb-8 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4B4F5B]">
              หลักฐานแนบประกอบ (Attachments)
            </p>
            <div>
              <p className="mb-1 text-[11px] text-[#4B4F5B]">รูปสลิปโอนเงิน ttb</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProduct.sale_slip_url}
                alt="สลิปโอนเงิน"
                onClick={() => setLightboxUrl(selectedProduct.sale_slip_url)}
                className="h-auto w-56 max-h-72 cursor-zoom-in rounded-lg border border-[#E4E6EF] object-contain"
              />
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
