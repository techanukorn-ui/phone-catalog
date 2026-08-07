'use client'

import { useState } from 'react'
import ReportView from './ReportView'
import StagnantStockReport from './StagnantStockReport'

type ReportTab = 'sales' | 'stagnant'

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales', label: 'รายงานการขาย' },
  { key: 'stagnant', label: 'รายงานสินค้าค้างสต็อกเกิน 15 วัน' },
]

export default function ReportSection() {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto [touch-action:pan-x]">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide ${
              tab === t.key
                ? 'border-amber-dark bg-amber-dark text-white'
                : 'border-amber-dark bg-panel text-amber-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && <ReportView />}
      {tab === 'stagnant' && <StagnantStockReport />}
    </div>
  )
}
