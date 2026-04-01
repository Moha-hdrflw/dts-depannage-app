import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-dark-800 border border-dark-600
        rounded-t-2xl sm:rounded-2xl max-h-[95vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 pb-8 sm:pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
