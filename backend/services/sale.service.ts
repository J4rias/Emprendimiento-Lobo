import { Op } from 'sequelize';
import Sale from '../models/Sale';
import SaleDetail from '../models/SaleDetail';
import SalePayment from '../models/SalePayment';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import Customer from '../models/Customer';
import Warehouse from '../models/Warehouse';
import User from '../models/User';
import Inventory from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import PosReservation from '../models/PosReservation';
import ExchangeRate from '../models/ExchangeRate';

const logger = require('../config/logger');
const { sequelize } = require('../config/database');

/** Error class that carries an HTTP status for the controller to use */
export class ServiceError extends Error {
  status: number;
  extra?: Record<string, any>;

  constructor(status: number, message: string, extra?: Record<string, any>) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.extra = extra;
  }
}

// ─── Number generation ──────────────────────────────────────────────────────

export async function generateSaleNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const prefix = `VEN-${year}${month}${day}`;

  const lastSale = await Sale.findOne({
    where: { sale_number: { [Op.like]: `${prefix}%` } },
    order: [['sale_number', 'DESC']]
  }) as any;

  let sequence = 1;
  if (lastSale) {
    const lastSequence = parseInt(lastSale.sale_number.split('-').pop());
    sequence = lastSequence + 1;
  }
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

// ─── createSale ─────────────────────────────────────────────────────────────

export interface CreateSaleInput {
  customer_id?: number;
  warehouse_id: number;
  sale_type: string;
  currency_mode?: string;
  payment_lines?: any[];
  items: any[];
  discount_amount?: number;
  notes?: string;
  quote_id?: number;
  exchange_rate?: number;
  authorized_by?: number;
  session_id?: string;
  tab_id?: string;
}

export interface CreateSaleResult {
  sale: any;
  /** product_ids whose reservations should be re-broadcast after commit */
  affectedProductIds: number[];
}

/**
 * Create a sale with all associated details, payments and inventory movements.
 * Throws ServiceError on business-rule violations (status 400/403/404/409).
 * The caller is responsible for emitting socket.io events with affectedProductIds.
 */
