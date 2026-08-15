'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import LoginForm from '@/components/admin/LoginForm'
import OwnerProfileForm from '@/components/admin/OwnerProfileForm'
import ReceiptVoucherTTB from '@/components/admin/ReceiptVoucherTTB'
import ReceiptSaleTTB from '@/components/admin/ReceiptSaleTTB'
import PaymentVoucherDividend from '@/components/admin/PaymentVoucherDividend'
import CashLedgerReport from '@/components/admin/CashLedgerReport'

const ACCOUNTING_OWNERS = ['วอลเล่', 'โบ๊ท', 'โบว์'] as const
type AccountingOwner = (typeof ACCOUNTING_OWNERS)[number]

const DOC_TYPES = ['ใบสำคัญรับเงิน', 'ใบเสร็จรับเงิน'] as const
type DocType = (typeof DOC_TYPES)[number]

const PERSONAL_INFO = 'ข้อมูลส่วนตัว' as const
// ใบสำคัญจ่ายเมจิ/โบว์ กับ รายงานเงินสดรับ-จ่าย ไม่มี method submenu (TTB) เหมือน DOC_TYPES แต่ยังคงต้องแยกตาม
// activeOwner เสมอ (มาตรฐานหน้านี้ — บัญชี/ภาษีของใครของมัน) เลยขึ้นเป็นหัวข้อทั่วไปแทนที่จะซ้อนใต้ "เอกสาร"
const PAYMENT_VOUCHER_MAGIC = 'ใบสำคัญจ่าย (เมจิ)' as const
// จ่ายปันผลให้โบว์ จากยอดขายเครื่องที่ owner=วอลเล่ เท่านั้น (ข้อตกลงเฉพาะวอลเล่-โบว์ ไม่ใช่ทุกเจ้าของทุน)
const PAYMENT_VOUCHER_DIVIDEND_BOW = 'ใบสำคัญจ่าย (โบว์)' as const
const CASH_LEDGER = 'รายงานเงินสดรับ-จ่าย' as const

const SECTIONS = [PERSONAL_INFO, PAYMENT_VOUCHER_MAGIC, PAYMENT_VOUCHER_DIVIDEND_BOW, CASH_LEDGER, ...DOC_TYPES] as const
type Section = (typeof SECTIONS)[number]

// หัวข้อที่ไม่มี method submenu (TTB) — แสดงแค่ owner/section ในหัวเรื่อง ไม่มี "· TTB" ต่อท้าย
const NO_METHOD_SECTIONS: Section[] = [PERSONAL_INFO, PAYMENT_VOUCHER_MAGIC, PAYMENT_VOUCHER_DIVIDEND_BOW, CASH_LEDGER]

