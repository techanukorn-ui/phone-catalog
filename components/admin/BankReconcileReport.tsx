'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { OWNERS } from '@/lib/types'
import type { Product, ProductOwner } from '@/lib/types'
import { formatPrice, toDateInputStr } from '@/lib/utils'

const BANK = 'TTB' as const

type OwnerFilter = 'ทั้งหมด' | ProductOwner
type StatusFilter = 'ทั้งหมด' | 'ปิดยอดแล้ว'

type Leg = {
  date: string
  amount: number
  slipUrl: string | null
}

type ReconcileRow = {
  key: string
  product: Product
  anchorDate: string
  buy: Leg | null // ซื้อผ่าน TTB
  sold: boolean // ขายไปแล้วหรือยัง (ไม่ว่าจะผ่าน TTB หรือไม่)
  sell: Leg | null // ขายผ่าน TTB (มีค่าเฉพาะตอนขายแล้วและขายผ่าน TTB)
}

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return toDateInputStr(d)
}

export default function BankReconcileReport() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(toDateInputStr(new Date()))
  const [activeOwner, setActiveOwner] = useState<OwnerFilter>('ทั้งหมด')
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('ทั้งหมด')
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [savingPdf, setSavingPdf] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .or(`purchase_bank.eq.${BANK},sale_bank.eq.${BANK}`)
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows((data as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const reconcileRows = useMemo(() => {
    const ownerRows = activeOwner === 'ทั้งหมด' ? rows : rows.filter((p) => p.owner === activeOwner)
    const built: ReconcileRow[] = []

    for (const p of ownerRows) {
      const buyIsTTB = p.purchase_payment_method === 'โอน' && p.purchase_bank === BANK
      const sellIsTTB = p.sale_payment_method === 'โอน' && p.sale_bank === BANK
      if (!buyIsTTB && !sellIsTTB) continue

      const anchorDate = buyIsTTB ? p.purchase_date : p.sold_at
      if (!anchorDate || anchorDate < from || anchorDate > to) continue

      built.push({
        key: p.id,
        product: p,
        anchorDate,
        buy: buyIsTTB ? { date: p.purchase_date!, amount: p.cost_device ?? 0, slipUrl: p.purchase_slip_url } : null,
        sold: p.status === 'ขายแล้ว',
        sell:
          p.status === 'ขายแล้ว' && sellIsTTB
            ? { date: p.sold_at!, amount: p.sale_price ?? 0, slipUrl: p.sale_slip_url }
            : null,
      })
    }

    built.sort((a, b) => (a.anchorDate < b.anchorDate ? -1 : a.anchorDate > b.anchorDate ? 1 : 0))
    return built
  }, [rows, from, to, activeOwner])

  const displayRows =
    activeStatus === 'ปิดยอดแล้ว' ? reconcileRows.filter((r) => r.buy && r.sell) : reconcileRows

  const totalOut = displayRows.reduce((sum, r) => sum + (r.buy?.amount ?? 0), 0)
  const totalIn = displayRows.reduce((sum, r) => sum + (r.sell?.amount ?? 0), 0)
  const net = totalIn - totalOut

  async function handleSavePdf() {
    const el = printRef.current
    if (!el) return
    setSavingPdf(true)
    setError(null)
    const prevDisplay = el.style.display
    try {
      // การ์ดนี้ปกติซ่อนไว้ (แสดงเฉพาะตอนพิมพ์) — เปิดให้แสดงชั่วคราวเพื่อถ่ายภาพ แล้วซ่อนกลับหลังเสร็จ
      el.style.display = 'block'
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const captureScale = 2
      // บังคับความกว้างตอนถ่ายภาพให้คงที่ (ไม่ผูกกับความกว้างจอจริงของอุปกรณ์ที่กดเซฟ)
      // เพราะบนมือถือความกว้างจอแคบกว่าเดสก์ท็อปมาก ถ่ายตามจอจริงแล้วภาพจะเล็กจิ๋วอยู่มุมกระดาษ
      // ทำผ่าน onclone (แก้ที่สำเนาที่ html2canvas สร้างไว้ถ่ายภาพโดยเฉพาะ) เพื่อไม่ให้โดน max-width ของ container แม่บีบกลับ
      const PRINT_WIDTH = 720
      const canvas = await html2canvas(el, {
        scale: captureScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: PRINT_WIDTH + 200,
        onclone: (_doc, clonedEl) => {
          clonedEl.style.width = `${PRINT_WIDTH}px`
          clonedEl.style.maxWidth = `${PRINT_WIDTH}px`
        },
      })
      const imgData = canvas.toDataURL('image/png')
      if (new URLSearchParams(window.location.search).has('pdfdebug')) {
        const debugImg = document.createElement('img')
        debugImg.src = imgData
        debugImg.style.cssText =
          'position:fixed;top:0;left:0;z-index:9999;border:4px solid red;max-width:100vw;background:#fff'
        document.body.appendChild(debugImg)
      }
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24

      // แปลงขนาดภาพจาก px จริงเป็น pt ตามสัดส่วนเดิม (ไม่ยืดเต็มความกว้างหน้ากระดาษ)
      // แล้วค่อยย่อลงถ้ากว้างเกินพื้นที่พิมพ์ ป้องกันเนื้อหาน้อยแล้วโดนขยายจนดูเป็นแถบว่างเปล่า
      let imgWidth = (canvas.width / captureScale) * 0.75
      let imgHeight = (canvas.height / captureScale) * 0.75
      const maxWidth = pageWidth - margin * 2
      if (imgWidth > maxWidth) {
        const ratio = maxWidth / imgWidth
        imgWidth = maxWidth
        imgHeight *= ratio
      }

      const availableHeight = pageHeight - margin * 2
      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
      } else {
        let heightLeft = imgHeight
        let offset = 0
        pdf.addImage(imgData, 'PNG', margin, margin - offset, imgWidth, imgHeight)
        heightLeft -= availableHeight
        while (heightLeft > 0) {
          offset += availableHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', margin, margin - offset, imgWidth, imgHeight)
          heightLeft -= availableHeight
        }
      }

      pdf.save(`หลักฐานการซื้อขาย-TTB-${from}-ถึง-${to}.pdf`)
    } catch (err: any) {
      setError('บันทึก PDF ไม่สำเร็จ ลองใช้ปุ่มพิมพ์แล้วเลือก "บันทึกเป็น PDF" แทนได้')
    } finally {
      el.style.display = prevDisplay
      setSavingPdf(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ตั้งแต่วันที่</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ถึงวันที่</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
      </div>

      <div className="pill-row print:hidden">
        {(['ทั้งหมด', ...OWNERS] as OwnerFilter[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setActiveOwner(o)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activeOwner === o
                ? 'border-amber-dark bg-amber-dark text-white'
                : 'border-amber-dark bg-panel text-amber-dark'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="pill-row print:hidden">
        {(['ทั้งหมด', 'ปิดยอดแล้ว'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setActiveStatus(s)}
            className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              activeStatus === s
                ? 'border-teal-dark bg-teal-dark text-white'
                : 'border-teal-dark bg-panel text-teal-dark'
            }`}
          >
            {s === 'ปิดยอดแล้ว' ? 'ปิดยอดแล้ว (ซื้อ-ขายผ่าน TTB ครบ)' : s}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center font-mono text-sm text-ink/50 print:hidden">กำลังโหลดรายงาน…</p>}

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger print:hidden">{error}</p>}

      {!loading && !error && (
        <div className="hidden print:block">
          <h1 className="font-display text-lg font-semibold text-ink">
            หลักฐานการซื้อขาย
            {activeOwner !== 'ทั้งหมด' && ` — เจ้าของทุน ${activeOwner}`}
            {activeStatus === 'ปิดยอดแล้ว' && ' — เฉพาะที่ปิดยอดแล้ว'}
          </h1>
          <p className="font-mono text-xs text-ink/70">
            วันที่ {from} ถึง {to} · {displayRows.length} รายการ
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">เงินเข้า (ขาย)</p>
            <p className="text-sm font-semibold text-teal-dark">{formatPrice(totalIn)}</p>
          </div>
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">เงินออก (ซื้อ)</p>
            <p className="text-sm font-semibold text-danger">{formatPrice(totalOut)}</p>
          </div>
          <div className="rounded-card border border-line bg-panel p-2 text-center">
            <p className="text-ink/50">ยอดสุทธิ</p>
            <p className={`text-sm font-semibold ${net >= 0 ? 'text-teal-dark' : 'text-danger'}`}>
              {formatPrice(net)}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={handleSavePdf}
            disabled={savingPdf}
            className="flex-1 rounded-tag border border-teal px-4 py-2.5 font-mono text-sm font-semibold text-teal disabled:opacity-60"
          >
            {savingPdf ? 'กำลังเซฟ…' : 'เซฟ'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white"
          >
            พิมพ์
          </button>
        </div>
      )}

      {!loading && !error && displayRows.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-ink/50">
          {activeStatus === 'ปิดยอดแล้ว'
            ? 'ยังไม่มีรายการที่ปิดยอดแล้วในช่วงเวลาที่เลือก'
            : `ไม่มีรายการโอนผ่านธนาคาร ${BANK} ในช่วงเวลาที่เลือก`}
        </p>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-panel print:hidden">
          <table className="min-w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-ink/60">
                <th className="whitespace-nowrap px-3 py-2">รายการ</th>
                <th className="whitespace-nowrap px-3 py-2 text-danger">วันที่ซื้อ</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-danger">จำนวนเงินซื้อ</th>
                <th className="whitespace-nowrap px-3 py-2 text-teal-dark">วันที่ขาย</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-teal-dark">จำนวนเงินขาย</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">ส่วนต่าง</th>
                <th className="whitespace-nowrap px-3 py-2">สถานะ</th>
                <th className="whitespace-nowrap px-3 py-2">สลิปซื้อ</th>
                <th className="whitespace-nowrap px-3 py-2">สลิปขาย</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r.key} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">
                    {r.product.model_name} {r.product.capacity} {r.product.color}
                    <span className="ml-1 text-ink/50">({r.product.product_code})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{r.buy?.date ?? '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-danger">
                    {r.buy ? `-${formatPrice(r.buy.amount)}` : '-'}
                  </td>
                  {r.sell ? (
                    <>
                      <td className="whitespace-nowrap px-3 py-2 text-ink">{r.sell.date}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-teal-dark">
                        +{formatPrice(r.sell.amount)}
                      </td>
                    </>
                  ) : (
                    <td className="whitespace-nowrap px-3 py-2 text-ink/40" colSpan={2}>
                      {r.sold ? 'ขายแล้ว (ไม่ผ่าน TTB)' : 'ยังไม่ได้ขาย'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                    {r.buy && r.sell ? formatPrice(r.sell.amount - r.buy.amount) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded-tag border px-1.5 py-0.5 text-[10px] uppercase ${
                        r.buy && r.sell ? 'border-teal-dark text-teal-dark' : 'border-amber-dark text-amber-dark'
                      }`}
                    >
                      {r.buy && r.sell ? 'ปิดยอดแล้ว' : r.sold ? 'ขายแล้ว' : 'รอขาย'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.buy?.slipUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.buy.slipUrl}
                        alt="สลิปซื้อ"
                        onClick={() => setLightboxUrl(r.buy!.slipUrl)}
                        className="h-10 w-10 cursor-zoom-in rounded-tag border border-line object-cover"
                      />
                    ) : (
                      <span className="text-ink/30">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.sell?.slipUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.sell.slipUrl}
                        alt="สลิปขาย"
                        onClick={() => setLightboxUrl(r.sell!.slipUrl)}
                        className="h-10 w-10 cursor-zoom-in rounded-tag border border-line object-cover"
                      />
                    ) : (
                      <span className="text-ink/30">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-paper font-semibold">
                <td className="whitespace-nowrap px-3 py-2 text-ink">รวม</td>
                <td className="whitespace-nowrap px-3 py-2"></td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-danger">-{formatPrice(totalOut)}</td>
                <td className="whitespace-nowrap px-3 py-2"></td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-teal-dark">+{formatPrice(totalIn)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{formatPrice(net)}</td>
                <td className="whitespace-nowrap px-3 py-2"></td>
                <td className="whitespace-nowrap px-3 py-2"></td>
                <td className="whitespace-nowrap px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <div ref={printRef} className="hidden space-y-2 print:block">
          {displayRows.map((r) => (
            <div
              key={r.key}
              className="space-y-2 rounded-card border border-line bg-panel p-3 print:break-inside-avoid print:border-black"
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-ink">
                  {r.product.model_name} {r.product.capacity} {r.product.color}
                  <span className="ml-1 font-mono text-xs text-ink/50">({r.product.product_code})</span>
                </p>
                <span
                  className={`rounded-tag border px-1.5 py-0.5 text-[10px] uppercase ${
                    r.buy && r.sell ? 'border-teal-dark text-teal-dark' : 'border-amber-dark text-amber-dark'
                  }`}
                >
                  {r.buy && r.sell ? 'ปิดยอดแล้ว' : r.sold ? 'ขายแล้ว' : 'รอขาย'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-0.5">
                    <p className="font-mono text-[10px] uppercase text-danger">ซื้อ</p>
                    {r.buy ? (
                      <>
                        <p className="font-mono text-xs text-ink">{r.buy.date}</p>
                        <p className="font-mono text-xs font-semibold text-danger">-{formatPrice(r.buy.amount)}</p>
                      </>
                    ) : (
                      <p className="font-mono text-xs text-ink/40">ไม่ได้ซื้อผ่าน TTB</p>
                    )}
                  </div>
                  {r.buy?.slipUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.buy.slipUrl}
                      alt="สลิปซื้อ"
                      className="h-14 w-14 shrink-0 rounded-tag border border-line object-cover"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-0.5">
                    <p className="font-mono text-[10px] uppercase text-teal-dark">ขาย</p>
                    {r.sell ? (
                      <>
                        <p className="font-mono text-xs text-ink">{r.sell.date}</p>
                        <p className="font-mono text-xs font-semibold text-teal-dark">+{formatPrice(r.sell.amount)}</p>
                      </>
                    ) : (
                      <p className="font-mono text-xs text-ink/40">{r.sold ? 'ขายแล้ว (ไม่ผ่าน TTB)' : 'ยังไม่ได้ขาย'}</p>
                    )}
                  </div>
                  {r.sell?.slipUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.sell.slipUrl}
                      alt="สลิปขาย"
                      className="h-14 w-14 shrink-0 rounded-tag border border-line object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
          <p className="pt-2 text-right font-mono text-xs font-semibold text-ink">รวมยอดสุทธิ {formatPrice(net)}</p>
        </div>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6 print:hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="ดูสลิปขยาย"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-card object-contain"
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="ปิด"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
