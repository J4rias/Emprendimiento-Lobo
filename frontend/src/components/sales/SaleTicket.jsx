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

  // Building ticket HTML
  const ticketHTML = `
    <div style="width: 100%; padding: 1mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.2; color: #000;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">${name.toUpperCase()}</div>
        ${ruc || companyInfo.tax_id ? `<div style="font-size: 12px; font-weight: bold;">RIF: ${ruc || companyInfo.tax_id}</div>` : ''}
        ${address ? `<div style="font-size: 10px; margin-top: 2px;">${address}</div>` : ''}
        ${phone || email ? `<div style="font-size: 10px;">${phone ? `Tel: ${phone}` : ''} ${email ? `| ${email}` : ''}</div>` : ''}
      </div>

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Sale Info -->
      <div style="margin-bottom: 8px; font-size: 11px;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 4px;">NOTA DE ENTREGA</div>
        <div><strong>Nro:</strong> ${sale.sale_number || ''}</div>
        <div><strong>Fecha:</strong> ${formatDate(sale.sale_date || new Date())}</div>
        
        ${sale.customer ? `
          <div style="margin-top: 4px; border-top: 0.5px solid #eee; pt: 2px;">
            <div><strong>Cliente:</strong> ${sale.customer.name || (sale.customer.first_name ? `${sale.customer.first_name} ${sale.customer.last_name}` : 'GENERAL')}</div>
            ${sale.customer.address ? `<div style="font-size: 10px;"><strong>Dir:</strong> ${sale.customer.address}</div>` : ''}
            ${sale.customer.document_number ? `<div><strong>Doc:</strong> ${sale.customer.document_number}</div>` : ''}
          </div>
        ` : '<div><strong>Cliente:</strong> CONSUMIDOR FINAL</div>'}
        
        <div style="margin-top: 4px;"><strong>Vendedor:</strong> ${sale.creator?.full_name || sale.creator?.username || 'N/A'}</div>
      </div>

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Products -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #000; padding: 2px 0;">PRODUCTO</th>
            <th style="text-align: center; border-bottom: 1px solid #000; padding: 2px 0;">CANT</th>
            <th style="text-align: right; border-bottom: 1px solid #000; padding: 2px 0;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${sale.details?.map(detail => `
            <tr>
              <td style="padding: 4px 0; vertical-align: top; width: 60%;">
                <div style="font-weight: bold; line-height: 1.1; margin-bottom: 1px;">
                  ${detail.product?.name || 'Producto'}
                </div>
                ${detail.presentation?.name ? `<div style="font-size: 9px; color: #444;">${detail.presentation.name}</div>` : ''}
                <div style="font-size: 9px;">${formatCurrency(detail.unit_price || 0)} x ud.</div>
              </td>
              <td style="text-align: center; padding: 4px 0; vertical-align: top; width: 15%;">${detail.quantity || 0}</td>
              <td style="text-align: right; padding: 4px 0; vertical-align: top; width: 25%; font-weight: bold;">${formatCurrency(detail.total || 0)}</td>
            </tr>
          `).join('') || ''}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Totals -->
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; font-weight: bold; border-top: 1px solid #000;">
          <span>TOTAL:</span>
          <span>${formatCurrency(subtotal - discount)}</span>
        </div>
      </div>

      ${sale.sale_type === 'cash' ? `
        <div style="margin-bottom: 8px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; padding: 1px 0;">
            <span>Efectivo:</span>
            <span>${formatCurrency(paid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1px 0;">
            <span>Cambio:</span>
            <span>${formatCurrency(change)}</span>
          </div>
        </div>
      ` : `
        <div style="margin-bottom: 8px; text-align: center; font-weight: bold;">
          *** VENTA A CRÉDITO ***
        </div>
      `}

      ${sale.notes ? `
        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
        <div style="margin-bottom: 8px;">
          <div style="font-size: 10px;"><strong>Notas:</strong> ${sale.notes}</div>
        </div>
      ` : ''}

      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 8px; font-size: 10px;">
        <div style="font-weight: bold;">¡GRACIAS POR SU COMPRA!</div>
        <div style="margin-top: 3px;">Este documento no tiene valor tributario</div>
        <div style="margin-top: 8px; font-size: 9px; color: #666;">
          Fecha de impresión: ${formatDate(new Date())}
        </div>
      </div>
    </div>
  `;

  printHTML(ticketHTML, `Ticket ${sale.sale_number}`);
};

export default printSaleTicket;
