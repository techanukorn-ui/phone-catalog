'use client'

import { useState } from 'react'
import ReportView from './ReportView'
import DividendReport from './DividendReport'
import OwnerReport from './OwnerReport'
import StagnantStockReport from './StagnantStockReport'
import BankReconcileReport from './BankReconcileReport'

type ReportTab = 'sales' | 'dividend' | 'owner' | 'stagnant' | 'bank-reconcile'

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales', label: 'รายงานการขาย' },
  { key: 'dividend', label: 'รายงานปันผล' },
  { key: 'owner', label: 'สต็อกคงเหลือตามเจ้าของทุน' },
  { key: 'stagnant', label: 'รายงานสินค้าค้างสต็อกเกิน 15 วัน' },
  { key: 'bank-reconcile', label: 'หลักฐานการซื้อขายธนาคาร TTB' },
]

export default function ReportSection({ onSelectProduct }: { onSelectProduct: (id: string) => void }) {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-3">
      <div className="pill-row print:hidden">
        {REPORT_TABS.map((t) => {
          const active = tab === t.key
          const colorClass = active
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
      {tab === 'dividend' && <DividendReport />}
      {tab === 'owner' && <OwnerReport onSelectProduct={onSelectProduct} />}
      {tab === 'stagnant' && <StagnantStockReport />}
      {tab === 'bank-reconcile' && <BankReconcileReport />}
    </div>
  )
}
