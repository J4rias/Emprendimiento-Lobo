/**
 * Standard utility for formatting monetary values.
 * Uses dot for thousands and comma for decimals by default.
 */

/**
 * Formats a number or string as money.
 * @param {number|string} amount - The amount to format
 * @param {string} currency - The currency symbol (default: '$')
 * @returns {string} Formatted string
 */
export const formatMoney = (amount, currency = '$', decimals = 2) => {
    const val = parseFloat(amount);
    if (isNaN(val)) return `${currency} 0${decimals > 0 ? ',' + '0'.repeat(decimals) : ''}`;

    return `${currency} ${val.toLocaleString('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};

/**
 * Formats a date string to a more readable format.
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
