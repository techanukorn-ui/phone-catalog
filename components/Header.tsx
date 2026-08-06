import type { StoreSettings } from '@/lib/types'

export default function Header({ settings }: { settings: StoreSettings | null }) {
  const storeName = settings?.store_name || 'ร้านมือถือมือสอง'

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-tag border border-line bg-panel">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt={storeName} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-semibold text-teal">
              {storeName.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words font-display text-lg font-semibold leading-tight text-ink">
            {storeName}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink/50">
            สต็อกมือถือ · แท็บเล็ตมือสอง
          </p>
        </div>
      </div>
    </header>
  )
}
