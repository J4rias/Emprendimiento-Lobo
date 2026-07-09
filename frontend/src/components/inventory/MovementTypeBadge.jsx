import { TrendUp, TrendDown, ArrowsLeftRight, SlidersHorizontal } from '@phosphor-icons/react';
import { Badge } from '../ui';

// ─── Configuración por tipo de movimiento ─────────────────────────────────────
//
// Verde  (success) = entrada de stock: compras, ingresos, devoluciones de clientes
// Rojo   (error)   = salida de stock:  ventas, egresos, devoluciones a proveedor
// Ámbar  (warning) = ajuste manual:    puede ser + o −, pero es operación especial
// Azul   (info)    = transferencia:    movimiento interno sin impacto en inventario total

const TYPE_CONFIG = {
  // ── Entradas ────────────────────────────────────────────────────────────────
  compra:               { variant: 'success', label: 'Compra',             icon: TrendUp },
  ingreso:              { variant: 'success', label: 'Ingreso',             icon: TrendUp },
  ingreso_compra:       { variant: 'success', label: 'Ingreso Compra',      icon: TrendUp },
  devolucion_cliente:   { variant: 'success', label: 'Dev. Cliente',        icon: TrendUp },
  // ── Salidas ─────────────────────────────────────────────────────────────────
  venta:                { variant: 'error',   label: 'Venta',               icon: TrendDown },
  egreso:               { variant: 'error',   label: 'Egreso',              icon: TrendDown },
  egreso_venta:         { variant: 'error',   label: 'Egreso Venta',        icon: TrendDown },
  devolucion_proveedor: { variant: 'error',   label: 'Dev. Proveedor',      icon: TrendDown },
  // ── Ajustes ─────────────────────────────────────────────────────────────────
  ajuste_positivo:      { variant: 'warning', label: 'Ajuste +',            icon: SlidersHorizontal },
  ajuste_negativo:      { variant: 'warning', label: 'Ajuste −',            icon: SlidersHorizontal },
  // ── Transferencias ──────────────────────────────────────────────────────────
  transferencia:        { variant: 'info',    label: 'Transferencia',       icon: ArrowsLeftRight },
  transferencia_entrada:{ variant: 'info',    label: 'Transfer. Entrada',   icon: ArrowsLeftRight },
  transferencia_salida: { variant: 'info',    label: 'Transfer. Salida',    icon: ArrowsLeftRight },
};

/**
 * Badge estandarizado para tipos de movimiento de inventario.
 *
 * @param {string}  type       - movement_type del backend (ej: 'venta', 'compra', 'ajuste_positivo')
 * @param {boolean} [showIcon] - Muestra el ícono antes del label (default: true)
 */
export function MovementTypeBadge({ type, showIcon = true }) {
  const cfg = TYPE_CONFIG[type] ?? {
    variant: 'neutral',
    label: type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—',
    icon: null,
  };

  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className="gap-1 whitespace-nowrap">
      {showIcon && Icon && <Icon size={11} className="shrink-0" />}
      {cfg.label}
    </Badge>
  );
}

/**
 * Retorna true si el tipo de movimiento representa una entrada de stock.
 * Útil para calcular balance corriente en el kardex.
 */
export function isPositiveMovement(type) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg) return false;
  return cfg.variant === 'success' || type === 'ajuste_positivo' || type === 'transferencia_entrada';
}

/**
 * Opciones para Select de filtro de tipo de movimiento.
 */
export const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'compra',               label: 'Compra' },
  { value: 'ingreso',              label: 'Ingreso' },
  { value: 'ingreso_compra',       label: 'Ingreso Compra' },
  { value: 'devolucion_cliente',   label: 'Dev. Cliente' },
  { value: 'venta',                label: 'Venta' },
  { value: 'egreso',               label: 'Egreso' },
  { value: 'egreso_venta',         label: 'Egreso Venta' },
  { value: 'devolucion_proveedor', label: 'Dev. Proveedor' },
  { value: 'ajuste_positivo',      label: 'Ajuste +' },
  { value: 'ajuste_negativo',      label: 'Ajuste −' },
  { value: 'transferencia',        label: 'Transferencia' },
  { value: 'transferencia_entrada',label: 'Transfer. Entrada' },
  { value: 'transferencia_salida', label: 'Transfer. Salida' },
];
