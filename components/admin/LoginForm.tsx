'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
    } catch (err: any) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-panel p-6 shadow-tag"
      >
        <div>
          <p className="font-display text-lg font-semibold text-ink">เข้าสู่ระบบแผงควบคุมร้านค้า</p>
          <p className="mt-0.5 font-mono text-xs text-ink/50">สำหรับเจ้าของร้านเท่านั้น</p>
        </div>

        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">อีเมล</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">รหัสผ่าน</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>

        {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  )
}
