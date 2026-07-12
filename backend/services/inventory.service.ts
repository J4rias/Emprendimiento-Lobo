import { Op } from 'sequelize';
import Inventory from '../models/Inventory';
import Product from '../models/Product';
import Warehouse from '../models/Warehouse';
import Batch from '../models/Batch';
import Category from '../models/Category';
import ProductPresentation from '../models/ProductPresentation';
import ExchangeRate from '../models/ExchangeRate';

const logger = require('../config/logger');

// ─── getLowStock ──────────────────────────────────────────────────────────────

export async function getLowStock(warehouseId?: string | number) {
  const where: any = {};
  if (warehouseId) where.warehouse_id = warehouseId;

  const inventory = await Inventory.findAll({
    where,
    include: [
      { model: Product, as: 'product', where: { is_active: true }, include: [{ model: Category, as: 'category' }] },
      { model: Warehouse, as: 'warehouse' }
    ],
    order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
  }) as any[];

  return inventory.filter((item: any) =>
    parseFloat(item.quantity) <= parseFloat(item.product.reorder_point)
  );
}

// ─── getExpiringProducts ──────────────────────────────────────────────────────

export async function getExpiringProducts(days: number, warehouseId?: string | number) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);

  const where: any = {
    expiration_date: { [Op.lte]: expirationDate, [Op.gte]: new Date() },
    quantity: { [Op.gt]: 0 }
  };
  if (warehouseId) where.warehouse_id = warehouseId;

  return await Batch.findAll({
    where,
    include: [
      { model: Product, as: 'product', where: { is_active: true }, include: [{ model: Category, as: 'category' }] },
      { model: Warehouse, as: 'warehouse' }
    ],
    order: [['expiration_date', 'ASC']]
  }) as any[];
}

// ─── getValuation ─────────────────────────────────────────────────────────────

export async function getInventoryValuation(warehouseId?: string | number) {
  const where: any = {};
  if (warehouseId) where.warehouse_id = warehouseId;

  const inventory = await Inventory.findAll({
    where,
    include: [{ model: Product, as: 'product', where: { is_active: true }, include: [{ model: ProductPresentation, as: 'presentations' }] }]
  }) as any[];

  const totalsByCurrency: any = { USD: 0, COP: 0, VES: 0 };

  const valuedItems = inventory.map((inv: any) => {
    const defaultPresentation = inv.product?.presentations?.find((p: any) => p.is_default) || inv.product?.presentations?.[0];
    let cost = parseFloat(defaultPresentation?.cost || 0);
    const unitsPerPkg = parseInt(defaultPresentation?.units_per_package) || 1;
    const packageCost = parseFloat(defaultPresentation?.package_cost || 0);
    if (cost === 0 && packageCost > 0) cost = packageCost / unitsPerPkg;

    const currency = defaultPresentation?.purchase_currency || 'USD';
    const quantity = parseFloat(inv.quantity) || 0;
    const value = quantity * cost;

    if (totalsByCurrency.hasOwnProperty(currency)) totalsByCurrency[currency] += value;
    return { product: inv.product, quantity: inv.quantity, cost, currency, value };
  });

  let totalValueUSD = totalsByCurrency.USD;
  const conversions: any[] = [];
  const warnings: any[] = [];

  for (const [currency, amount] of Object.entries(totalsByCurrency)) {
    if (currency === 'USD' || amount === 0) continue;
    try {
      const converted = await (ExchangeRate as any).convert(amount, currency, 'USD');
      const rate = await (ExchangeRate as any).getRate(currency, 'USD');
      totalValueUSD += converted;
      conversions.push({ currency, originalAmount: amount, rate: rate || 0, convertedAmount: converted });
    } catch (error) {
      logger.warn(`No exchange rate found for ${currency} to USD:`, (error as Error).message);
      warnings.push({ currency, amount, message: `No se encontró tasa de cambio de ${currency} a USD. Este monto no está incluido en el total.` });
    }
  }

  let totalValueCOP = totalsByCurrency.COP;
  for (const [currency, amount] of Object.entries(totalsByCurrency)) {
    if (currency === 'COP' || amount === 0) continue;
    try { totalValueCOP += await (ExchangeRate as any).convert(amount, currency, 'COP'); } catch (e) {}
  }

  const productsWithStock = new Set(
    inventory.filter((inv: any) => parseFloat(inv.quantity) > 0).map((inv: any) => inv.product_id)
  ).size;

  return { items: valuedItems, totalValue: totalValueUSD, totalValueCOP, totalsByCurrency, conversions, warnings, currency: 'USD', productsWithStock };
}
