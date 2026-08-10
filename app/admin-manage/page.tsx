'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import StoreSettingsForm from '@/components/admin/StoreSettingsForm'
import ProductForm from '@/components/admin/ProductForm'
import ProductList from '@/components/admin/ProductList'
import ReportSection from '@/components/admin/ReportSection'
import OverviewDashboard from '@/components/admin/OverviewDashboard'
import LoginForm from '@/components/admin/LoginForm'

type Tab = 'overview' | 'settings' | 'add' | 'stock-available' | 'stock-sold' | 'report'

const TABS: { key: Tab; label: string; shortLabel: string; icon: string }[] = [
  { key: 'overview', label: 'ภาพรวม', shortLabel: 'ภาพรวม', icon: '📊' },
  { key: 'stock-available', label: 'สต็อกสินค้าพร้อมขาย', shortLabel: 'พร้อมขาย', icon: '📦' },
  { key: 'stock-sold', label: 'สินค้าขายแล้ว', shortLabel: 'ขายแล้ว', icon: '✅' },
  { key: 'add', label: 'เพิ่มสินค้า', shortLabel: 'เพิ่ม', icon: '➕' },
  { key: 'report', label: 'รายงาน', shortLabel: 'รายงาน', icon: '📈' },
  { key: 'settings', label: 'ข้อมูลร้านค้า', shortLabel: 'ตั้งค่า', icon: '⚙️' },
]

export default function AdminManagePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [jumpToProductId, setJumpToProductId] = useState<string | null>(null)

  function handleSelectProductFromReport(id: string) {
    setJumpToProductId(id)
    setTab('stock-available')
  }

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
    <main className="min-h-screen bg-paper pb-24 sm:pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-ink">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 lg:max-w-5xl">
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

      {/* จอกว้าง (คอมพิวเตอร์) — แถบแท็บติดกับเนื้อหา เพราะ bottom nav แบบมือถือจะดูลอยแยกจากเนื้อหาไปไกล */}
      <div className="sticky top-[60px] z-20 hidden border-b border-line bg-paper/95 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-2xl gap-1 px-4 py-2 lg:max-w-5xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
                tab === t.key ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70'
              }`}
            >
              <span className="text-sm leading-none">{t.icon}</span>
              {t.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-fade-in mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl">
        {tab === 'overview' && <OverviewDashboard />}

        {tab === 'settings' && <StoreSettingsForm />}

        {tab === 'add' && (
          <ProductForm
            mode="add"
            onSaved={() => {
              setRefreshKey((k) => k + 1)
            }}
          />
        )}

        {tab === 'stock-available' && (
          <ProductList
            key={refreshKey}
            status="พร้อมขาย"
            openProductId={jumpToProductId}
            onOpenedProduct={() => setJumpToProductId(null)}
          />
        )}

        {tab === 'stock-sold' && <ProductList key={refreshKey} status="ขายแล้ว" />}

        {tab === 'report' && <ReportSection onSelectProduct={handleSelectProductFromReport} />}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-2xl lg:max-w-5xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                tab === t.key ? 'text-teal' : 'text-ink/45'
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.shortLabel}
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}
