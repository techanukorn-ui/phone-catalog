'use client'

import { useMemo, useRef, useState } from 'react'
import type { Product } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import ConditionDial from './ConditionDial'

export default function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const images = useMemo(
    () => [product.cover_image_url, ...product.gallery_images],
    [product.cover_image_url, product.gallery_images]
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(index)
  }

  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}?p=${product.id}`
    const shareData = {
      title: product.model_name,
      text: `${product.model_name} ราคา ${formatPrice(product.price)}`,
      url,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // ผู้ใช้กดยกเลิกการแชร์ ไม่ต้องทำอะไรต่อ
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // เบราว์เซอร์บล็อกการเข้าถึงคลิปบอร์ด ปล่อยผ่านเงียบๆ
    }
  }

  const sold = product.status === 'ขายแล้ว'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-ink/60 [touch-action:pan-y] sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden overscroll-none rounded-t-card bg-panel [touch-action:pan-y] sm:rounded-card"
      >
        <div className="relative shrink-0">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="no-scrollbar snap-x-mandatory flex aspect-square w-full overflow-x-auto overscroll-x-contain [touch-action:pan-x]"
          >
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`${product.model_name} รูปที่ ${i + 1}`}
                className="h-full w-full shrink-0 snap-center object-cover"
              />
            ))}
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === activeIndex ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="ปิด"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white"
          >
            ✕
          </button>

          <button
            onClick={handleShare}
            aria-label="แชร์สินค้า"
            className="absolute right-14 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {copied && (
            <span className="absolute right-3 top-14 whitespace-nowrap rounded-tag bg-ink/80 px-2 py-1 font-mono text-[11px] text-white">
              คัดลอกลิงก์แล้ว
            </span>
          )}

          <span className="absolute left-3 top-3 rounded-tag bg-ink/80 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white">
            {product.product_code}
          </span>
        </div>

        <div className="tag-perforation overflow-x-hidden overflow-y-auto p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-display text-xl font-semibold text-ink">
                {product.model_name}
                {product.capacity ? <span className="text-ink/60"> · {product.capacity}</span> : null}
                {product.color ? <span className="text-ink/60"> · {product.color}</span> : null}
              </p>
              <p className="mt-0.5 break-words font-mono text-xs uppercase tracking-wide text-ink/50">
                {product.category}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-tag px-2 py-1 font-mono text-[11px] uppercase tracking-wide ${
                sold ? 'bg-ink/10 text-ink/60' : 'bg-teal-light text-teal-dark'
              }`}
            >
              {product.status}
            </span>
          </div>

          <p className="mb-4 font-mono text-2xl font-semibold text-amber-dark">
            {formatPrice(product.price)}
          </p>

          {product.battery_percent != null && (
            <div className="mb-4 flex gap-4 rounded-tag border border-line bg-paper p-3">
              <ConditionDial value={product.battery_percent} label="แบตเตอรี่" size={52} colorClassName="text-teal" />
            </div>
          )}

          <dl className="space-y-3 text-sm">
            {product.charge_cycles != null && (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/50">รอบชาร์จ</dt>
                <dd className="text-ink">{product.charge_cycles} รอบ</dd>
              </div>
            )}
            {product.warranty_until && (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/50">ประกันศูนย์เหลือถึง</dt>
                <dd className="text-ink">{product.warranty_until}</dd>
              </div>
            )}
            {product.accessories && (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/50">อุปกรณ์ที่มีให้</dt>
                <dd className="whitespace-pre-line break-words text-ink">{product.accessories}</dd>
              </div>
            )}
            {product.defects && (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-ink/50">ตำหนิ / รายละเอียดสภาพ</dt>
                <dd className="whitespace-pre-line break-words text-ink">{product.defects}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}
