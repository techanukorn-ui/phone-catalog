'use client'

import { useState } from 'react'
import ReportView from './ReportView'
import DividendReport from './DividendReport'
import OwnerReport from './OwnerReport'
import StagnantStockReport from './StagnantStockReport'
import SoldCleanupReport from './SoldCleanupReport'
import PurchaseEvidenceReport from './PurchaseEvidenceReport'
import BankReconcileReport from './BankReconcileReport'

type ReportTab = 'sales' | 'dividend' | 'owner' | 'stagnant' | 'purchase-evidence' | 'bank-reconcile' | 'cleanup'

const REPORT_TABS: { key: ReportTab; label: string; danger?: boolean }[] = [
  { key: 'sales', label: 'รายงานการขาย' },
  { key: 'dividend', label: 'รายงานปันผล' },
  { key: 'owner', label: 'สต็อกคงเหลือตามเจ้าของทุน' },
  { key: 'stagnant', label: 'รายงานสินค้าค้างสต็อกเกิน 15 วัน' },
  { key: 'purchase-evidence', label: 'หลักฐานการซื้อเครื่อง' },
  { key: 'bank-reconcile', label: 'หลักฐานการซื้อขายธนาคาร TTB' },
  { key: 'cleanup', label: 'ลบรูปสินค้าที่ขายแล้วเกิน 3 เดือน', danger: true },
]

export default function ReportSection({ onSelectProduct }: { onSelectProduct: (id: string) => void }) {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-3">
      <div className="pill-row print:hidden">
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
      {tab === 'dividend' && <DividendReport />}
      {tab === 'owner' && <OwnerReport onSelectProduct={onSelectProduct} />}
      {tab === 'stagnant' && <StagnantStockReport />}
      {tab === 'purchase-evidence' && <PurchaseEvidenceReport />}
      {tab === 'bank-reconcile' && <BankReconcileReport />}
      {tab === 'cleanup' && <SoldCleanupReport />}
    </div>
  )
}
