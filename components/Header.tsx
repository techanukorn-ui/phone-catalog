import type { StoreSettings } from '@/lib/types'

export default function Header({ settings }: { settings: StoreSettings | null }) {
  const storeName = settings?.store_name || 'ร้านมือถือมือสอง'
  const phones = [settings?.phone1, settings?.phone2].filter((p): p is string => !!p?.trim())

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
          <p className="text-base font-mono font-bold uppercase tracking-wide text-teal">
            รับซื้อ ฝาก ขาย สินค้า Apple มือ 2 ทุกชนิด
          </p>
          {phones.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 font-mono text-base text-ink/70">
              {phones.map((phone, i) => (
                <span key={phone} className="flex items-center gap-x-2">
                  {i > 0 && <span className="text-ink/30">·</span>}
                  <a href={`tel:${phone}`} className="hover:text-teal">
                    {phone}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </header>
  )
}
