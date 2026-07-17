import React from 'react'
import {
  Eye, PencilSimple, Trash, XCircle, Receipt, CreditCard,
  ArrowCounterClockwise, SealCheck, TrayArrowDown, HourglassMedium,
  ArrowCircleRight, Truck, CheckCircle, Package,
  Lock, LockOpen, SlidersHorizontal, FileCsv,
} from '@phosphor-icons/react';
import { Button } from './Button';

// ── Variantes de color por tipo de acción ────────────────────────────────────
const VARIANTS = {
  view:      '',
  edit:      'text-blue-600 hover:bg-blue-50',
  delete:    'text-red-600 hover:bg-red-50',
  cancel:    'text-red-500 hover:bg-red-50',
  statement: 'text-slate-600 hover:bg-slate-50',
  payment:   'text-emerald-600 hover:bg-emerald-50',
  return:    'text-orange-600 hover:bg-orange-50',
  approve:   'text-purple-600 hover:bg-purple-50',
  receive:   'text-indigo-600 hover:bg-indigo-50',
  partial:   'text-amber-600 hover:bg-amber-50',
  convert:   'text-teal-600 hover:bg-teal-50',
  transit:   'text-sky-600 hover:bg-sky-50',
  deliver:   'text-green-600 hover:bg-green-50',
  activate:  'text-green-600 hover:bg-green-50',
  deactivate:'text-orange-600 hover:bg-orange-50',
  adjust:    'text-violet-600 hover:bg-violet-50',
} as const;

type ActionVariant = keyof typeof VARIANTS

interface ActionButtonProps {
  variant?: ActionVariant
  title?: string
  onClick?: () => void
  disabled?: boolean
  children?: React.ReactNode
}

interface ActionProps {
  onClick?: () => void
  disabled?: boolean
  title?: string
}

interface ToggleLockActionProps extends ActionProps {
  active?: boolean
}

// ── Base ─────────────────────────────────────────────────────────────────────
const ActionButton = ({ variant = 'view', title, onClick, disabled, children }: ActionButtonProps) => (
  <Button
    variant="ghost"
    size="sm"
    className={VARIANTS[variant]}
    title={title}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

// ── Acciones semánticas ───────────────────────────────────────────────────────
export const ViewAction = ({ onClick, disabled, title = 'Ver detalles' }: ActionProps) => (
  <ActionButton variant="view" title={title} onClick={onClick} disabled={disabled}>
    <Eye size={16} />
  </ActionButton>
);

export const EditAction = ({ onClick, disabled, title = 'Editar' }: ActionProps) => (
  <ActionButton variant="edit" title={title} onClick={onClick} disabled={disabled}>
    <PencilSimple size={16} />
  </ActionButton>
);

export const DeleteAction = ({ onClick, disabled, title = 'Eliminar' }: ActionProps) => (
  <ActionButton variant="delete" title={title} onClick={onClick} disabled={disabled}>
    <Trash size={16} />
  </ActionButton>
);

export const CancelAction = ({ onClick, disabled, title = 'Cancelar' }: ActionProps) => (
  <ActionButton variant="cancel" title={title} onClick={onClick} disabled={disabled}>
    <XCircle size={16} />
  </ActionButton>
);

export const StatementAction = ({ onClick, disabled, title = 'Estado de cuenta' }: ActionProps) => (
  <ActionButton variant="statement" title={title} onClick={onClick} disabled={disabled}>
    <Receipt size={16} />
  </ActionButton>
);

export const PaymentAction = ({ onClick, disabled, title = 'Registrar pago' }: ActionProps) => (
  <ActionButton variant="payment" title={title} onClick={onClick} disabled={disabled}>
    <CreditCard size={16} />
  </ActionButton>
);

export const ReturnAction = ({ onClick, disabled, title = 'Generar devolución' }: ActionProps) => (
  <ActionButton variant="return" title={title} onClick={onClick} disabled={disabled}>
    <ArrowCounterClockwise size={16} />
  </ActionButton>
);

export const ApproveAction = ({ onClick, disabled, title = 'Aprobar' }: ActionProps) => (
  <ActionButton variant="approve" title={title} onClick={onClick} disabled={disabled}>
    <SealCheck size={16} />
  </ActionButton>
);

export const ReceiveAction = ({ onClick, disabled, title = 'Recibir mercancía' }: ActionProps) => (
  <ActionButton variant="receive" title={title} onClick={onClick} disabled={disabled}>
    <TrayArrowDown size={16} />
  </ActionButton>
);

export const PartialReceiveAction = ({ onClick, disabled, title = 'Continuar recepción parcial' }: ActionProps) => (
  <ActionButton variant="partial" title={title} onClick={onClick} disabled={disabled}>
    <HourglassMedium size={16} />
  </ActionButton>
);

export const ConvertAction = ({ onClick, disabled, title = 'Convertir a venta' }: ActionProps) => (
  <ActionButton variant="convert" title={title} onClick={onClick} disabled={disabled}>
    <ArrowCircleRight size={16} />
  </ActionButton>
);

export const TransitAction = ({ onClick, disabled, title = 'Marcar en tránsito' }: ActionProps) => (
  <ActionButton variant="transit" title={title} onClick={onClick} disabled={disabled}>
    <Truck size={16} />
  </ActionButton>
);

export const DeliverAction = ({ onClick, disabled, title = 'Confirmar entrega' }: ActionProps) => (
  <ActionButton variant="deliver" title={title} onClick={onClick} disabled={disabled}>
    <CheckCircle size={16} />
  </ActionButton>
);

export const ReceiveTransferAction = ({ onClick, disabled, title = 'Recibir transferencia' }: ActionProps) => (
  <ActionButton variant="deliver" title={title} onClick={onClick} disabled={disabled}>
    <Package size={16} />
  </ActionButton>
);

export const ToggleLockAction = ({ active, onClick, disabled }: ToggleLockActionProps) => (
  <ActionButton
    variant={active ? 'deactivate' : 'activate'}
    title={active ? 'Desactivar' : 'Activar'}
    onClick={onClick}
    disabled={disabled}
  >
    {active ? <Lock size={16} /> : <LockOpen size={16} />}
  </ActionButton>
);

export const AdjustAction = ({ onClick, disabled, title = 'Ajustar stock' }: ActionProps) => (
  <ActionButton variant="adjust" title={title} onClick={onClick} disabled={disabled}>
    <SlidersHorizontal size={16} />
  </ActionButton>
);

export const ExportCsvAction = ({ onClick, disabled, title = 'Exportar CSV' }: ActionProps) => (
  <ActionButton variant="view" title={title} onClick={onClick} disabled={disabled}>
    <FileCsv size={16} />
  </ActionButton>
);

export default ActionButton;
