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
};

// ── Base ─────────────────────────────────────────────────────────────────────
const ActionButton = ({ variant = 'view', title, onClick, disabled, children }) => (
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
export const ViewAction = ({ onClick, disabled, title = 'Ver detalles' }) => (
  <ActionButton variant="view" title={title} onClick={onClick} disabled={disabled}>
    <Eye size={16} />
  </ActionButton>
);

export const EditAction = ({ onClick, disabled, title = 'Editar' }) => (
  <ActionButton variant="edit" title={title} onClick={onClick} disabled={disabled}>
    <PencilSimple size={16} />
  </ActionButton>
);

export const DeleteAction = ({ onClick, disabled, title = 'Eliminar' }) => (
  <ActionButton variant="delete" title={title} onClick={onClick} disabled={disabled}>
    <Trash size={16} />
  </ActionButton>
);

export const CancelAction = ({ onClick, disabled, title = 'Cancelar' }) => (
  <ActionButton variant="cancel" title={title} onClick={onClick} disabled={disabled}>
    <XCircle size={16} />
  </ActionButton>
);

export const StatementAction = ({ onClick, disabled, title = 'Estado de cuenta' }) => (
  <ActionButton variant="statement" title={title} onClick={onClick} disabled={disabled}>
    <Receipt size={16} />
  </ActionButton>
);

export const PaymentAction = ({ onClick, disabled, title = 'Registrar pago' }) => (
  <ActionButton variant="payment" title={title} onClick={onClick} disabled={disabled}>
    <CreditCard size={16} />
  </ActionButton>
);

export const ReturnAction = ({ onClick, disabled, title = 'Generar devolución' }) => (
  <ActionButton variant="return" title={title} onClick={onClick} disabled={disabled}>
    <ArrowCounterClockwise size={16} />
  </ActionButton>
);

export const ApproveAction = ({ onClick, disabled, title = 'Aprobar' }) => (
  <ActionButton variant="approve" title={title} onClick={onClick} disabled={disabled}>
    <SealCheck size={16} />
  </ActionButton>
);

export const ReceiveAction = ({ onClick, disabled, title = 'Recibir mercancía' }) => (
  <ActionButton variant="receive" title={title} onClick={onClick} disabled={disabled}>
    <TrayArrowDown size={16} />
  </ActionButton>
);

export const PartialReceiveAction = ({ onClick, disabled, title = 'Continuar recepción parcial' }) => (
  <ActionButton variant="partial" title={title} onClick={onClick} disabled={disabled}>
    <HourglassMedium size={16} />
  </ActionButton>
);

export const ConvertAction = ({ onClick, disabled, title = 'Convertir a venta' }) => (
  <ActionButton variant="convert" title={title} onClick={onClick} disabled={disabled}>
    <ArrowCircleRight size={16} />
  </ActionButton>
);

export const TransitAction = ({ onClick, disabled, title = 'Marcar en tránsito' }) => (
  <ActionButton variant="transit" title={title} onClick={onClick} disabled={disabled}>
    <Truck size={16} />
  </ActionButton>
);

export const DeliverAction = ({ onClick, disabled, title = 'Confirmar entrega' }) => (
  <ActionButton variant="deliver" title={title} onClick={onClick} disabled={disabled}>
    <CheckCircle size={16} />
  </ActionButton>
);

export const ReceiveTransferAction = ({ onClick, disabled, title = 'Recibir transferencia' }) => (
  <ActionButton variant="deliver" title={title} onClick={onClick} disabled={disabled}>
    <Package size={16} />
  </ActionButton>
);

export const ToggleLockAction = ({ active, onClick, disabled }) => (
  <ActionButton
    variant={active ? 'deactivate' : 'activate'}
    title={active ? 'Desactivar' : 'Activar'}
    onClick={onClick}
    disabled={disabled}
  >
    {active ? <Lock size={16} /> : <LockOpen size={16} />}
  </ActionButton>
);

export const AdjustAction = ({ onClick, disabled, title = 'Ajustar stock' }) => (
  <ActionButton variant="adjust" title={title} onClick={onClick} disabled={disabled}>
    <SlidersHorizontal size={16} />
  </ActionButton>
);

export const ExportCsvAction = ({ onClick, disabled, title = 'Exportar CSV' }) => (
  <ActionButton variant="view" title={title} onClick={onClick} disabled={disabled}>
    <FileCsv size={16} />
  </ActionButton>
);

export default ActionButton;
