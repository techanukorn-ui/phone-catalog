'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import LoginForm from '@/components/admin/LoginForm'

const ACCOUNTING_OWNERS = ['วอลเล่', 'โบ๊ท', 'โบว์'] as const
type AccountingOwner = (typeof ACCOUNTING_OWNERS)[number]

const DOC_TYPES = ['ใบสำคัญรับเงิน', 'ใบเสร็จรับเงิน'] as const
type DocType = (typeof DOC_TYPES)[number]

const PAYMENT_METHODS = ['TTB', 'เงินสด', 'อื่นๆ'] as const
type DocPaymentMethod = (typeof PAYMENT_METHODS)[number]

export default function AccountingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeOwner, setActiveOwner] = useState<AccountingOwner>(ACCOUNTING_OWNERS[0])
  const [activeDoc, setActiveDoc] = useState<DocType>(DOC_TYPES[0])
  const [activeMethod, setActiveMethod] = useState<DocPaymentMethod>(PAYMENT_METHODS[0])

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
    <main className="min-h-screen bg-paper pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-ink">
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <div>
            <p className="font-display text-lg font-semibold text-white">บัญชี / ภาษี</p>
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

      <div className="px-6 py-4">
        <div className="pill-row justify-center">
          {ACCOUNTING_OWNERS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setActiveOwner(o)}
              className={`shrink-0 rounded-tag border px-3 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
                activeOwner === o ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="flex gap-2 overflow-x-auto sm:w-44 sm:shrink-0 sm:flex-col sm:overflow-visible">
            {DOC_TYPES.map((d) => (
              <div key={d} className="contents sm:block">
                <button
                  type="button"
                  onClick={() => setActiveDoc(d)}
                  className={`shrink-0 rounded-tag border px-3 py-2 text-left font-mono text-xs uppercase tracking-wide transition-colors ${
                    activeDoc === d ? 'border-amber-dark bg-amber-dark text-white' : 'border-line bg-panel text-ink/70'
                  }`}
                >
                  {d}
                </button>

                {d === activeDoc && (
                  <div className="flex gap-2 sm:mt-2 sm:flex-col sm:pl-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setActiveMethod(m)}
                        className={`shrink-0 rounded-tag border px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-wide transition-colors ${
                          activeMethod === m ? 'border-teal bg-teal text-white' : 'border-line bg-paper text-ink/60'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <p className="py-8 text-center font-mono text-sm text-ink/50">
              {activeDoc} — {activeMethod} — {activeOwner} — ยังไม่มีเนื้อหาในหน้านี้
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
