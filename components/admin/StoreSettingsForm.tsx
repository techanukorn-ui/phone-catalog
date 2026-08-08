'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { StoreSettings } from '@/lib/types'
import { deleteImageByUrl, uploadImage } from '@/lib/utils'

export default function StoreSettingsForm() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [storeName, setStoreName] = useState('')
  const [phone1, setPhone1] = useState('')
  const [phone2, setPhone2] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
      const s = data as StoreSettings | null
      setSettings(s)
      setStoreName(s?.store_name ?? '')
      setPhone1(s?.phone1 ?? '')
      setPhone2(s?.phone2 ?? '')
      setLogoPreview(s?.logo_url ?? null)
      setLoading(false)
    }
    load()
  }, [])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      let logoUrl = settings?.logo_url ?? null
      if (logoFile) {
        logoUrl = await uploadImage('store-assets', logoFile, 'logo')
        if (settings?.logo_url) {
          await deleteImageByUrl('store-assets', settings.logo_url)
        }
      }

      const { data, error: upsertError } = await supabase
        .from('store_settings')
        .upsert({
          id: 1,
          store_name: storeName.trim() || 'ร้านมือถือมือสอง',
          logo_url: logoUrl,
          phone1: phone1.trim() || null,
          phone2: phone2.trim() || null,
        })
        .select()
        .single()
      if (upsertError) throw upsertError

      setSettings(data as StoreSettings)
      setLogoFile(null)
      setSavedAt(Date.now())
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดข้อมูลร้านค้า…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-panel p-4">
      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ชื่อร้านค้า</span>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="เช่น ร้านมือถือใจดี"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">เบอร์โทร 1</span>
          <input
            value={phone1}
            onChange={(e) => setPhone1(e.target.value)}
            inputMode="tel"
            placeholder="เช่น 081-234-5678"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">เบอร์โทร 2</span>
          <input
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            inputMode="tel"
            placeholder="เช่น 089-876-5432"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">โลโก้ร้านค้า</span>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-tag border border-line bg-paper">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="logo preview" className="h-full w-full object-cover" />
            ) : (
              <span className="font-mono text-[10px] text-ink/40">ไม่มีโลโก้</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleLogoChange} className="text-xs" />
        </div>
      </div>

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {savedAt && !error && (
        <p className="rounded-tag bg-teal-light px-3 py-2 text-sm text-teal-dark">บันทึกข้อมูลร้านค้าเรียบร้อย</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูลร้านค้า'}
      </button>
    </form>
  )
}
