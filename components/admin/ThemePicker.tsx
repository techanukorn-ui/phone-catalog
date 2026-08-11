import type { StoreTheme } from '@/lib/types'
import { THEME_PRESETS } from '@/lib/types'

export default function ThemePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: StoreTheme
  onChange: (theme: StoreTheme) => void
}) {
  return (
    <div>
      <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/60">{label}</span>
      <div className="flex flex-wrap gap-2">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`flex items-center gap-2 rounded-tag border px-3 py-2 text-xs ${
              value === preset.value ? 'border-ink bg-ink/5' : 'border-line bg-paper'
            }`}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-ink/10"
              style={{ backgroundColor: preset.swatch }}
            />
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
