'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  CATEGORIES,
  OWNERS,
  type Product,
  type ProductCategory,
  type ProductBank,
  type ProductOwner,
  type ProductPaymentMethod,
  type ProductStatus,
} from '@/lib/types'
import {
  deleteImageByUrl,
  deleteImagesByUrls,
  generateProductCode,
  getNextCategorySortOrder,
  getNextSortOrder,
  nextReceiptDocNumber,
  uploadImage,
} from '@/lib/utils'

type Props = {
  mode: 'add' | 'edit'
  initialProduct?: Product
  onSaved: () => void
  onCancel?: () => void
}

type FieldState = {
  category: ProductCategory
  owner: ProductOwner | ''
  product_code: string
  model_name: string
  capacity: string
  color: string
  price: string
  battery_percent: string
  charge_cycles: string
  warranty_until: string
  accessories: string
  defects: string
  status: ProductStatus
  listed_at: string
  cost_device: string
  purchase_payment_method: ProductPaymentMethod
  purchase_bank: ProductBank | ''
  purchase_date: string
  imei_serial: string
  seller_name: string
}

function todayStr(): string {
  const d = new Date()
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

function toFieldState(p?: Product): FieldState {
  return {
    category: p?.category ?? 'IPAD',
    owner: p?.owner ?? '',
    product_code: p?.product_code ?? '',
    model_name: p?.model_name ?? '',
    capacity: p?.capacity ?? '',
    color: p?.color ?? '',
    price: p?.price != null ? String(p.price) : '',
    battery_percent: p?.battery_percent != null ? String(p.battery_percent) : '',
    charge_cycles: p?.charge_cycles != null ? String(p.charge_cycles) : '',
    warranty_until: p?.warranty_until ?? '',
    accessories: p?.accessories ?? '',
    defects: p?.defects ?? '',
    listed_at: p?.listed_at ?? todayStr(),
    status: p?.status ?? 'พร้อมขาย',
    cost_device: p?.cost_device != null ? String(p.cost_device) : '',
    purchase_payment_method: p?.purchase_payment_method ?? 'เงินสด',
    purchase_bank: p?.purchase_bank ?? '',
    purchase_date: p?.purchase_date ?? todayStr(),
    imei_serial: p?.imei_serial ?? '',
    seller_name: p?.seller_name ?? '',
  }
}

export default function ProductForm({ mode, initialProduct, onSaved, onCancel }: Props) {
  const [fields, setFields] = useState<FieldState>(toFieldState(initialProduct))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(initialProduct?.cover_image_url ?? null)
  const [existingGallery, setExistingGallery] = useState<string[]>(initialProduct?.gallery_images ?? [])
  const [removedGallery, setRemovedGallery] = useState<string[]>([])
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([])
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(initialProduct?.purchase_slip_url ?? null)
  const [removeSlip, setRemoveSlip] = useState(false)
  const [existingEvidence, setExistingEvidence] = useState<string[]>(
    initialProduct?.purchase_evidence_urls ?? []
  )
  const [removedEvidence, setRemovedEvidence] = useState<string[]>([])
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  function updateField<K extends keyof FieldState>(key: K, value: FieldState[K]) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setNewGalleryFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removeExistingGalleryImage(url: string) {
    setExistingGallery((prev) => prev.filter((u) => u !== url))
    setRemovedGallery((prev) => [...prev, url])
  }

  function removeNewGalleryFile(index: number) {
    setNewGalleryFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
    setRemoveSlip(false)
  }

  function removeSlipImage() {
    setSlipFile(null)
    setSlipPreview(null)
    setRemoveSlip(true)
  }

  function handleEvidenceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setNewEvidenceFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removeExistingEvidenceImage(url: string) {
    setExistingEvidence((prev) => prev.filter((u) => u !== url))
    setRemovedEvidence((prev) => [...prev, url])
  }

  function removeNewEvidenceFile(index: number) {
    setNewEvidenceFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fields.model_name.trim()) {
      setError('กรุณากรอกชื่อรุ่น')
      return
    }
    if (!fields.price || Number.isNaN(Number(fields.price))) {
      setError('กรุณากรอกราคาเป็นตัวเลข')
      return
    }
    if (mode === 'add' && !coverFile) {
      setError('กรุณาเลือกรูปปกสินค้า')
      return
    }
    if (mode === 'edit' && !fields.product_code.trim()) {
      setError('กรุณากรอกรหัสสินค้า')
      return
    }
    if (mode === 'add' && (!fields.cost_device || Number.isNaN(Number(fields.cost_device)))) {
      setError('กรุณากรอกต้นทุนเครื่อง')
      return
    }
    if (mode === 'add' && !fields.purchase_date) {
      setError('กรุณาเลือกวันที่ซื้อเครื่อง')
      return
    }
    if (fields.purchase_payment_method === 'โอน' && !fields.purchase_bank) {
      setError('กรุณาเลือกธนาคาร')
      return
    }

    setSaving(true)
    try {
      let coverUrl = initialProduct?.cover_image_url ?? ''
      if (coverFile) {
        const folder = initialProduct?.product_code ?? fields.category
        coverUrl = await uploadImage('product-images', coverFile, folder)
      }

      const uploadedGalleryUrls: string[] = []
      for (const file of newGalleryFiles) {
        const folder = initialProduct?.product_code ?? fields.category
        const url = await uploadImage('product-images', file, folder)
        uploadedGalleryUrls.push(url)
      }

      const finalGallery = [...existingGallery, ...uploadedGalleryUrls]

      let slipUrl = removeSlip ? null : initialProduct?.purchase_slip_url ?? null
      if (fields.purchase_payment_method === 'โอน' && slipFile) {
        const folder = initialProduct?.product_code ?? fields.category
        slipUrl = await uploadImage('product-images', slipFile, folder)
      } else if (fields.purchase_payment_method === 'เงินสด') {
        slipUrl = null
      }

      const uploadedEvidenceUrls: string[] = []
      for (const file of newEvidenceFiles) {
        const folder = initialProduct?.product_code ?? fields.category
        const url = await uploadImage('product-images', file, folder)
        uploadedEvidenceUrls.push(url)
      }
      const finalEvidence = [...existingEvidence, ...uploadedEvidenceUrls]

      const payload = {
        category: fields.category,
        owner: fields.owner || null,
        model_name: fields.model_name.trim(),
        capacity: fields.capacity.trim() || null,
        color: fields.color.trim() || null,
        price: Number(fields.price),
        battery_percent: fields.battery_percent ? Number(fields.battery_percent) : null,
        charge_cycles: fields.charge_cycles ? Number(fields.charge_cycles) : null,
        warranty_until: fields.warranty_until.trim() || null,
        accessories: fields.accessories.trim() || null,
        defects: fields.defects.trim() || null,
        status: fields.status,
        listed_at: fields.listed_at || todayStr(),
        cover_image_url: coverUrl,
        gallery_images: finalGallery,
        cost_device: fields.cost_device ? Number(fields.cost_device) : null,
        purchase_payment_method: fields.purchase_payment_method,
        purchase_bank: fields.purchase_payment_method === 'โอน' ? fields.purchase_bank || null : null,
        purchase_slip_url: slipUrl,
        purchase_date: fields.purchase_date || null,
        imei_serial: fields.imei_serial.trim() || null,
        seller_name: fields.seller_name.trim() || null,
        purchase_evidence_urls: finalEvidence,
      }

      if (mode === 'add') {
        const sort_order = await getNextSortOrder()
        const category_sort_order = await getNextCategorySortOrder(fields.category)
        const manualCode = fields.product_code.trim().toUpperCase()
        let newProductId: string | null = null
        if (manualCode) {
          const { data: inserted, error: insertError } = await supabase
            .from('products')
            .insert([{ ...payload, product_code: manualCode, sort_order, category_sort_order }])
            .select('id')
            .single()
          if (insertError) {
            if (insertError.code === '23505') {
              throw new Error(`รหัสสินค้า "${manualCode}" ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`)
            }
            throw insertError
          }
          newProductId = inserted.id
        } else {
          let attempt = 0
          let lastError: any = null
          while (attempt < 5) {
            const product_code = generateProductCode(fields.category)
            const { data: inserted, error: insertError } = await supabase
              .from('products')
              .insert([{ ...payload, product_code, sort_order, category_sort_order }])
              .select('id')
              .single()
            if (!insertError) {
              newProductId = inserted.id
              lastError = null
              break
            }
            // 23505 = unique_violation → รหัสซ้ำ ลองใหม่
            if (insertError.code !== '23505') {
              lastError = insertError
              break
            }
            lastError = insertError
            attempt++
          }
          if (lastError) throw lastError
        }

        // ซื้อผ่านโอน TTB → ออกใบสำคัญรับเงินให้อัตโนมัติเลย ไม่ต้องรอกดสร้างเองทีหลังในหน้าบัญชี/ภาษี
        if (newProductId && payload.purchase_payment_method === 'โอน' && payload.purchase_bank === 'TTB') {
          const doc_number = await nextReceiptDocNumber()
          // ก็อปข้อมูลส่วนตัวเจ้าของทุน ณ ตอนนี้แช่แข็งไว้ในเอกสาร ไม่ให้เปลี่ยนย้อนหลังถ้าไปแก้ข้อมูลส่วนตัวทีหลัง
          const { data: ownerProfile } = await supabase
            .from('owner_profiles')
            .select('full_name, id_card_number, address, phone')
            .eq('owner', payload.owner)
            .maybeSingle()
          await supabase.from('receipt_vouchers').insert({
            doc_number,
            doc_type: 'ใบสำคัญรับเงิน',
            owner: payload.owner,
            product_id: newProductId,
            method: 'TTB',
            seller_name: payload.seller_name,
            owner_full_name: ownerProfile?.full_name ?? null,
            owner_id_card_number: ownerProfile?.id_card_number ?? null,
            owner_address: ownerProfile?.address ?? null,
            owner_phone: ownerProfile?.phone ?? null,
          })
        }
      } else if (initialProduct) {
        const newCode = fields.product_code.trim().toUpperCase()
        // เปลี่ยนหมวดหมู่ระหว่างแก้ไข → ค่า category_sort_order เดิมใช้กับหมวดใหม่ไม่ได้ ต้องขอค่าลำดับใหม่
        const updatePayload =
          initialProduct.category !== fields.category
            ? { ...payload, product_code: newCode, category_sort_order: await getNextCategorySortOrder(fields.category) }
            : { ...payload, product_code: newCode }
        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', initialProduct.id)
        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error(`รหัสสินค้า "${newCode}" ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`)
          }
          throw updateError
        }

        // ลบรูปเก่าที่ถูกถอดออก และรูปปกเก่าถ้ามีการเปลี่ยนรูปใหม่
        if (removedGallery.length > 0) {
          await deleteImagesByUrls('product-images', removedGallery)
        }
        if (coverFile && initialProduct.cover_image_url) {
          await deleteImageByUrl('product-images', initialProduct.cover_image_url)
        }
        if (initialProduct.purchase_slip_url && initialProduct.purchase_slip_url !== slipUrl) {
          await deleteImageByUrl('product-images', initialProduct.purchase_slip_url)
        }
        if (removedEvidence.length > 0) {
          await deleteImagesByUrls('product-images', removedEvidence)
        }
      }

      onSaved()
      if (mode === 'add') {
        setFields(toFieldState(undefined))
        setCoverFile(null)
        setCoverPreview(null)
        setExistingGallery([])
        setNewGalleryFiles([])
        setSlipFile(null)
        setSlipPreview(null)
        setRemoveSlip(false)
        setExistingEvidence([])
        setNewEvidenceFiles([])
      }
    } catch (err: any) {
      setError(err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-panel p-4">
      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          รูปปก (Cover) {mode === 'add' && '*'}
        </span>
        <div className="flex items-center gap-3">
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt="cover preview"
              onClick={() => setLightboxUrl(coverPreview)}
              className="h-16 w-16 cursor-zoom-in rounded-tag border border-line object-cover"
            />
          )}
          <input type="file" accept="image/*" onChange={handleCoverChange} className="text-xs" />
        </div>
      </div>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รูปประกอบ (Gallery)</span>
        <div className="mb-2 flex flex-wrap gap-2">
          {existingGallery.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="gallery"
                onClick={() => setLightboxUrl(url)}
                className="h-14 w-14 cursor-zoom-in rounded-tag border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => removeExistingGalleryImage(url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {newGalleryFiles.map((file, i) => {
            const previewUrl = URL.createObjectURL(file)
            return (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="new gallery"
                  onClick={() => setLightboxUrl(previewUrl)}
                  className="h-14 w-14 cursor-zoom-in rounded-tag border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewGalleryFile(i)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
        <input type="file" accept="image/*" multiple onChange={handleGalleryChange} className="text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">หมวดหมู่</span>
          <select
            value={fields.category}
            onChange={(e) => updateField('category', e.target.value as ProductCategory)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">สถานะ</span>
          <select
            value={fields.status}
            onChange={(e) => updateField('status', e.target.value as ProductStatus)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          >
            <option value="พร้อมขาย">พร้อมขาย</option>
            <option value="ขายแล้ว">ขายแล้ว</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">เจ้าของทุน</span>
        <select
          value={fields.owner}
          onChange={(e) => updateField('owner', e.target.value as ProductOwner | '')}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        >
          <option value="">ไม่ระบุ</option>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          {mode === 'add' ? 'รหัสสินค้า (เว้นว่างเพื่อสุ่มอัตโนมัติ)' : 'รหัสสินค้า *'}
        </span>
        <input
          value={fields.product_code}
          onChange={(e) => updateField('product_code', e.target.value)}
          placeholder="เช่น IP-7F3K9A"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 font-mono text-base uppercase"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">วันที่ลงสินค้า</span>
        <input
          type="date"
          value={fields.listed_at}
          onChange={(e) => updateField('listed_at', e.target.value)}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ชื่อรุ่น *</span>
        <input
          value={fields.model_name}
          onChange={(e) => updateField('model_name', e.target.value)}
          placeholder="เช่น iPhone 13 Pro Max"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ความจุ</span>
          <input
            value={fields.capacity}
            onChange={(e) => updateField('capacity', e.target.value)}
            placeholder="เช่น 256GB"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">สี</span>
          <input
            value={fields.color}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="เช่น Titanium Blue"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">IMEI / Serial Number</span>
        <input
          value={fields.imei_serial}
          onChange={(e) => updateField('imei_serial', e.target.value)}
          placeholder="ไม่บังคับ"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 font-mono text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ราคา (บาท) *</span>
        <input
          value={fields.price}
          onChange={(e) => updateField('price', e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 21900"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          วันที่ซื้อเครื่อง {mode === 'add' && '*'}
        </span>
        <input
          type="date"
          value={fields.purchase_date}
          onChange={(e) => updateField('purchase_date', e.target.value)}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ชื่อ-นามสกุล ผู้ขาย</span>
        <input
          value={fields.seller_name}
          onChange={(e) => updateField('seller_name', e.target.value)}
          placeholder="ไม่บังคับ"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          หลักฐานการซื้อ (ไม่บังคับ, แนบได้หลายรูป)
        </span>
        <div className="mb-2 flex flex-wrap gap-2">
          {existingEvidence.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="หลักฐานการซื้อ"
                onClick={() => setLightboxUrl(url)}
                className="h-16 w-16 cursor-zoom-in rounded-tag border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => removeExistingEvidenceImage(url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {newEvidenceFiles.map((file, i) => {
            const previewUrl = URL.createObjectURL(file)
            return (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="หลักฐานการซื้อใหม่"
                  onClick={() => setLightboxUrl(previewUrl)}
                  className="h-16 w-16 cursor-zoom-in rounded-tag border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewEvidenceFile(i)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
        <input type="file" accept="image/*" multiple onChange={handleEvidenceChange} className="text-xs" />
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          ต้นทุนเครื่อง (บาท) {mode === 'add' && '*'}
        </span>
        <input
          value={fields.cost_device}
          onChange={(e) => updateField('cost_device', e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 15000"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">วิธีจ่ายเงินตอนซื้อเครื่อง</span>
        <select
          value={fields.purchase_payment_method}
          onChange={(e) => updateField('purchase_payment_method', e.target.value as ProductPaymentMethod)}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        >
          <option value="เงินสด">เงินสด</option>
          <option value="โอน">โอน</option>
        </select>
      </label>

      {fields.purchase_payment_method === 'โอน' && (
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ธนาคาร</span>
          <select
            value={fields.purchase_bank}
            onChange={(e) => updateField('purchase_bank', e.target.value as ProductBank)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          >
            <option value="">เลือกธนาคาร</option>
            <option value="TTB">TTB</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </label>
      )}

      {fields.purchase_payment_method === 'โอน' && (
        <div>
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
            สลิปโอนเงิน (ไม่บังคับ)
          </span>
          <div className="flex items-center gap-3">
            {slipPreview && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slipPreview}
                  alt="สลิปโอนเงิน"
                  onClick={() => setLightboxUrl(slipPreview)}
                  className="h-16 w-16 cursor-zoom-in rounded-tag border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={removeSlipImage}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleSlipChange} className="text-xs" />
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">แบตเตอรี่ %</span>
        <input
          value={fields.battery_percent}
          onChange={(e) => updateField('battery_percent', e.target.value)}
          inputMode="numeric"
          placeholder="0-100"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รอบชาร์จ</span>
        <input
          value={fields.charge_cycles}
          onChange={(e) => updateField('charge_cycles', e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 79"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ประกันศูนย์เหลือถึง</span>
        <input
          value={fields.warranty_until}
          onChange={(e) => updateField('warranty_until', e.target.value)}
          placeholder="เช่น 12 มี.ค. 2569 หรือ หมดประกัน"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">อุปกรณ์ที่มีให้</span>
        <textarea
          value={fields.accessories}
          onChange={(e) => updateField('accessories', e.target.value)}
          rows={2}
          placeholder="เช่น กล่อง, สายชาร์จ, เคส"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รายละเอียดสินค้า / ตำหนิ(ถ้ามี)</span>
        <textarea
          value={fields.defects}
          onChange={(e) => updateField('defects', e.target.value)}
          rows={2}
          placeholder="เช่น มีรอยขีดข่วนเล็กน้อยที่มุมล่างขวา"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก…' : mode === 'add' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-tag border border-line px-4 py-2.5 font-mono text-sm text-ink/70"
          >
            ยกเลิก
          </button>
        )}
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="ดูรูปขยาย"
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
    </form>
  )
}
