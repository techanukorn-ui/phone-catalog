'use client'

import { useState } from 'react'
import ReportView from './ReportView'

type ReportTab = 'sales'

const REPORT_TABS: { key: ReportTab; label: string }[] = [{ key: 'sales', label: 'รายงานการขาย' }]

export default function ReportSection() {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide ${
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
    </div>
  )
}
