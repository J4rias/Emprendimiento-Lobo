/**
 * Contrato del schema de recepción de mercancía.
 *
 * Regresión de la migración TS+Zod (e2fa0e9): el schema exigía
 * `purchase_order_detail_id` / `package_quantity_received` mientras el
 * frontend (PurchaseOrderReceivePage) y el controller usan
 * `detail_id` / `package_quantity` / `loose_units`, por lo que TODO
 * POST /:id/receive respondía 400. Estos tests fijan el contrato real.
 */
const { ReceiveMerchandiseSchema } = require('../schemas/purchaseOrder.schema');

describe('ReceiveMerchandiseSchema — contrato con el frontend', () => {
  it('acepta el payload exacto que envía PurchaseOrderReceivePage', () => {
    // Forma generada en PurchaseOrderReceivePage.jsx handleFinalSubmit()
    const payload = {
      received_items: [
        {
          detail_id: 12,
          package_quantity: 5,
          loose_units: 3,
          batch_number: null,
          manufacture_date: null,
          expiry_date: null,
        },
      ],
      invoice_number: 'FAC-00123',
      notes: '',
    };
    const result = ReceiveMerchandiseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('acepta recepción con lote y fechas', () => {
    const payload = {
      received_items: [
        {
          detail_id: 7,
          package_quantity: 0,
          loose_units: 24,
          batch_number: 'L-2026-07',
          manufacture_date: '2026-06-01',
          expiry_date: '2027-06-01',
        },
      ],
      invoice_number: 'FAC-00124',
    };
    expect(ReceiveMerchandiseSchema.safeParse(payload).success).toBe(true);
  });

  it('rechaza items sin detail_id', () => {
    const payload = {
      received_items: [{ package_quantity: 5, loose_units: 0 }],
      invoice_number: 'FAC-00125',
    };
    expect(ReceiveMerchandiseSchema.safeParse(payload).success).toBe(false);
  });

  it('rechaza received_items vacío', () => {
    const payload = { received_items: [], invoice_number: 'FAC-00126' };
    expect(ReceiveMerchandiseSchema.safeParse(payload).success).toBe(false);
  });

  it('rechaza cantidades negativas', () => {
    const payload = {
      received_items: [{ detail_id: 1, package_quantity: -2, loose_units: 0 }],
    };
    expect(ReceiveMerchandiseSchema.safeParse(payload).success).toBe(false);
  });
});
