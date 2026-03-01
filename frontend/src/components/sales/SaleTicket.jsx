import {
  printHTML,
  formatCurrency,
  formatDate,
  centerText,
  separator,
  twoColumn
} from '../../utils/printUtils';

/**
 * Generate and print sale ticket
 * @param {object} sale - Sale object with details
 * @param {object} companyInfo - Company information
 */
export const printSaleTicket = (sale, companyInfo = {}) => {
  const {
    name = 'EMPRENDIMIENTO LOBO',
    address = '',
    phone = '',
    email = '',
    ruc = ''
  } = companyInfo;

  // Calculate totals
  const subtotal = parseFloat(sale.subtotal || 0);
  const discount = parseFloat(sale.discount_amount || 0);
  const tax = parseFloat(sale.tax_amount || 0);
  const total = parseFloat(sale.total || 0);
  const paid = parseFloat(sale.paid_amount || 0);
  const change = parseFloat(sale.change_amount || 0);

  // Build ticket HTML
  const ticketHTML = `
    <div style="width: 80mm; padding: 5mm; font-family: 'Courier New', monospace; font-size: 12px;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="font-size: 16px; font-weight: bold;">${name}</div>
        ${address ? `<div style="font-size: 10px;">${address}</div>` : ''}
        ${phone ? `<div style="font-size: 10px;">Tel: ${phone}</div>` : ''}
        ${email ? `<div style="font-size: 10px;">${email}</div>` : ''}
        ${ruc ? `<div style="font-size: 10px;">RUC: ${ruc}</div>` : ''}
      </div>

      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

      <!-- Sale Info -->
      <div style="margin-bottom: 10px;">
        <div><strong>TICKET DE VENTA</strong></div>
        <div>Nro: ${sale.sale_number || ''}</div>
        <div>Fecha: ${formatDate(sale.sale_date || new Date())}</div>
        ${sale.customer ? `<div>Cliente: ${sale.customer.name}</div>` : ''}
        ${sale.warehouse ? `<div>Almacén: ${sale.warehouse.name}</div>` : ''}
        <div>Vendedor: ${sale.creator?.full_name || sale.creator?.username || 'N/A'}</div>
        <div>Tipo: ${sale.sale_type === 'cash' ? 'CONTADO' : 'CRÉDITO'}</div>
      </div>

      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

      <!-- Products -->
      <table style="width: 100%; margin-bottom: 10px; font-size: 11px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #000; padding: 2px 0;">Producto</th>
            <th style="text-align: center; border-bottom: 1px solid #000; padding: 2px 0;">Cant</th>
            <th style="text-align: right; border-bottom: 1px solid #000; padding: 2px 0;">P.Unit</th>
            <th style="text-align: right; border-bottom: 1px solid #000; padding: 2px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.details?.map(detail => `
            <tr>
              <td style="padding: 4px 0; vertical-align: top;">
                ${detail.product?.name || 'Producto'}
                ${detail.presentation?.name ? `<br><small style="font-size: 9px;">${detail.presentation.name}</small>` : ''}
              </td>
              <td style="text-align: center; padding: 4px 0; vertical-align: top;">${detail.quantity || 0}</td>
              <td style="text-align: right; padding: 4px 0; vertical-align: top;">${formatCurrency(detail.unit_price || 0)}</td>
              <td style="text-align: right; padding: 4px 0; vertical-align: top;">${formatCurrency(detail.total || 0)}</td>
            </tr>
          `).join('') || ''}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

      <!-- Totals -->
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; font-weight: bold; border-top: 1px solid #000;">
          <span>TOTAL:</span>
          <span>${formatCurrency(subtotal - discount)}</span>
        </div>
      </div>

      ${sale.sale_type === 'cash' ? `
        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Efectivo:</span>
            <span>${formatCurrency(paid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Cambio:</span>
            <span>${formatCurrency(change)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Método:</span>
            <span>${sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'card' ? 'Tarjeta' : 'Otro'}</span>
          </div>
        </div>
      ` : ''}

      ${sale.notes ? `
        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
        <div style="margin-bottom: 10px;">
          <div><strong>Notas:</strong></div>
          <div style="font-size: 10px;">${sale.notes}</div>
        </div>
      ` : ''}

      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 10px; font-size: 10px;">
        <div>¡Gracias por su compra!</div>
        <div style="margin-top: 5px;">Este documento no tiene valor tributario</div>
        <div style="margin-top: 10px; font-size: 9px;">
          Impreso: ${formatDate(new Date())}
        </div>
      </div>
    </div>
  `;

  printHTML(ticketHTML, `Ticket ${sale.sale_number}`);
};

export default printSaleTicket;
