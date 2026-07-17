import React from 'react'
import { Trash, Warning, Info, CheckCircle } from '@phosphor-icons/react'
import { Modal } from './Modal'
import { Button } from './Button'
import { cn } from '../../lib/utils'

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success'

const variants: Record<ConfirmVariant, {
  Icon: React.ComponentType<any>
  iconClass: string
  confirmVariant: string
  defaultConfirmLabel: string
}> = {
  danger: {
    Icon: Trash,
    iconClass: 'text-red-500',
    confirmVariant: 'danger',
    defaultConfirmLabel: 'Eliminar',
  },
  warning: {
    Icon: Warning,
    iconClass: 'text-amber-500',
    confirmVariant: 'primary',
    defaultConfirmLabel: 'Confirmar',
  },
  info: {
    Icon: Info,
    iconClass: 'text-blue-500',
    confirmVariant: 'primary',
    defaultConfirmLabel: 'Confirmar',
  },
  success: {
    Icon: CheckCircle,
    iconClass: 'text-green-500',
    confirmVariant: 'success',
    defaultConfirmLabel: 'Confirmar',
  },
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const { Icon, iconClass, confirmVariant, defaultConfirmLabel } = variants[variant]
  const label = confirmLabel ?? defaultConfirmLabel

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center py-2 gap-3">
        <div className={cn('rounded-full bg-gray-50 p-3', iconClass)}>
          <Icon size={32} weight="duotone" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-200">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant as any} onClick={onConfirm} loading={loading}>
          {label}
        </Button>
      </div>
    </Modal>
  )
}
