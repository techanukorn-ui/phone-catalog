'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ProductCategory } from '@/lib/types'

type Props = {
  category: ProductCategory
  count: number
  children: React.ReactNode
}

export default function SortableCategorySection({ category, count, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-tag border border-line bg-panel text-ink/40 active:cursor-grabbing"
          aria-label="ลากเพื่อจัดลำดับหมวดหมู่"
        >
          ⠿
        </button>
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink/60">{category}</p>
        <span className="font-mono text-[10px] text-ink/40">({count})</span>
        <div className="h-px flex-1 bg-line" />
      </div>
      {children}
    </div>
  )
}
