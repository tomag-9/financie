type BrandMarkProps = {
  className?: string
  showLabel?: boolean
}

export function BrandMark({ className = '', showLabel = true }: BrandMarkProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <svg viewBox="0 0 73 76" aria-hidden="true" className="block h-10 w-10 shrink-0">
        <path d="M36 0L0 76H18L36 37L55 76H73L36 0Z" fill="url(#brandMarkGradient)" />
        <defs>
          <linearGradient id="brandMarkGradient" x1="19" y1="-2" x2="79" y2="76" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0A2E69" />
            <stop offset="1" stopColor="#C15B28" />
          </linearGradient>
        </defs>
      </svg>
      {showLabel ? <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Magi</span> : null}
    </div>
  )
}