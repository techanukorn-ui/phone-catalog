'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Product } from '@/lib/types'

type Props = {
  product: Product
  onSaved: () => void
  onCancel: () => void
}

function parseNum(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function todayStr(): string {
  const d = new Date()
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

export default function MarkSoldForm({ product, onSaved, onCancel }: Props) {
  const [soldAt, setSoldAt] = useState(product.sold_at ?? todayStr())
  const [costDevice, setCostDevice] = useState(product.cost_device != null ? String(product.cost_device) : '')
  const [costOther, setCostOther] = useState(product.cost_other != null ? String(product.cost_other) : '')
  const [salePrice, setSalePrice] = useState(product.sale_price != null ? String(product.sale_price) : '')
  const [divWallet, setDivWallet] = useState(product.dividend_wallet != null ? String(product.dividend_wallet) : '')
  const [divBow, setDivBow] = useState(product.dividend_bow != null ? String(product.dividend_bow) : '')
  const [divMagic, setDivMagic] = useState(product.dividend_magic != null ? String(product.dividend_magic) : '')
  const [divBoat, setDivBoat] = useState(product.dividend_boat != null ? String(product.dividend_boat) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalCost = useMemo(() => parseNum(costDevice) + parseNum(costOther), [costDevice, costOther])
  const netProfit = useMemo(() => parseNum(salePrice) - totalCost, [salePrice, totalCost])
  const dividendSum = useMemo(
    () => parseNum(divWallet) + parseNum(divBow) + parseNum(divMagic) + parseNum(divBoat),
    [divWallet, divBow, divMagic, divBoat]
  )
  const dividendMatches = Math.abs(dividendSum - netProfit) < 0.01

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!soldAt) {
      setError('กรุณาเลือกวันที่ขาย')
      return
    }
    if (!salePrice || Number.isNaN(Number(salePrice))) {
      setError('กรุณากรอกราคาขายจริงเป็นตัวเลข')
      return
    }
    if (!dividendMatches) {
      setError(
        `ผลรวมปันผล (${dividendSum.toLocaleString('th-TH')}) ต้องเท่ากับกำไรสุทธิ(ก่อนแบ่งปันผล) (${netProfit.toLocaleString('th-TH')})`
      )
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          status: 'ขายแล้ว',
          sold_at: soldAt,
          cost_device: costDevice ? parseNum(costDevice) : null,
          cost_other: costOther ? parseNum(costOther) : null,
          sale_price: parseNum(salePrice),
          dividend_wallet: divWallet ? parseNum(divWallet) : null,
          dividend_bow: divBow ? parseNum(divBow) : null,
          dividend_magic: divMagic ? parseNum(divMagic) : null,
          dividend_boat: divBoat ? parseNum(divBoat) : null,
        })
        .eq('id', product.id)
      if (updateError) throw updateError
      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3">
      <p className="font-display text-sm font-semibold text-ink">
        บันทึกการขาย — {product.model_name} ({product.product_code})
      </p>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">วันที่ขาย *</span>
        <input
          type="date"
          value={soldAt}
          onChange={(e) => setSoldAt(e.target.value)}
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ต้นทุนเครื่อง</span>
          <input
            value={costDevice}
            onChange={(e) => setCostDevice(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ค่าใช้จ่ายอื่นๆ</span>
          <input
            value={costOther}
            onChange={(e) => setCostOther(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ต้นทุนรวม</span>
        <p className="rounded-tag border border-line bg-line/20 px-3 py-2 font-mono text-sm text-ink/70">
          {totalCost.toLocaleString('th-TH')}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">ราคาขายจริง *</span>
        <input
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          inputMode="numeric"
          placeholder="เช่น 17300"
          className="w-full rounded-tag border border-line bg-paper px-3 py-2 text-base"
        />
      </label>

      <div>
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">กำไรสุทธิ(ก่อนแบ่งปันผล)</span>
        <p className="rounded-tag border border-line bg-line/20 px-3 py-2 font-mono text-sm font-semibold text-teal-dark">
          {netProfit.toLocaleString('th-TH')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/60">ปันผลวอลเล่</span>
          <input
            value={divWallet}
            onChange={(e) => setDivWallet(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-2 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/60">ปันผลโบว์</span>
          <input
            value={divBow}
            onChange={(e) => setDivBow(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-2 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/60">ปันผลเมจิ</span>
          <input
            value={divMagic}
            onChange={(e) => setDivMagic(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-2 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/60">ปันผลโบ๊ท</span>
          <input
            value={divBoat}
            onChange={(e) => setDivBoat(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-tag border border-line bg-paper px-2 py-2 text-base"
          />
        </label>
      </div>

      <p className={`font-mono text-xs ${dividendMatches ? 'text-ink/50' : 'text-danger'}`}>
        รวมปันผล {dividendSum.toLocaleString('th-TH')} / กำไรสุทธิ(ก่อนแบ่งปันผล) {netProfit.toLocaleString('th-TH')}
      </p>

      {error && <p className="rounded-tag bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-tag bg-teal px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก…' : 'ยืนยันขายแล้ว'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-tag border border-line px-4 py-2.5 font-mono text-sm text-ink/70"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  )
}
