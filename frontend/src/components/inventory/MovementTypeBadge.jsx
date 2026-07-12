import { TrendUp, TrendDown, ArrowsLeftRight, SlidersHorizontal } from '@phosphor-icons/react';
import { Badge } from '../ui';

// ─── Configuración por tipo de movimiento ─────────────────────────────────────
//
// Tipos persistidos por el backend (ENUM de inventory_movements):
//   ingreso | egreso | ajuste_positivo | ajuste_negativo | transferencia
//
// Verde  (success) = entrada de stock: compras, devoluciones de clientes
// Rojo   (error)   = salida de stock:  ventas
// Ámbar  (warning) = ajuste manual:    puede ser + o −, pero es operación especial
// Azul   (info)    = transferencia:    quantity lleva signo (salida −, entrada +)

const TYPE_CONFIG = {
  ingreso:         { variant: 'success', label: 'Ingreso',       icon: TrendUp },
  egreso:          { variant: 'error',   label: 'Egreso',        icon: TrendDown },
  ajuste_positivo: { variant: 'warning', label: 'Ajuste +',      icon: SlidersHorizontal },
  ajuste_negativo: { variant: 'warning', label: 'Ajuste −',      icon: SlidersHorizontal },
  transferencia:   { variant: 'info',    label: 'Transferencia', icon: ArrowsLeftRight },
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
  return cfg.variant === 'success' || type === 'ajuste_positivo';
}

/**
 * Opciones para Select de filtro de tipo de movimiento.
 * Solo los tipos que la DB persiste — otros valores nunca devuelven resultados.
 */
export const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ingreso',         label: 'Ingreso' },
  { value: 'egreso',          label: 'Egreso' },
  { value: 'ajuste_positivo', label: 'Ajuste +' },
  { value: 'ajuste_negativo', label: 'Ajuste −' },
  { value: 'transferencia',   label: 'Transferencia' },
];
