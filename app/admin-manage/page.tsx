'use client'

import { useState } from 'react'
import StoreSettingsForm from '@/components/admin/StoreSettingsForm'
import ProductForm from '@/components/admin/ProductForm'
import ProductList from '@/components/admin/ProductList'

type Tab = 'settings' | 'add' | 'stock'

const TABS: { key: Tab; label: string }[] = [
  { key: 'stock', label: 'สต็อกสินค้า' },
  { key: 'add', label: 'เพิ่มสินค้า' },
  { key: 'settings', label: 'ข้อมูลร้านค้า' },
]

export default function AdminManagePage() {
  const [tab, setTab] = useState<Tab>('stock')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <main className="min-h-screen bg-paper pb-16">
      <header className="sticky top-0 z-30 border-b border-line bg-ink">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <p className="font-display text-lg font-semibold text-white">แผงควบคุมร้านค้า</p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-white/50">
            หน้านี้เข้าถึงได้ผ่านลิงก์ตรงเท่านั้น — อย่าเผยแพร่ลิงก์นี้
          </p>
        </div>
      </header>

      <div className="sticky top-[60px] z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-2.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide ${
                tab === t.key ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70'
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

        {tab === 'stock' && <ProductList key={refreshKey} />}
      </div>
    </main>
  )
}