export async function createSale(
  input: CreateSaleInput,
  userId: number,
  userRole?: string
): Promise<CreateSaleResult> {
  const {
    customer_id,
    warehouse_id,
    sale_type,
    currency_mode = 'COP',
    payment_lines = [],
    items,
    discount_amount = 0,
    notes,
    quote_id,
    exchange_rate = 1,
    authorized_by,
    session_id,
    tab_id
  } = input;

  const transaction = await sequelize.transaction();

  try {
    // Validate authorization for credit / mixed sales
    if (sale_type === 'credit' || sale_type === 'mixed') {
      const isAdmin = userRole === 'Administrador';
      if (!isAdmin && !authorized_by) {
        await transaction.rollback();
        throw new ServiceError(403, 'Venta a crédito requiere autorización de un administrador');
      }
    }

    const cashLines = payment_lines.filter((l: any) => l.method !== 'credit');
    const creditLines = payment_lines.filter((l: any) => l.method === 'credit');

    let paid_amount = 0;
    if ((sale_type === 'cash' || sale_type === 'mixed') && cashLines.length > 0) {
      paid_amount = cashLines.reduce((sum: number, line: any) => {
        const amount = parseFloat(line.amount) || 0;
        if (amount <= 0) return sum;
        const rate = parseFloat(line.exchange_rate) || 1;
        return sum + (amount / rate);
      }, 0);
    }

    let credit_amount = 0;
    if ((sale_type === 'credit' || sale_type === 'mixed') && creditLines.length > 0) {
      credit_amount = creditLines.reduce((sum: number, line: any) => {
        const amount = parseFloat(line.amount) || 0;
        const rate = parseFloat(line.exchange_rate) || 1;
        return sum + (amount / rate);
      }, 0);
    }

    if (!items || items.length === 0) {
      await transaction.rollback();
      throw new ServiceError(400, 'La venta debe tener al menos un producto');
    }

    if (!warehouse_id) {
      await transaction.rollback();
      throw new ServiceError(400, 'Debe especificar el depósito');
    }

    const sale_number = await generateSaleNumber();

    // Batch pre-fetch to eliminate N+1 queries in the item loop
    const productIds = [...new Set<number>(items.map((i: any) => i.product_id))];
    const presentationIds = [...new Set<number>(items.map((i: any) => i.presentation_id))];

    const [productRows, presentationRows, inventoryRows] = await Promise.all([
      Product.findAll({ where: { id: { [Op.in]: productIds } } }),
      ProductPresentation.findAll({ where: { id: { [Op.in]: presentationIds } } }),
      Inventory.findAll({
        where: { product_id: { [Op.in]: productIds }, warehouse_id },
        lock: transaction.LOCK.UPDATE,
        transaction
      })
    ]);

    const productMap = new Map<number, any>((productRows as any[]).map((p: any) => [p.id, p]));
    const presentationMap = new Map<number, any>((presentationRows as any[]).map((p: any) => [p.id, p]));
    const inventoryMap = new Map<number, any>((inventoryRows as any[]).map((i: any) => [i.product_id, i]));

    const reservationMap = new Map<number, number>();
    if (session_id && tab_id) {
      const reservRows = await (PosReservation as any).findAll({
        attributes: [
          'product_id',
          [sequelize.fn('SUM', sequelize.col('units_reserved')), 'total']
        ],
        where: {
          product_id: { [Op.in]: productIds },
          expires_at: { [Op.gte]: new Date() },
          [Op.or]: [
            { session_id: { [Op.ne]: session_id } },
            { tab_id: { [Op.ne]: tab_id } }
          ]
        },
        group: ['product_id'],
        raw: true,
        transaction
      }) as any[];
      for (const row of reservRows) {
        reservationMap.set(Number(row.product_id), Number(row.total) || 0);
      }
    }

    let subtotal = 0;
    let tax_amount = 0;
    const saleDetails: any[] = [];
    const inventoryMovements: any[] = [];
    let vesUsdRate: number | null = null;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        await transaction.rollback();
        throw new ServiceError(404, `Producto ${item.product_id} no encontrado`);
      }

      const presentation = presentationMap.get(item.presentation_id);
      if (!presentation) {
        await transaction.rollback();
        throw new ServiceError(404, `Presentación ${item.presentation_id} no encontrada`);
      }

      const inventory = inventoryMap.get(item.product_id);

      if (!inventory) {
        await transaction.rollback();
        throw new ServiceError(400, `No hay registro de inventario para ${product.name}`);
      }

      const unit_price = item.unit_price || presentation.base_price;
      const is_unit = item.is_unit || false;
      const item_subtotal = unit_price * item.quantity;
      const item_discount = item.discount_percent ? (item_subtotal * item.discount_percent / 100) : 0;
      const taxable_amount = item_subtotal - item_discount;
      const item_tax = taxable_amount * (item.tax_percent || 0) / 100;
      const item_total = taxable_amount + item_tax;

      subtotal += item_subtotal;
      tax_amount += item_tax;

      const units_to_deduct = is_unit ? item.quantity : (item.quantity * (presentation.units_per_package || 1));

      // Validate stock considering OTHER tabs' reservations only (pre-fetched in batch above)
      const reserved_by_others = reservationMap.get(item.product_id) ?? 0;

      const available = parseFloat(inventory.quantity) - Number(reserved_by_others);

      if (available < units_to_deduct) {
        await transaction.rollback();
        throw new ServiceError(409, `Stock insuficiente para ${product.name}. Otro vendedor reservó parte del stock.`, {
          conflict: true,
          product_name: product.name,
          available: Math.max(0, available),
          requested: units_to_deduct,
          reserved_by_others: Number(reserved_by_others)
        });
      }

      // Calculate cost_price in USD
      const rawCost = parseFloat(is_unit ? presentation.cost : presentation.package_cost) || 0;
      let costPrice: number | null = null;
      if (rawCost > 0) {
        if (presentation.purchase_currency === 'COP' && exchange_rate > 1) {
          costPrice = rawCost / exchange_rate;
        } else if (presentation.purchase_currency === 'VES') {
          if (vesUsdRate === null) {
            try { vesUsdRate = await (ExchangeRate as any).getRate('VES', 'USD'); }
            catch (e) { vesUsdRate = 0; }
          }
          costPrice = vesUsdRate! > 0 ? rawCost * vesUsdRate! : null;
        } else {
          costPrice = rawCost;
        }
      }

      saleDetails.push({
        product_id: item.product_id,
        presentation_id: item.presentation_id,
        batch_id: item.batch_id || null,
        quantity: item.quantity,
        is_unit,
        unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item_discount,
        tax_percent: item.tax_percent || 0,
        tax_amount: item_tax,
        subtotal: item_subtotal,
        total: item_total,
        cost_price: costPrice,
        notes: item.notes || null
      });

      await inventory.update({ quantity: parseFloat(inventory.quantity) - units_to_deduct }, { transaction });

      inventoryMovements.push({
        product_id: item.product_id,
        warehouse_id,
        presentation_id: item.presentation_id,
        movement_type: 'egreso',
        quantity: units_to_deduct,
        unit_cost: presentation.cost || null,
        package_cost: presentation.package_cost || null,
        currency: presentation.purchase_currency || 'USD',
        reason: `Venta ${sale_number}`,
        document_number: sale_number,
        user_id: userId
      });
    }

    if (inventoryMovements.length > 0) {
      await InventoryMovement.bulkCreate(inventoryMovements as any[], { transaction });
    }

    const total = subtotal - discount_amount + tax_amount;
    const change_amount = sale_type === 'cash' ? Math.max(0, paid_amount - total) : 0;

    if (sale_type === 'cash' && paid_amount > 0 && paid_amount < total - 0.05) {
      await transaction.rollback();
      throw new ServiceError(400, `Pago insuficiente. Total: $${total.toFixed(2)}, Pagado: $${paid_amount.toFixed(2)}`);
    }

    if (sale_type === 'credit') {
      credit_amount = total;
    }

    let credit_due_date: Date | null = null;
    if ((sale_type === 'credit' || sale_type === 'mixed') && customer_id && credit_amount > 0) {
      const customer = await Customer.findByPk(customer_id, { transaction }) as any;
      if (!customer) {
        await transaction.rollback();
        throw new ServiceError(404, 'Cliente no encontrado');
      }

      const currentCreditUsed = parseFloat(customer.credit_used || 0);
      await customer.update({ credit_used: currentCreditUsed + credit_amount }, { transaction });

      const creditDays = parseInt(customer.credit_days) || 0;
      if (creditDays > 0) {
        credit_due_date = new Date();
        credit_due_date.setDate(credit_due_date.getDate() + creditDays);
      }
    }

    const saleDate = new Date();
    const sale = await Sale.create({
      sale_number,
      customer_id: customer_id || null,
      warehouse_id,
      user_id: userId,
      sale_date: saleDate,
      sale_type,
      currency_mode,
      exchange_rate,
      payment_method: sale_type === 'cash' && cashLines.length > 0 ? cashLines[0].method : null,
      subtotal,
      tax_amount,
      discount_amount,
      total,
      credit_amount,
      credit_due_date,
      paid_amount: (sale_type === 'cash' || sale_type === 'mixed') ? paid_amount : 0,
      change_amount,
      status: sale_type === 'cash' ? 'completed' : 'pending',
      notes,
      quote_id: quote_id || null,
      created_by: userId,
      authorized_by: (sale_type === 'credit' || sale_type === 'mixed')
        ? (userRole === 'Administrador' ? userId : authorized_by)
        : null
    } as any, { transaction }) as any;

    if (saleDetails.length > 0) {
      await SaleDetail.bulkCreate(
        saleDetails.map((d: any) => ({ sale_id: sale.id, ...d })) as any[],
        { transaction }
      );
    }

    if ((sale_type === 'cash' || sale_type === 'mixed') && cashLines.length > 0) {
      const paymentBatch: any[] = [];
      let creditBalanceDeductionUSD = 0;

      for (const payLine of cashLines) {
        if (parseFloat(payLine.amount) === 0) continue;
        paymentBatch.push({
          sale_id: sale.id,
          payment_date: new Date(),
          payment_method: payLine.method || 'cash',
          amount: payLine.amount,
          currency: payLine.currency || 'USD',
          exchange_rate: payLine.exchange_rate || 1,
          reference: payLine.reference || null,
          bank_id: payLine.bank_id || null,
          created_by: userId
        });
        if (payLine.method === 'credit_balance' && customer_id) {
          creditBalanceDeductionUSD += parseFloat(payLine.amount) / (parseFloat(payLine.exchange_rate) || 1);
        }
      }

      if (paymentBatch.length > 0) {
        await SalePayment.bulkCreate(paymentBatch as any[], { transaction });
      }

      if (creditBalanceDeductionUSD > 0 && customer_id) {
        const customer = await Customer.findByPk(customer_id, { transaction }) as any;
        if (customer) {
          const newBalance = Math.max(0, parseFloat(customer.creditBalance || 0) - creditBalanceDeductionUSD);
          await customer.update({ creditBalance: newBalance }, { transaction });
        }
      }
    }

    await transaction.commit();

    // Return affected product IDs so the controller can emit socket events
    const affectedProductIds: number[] = items.map((item: any) => item.product_id);

    // Load the full sale for the response
    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        {
          model: SaleDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product' },
            { model: ProductPresentation, as: 'presentation' }
          ]
        },
        { model: Customer, as: 'customer' },
        { model: Warehouse, as: 'warehouse' },
        { model: User, as: 'seller' }
      ]
    }) as any;

    return { sale: createdSale, affectedProductIds };

  } catch (error) {
    // Only rollback if the transaction is still active (not already rolled back in validation blocks above)
    try { await transaction.rollback(); } catch (_) { /* already rolled back */ }
    throw error;
  }
}

