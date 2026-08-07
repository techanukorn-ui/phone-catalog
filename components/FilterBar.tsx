import { CATEGORY_TABS } from '@/lib/types'
import type { CategoryTab } from '@/lib/types'

export type SortOption = 'newest' | 'price-asc' | 'price-desc'

type Props = {
  categories?: CategoryTab[]
  activeCategory: string
  onCategoryChange: (category: string) => void
  search: string
  onSearchChange: (value: string) => void
  sort: SortOption
  onSortChange: (value: SortOption) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'แนะนำ' },
  { value: 'price-asc', label: 'ราคา: ถูก → แพง' },
  { value: 'price-desc', label: 'ราคา: แพง → ถูก' },
]

export default function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: Props) {
  const tabs = categories?.length ? categories : CATEGORY_TABS
  return (
    <div className="sticky top-[196px] z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2.5">
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto [touch-action:pan-x]">
          {tabs.map((tab) => {
            const active = tab === activeCategory
            return (
              <button
                key={tab}
                onClick={() => onCategoryChange(tab)}
                className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                  active
                    ? 'border-teal bg-teal text-white'
                    : 'border-line bg-panel text-ink/70 active:bg-line/40'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            type="text"
            inputMode="search"
            placeholder="ค้นหารุ่น เช่น iPhone 13 Pro"
            className="min-w-0 flex-1 rounded-tag border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="shrink-0 rounded-tag border border-line bg-panel px-2 py-2 text-xs text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
