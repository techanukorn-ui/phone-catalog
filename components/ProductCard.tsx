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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.cover_image_url}
          alt={product.model_name}
          className={`h-full w-full object-cover transition-opacity ${sold ? 'opacity-40 grayscale' : ''}`}
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
          <p className="font-display text-sm font-semibold leading-snug text-ink">
            {product.model_name}
            {product.capacity ? <span className="text-ink/60"> · {product.capacity}</span> : null}
          </p>
        </div>

        {product.battery_percent != null && (
          <ConditionDial value={product.battery_percent} label="แบต" size={38} colorClassName="text-teal" />
        )}

        <p className="mt-auto font-mono text-lg font-semibold text-amber-dark">
          {formatPrice(product.price)}
        </p>
      </div>
    </button>
  )
}
