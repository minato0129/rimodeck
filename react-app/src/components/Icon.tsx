import paths from './iconPaths'

// Material Symbols の SVG。外部フォントに頼らないので、オフラインでも表示が崩れない。
// 大きさは font-size に合わせて変わる(既定は 24px)。
export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  const d = paths[name]
  if (!d) return null
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
