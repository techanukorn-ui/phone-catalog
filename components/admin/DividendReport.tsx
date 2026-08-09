'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { buildLastMonths, formatPrice, toDateInputStr } from '@/lib/utils'

type Person = 'โบ๊ท' | 'วอลเล่' | 'โบว์' | 'น้าเหน่ง' | 'เมจิ'
type PersonFilter = 'ทั้งหมด' | Person

const PERSONS: Person[] = ['โบ๊ท', 'วอลเล่', 'โบว์', 'น้าเหน่ง', 'เมจิ']

// แมปชื่อคนไปยังคอลัมน์ปันผลในตาราง products
const DIVIDEND_FIELD: Record<Person, 'dividend_boat' | 'dividend_wallet' | 'dividend_bow' | 'dividend_neng' | 'dividend_magic'> = {
  โบ๊ท: 'dividend_boat',
  วอลเล่: 'dividend_wallet',
  โบว์: 'dividend_bow',
  น้าเหน่ง: 'dividend_neng',
  เมจิ: 'dividend_magic',
}

type Row = {
  sold_at: string | null
  dividend_boat: number | null
  dividend_wallet: number | null
  dividend_bow: number | null
  dividend_neng: number | null
  dividend_magic: number | null
}

export default function DividendReport() {
  const months = useMemo(() => buildLastMonths(12), [])
  const [selectedKey, setSelectedKey] = useState(months[0].key)
  const [activePerson, setActivePerson] = useState<PersonFilter>('ทั้งหมด')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const oldestStart = months[months.length - 1].start

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('sold_at, dividend_boat, dividend_wallet, dividend_bow, dividend_neng, dividend_magic')
        .eq('status', 'ขายแล้ว')
        .gte('sold_at', toDateInputStr(oldestStart))
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Row[]) ?? [])
      }
      setLoading(false)
    }
    load()
    // oldestStart is derived from `months`, which is stable via useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedMonth = months.find((m) => m.key === selectedKey)!
  const monthRows = rows.filter((p) => {
    if (!p.sold_at) return false
    const d = new Date(p.sold_at)
    return d >= selectedMonth.start && d < selectedMonth.end
  })

  const totalsByPerson = PERSONS.reduce(
    (acc, person) => {
      const field = DIVIDEND_FIELD[person]
      acc[person] = monthRows.reduce((sum, p) => sum + (p[field] ?? 0), 0)
      return acc
    },
    {} as Record<Person, number>
  )
  const grandTotal = PERSONS.reduce((sum, person) => sum + totalsByPerson[person], 0)

  return (
    <div className="space-y-3">
      <div className="pill-row">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedKey(m.key)}
            className={`shrink-0 rounded-tag border px-3 py-2 font-mono text-xs ${
              selectedKey === m.key ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="pill-row justify-center">
        {(['ทั้งหมด', ...PERSONS] as PersonFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setActivePerson(p)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activePerson === p
                ? 'border-teal bg-teal text-white'
                : 'border-line bg-panel text-ink/70 active:bg-line/40'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายงาน…</p>}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {activePerson === 'ทั้งหมด' ? (
            <>
              {PERSONS.map((person) => (
                <div
                  key={person}
                  className="flex items-center justify-between rounded-card border border-line bg-panel p-3"
                >
                  <p className="font-display text-sm font-semibold text-ink">{person}</p>
                  <p className="font-mono text-sm font-semibold text-teal-dark">
                    {formatPrice(totalsByPerson[person])}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-card border border-teal bg-teal/10 p-3">
                <p className="font-display text-sm font-semibold text-ink">รวมทั้งหมด</p>
                <p className="font-mono text-sm font-semibold text-teal-dark">{formatPrice(grandTotal)}</p>
              </div>
            </>
          ) : (
            <div className="rounded-card border border-teal bg-teal/10 p-4 text-center">
              <p className="font-display text-sm font-semibold text-ink">
                ปันผล{activePerson} — {selectedMonth.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-teal-dark">
                {formatPrice(totalsByPerson[activePerson])}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