// ─── cancelSale ─────────────────────────────────────────────────────────────

/**
 * Cancel a sale. Restores inventory and reverts customer credit_used.
 * Throws ServiceError on business-rule violations.
 */
export async function cancelSale(saleId: number, reason: string, userId: number): Promise<any> {
  const transaction = await sequelize.transaction();

  try {
    const sale = await Sale.findByPk(saleId, {
      include: [{
        model: SaleDetail,
        as: 'details',
        include: [{ model: ProductPresentation, as: 'presentation' }]
      }]
    }) as any;

    if (!sale) {
      await transaction.rollback();
      throw new ServiceError(404, 'Venta no encontrada');
    }

    if (sale.status === 'cancelled') {
      await transaction.rollback();
      throw new ServiceError(400, 'La venta ya está cancelada');
    }

    // Batch pre-fetch inventories with row-level locks
    const cancelProductIds = [...new Set<number>(sale.details.map((d: any) => d.product_id))];
    const cancelInvRows = await Inventory.findAll({
      where: { product_id: { [Op.in]: cancelProductIds }, warehouse_id: sale.warehouse_id },
      lock: transaction.LOCK.UPDATE,
      transaction
    }) as any[];
    const cancelInvMap = new Map<number, any>(cancelInvRows.map((i: any) => [i.product_id, i]));
    const cancelMovements: any[] = [];

    for (const detail of sale.details) {
      const inventory = cancelInvMap.get(detail.product_id);

      if (inventory) {
        const units_to_return = detail.is_unit
          ? parseFloat(detail.quantity)
          : (parseFloat(detail.quantity) * (detail.presentation?.units_per_package || 1));

        if (['completed', 'pending', 'partial'].includes(sale.status)) {
          await inventory.update({
            quantity: parseFloat(inventory.quantity) + units_to_return
          }, { transaction });

          cancelMovements.push({
            product_id: detail.product_id,
            warehouse_id: sale.warehouse_id,
            presentation_id: detail.presentation_id,
            movement_type: 'ingreso',
            quantity: units_to_return,
            reason: `Cancelación venta ${sale.sale_number}`,
            document_number: sale.sale_number,
            user_id: userId
          });
        }
      }
    }

    if (cancelMovements.length > 0) {
      await InventoryMovement.bulkCreate(cancelMovements as any[], { transaction });
    }

    if ((sale.sale_type === 'credit' || sale.sale_type === 'mixed') && sale.customer_id) {
      const customer = await Customer.findByPk(sale.customer_id, { transaction }) as any;
      if (customer) {
        const currentCreditUsed = parseFloat(customer.credit_used || 0);
        const creditToRevert = sale.sale_type === 'credit'
          ? parseFloat(sale.total)
          : parseFloat(sale.credit_amount || 0);
        await customer.update({
          credit_used: Math.max(0, currentCreditUsed - creditToRevert)
        }, { transaction });
      }
    }

    await sale.update({
      status: 'cancelled',
      notes: `${sale.notes || ''}\nCANCELADA: ${reason || 'Sin razón especificada'}`,
      updated_by: userId
    }, { transaction });

    // Mark all non-reversed payments as reversed and collect refund info
    const [paymentsToReverse] = await sequelize.query(
      `SELECT id, amount, currency, payment_method FROM sale_payments
       WHERE sale_id = ? AND reversed_at IS NULL`,
      { replacements: [saleId], transaction }
    ) as any[];

    if ((paymentsToReverse as any[]).length > 0) {
      await sequelize.query(
        `UPDATE sale_payments SET reversed_at = NOW(), reversed_by = ?
         WHERE sale_id = ? AND reversed_at IS NULL`,
        { replacements: [userId, saleId], transaction }
      );
    }

    // Build refund summary: only cash payments with positive amounts (what was physically received)
    const refundLines: Array<{ amount: number; currency: string; payment_method: string }> = [];
    for (const p of paymentsToReverse as any[]) {
      if (parseFloat(p.amount) > 0) {
        refundLines.push({
          amount: parseFloat(p.amount),
          currency: p.currency,
          payment_method: p.payment_method
        });
      }
    }

    await transaction.commit();
    return { sale, refund_lines: refundLines };

  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* already rolled back */ }
    throw error;
  }
}

