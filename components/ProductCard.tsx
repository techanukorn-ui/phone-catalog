import Image from 'next/image'
import type { Product } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import ConditionDial from './ConditionDial'

export default function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const sold = product.status === 'ขายแล้ว'

  return (
    <button
      onClick={() => onSelect(product)}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-panel text-left shadow-tag transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-line/30">
        <Image
          src={product.cover_image_url}
          alt={product.model_name}
          fill
          sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
          className={`object-cover transition-opacity ${sold ? 'opacity-40 grayscale' : ''}`}
        />
        <span className="absolute left-2 top-2 rounded-tag bg-ink/80 px-2 py-0.5 font-mono text-[10px] tracking-wide text-white">
          {product.product_code}
        </span>
        <span
          className={`absolute right-2 top-2 rounded-tag px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            sold ? 'bg-ink/70 text-white' : 'bg-success text-white'
          }`}
        >
          {product.status}
        </span>
      </div>

      <div className="tag-perforation flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="break-words font-display text-sm font-semibold leading-snug text-ink">
            {product.model_name}
            {product.capacity ? <span className="text-ink/60"> · {product.capacity}</span> : null}
            {product.color ? <span className="text-ink/60"> · {product.color}</span> : null}
          </p>
        </div>

        {product.battery_percent != null && (
          <ConditionDial value={product.battery_percent} label="แบต" size={38} colorClassName="text-teal" />
        )}

        {(product.charge_cycles != null || product.warranty_until) && (
          <div className="space-y-0.5 font-mono text-[11px] text-ink/60">
            {product.charge_cycles != null && <p>รอบชาร์จ {product.charge_cycles} รอบ</p>}
            {product.warranty_until && <p className="break-words">ประกันถึง {product.warranty_until}</p>}
          </div>
        )}

        <p className="mt-auto font-mono text-lg font-semibold text-amber-dark">
          {formatPrice(product.price)}
        </p>
      </div>
    </button>
  )
}
