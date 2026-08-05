/**
 * Formatters estándar del sistema.
 *
 * Reglas de negocio (no cambiar sin revisar el resto del sistema):
 *  - VES y COP: enteros (Math.round), separador de miles con punto, locale es-VE.
 *    Math.round y no Math.ceil: el ceil inflaba montos por ruido de punto
 *    flotante (15000.0000001 → 15.001) y difería del ticket y del arqueo.
 *  - USD: siempre 2 decimales.
 *  - Fechas: locale es-VE.
 */

export const LOCALE = 'es-VE';

export const formatMoney = (amount: number | string, currency = '$', decimals = 2): string => {
    const val = parseFloat(String(amount));
    if (isNaN(val)) return `${currency} 0${decimals > 0 ? ',' + '0'.repeat(decimals) : ''}`;

    return `${currency} ${val.toLocaleString(LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};

/** COP: entero redondeado, miles con punto. Ej: "COP 15.261.884" */
export const formatCOP = (amount: number | string): string => {
    const val = parseFloat(String(amount));
    if (isNaN(val)) return 'COP 0';
    return `COP ${Math.round(val).toLocaleString(LOCALE)}`;
};

/** VES: entero redondeado, miles con punto. Ej: "Bs 1.128.815" */
export const formatVES = (amount: number | string): string => {
    const val = parseFloat(String(amount));
    if (isNaN(val)) return 'Bs 0';
    return `Bs ${Math.round(val).toLocaleString(LOCALE)}`;
};

/** USD: siempre 2 decimales. Ej: "$ 1.320,50" */
export const formatUSD = (amount: number | string): string => formatMoney(amount, '$', 2);

/** Formatea según el código de moneda del sistema (USD/COP/VES). */
export const formatByCurrency = (amount: number | string, currency: string): string => {
    if (currency === 'COP') return formatCOP(amount);
    if (currency === 'VES') return formatVES(amount);
    return formatUSD(amount);
};

/** Fecha con hora. Ej: "12 jul 2026, 3:45 p.m." */
export const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString(LOCALE, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/** Fecha corta sin hora. Ej: "12/7/2026" */
export const formatDateShort = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(LOCALE);
};