const PAYMENT_METHODS = ['TTB'] as const
type DocPaymentMethod = (typeof PAYMENT_METHODS)[number]

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 15.5h6M9 9.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AccountingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeOwner, setActiveOwner] = useState<AccountingOwner>(ACCOUNTING_OWNERS[0])
  const [activeSection, setActiveSection] = useState<Section>(PERSONAL_INFO)
  const [expandedDocs, setExpandedDocs] = useState<DocType[]>([])
  const [activeMethod, setActiveMethod] = useState<DocPaymentMethod>(PAYMENT_METHODS[0])

  function toggleDoc(d: DocType) {
    // กดหัวข้อใหญ่ = แค่กาง/ยุบหัวข้อย่อยเท่านั้น ไม่เปลี่ยนหน้าที่กำลังดูอยู่
    // ต้องกดเลือกหัวข้อย่อย (เช่น TTB) เองถึงจะเปลี่ยนหน้า
    if (expandedDocs.includes(d)) {
      // ยุบเฉพาะหัวข้อที่กด ไม่ไปยุ่งกับหัวข้อใหญ่อื่นที่เปิดค้างอยู่
      setExpandedDocs((prev) => prev.filter((x) => x !== d))
    } else {
      setExpandedDocs((prev) => [...prev, d])
    }
  }

  function selectMethod(d: DocType, m: DocPaymentMethod) {
    setActiveSection(d)
    setActiveMethod(m)
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
    <div className="flex min-h-screen bg-[#F3F4F8] text-[#1B1E2B]">
      <aside className="flex w-64 shrink-0 flex-col bg-[#12152A] print:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#3B5BFF] text-sm font-semibold text-white">
            ฿
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">บัญชี / ภาษี</p>
            <p className="truncate text-[11px] text-slate-400">Marcuz Mobile</p>
          </div>
        </div>

        <div className="px-5 pb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">เจ้าของทุน</p>
          <div className="flex gap-1.5">
            {ACCOUNTING_OWNERS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setActiveOwner(o)
                  // ใบสำคัญจ่ายโบว์ มีแค่แท็บวอลเล่ — สลับแท็บออกไปแล้วต้องเด้งกลับหน้าอื่นไม่งั้นจะค้างอยู่หน้าที่เลือกไม่ได้
                  if (o !== 'วอลเล่' && activeSection === PAYMENT_VOUCHER_DIVIDEND_BOW) {
                    setActiveSection(PERSONAL_INFO)
                  }
                }}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  activeOwner === o
                    ? 'bg-[#3B5BFF] text-white'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-5 mb-2 h-px bg-white/10" />

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">ทั่วไป</p>
          <button
            type="button"
            onClick={() => setActiveSection(PERSONAL_INFO)}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors ${
              activeSection === PERSONAL_INFO
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <span className={activeSection === PERSONAL_INFO ? 'text-[#7C93FF]' : 'text-slate-500'}>
              <ProfileIcon />
            </span>
            <span className="flex-1 truncate">{PERSONAL_INFO}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection(PAYMENT_VOUCHER_MAGIC)}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors ${
              activeSection === PAYMENT_VOUCHER_MAGIC
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <span className={activeSection === PAYMENT_VOUCHER_MAGIC ? 'text-[#7C93FF]' : 'text-slate-500'}>
              <DocIcon />
            </span>
            <span className="flex-1 truncate">{PAYMENT_VOUCHER_MAGIC}</span>
          </button>

          {activeOwner === 'วอลเล่' && (
            <button
              type="button"
              onClick={() => setActiveSection(PAYMENT_VOUCHER_DIVIDEND_BOW)}
              className={`mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors ${
                activeSection === PAYMENT_VOUCHER_DIVIDEND_BOW
                  ? 'bg-white/[0.08] text-white'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <span className={activeSection === PAYMENT_VOUCHER_DIVIDEND_BOW ? 'text-[#7C93FF]' : 'text-slate-500'}>
                <DocIcon />
              </span>
              <span className="flex-1 truncate">{PAYMENT_VOUCHER_DIVIDEND_BOW}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSection(CASH_LEDGER)}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors ${
              activeSection === CASH_LEDGER
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <span className={activeSection === CASH_LEDGER ? 'text-[#7C93FF]' : 'text-slate-500'}>
              <DocIcon />
            </span>
            <span className="flex-1 truncate">{CASH_LEDGER}</span>
          </button>

          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">เอกสาร</p>
          {DOC_TYPES.map((d) => {
            const isSelected = activeSection === d
            const isOpen = expandedDocs.includes(d)
            return (
              <div key={d} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleDoc(d)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    isSelected ? 'bg-white/[0.08] text-white' : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span className={isSelected ? 'text-[#7C93FF]' : 'text-slate-500'}>
                    <DocIcon />
                  </span>
                  <span className="flex-1 truncate">{d}</span>
                  <ChevronIcon open={isOpen} />
                </button>

                {isOpen && (
                  <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectMethod(d, m)}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                          activeSection === d && activeMethod === m
                            ? 'bg-[#3B5BFF]/15 font-medium text-[#7C93FF]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            activeSection === d && activeMethod === m ? 'bg-[#7C93FF]' : 'bg-slate-600'
                          }`}
                        />
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="px-2 pb-2 text-[10px] leading-relaxed text-slate-500">
            หน้านี้เข้าถึงได้ผ่านลิงก์ตรงเท่านั้น — อย่าเผยแพร่ลิงก์นี้
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06]"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#E4E6EF] bg-white px-8 py-5 print:hidden">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] text-[#8A8FA3]">
              <span>{activeOwner}</span>
              <span>/</span>
              {NO_METHOD_SECTIONS.includes(activeSection) ? (
                <span className="font-medium text-[#3B5BFF]">{activeSection}</span>
              ) : (
                <>
                  <span>{activeSection}</span>
                  <span>/</span>
                  <span className="font-medium text-[#3B5BFF]">{activeMethod}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-xl font-semibold text-[#1B1E2B]">
              {NO_METHOD_SECTIONS.includes(activeSection) ? activeSection : `${activeSection} · ${activeMethod}`}
            </h1>
          </div>
          <span className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-[11px] font-medium text-[#3B5BFF]">
            {activeOwner}
          </span>
        </header>

        <main className="flex-1 px-8 py-8 print:px-0 print:py-0">
          {activeSection === PERSONAL_INFO ? (
            <OwnerProfileForm owner={activeOwner} />
          ) : activeSection === PAYMENT_VOUCHER_MAGIC ? (
            <PaymentVoucherDividend
              owner={activeOwner}
              payee="เมจิ"
              dividendField="dividend_magic"
              payeeFullNameFallback="ลักษมณ ลิขิตพรวงศ์"
            />
          ) : activeSection === PAYMENT_VOUCHER_DIVIDEND_BOW ? (
            <PaymentVoucherDividend owner={activeOwner} payee="โบว์" dividendField="dividend_bow" />
          ) : activeSection === CASH_LEDGER ? (
            <CashLedgerReport owner={activeOwner} />
          ) : activeSection === 'ใบสำคัญรับเงิน' && activeMethod === 'TTB' ? (
            <ReceiptVoucherTTB owner={activeOwner} />
          ) : activeSection === 'ใบเสร็จรับเงิน' && activeMethod === 'TTB' ? (
            <ReceiptSaleTTB owner={activeOwner} />
          ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-[#E4E6EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.08)]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF1FF] text-[#3B5BFF]">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                <path
                  d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 12.5h6M9 15.5h6M9 9.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#1B1E2B]">ยังไม่มีข้อมูลในหมวดนี้</p>
            <p className="mt-1 text-[13px] text-[#8A8FA3]">
              {activeSection} — {activeMethod} — เจ้าของทุน {activeOwner}
            </p>
          </div>
          )}
        </main>
      </div>
    </div>
  )
}
