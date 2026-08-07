'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ProductCategory } from '@/lib/types'

type Props = {
  category: ProductCategory
  active: boolean
  onSelect: () => void
}

export default function SortableCategoryPill({ category, active, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      className={`shrink-0 touch-none select-none rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
        active ? 'border-teal bg-teal text-white' : 'border-line bg-panel text-ink/70 active:bg-line/40'
      }`}
    >
      {category}
    </button>
  )
}
