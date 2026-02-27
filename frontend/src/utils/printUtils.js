/**
 * Print utilities for tickets and invoices
 */

/**
 * Print HTML content
 * @param {string} content - HTML content to print
 * @param {string} title - Document title
 */
export const printHTML = (content, title = 'Imprimir') => {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes para imprimir');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }

            .no-print {
              display: none !important;
            }
          }

          @page {
            margin: 0;
            size: 80mm auto;
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            window.print();
            // Close window after printing or canceling
            setTimeout(function() {
              window.close();
            }, 100);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};

/**
 * Format currency for printing
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount, currency = '$') => {
  return `${currency} ${parseFloat(amount).toFixed(2)}`;
};

/**
 * Format date for printing
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Center text for thermal printer (80mm = ~48 chars)
 * @param {string} text - Text to center
 * @param {number} width - Line width in characters
 * @returns {string} Centered text
 */
export const centerText = (text, width = 48) => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
};

/**
 * Create separator line
 * @param {number} width - Line width
 * @param {string} char - Character to use
 * @returns {string} Separator line
 */
export const separator = (width = 48, char = '-') => {
  return char.repeat(width);
};

/**
 * Align text to right
 * @param {string} text - Text to align
 * @param {number} width - Line width
 * @returns {string} Right-aligned text
 */
export const alignRight = (text, width = 48) => {
  const padding = Math.max(0, width - text.length);
  return ' '.repeat(padding) + text;
};

/**
 * Create two-column line (label on left, value on right)
 * @param {string} label - Left text
 * @param {string} value - Right text
 * @param {number} width - Total width
 * @returns {string} Two-column line
 */
export const twoColumn = (label, value, width = 48) => {
  const spacing = Math.max(1, width - label.length - value.length);
  return label + ' '.repeat(spacing) + value;
};
