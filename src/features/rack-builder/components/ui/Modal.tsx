import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden sm:items-center">
      <div className="fixed inset-0 overflow-x-hidden bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 shadow-xl w-full max-h-[95svh] overflow-auto rounded-t-xl sm:rounded-lg sm:max-w-lg sm:mx-4 sm:max-h-[90vh]">
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-between px-4 py-4 border-b dark:border-gray-700 sm:px-6">
          <h2 className="text-lg font-semibold dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="px-4 py-4 sm:px-6 dark:text-gray-100" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
