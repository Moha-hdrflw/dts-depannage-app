export function Badge({ color = 'gray', children, onClick, className = '' }) {
  const styles = {
    red:    { cls: 'bg-red-500/20 text-red-400 border-red-500/30',     glow: 'badge-glow-red' },
    green:  { cls: 'bg-green-500/20 text-green-400 border-green-500/30', glow: 'badge-glow-green' },
    blue:   { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30',   glow: 'badge-glow-blue' },
    yellow: { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', glow: '' },
    gray:   { cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30',   glow: '' },
    purple: { cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30', glow: '' },
    accent: { cls: 'bg-accent/20 text-accent border-accent/30',         glow: 'badge-glow-green' },
  }

  const s = styles[color] || styles.gray

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium
        ${s.cls} ${s.glow}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        ${className}`}
    >
      {children}
    </span>
  )
}
