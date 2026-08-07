'use client'

import { useState } from 'react'
import type { Product } from '@/lib/types'
import { formatPrice, type MonthOption } from '@/lib/utils'

type Props = {
  rows: Product[]
  months: MonthOption[] // newest-first, as produced by buildLastMonths
  titleSuffix?: string
}

const SALE_COLOR = '#0D9488' // ยอดขาย
const PROFIT_COLOR = '#E8A33D' // กำไรสุทธิ — เฉดเดียวกับ amber ที่ใช้กับราคาทั่วแอป

const W = 340
const H = 240
const MARGIN = { left: 46, right: 10, top: 22, bottom: 26 }
const PLOT_W = W - MARGIN.left - MARGIN.right
const PLOT_H = H - MARGIN.top - MARGIN.bottom
const BAR_W = 16
const BAR_GAP = 26
const BAR_RADIUS = 4

function niceNumber(range: number, round: boolean): number {
  if (range <= 0) return 1
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / 10 ** exponent
  let niceFraction: number
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * 10 ** exponent
}

function formatCompact(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
  }
  return `${sign}${abs.toLocaleString('th-TH')}`
}

/** วาดแท่งปลายมน 4px ด้านที่เป็นค่าจริง (บน = ค่าบวก, ล่าง = ค่าลบ) มุมชนเส้นฐาน (0) เป็นเหลี่ยม */
function barPath(x: number, y: number, w: number, h: number, roundTop: boolean): string {
  if (h <= 0.5) return ''
  const r = Math.min(BAR_RADIUS, w / 2, h)
  if (roundTop) {
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
  }
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} Z`
}

type Hovered = { idx: number; series: 'sale' | 'profit' }

export default function SalesComparisonChart({ rows, months, titleSuffix }: Props) {
  const [hovered, setHovered] = useState<Hovered | null>(null)

  const chartMonths = [...months].reverse() // เรียงเก่า→ใหม่ อ่านซ้ายไปขวาเหมือนไทม์ไลน์
  const data = chartMonths.map((m) => {
    const inMonth = rows.filter((p) => {
      if (!p.sold_at) return false
      const d = new Date(p.sold_at)
      return d >= m.start && d < m.end
    })
    return {
      key: m.key,
      fullLabel: m.label,
      shortLabel: m.start.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      sale: inMonth.reduce((sum, p) => sum + (p.sale_price ?? 0), 0),
      profit: inMonth.reduce((sum, p) => sum + (p.net_profit ?? 0), 0),
    }
  })

  const allValues = data.flatMap((d) => [d.sale, d.profit])
  const rawMax = Math.max(0, ...allValues)
  const rawMin = Math.min(0, ...allValues)
  const step = niceNumber((rawMax - rawMin || 1) / 4, true)
  const niceMin = rawMin < 0 ? Math.floor(rawMin / step) * step : 0
  const niceMax = rawMax > 0 ? Math.ceil(rawMax / step) * step : step
  const domain = niceMax - niceMin || 1

  const yScale = (v: number) => MARGIN.top + PLOT_H * (1 - (v - niceMin) / domain)
  const baselineY = yScale(0)

  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Math.round(v))
  }

  const groupW = PLOT_W / data.length
  const pairW = BAR_W * 2 + BAR_GAP

  const hasAnyData = allValues.some((v) => v !== 0)

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="font-display text-sm font-semibold text-ink">
          ยอดขายเทียบกำไรสุทธิ 3 เดือนล่าสุด{titleSuffix ? ` — ${titleSuffix}` : ''}
        </p>
        <p className="font-mono text-[10px] text-ink/40">หน่วย: บาท</p>
      </div>

      {!hasAnyData ? (
        <p className="py-8 text-center font-mono text-sm text-ink/50">ยังไม่มีข้อมูลการขายในช่วง 3 เดือนนี้</p>
      ) : (
        <>
          <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible">
              {ticks.map((t) => {
                const y = yScale(t)
                return (
                  <g key={t}>
                    <line
                      x1={MARGIN.left}
                      x2={W - MARGIN.right}
                      y1={y}
                      y2={y}
                      stroke="#e1e0d9"
                      strokeWidth={1}
                    />
                    <text x={MARGIN.left - 6} y={y} textAnchor="end" dominantBaseline="middle" className="font-mono" fontSize={8} fill="#898781">
                      {formatCompact(t)}
                    </text>
                  </g>
                )
              })}

              {data.map((d, idx) => {
                const groupCenterX = MARGIN.left + groupW * idx + groupW / 2
                const saleX = groupCenterX - pairW / 2
                const profitX = saleX + BAR_W + BAR_GAP

                const saleTop = yScale(Math.max(d.sale, 0))
                const saleBottom = yScale(Math.min(d.sale, 0))
                const profitTop = yScale(Math.max(d.profit, 0))
                const profitBottom = yScale(Math.min(d.profit, 0))

                const saleHovered = hovered?.idx === idx && hovered.series === 'sale'
                const profitHovered = hovered?.idx === idx && hovered.series === 'profit'

                return (
                  <g key={d.key}>
                    <path
                      d={barPath(saleX, saleTop, BAR_W, saleBottom - saleTop, d.sale >= 0)}
                      fill={SALE_COLOR}
                      style={{ filter: saleHovered ? 'brightness(1.12)' : undefined, cursor: 'pointer' }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${d.fullLabel} ยอดขาย ${formatPrice(d.sale)}`}
                      onMouseEnter={() => setHovered({ idx, series: 'sale' })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ idx, series: 'sale' })}
                      onBlur={() => setHovered(null)}
                    />
                    {Math.abs(d.sale) > 0.5 && (
                      <text
                        x={saleX + BAR_W / 2}
                        y={(d.sale >= 0 ? saleTop : saleBottom) + (d.sale >= 0 ? -4 : 12)}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize={8}
                        fill="#52514e"
                      >
                        {formatCompact(d.sale)}
                      </text>
                    )}

                    <path
                      d={barPath(profitX, profitTop, BAR_W, profitBottom - profitTop, d.profit >= 0)}
                      fill={PROFIT_COLOR}
                      style={{ filter: profitHovered ? 'brightness(1.12)' : undefined, cursor: 'pointer' }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${d.fullLabel} กำไรสุทธิ(ก่อนแบ่งปันผล) ${formatPrice(d.profit)}`}
                      onMouseEnter={() => setHovered({ idx, series: 'profit' })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ idx, series: 'profit' })}
                      onBlur={() => setHovered(null)}
                    />
                    {Math.abs(d.profit) > 0.5 && (
                      <text
                        x={profitX + BAR_W / 2}
                        y={(d.profit >= 0 ? profitTop : profitBottom) + (d.profit >= 0 ? -4 : 12)}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize={8}
                        fill="#52514e"
                      >
                        {formatCompact(d.profit)}
                      </text>
                    )}

                    <text
                      x={groupCenterX}
                      y={H - MARGIN.bottom + 14}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize={9}
                      fill="#52514e"
                    >
                      {d.shortLabel}
                    </text>
                  </g>
                )
              })}

              <line
                x1={MARGIN.left}
                x2={W - MARGIN.right}
                y1={baselineY}
                y2={baselineY}
                stroke="#c3c2b7"
                strokeWidth={1}
              />
            </svg>

            {hovered &&
              (() => {
                const d = data[hovered.idx]
                const isSale = hovered.series === 'sale'
                const value = isSale ? d.sale : d.profit
                const groupCenterX = MARGIN.left + groupW * hovered.idx + groupW / 2
                const barX = isSale ? groupCenterX - pairW / 2 : groupCenterX - pairW / 2 + BAR_W + BAR_GAP
                const topY = yScale(Math.max(value, 0))
                const leftPct = Math.min(85, Math.max(15, ((barX + BAR_W / 2) / W) * 100))
                const topPct = Math.max(4, (topY / H) * 100)
                return (
                  <div
                    className="pointer-events-none absolute z-10 w-28 -translate-x-1/2 -translate-y-full rounded-tag border border-line bg-ink px-2 py-1 text-center shadow-tag"
                    style={{ left: `${leftPct}%`, top: `${topPct}%`, marginTop: -6 }}
                  >
                    <p className="font-mono text-[10px] text-white/70">{d.fullLabel}</p>
                    <p className="font-mono text-xs font-semibold text-white">
                      {isSale ? 'ยอดขาย' : 'กำไรสุทธิ(ก่อนแบ่งปันผล)'} {formatPrice(value)}
                    </p>
                  </div>
                )
              })()}
          </div>

          <div className="mt-2 flex justify-center gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink/70">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SALE_COLOR }} />
              ยอดขาย
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink/70">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PROFIT_COLOR }} />
              กำไรสุทธิ(ก่อนแบ่งปันผล)
            </span>
          </div>
        </>
      )}
    </div>
  )
}
