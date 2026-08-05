type Props = {
  value: number
  label: string
  size?: number
  colorClassName?: string
}

export default function ConditionDial({ value, label, size = 44, colorClassName = 'text-teal' }: Props) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#DAD7CF"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={colorClassName}
          stroke="currentColor"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink font-mono"
          style={{ fontSize: size * 0.28 }}
        >
          {clamped}
        </text>
      </svg>
      <span className="text-[10px] leading-tight text-ink/60 font-mono uppercase tracking-wide">
        {label}
      </span>
    </div>
  )
}
