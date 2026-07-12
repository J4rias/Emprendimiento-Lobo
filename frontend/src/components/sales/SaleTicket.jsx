import {
  printHTML,
  printPortable,
  formatCurrency,
  formatDate,
  centerText,
  separator,
  twoColumn
} from '../../utils/printUtils';

/**
 * Build ticket HTML string (shared by desktop and portable print)
 */
const buildTicketHTML = (sale, companyInfo = {}, printOptions = {}) => {
  const {
    displayCurrency = 'USD',
    currencySymbol = '$',
    exchangeRate = 1
  } = printOptions;

  const isCOP = displayCurrency === 'COP';
  const tFormat = (amount) => {
    const val = parseFloat(amount || 0) * exchangeRate;
    if (isCOP) {
      const rounded = Math.round(val);
      return `${currencySymbol} ${rounded.toLocaleString('de-DE')}`;
    }
    const roundedVal = Math.round(val * 100) / 100;
    return `${currencySymbol} ${roundedVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const subtotal = parseFloat(sale.subtotal || 0);
  const discount = parseFloat(sale.discount_amount || 0);

  return `
    <div style="width: 100%; max-width: 100%; padding: 0; margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.1; color: #000; overflow: hidden;">
      <!-- Sale Info -->
      <div style="margin-bottom: 8px; font-size: 13px;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 4px;">PRESUPUESTO</div>
        <div><strong>Nro:</strong> ${(sale.sale_number || '').replace(/^VEN/, 'PRE')}</div>
        <div><strong>Fecha:</strong> ${formatDate(sale.sale_date || new Date())}</div>

        ${sale.customer ? `
          <div style="margin-top: 4px; border-top: 1px solid #000; pt: 2px;">
            <div><strong>Cliente:</strong> ${sale.customer.business_name || sale.customer.businessName || `${sale.customer.first_name || sale.customer.firstName || ''} ${sale.customer.last_name || sale.customer.lastName || ''}`.trim() || 'GENERAL'}</div>
            ${sale.customer.address ? `<div style="font-size: 11px;"><strong>Dir:</strong> ${sale.customer.address}</div>` : ''}
            ${(sale.customer.document_number || sale.customer.documentNumber) ? `<div><strong>Doc:</strong> ${(sale.customer.document_type || sale.customer.documentType) ? (sale.customer.document_type || sale.customer.documentType) + '-' : ''}${sale.customer.document_number || sale.customer.documentNumber}</div>` : ''}
          </div>
        ` : '<div><strong>Cliente:</strong> CONSUMIDOR FINAL</div>'}

        <div style="margin-top: 4px;"><strong>Vendedor:</strong> ${sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}`.trim() : 'N/A'}</div>
      </div>

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Products -->
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 13px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 2px solid #000; padding: 2px 0;">PRODUCTO</th>
            <th style="text-align: center; border-bottom: 2px solid #000; padding: 2px 0;">CANT</th>
            <th style="text-align: right; border-bottom: 2px solid #000; padding: 2px 0;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${sale.details?.map(detail => {
    const isUnit = detail.is_unit;
    const unitLabel = isUnit ? 'Ud' : 'Paq';
    return `
            <tr>
              <td style="padding: 4px 0; vertical-align: top; width: 55%;">
                <div style="font-weight: bold; line-height: 1.1; margin-bottom: 1px;">
                  ${detail.product?.name || 'Producto'}
                </div>
              </td>
              <td style="text-align: center; padding: 4px 0; vertical-align: top; width: 20%; font-size: 12px;">
                <div>${Math.round(detail.quantity || 0)} ${unitLabel}</div>
                <div style="font-size: 10px;">x ${tFormat(detail.unit_price || 0)}</div>
              </td>
              <td style="text-align: right; padding: 4px 0; vertical-align: top; width: 25%; font-weight: bold;">
                <div style="margin-top: 2px;">${tFormat(detail.total || 0)}</div>
              </td>
            </tr>
          `}).join('') || ''}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Totals -->
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 16px; font-weight: bold; border-top: 2px solid #000;">
          <span>TOTAL:</span>
          <span>${tFormat(subtotal - discount)}</span>
        </div>
      </div>

      <div style="margin-bottom: 8px; text-align: center; font-weight: bold; font-size: 14px;">
        ${sale.sale_type === 'cash' ? '*** APROBADO ***' : '*** PENDIENTE ***'}
      </div>

      ${sale.notes ? `
        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px;"><strong>Notas:</strong> ${sale.notes}</div>
        </div>
      ` : ''}

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 8px; font-size: 11px;">
        <div style="margin-top: 8px; font-size: 10px;">
          Fecha de impresión: ${formatDate(new Date())}
        </div>
      </div>
    </div>
  `;
};

/**
 * Print sale ticket via browser print dialog (desktop)
 */
export const printSaleTicket = (sale, companyInfo = {}, printOptions = {}) => {
  const ticketHTML = buildTicketHTML(sale, companyInfo, printOptions);
  printHTML(ticketHTML, `Ticket ${sale.sale_number}`);
};

/**
 * Print sale ticket via RawBT (portable Bluetooth thermal printer)
 */
export const printSaleTicketPortable = (sale, companyInfo = {}, printOptions = {}) => {
  const ticketHTML = buildTicketHTML(sale, companyInfo, printOptions);
  printPortable(ticketHTML);
};

export default printSaleTicket;
