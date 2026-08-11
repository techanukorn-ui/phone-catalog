'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { StoreSettings, StoreTheme } from '@/lib/types'
import ThemePicker from './ThemePicker'

type ThemeField = 'bg_theme' | 'theme' | 'name_theme' | 'price_theme' | 'tagline_theme' | 'pill_text_theme'

const THEME_FIELDS: { key: ThemeField; label: string; fallback: StoreTheme }[] = [
  { key: 'bg_theme', label: 'ธีมสีพื้นหลังหน้าร้าน', fallback: 'cream' },
  { key: 'theme', label: 'ธีมสีปุ่มกด', fallback: 'teal' },
  { key: 'name_theme', label: 'ธีมสีชื่อรุ่นสินค้า', fallback: 'black' },
  { key: 'price_theme', label: 'ธีมสีราคาสินค้า', fallback: 'amber' },
  { key: 'tagline_theme', label: 'ธีมสีสโลแกนใต้ชื่อร้าน', fallback: 'teal' },
  { key: 'pill_text_theme', label: 'ธีมสีตัวหนังสือปุ่มหมวดหมู่ (ตอนถูกเลือก)', fallback: 'white' },
]

function defaultValues(): Record<ThemeField, StoreTheme> {
  return Object.fromEntries(THEME_FIELDS.map((f) => [f.key, f.fallback])) as Record<ThemeField, StoreTheme>
}

export default function ThemeSettingsForm() {
  const [values, setValues] = useState<Record<ThemeField, StoreTheme>>(defaultValues)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
      const s = data as StoreSettings | null
      setValues(
        Object.fromEntries(THEME_FIELDS.map((f) => [f.key, s?.[f.key] ?? f.fallback])) as Record<ThemeField, StoreTheme>
      )
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { error: upsertError } = await supabase.from('store_settings').upsert({ id: 1, ...values })
      if (upsertError) throw upsertError
      setSavedAt(Date.now())
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดข้อมูล…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-panel p-4">
      {THEME_FIELDS.map((f) => (
        <ThemePicker
          key={f.key}
          label={f.label}
          value={values[f.key]}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
        />
      ))}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {savedAt && !error && (
        <p className="rounded-tag bg-teal-light px-3 py-2 text-sm text-teal-dark">บันทึกธีมสีเรียบร้อย</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึกธีมสี'}
      </button>
    </form>
  )
}
