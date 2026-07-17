import html2canvas from 'html2canvas';

/**
 * Print utilities for tickets and invoices
 */

interface PrinterSettings {
  width: string;
  margin: string;
  zoom: string;
}

interface PortablePrinterSettings {
  width: string;
  fontSize: string;
}

/**
 * Print HTML content via browser print dialog (desktop)
 */
export const printHTML = (content: string, title = 'Imprimir'): void => {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes para imprimir');
    return;
  }

  const printerSettings: PrinterSettings = JSON.parse(localStorage.getItem('pos_printer_settings') || '{"width": "72mm", "margin": "0mm", "zoom": "1.0"}');
  const width = printerSettings.width || '72mm';
  const margin = printerSettings.margin || '0mm';
  const zoom = printerSettings.zoom || '1.0';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.1;
            color: #000;
            background: #fff;
            width: ${width};
            max-width: ${width};
            overflow: hidden;
            zoom: ${zoom};
            image-rendering: pixelated;
          }

          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${width} !important;
              max-width: ${width} !important;
              overflow: hidden !important;
            }

            .no-print {
              display: none !important;
            }
          }

          @page {
            margin: 0 !important;
            size: ${width} auto;
          }

          /* Evitar que el navegador corte palabras de forma brusca */
          div, p, td, th {
            overflow-wrap: break-word;
            word-wrap: break-word;
            hyphens: auto;
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            // Un pequeño delay para asegurar que los estilos carguen
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};

/**
 * Format currency for printing
 */
export const formatCurrency = (amount: number | string, currency = '$'): string => {
  const val = parseFloat(String(amount));
  if (isNaN(val)) return `${currency} 0,00`;

  return `${currency} ${val.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Format date for printing
 */
export const formatDate = (date: string | Date): string => {
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
 */
export const centerText = (text: string, width = 48): string => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
};

/**
 * Create separator line
 */
export const separator = (width = 48, char = '-'): string => {
  return char.repeat(width);
};

/**
 * Align text to right
 */
export const alignRight = (text: string, width = 48): string => {
  const padding = Math.max(0, width - text.length);
  return ' '.repeat(padding) + text;
};

/**
 * Create two-column line (label on left, value on right)
 */
export const twoColumn = (label: string, value: string, width = 48): string => {
  const spacing = Math.max(1, width - label.length - value.length);
  return label + ' '.repeat(spacing) + value;
};

/**
 * Print HTML content via RawBT (portable Bluetooth thermal printer).
 * Renders the ticket HTML into a canvas, converts to base64 image,
 * and sends to RawBT via its rawbt: URI scheme.
 */
export const printPortable = async (content: string): Promise<void> => {
  const portableSettings: PortablePrinterSettings = JSON.parse(
    localStorage.getItem('pos_printer_portable_settings') || '{"width": "72mm", "fontSize": "13px"}'
  );
  const width = portableSettings.width || '72mm';
  const fontSize = portableSettings.fontSize || '13px';
  // Parse width to pixels (1mm ≈ 3.78px at 96dpi)
  const widthPx = Math.round(parseFloat(width) * 3.78);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: ${widthPx}px; max-width: ${widthPx}px;
    background: #fff; color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: ${fontSize}; line-height: 1.1;
    padding: 4px; box-sizing: border-box;
    overflow: hidden;
  `;
  container.innerHTML = content;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: widthPx,
      windowWidth: widthPx,
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');
    // RawBT accepts rawbt: URI with base64 image
    window.location.href = 'rawbt:' + dataUrl;
  } catch (err) {
    console.error('Error generating portable print image:', err);
    alert('Error al generar imagen para impresión portátil');
  } finally {
    document.body.removeChild(container);
  }
};
