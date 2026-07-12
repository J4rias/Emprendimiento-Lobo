/**
 * Formatters estándar del sistema.
 *
 * Reglas de negocio (no cambiar sin revisar el resto del sistema):
 *  - VES y COP: enteros (Math.ceil), separador de miles con punto, locale es-VE.
 *  - USD: siempre 2 decimales.
 *  - Fechas: locale es-VE.
 */

const LOCALE = 'es-VE';

/**
 * Formats a number or string as money.
 * @param {number|string} amount - The amount to format
 * @param {string} currency - The currency symbol (default: '$')
 * @returns {string} Formatted string
 */
export const formatMoney = (amount, currency = '$', decimals = 2) => {
    const val = parseFloat(amount);
    if (isNaN(val)) return `${currency} 0${decimals > 0 ? ',' + '0'.repeat(decimals) : ''}`;

    return `${currency} ${val.toLocaleString(LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};

/** COP: entero redondeado hacia arriba, miles con punto. Ej: "COP 15.261.884" */
export const formatCOP = (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val)) return 'COP 0';
    return `COP ${Math.ceil(val).toLocaleString(LOCALE)}`;
};

/** VES: entero redondeado hacia arriba, miles con punto. Ej: "Bs 1.128.815" */
export const formatVES = (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val)) return 'Bs 0';
    return `Bs ${Math.ceil(val).toLocaleString(LOCALE)}`;
};

/** USD: siempre 2 decimales. Ej: "$ 1.320,50" */
export const formatUSD = (amount) => formatMoney(amount, '$', 2);

/** Formatea según el código de moneda del sistema (USD/COP/VES). */
export const formatByCurrency = (amount, currency) => {
    if (currency === 'COP') return formatCOP(amount);
    if (currency === 'VES') return formatVES(amount);
    return formatUSD(amount);
};

/**
 * Formats a date string to a more readable format (con hora).
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
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
export const formatDateShort = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(LOCALE);
};
