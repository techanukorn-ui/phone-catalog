'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORIES, type Product, type ProductCategory, type ProductStatus } from '@/lib/types'
import { deleteImageByUrl, deleteImagesByUrls, generateProductCode, uploadImage } from '@/lib/utils'

type Props = {
  mode: 'add' | 'edit'
  initialProduct?: Product
  onSaved: () => void
  onCancel?: () => void
}

type FieldState = {
  category: ProductCategory
  product_code: string
  model_name: string
  capacity: string
  color: string
  price: string
  battery_percent: string
  condition_percent: string
  charge_cycles: string
  warranty_until: string
  accessories: string
  defects: string
  status: ProductStatus
  listed_at: string
}

function todayStr(): string {
  const d = new Date()
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

function toFieldState(p?: Product): FieldState {
  return {
    category: p?.category ?? 'iPhone',
    product_code: p?.product_code ?? '',
    model_name: p?.model_name ?? '',
    capacity: p?.capacity ?? '',
    color: p?.color ?? '',
    price: p?.price != null ? String(p.price) : '',
    battery_percent: p?.battery_percent != null ? String(p.battery_percent) : '',
    condition_percent: p?.condition_percent != null ? String(p.condition_percent) : '',
    charge_cycles: p?.charge_cycles != null ? String(p.charge_cycles) : '',
    warranty_until: p?.warranty_until ?? '',
    accessories: p?.accessories ?? '',
    defects: p?.defects ?? '',
    listed_at: p?.listed_at ?? todayStr(),
    status: p?.status ?? 'พร้อมขาย',
  }
}

export default function ProductForm({ mode, initialProduct, onSaved, onCancel }: Props) {
  const [fields, setFields] = useState<FieldState>(toFieldState(initialProduct))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(initialProduct?.cover_image_url ?? null)
  const [existingGallery, setExistingGallery] = useState<string[]>(initialProduct?.gallery_images ?? [])
  const [removedGallery, setRemovedGallery] = useState<string[]>([])
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const payload = {
        category: fields.category,
        model_name: fields.model_name.trim(),
        capacity: fields.capacity.trim() || null,
        color: fields.color.trim() || null,
        price: Number(fields.price),
        battery_percent: fields.battery_percent ? Number(fields.battery_percent) : null,
        condition_percent: fields.condition_percent ? Number(fields.condition_percent) : null,
        charge_cycles: fields.charge_cycles ? Number(fields.charge_cycles) : null,
        warranty_until: fields.warranty_until.trim() || null,
        accessories: fields.accessories.trim() || null,
        defects: fields.defects.trim() || null,
        status: fields.status,
        listed_at: fields.listed_at || todayStr(),
        cover_image_url: coverUrl,
        gallery_images: finalGallery,
      }

      if (mode === 'add') {
        const manualCode = fields.product_code.trim().toUpperCase()
        if (manualCode) {
          const { error: insertError } = await supabase
            .from('products')
            .insert([{ ...payload, product_code: manualCode }])
          if (insertError) {
            if (insertError.code === '23505') {
              throw new Error(`รหัสสินค้า "${manualCode}" ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`)
            }
            throw insertError
          }
        } else {
          let attempt = 0
          let lastError: any = null
          while (attempt < 5) {
            const product_code = generateProductCode(fields.category)
            const { error: insertError } = await supabase
              .from('products')
              .insert([{ ...payload, product_code }])
            if (!insertError) {
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
      } else if (initialProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', initialProduct.id)
        if (updateError) throw updateError

        // ลบรูปเก่าที่ถูกถอดออก และรูปปกเก่าถ้ามีการเปลี่ยนรูปใหม่
        if (removedGallery.length > 0) {
          await deleteImagesByUrls('product-images', removedGallery)
        }
        if (coverFile && initialProduct.cover_image_url) {
          await deleteImageByUrl('product-images', initialProduct.cover_image_url)
        }
      }

      onSaved()
      if (mode === 'add') {
        setFields(toFieldState(undefined))
        setCoverFile(null)
        setCoverPreview(null)
        setExistingGallery([])
        setNewGalleryFiles([])
      }
    } catch (err: any) {
      setError(err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-panel p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">หมวดหมู่</span>
          <select
            value={fields.category}
            onChange={(e) => updateField('category', e.target.value as ProductCategory)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
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
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="พร้อมขาย">พร้อมขาย</option>
            <option value="ขายแล้ว">ขายแล้ว</option>
          </select>
        </label>
      </div>

      {mode === 'add' && (
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
            รหัสสินค้า (เว้นว่างเพื่อสุ่มอัตโนมัติ)
          </span>
          <input
            value={fields.product_code}
            onChange={(e) => updateField('product_code', e.target.value)}
            placeholder="เช่น IP-7F3K9A"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 font-mono text-sm uppercase"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">วันที่ลงสินค้า</span>
        <input
          type="date"
          value={fields.listed_at}
          onChange={(e) => updateField('listed_at', e.target.value)}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ชื่อรุ่น *</span>
        <input
          value={fields.model_name}
          onChange={(e) => updateField('model_name', e.target.value)}
          placeholder="เช่น iPhone 13 Pro Max"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ความจุ</span>
          <input
            value={fields.capacity}
            onChange={(e) => updateField('capacity', e.target.value)}
            placeholder="เช่น 256GB"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">สี</span>
          <input
            value={fields.color}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="เช่น Titanium Blue"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ราคา (บาท) *</span>
        <input
          value={fields.price}
          onChange={(e) => updateField('price', e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 21900"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">แบตเตอรี่ %</span>
          <input
            value={fields.battery_percent}
            onChange={(e) => updateField('battery_percent', e.target.value)}
            inputMode="numeric"
            placeholder="0-100"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">สภาพเครื่อง %</span>
          <input
            value={fields.condition_percent}
            onChange={(e) => updateField('condition_percent', e.target.value)}
            inputMode="numeric"
            placeholder="0-100"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รอบชาร์จ</span>
        <input
          value={fields.charge_cycles}
          onChange={(e) => updateField('charge_cycles', e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 79"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ประกันศูนย์เหลือถึง</span>
        <input
          value={fields.warranty_until}
          onChange={(e) => updateField('warranty_until', e.target.value)}
          placeholder="เช่น 12 มี.ค. 2569 หรือ หมดประกัน"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">อุปกรณ์ที่มีให้</span>
        <textarea
          value={fields.accessories}
          onChange={(e) => updateField('accessories', e.target.value)}
          rows={2}
          placeholder="เช่น กล่อง, สายชาร์จ, เคส"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รายละเอียดตำหนิ</span>
        <textarea
          value={fields.defects}
          onChange={(e) => updateField('defects', e.target.value)}
          rows={2}
          placeholder="เช่น มีรอยขีดข่วนเล็กน้อยที่มุมล่างขวา"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">
          รูปปก (Cover) {mode === 'add' && '*'}
        </span>
        <div className="flex items-center gap-3">
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="cover preview" className="h-16 w-16 rounded-tag border border-line object-cover" />
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
              <img src={url} alt="gallery" className="h-14 w-14 rounded-tag border border-line object-cover" />
              <button
                type="button"
                onClick={() => removeExistingGalleryImage(url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {newGalleryFiles.map((file, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="new gallery" className="h-14 w-14 rounded-tag border border-line object-cover" />
              <button
                type="button"
                onClick={() => removeNewGalleryFile(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={handleGalleryChange} className="text-xs" />
      </div>

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
    </form>
  )
}
