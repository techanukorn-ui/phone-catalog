'use client'

import { useState } from 'react'
import ReportView from './ReportView'
import OwnerReport from './OwnerReport'
import StagnantStockReport from './StagnantStockReport'
import SoldCleanupReport from './SoldCleanupReport'

type ReportTab = 'sales' | 'owner' | 'stagnant' | 'cleanup'

const REPORT_TABS: { key: ReportTab; label: string; danger?: boolean }[] = [
  { key: 'sales', label: 'รายงานการขาย' },
  { key: 'owner', label: 'รายงานเจ้าของทุน' },
  { key: 'stagnant', label: 'รายงานสินค้าค้างสต็อกเกิน 15 วัน' },
  { key: 'cleanup', label: 'ลบสินค้าที่ขายแล้วเกิน 3 เดือน', danger: true },
]

export default function ReportSection() {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto [touch-action:pan-x]">
        {REPORT_TABS.map((t) => {
          const active = tab === t.key
          const colorClass = t.danger
            ? active
              ? 'border-danger bg-danger text-white'
              : 'border-danger bg-panel text-danger'
            : active
              ? 'border-amber-dark bg-amber-dark text-white'
              : 'border-amber-dark bg-panel text-amber-dark'
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide ${colorClass}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'sales' && <ReportView />}
      {tab === 'owner' && <OwnerReport />}
      {tab === 'stagnant' && <StagnantStockReport />}
      {tab === 'cleanup' && <SoldCleanupReport />}
    </div>
  )
}
