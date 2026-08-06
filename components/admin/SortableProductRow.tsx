'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Product } from '@/lib/types'

type Props = {
  product: Product
  children: React.ReactNode
}

export default function SortableProductRow({ product, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-tag border border-line bg-panel text-ink/40 active:cursor-grabbing"
        aria-label="ลากเพื่อจัดลำดับ"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
