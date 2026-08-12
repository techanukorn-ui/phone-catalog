'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { OwnerProfile } from '@/lib/types'

type Props = {
  owner: string
}

export default function OwnerProfileForm({ owner }: Props) {
  const [fullName, setFullName] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setSavedAt(null)
      const { data } = await supabase.from('owner_profiles').select('*').eq('owner', owner).maybeSingle()
      if (cancelled) return
      const p = data as OwnerProfile | null
      setFullName(p?.full_name ?? '')
      setIdCardNumber(p?.id_card_number ?? '')
      setAddress(p?.address ?? '')
      setPhone(p?.phone ?? '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [owner])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const digits = idCardNumber.trim()
    if (digits && !/^\d{13}$/.test(digits)) {
      setError('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก')
      return
    }

    setSaving(true)
    try {
      const { error: upsertError } = await supabase.from('owner_profiles').upsert({
        owner,
        full_name: fullName.trim() || null,
        id_card_number: digits || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      if (upsertError) throw upsertError
      setSavedAt(Date.now())
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

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl rounded-2xl border border-[#E4E6EF] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]"
    >
      <p className="mb-5 text-[13px] text-[#8A8FA3]">
        ข้อมูลนี้จะถูกดึงไปใช้ตอนออกเอกสาร (ใบสำคัญรับเงิน / ใบเสร็จรับเงิน) ของ <span className="font-medium text-[#1B1E2B]">{owner}</span>
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ชื่อ-นามสกุล (เต็ม)</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="เช่น นายสมชาย ใจดี"
            className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">เลขบัตรประชาชน 13 หลัก</span>
          <input
            value={idCardNumber}
            onChange={(e) => setIdCardNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 13))}
            inputMode="numeric"
            placeholder="เช่น 1234567890123"
            className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">ที่อยู่ตามบัตรประชาชน</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="เช่น 123 หมู่ 4 ต.บางรัก อ.เมือง จ.สมุทรปราการ 10270"
            className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#1B1E2B]">เบอร์โทร</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="เช่น 081-234-5678"
            className="w-full rounded-lg border border-[#E4E6EF] bg-white px-3 py-2.5 text-sm text-[#1B1E2B] outline-none transition-colors focus:border-[#3B5BFF]"
          />
        </label>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}
      {savedAt && !error && (
        <p className="mt-4 rounded-lg bg-[#EEF1FF] px-3 py-2 text-[13px] text-[#3B5BFF]">บันทึกข้อมูลเรียบร้อย</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-lg bg-[#3B5BFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
      </button>
    </form>
  )
}
