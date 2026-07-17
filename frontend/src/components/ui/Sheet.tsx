import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

const sideClasses: Record<string, [string, string]> = {
  right: [
    'right-0 top-0 h-full border-l',
    'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  ],
  left: [
    'left-0 top-0 h-full border-r',
    'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
  ],
}

const sizeClasses: Record<string, string> = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
  xl: 'w-[600px]',
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children?: React.ReactNode
  side?: 'right' | 'left'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Sheet({ open, onClose, title, children, side = 'right', size = 'md', className }: SheetProps) {
  const [posClass, animClass] = sideClasses[side]

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/40',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-150'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-white shadow-xl border-gray-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out duration-200',
            posClass,
            animClass,
            sizeClasses[size],
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
