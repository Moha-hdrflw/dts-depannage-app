export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-400">{label}</label>}
      <input
        className={`bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-gray-200
          placeholder-gray-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
          transition-colors text-base ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}

export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-400">{label}</label>}
      <select
        className={`bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-gray-200
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
          transition-colors text-base ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-400">{label}</label>}
      <textarea
        className={`bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-gray-200
          placeholder-gray-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
          transition-colors text-base resize-none ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
