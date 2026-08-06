import { CATEGORIES } from '@/lib/types'

type Props = {
  activeCategory: string
  onCategoryChange: (category: string) => void
  search: string
  onSearchChange: (value: string) => void
}

const TABS = ['ทั้งหมด', ...CATEGORIES]

export default function FilterBar({ activeCategory, onCategoryChange, search, onSearchChange }: Props) {
  return (
    <div className="sticky top-[68px] z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2.5">
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto [touch-action:pan-x]">
          {TABS.map((tab) => {
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
        <div className="relative">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            type="text"
            inputMode="search"
            placeholder="ค้นหารุ่น เช่น iPhone 13 Pro"
            className="w-full rounded-tag border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
      </div>
    </div>
  )
}
