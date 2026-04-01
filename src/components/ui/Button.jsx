export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-accent text-dark-900 hover:bg-accent-dark font-semibold neon-btn',
    secondary: 'bg-dark-700 text-gray-200 hover:bg-dark-600 border border-dark-500',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-400 hover:text-gray-200 hover:bg-dark-700',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-all
        ${variants[variant]} ${sizes[size]} ${className}
        disabled:opacity-50 disabled:cursor-not-allowed`}
      {...props}
    >
      {children}
    </button>
  )
}
