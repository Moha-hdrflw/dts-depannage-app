export function Card({ children, className = '', neon = false }) {
  return (
    <div className={`bg-dark-800 rounded-xl p-4 ${neon ? 'neon-card' : 'border border-dark-600'} ${className}`}>
      {children}
    </div>
  )
}

export function MontantDisplay({ ttc, ht, size = 'md' }) {
  const fmt = n => n?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const sizes = {
    sm: { ttc: 'text-base font-bold', ht: 'text-xs' },
    md: { ttc: 'text-xl font-bold', ht: 'text-sm' },
    lg: { ttc: 'text-3xl font-bold', ht: 'text-base' },
  }
  const s = sizes[size] || sizes.md
  return (
    <div className="flex flex-col items-end">
      <span className={`neon-green ${s.ttc}`}>{fmt(ttc)} TTC</span>
      <span className={`text-gray-500 ${s.ht}`}>HT : {fmt(ht)}</span>
    </div>
  )
}
