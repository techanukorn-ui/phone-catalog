'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import StoreSettingsForm from '@/components/admin/StoreSettingsForm'
import ProductForm from '@/components/admin/ProductForm'
import ProductList from '@/components/admin/ProductList'
import ReportView from '@/components/admin/ReportView'
import LoginForm from '@/components/admin/LoginForm'

type Tab = 'settings' | 'add' | 'stock-available' | 'stock-sold' | 'report'

const TABS: { key: Tab; label: string; active: string; inactive: string }[] = [
  {
    key: 'stock-available',
    label: 'สต็อกสินค้าพร้อมขาย',
    active: 'border-teal bg-teal text-white',
    inactive: 'border-teal text-teal-dark bg-panel',
  },
  {
    key: 'stock-sold',
    label: 'สินค้าขายแล้ว',
    active: 'border-ink bg-ink text-white',
    inactive: 'border-ink text-ink bg-panel',
  },
  {
    key: 'add',
    label: 'เพิ่มสินค้า',
    active: 'border-success bg-success text-white',
    inactive: 'border-success text-success bg-panel',
  },
  {
    key: 'report',
    label: 'รายงาน',
    active: 'border-amber-dark bg-amber-dark text-white',
    inactive: 'border-amber-dark text-amber-dark bg-panel',
  },
  {
    key: 'settings',
    label: 'ข้อมูลร้านค้า',
    active: 'border-info-dark bg-info-dark text-white',
    inactive: 'border-info-dark text-info-dark bg-panel',
  },
]

export default function AdminManagePage() {
  const [tab, setTab] = useState<Tab>('stock-available')
  const [refreshKey, setRefreshKey] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="font-mono text-sm text-ink/50">กำลังตรวจสอบสิทธิ์…</p>
      </main>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <main className="min-h-screen bg-paper pb-16">
      <header className="sticky top-0 z-30 border-b border-line bg-ink">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold text-white">แผงควบคุมร้านค้า</p>
            <p className="font-mono text-[11px] uppercase tracking-wide text-white/50">
              หน้านี้เข้าถึงได้ผ่านลิงก์ตรงเท่านั้น — อย่าเผยแพร่ลิงก์นี้
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="shrink-0 rounded-tag border border-white/30 px-3 py-1.5 font-mono text-xs text-white/80"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="sticky top-[60px] z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 py-2.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide ${
                tab === t.key ? t.active : t.inactive
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {tab === 'settings' && <StoreSettingsForm />}

        {tab === 'add' && (
          <ProductForm
            mode="add"
            onSaved={() => {
              setRefreshKey((k) => k + 1)
            }}
          />
        )}

        {tab === 'stock-available' && <ProductList key={refreshKey} status="พร้อมขาย" />}

        {tab === 'stock-sold' && <ProductList key={refreshKey} status="ขายแล้ว" />}

        {tab === 'report' && <ReportView />}
      </div>
    </main>
  )
}