// ─── addPayment ─────────────────────────────────────────────────────────────

export interface AddPaymentResult {
  payments: any[];
  sale: any;
}

/**
 * Add one or more payment lines to a pending credit/mixed sale.
 * Throws ServiceError on business-rule violations.
 */
export async function addPayment(
  saleId: number,
  payment_lines: any[],
  notes: string | null,
  userId: number
): Promise<AddPaymentResult> {
  const transaction = await sequelize.transaction();

  try {
    const sale = await Sale.findByPk(saleId) as any;

    if (!sale) {
      await transaction.rollback();
      throw new ServiceError(404, 'Venta no encontrada');
    }

    if (!['credit', 'mixed'].includes(sale.sale_type)) {
      await transaction.rollback();
      throw new ServiceError(400, 'Solo se pueden agregar pagos a ventas a crédito o mixtas');
    }

    if (sale.status === 'cancelled') {
      await transaction.rollback();
      throw new ServiceError(400, 'No se pueden agregar pagos a una venta cancelada');
    }

    if (!payment_lines || payment_lines.length === 0) {
      await transaction.rollback();
      throw new ServiceError(400, 'No se enviaron líneas de pago');
    }

    const totalNewlyPaidUSD = payment_lines.reduce((sum: number, payLine: any) => {
      return sum + (parseFloat(payLine.amount) || 0) / (parseFloat(payLine.exchange_rate) || 1);
    }, 0);

    const remainingBalance = parseFloat(sale.total) - parseFloat(sale.paid_amount);
    if (totalNewlyPaidUSD > remainingBalance + 0.01) {
      await transaction.rollback();
      throw new ServiceError(400, 'El pago excede el saldo pendiente de la venta');
    }

    let newlyPaidUSD = 0;
    const createdPayments: any[] = [];
    let addPayCreditBalanceUSD = 0;

    for (const payLine of payment_lines) {
      const amountUSD = (parseFloat(payLine.amount) || 0) / (parseFloat(payLine.exchange_rate) || 1);
      newlyPaidUSD += amountUSD;

      const payment = await SalePayment.create({
        sale_id: sale.id,
        payment_date: new Date(),
        payment_method: payLine.method || 'cash',
        amount: payLine.amount,
        currency: payLine.currency || 'USD',
        exchange_rate: payLine.exchange_rate || 1,
        reference: payLine.reference || null,
        bank_id: payLine.bank_id || null,
        notes: notes || null,
        created_by: userId
      } as any, { transaction }) as any;

      createdPayments.push(payment);

      if (payLine.method === 'credit_balance' && sale.customer_id) {
        addPayCreditBalanceUSD += amountUSD;
      }
    }

    const newPaidAmount = Math.min(parseFloat(sale.paid_amount) + newlyPaidUSD, parseFloat(sale.total));
    const newCreditAmount = Math.max(0, parseFloat(sale.credit_amount) - newlyPaidUSD);
    const newStatus = newPaidAmount >= parseFloat(sale.total) - 0.01 ? 'completed' : 'pending';

    await sale.update({
      paid_amount: newPaidAmount,
      credit_amount: newCreditAmount,
      status: newStatus,
      updated_by: userId
    }, { transaction });

    // Update customer's credit_used and creditBalance in a single fetch
    if (sale.customer_id) {
      const customer = await Customer.findByPk(sale.customer_id, { transaction }) as any;
      if (customer) {
        const updates: any = {
          credit_used: Math.max(0, parseFloat(customer.credit_used || 0) - newlyPaidUSD)
        };
        if (addPayCreditBalanceUSD > 0) {
          updates.creditBalance = Math.max(0, parseFloat(customer.creditBalance || 0) - addPayCreditBalanceUSD);
        }
        await customer.update(updates, { transaction });
      }
    }

    await transaction.commit();

    const updatedSale = await Sale.findByPk(saleId, {
      include: [{ model: SalePayment, as: 'payments' }]
    }) as any;

    return { payments: createdPayments, sale: updatedSale };

  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* already rolled back */ }
    throw error;
  }
}
