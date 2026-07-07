import { Op } from 'sequelize';
import Inventory from '../models/Inventory';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import PriceList from '../models/PriceList';
import PriceListDetail from '../models/PriceListDetail';
import ExchangeRate from '../models/ExchangeRate';

const logger = require('../config/logger');
const { sequelize } = require('../config/database');

// ─── getProductsWithStock ─────────────────────────────────────────────────────

export async function getProductsWithStock() {
  const inventories = await Inventory.findAll({
    where: { quantity: { [Op.gt]: 0 } },
    attributes: ['product_id'],
    include: [{ model: Product, as: 'product', where: { is_active: true }, attributes: ['id', 'sku', 'name'] }],
    group: ['product_id']
  }) as any[];

  const productIds = inventories.map((inv: any) => inv.product_id);

  const allPresentations = await ProductPresentation.findAll({
    where: { product_id: { [Op.in]: productIds }, is_active: true },
    attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency', 'product_id']
  }) as any[];

  const presentationsByProductId: Record<number, any[]> = {};
  for (const p of allPresentations) {
    if (!presentationsByProductId[p.product_id]) presentationsByProductId[p.product_id] = [];
    presentationsByProductId[p.product_id].push(p);
  }

  const results: any[] = [];
  const seenPresentations = new Set<string>();

  for (const inv of inventories) {
    const presentations = presentationsByProductId[inv.product_id] || [];

    for (const p of presentations) {
      const key = `${inv.product_id}-${p.id}`;
      if (!seenPresentations.has(key)) {
        seenPresentations.add(key);
        results.push({ product_id: inv.product_id, product: inv.product, presentation: { ...p.get(), package_cost: p.package_cost, cost: p.cost } });
      }
    }
  }
  return results;
}

// ─── exportPriceListCSV ───────────────────────────────────────────────────────

export async function exportPriceListCSV(priceListId: string | number): Promise<{ csv: string; filename: string } | null> {
  const priceList = await PriceList.findOne({
    where: { id: priceListId },
    include: [{
      model: PriceListDetail, as: 'details',
      include: [
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name'] },
        { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
      ]
    }]
  }) as any;

  if (!priceList) return null;

  const productIds = priceList.details.map((d: any) => d.product?.id).filter(Boolean);
  let inventoryByProduct: any = {};
  if (productIds.length > 0) {
    const inventories = await Inventory.findAll({
      where: { product_id: productIds },
      attributes: ['product_id', [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']],
      group: ['product_id']
    }) as any[];
    inventories.forEach((inv: any) => { inventoryByProduct[inv.product_id] = parseFloat(inv.get('total_quantity')) || 0; });
  }

  let rateToCop = 1;
  if (priceList.currency && priceList.currency !== 'COP') {
    try { rateToCop = await (ExchangeRate as any).getRate(priceList.currency, 'COP'); }
    catch (e) { logger.error('Failed to get exchange rate to COP for CSV export', e); }
  }

  const headers = ['SKU', 'Producto', 'Presentación', 'Existencia (Paquetes)', 'Existencia (Unidades)', 'Uds/Paquete', `Costo/Paquete (${priceList.currency})`, `Costo/Paquete (COP)`, `Costo Unitario (${priceList.currency})`, `Costo Unitario (COP)`, `Precio/Paquete (${priceList.currency})`, `Precio/Paquete (COP)`, 'Precio/Paquete (USD directo)', `Precio Unitario (${priceList.currency})`, `Precio Unitario (COP)`, 'Margen COP %', 'Margen USD %'];

  const uniqueCurrencies = new Set<string>();
  priceList.details.forEach((d: any) => {
    if (d.presentation?.purchase_currency && d.presentation.purchase_currency !== priceList.currency) {
      uniqueCurrencies.add(d.presentation.purchase_currency);
    }
    if (d.presentation?.purchase_currency && d.presentation.purchase_currency !== 'COP') {
      uniqueCurrencies.add(d.presentation.purchase_currency);
    }
  });

  const rateToListCurrency: Map<string, number> = new Map();
  const rateToCopMap: Map<string, number> = new Map();

  for (const currency of uniqueCurrencies) {
    if (currency !== priceList.currency) {
      try {
        const rate = await (ExchangeRate as any).getRate(currency, priceList.currency);
        rateToListCurrency.set(currency, rate);
      } catch (e) { logger.error(`Failed to get exchange rate from ${currency} to ${priceList.currency}`, e); }
    }
    if (currency !== 'COP') {
      try {
        const rate = await (ExchangeRate as any).getRate(currency, 'COP');
        rateToCopMap.set(currency, rate);
      } catch (e) { logger.error(`Failed to get exchange rate from ${currency} to COP`, e); }
    }
  }

  const rows = await Promise.all(priceList.details.map(async (d: any) => {
    const unitsPerPackage = d.presentation?.units_per_package || 1;
    const totalLooseUnits = inventoryByProduct[d.product?.id] || 0;
    const stockPackages = Math.floor(totalLooseUnits / unitsPerPackage);
    const stockRemainingUnits = totalLooseUnits % unitsPerPackage;

    let nativeCost = parseFloat(d.package_cost) || 0;
    let nativeUnitCost = parseFloat(d.unit_cost) || 0;
    let nativeCurrency = d.presentation?.purchase_currency || 'USD';

    let costInListCurrency = nativeCost * (rateToListCurrency.get(nativeCurrency) ?? 1);
    let costInCop = nativeCost * (rateToCopMap.get(nativeCurrency) ?? rateToCop);
    let unitCostInListCurrency = nativeUnitCost * (rateToListCurrency.get(nativeCurrency) ?? 1);
    let unitCostInCop = nativeUnitCost * (rateToCopMap.get(nativeCurrency) ?? rateToCop);

    const pkgPriceUsd = parseFloat(d.package_price_usd) || 0;
    const costUsd = costInListCurrency;
    const marginCop = parseFloat(d.margin_percentage) || 0;
    const marginUsd = costUsd > 0 ? ((pkgPriceUsd - costUsd) / costUsd * 100) : 0;

    return [
      d.product?.sku || '',
      `"${(d.product?.name || '').replace(/"/g, '""')}"`,
      `"${(d.presentation?.name || '').replace(/"/g, '""')}"`,
      stockPackages,
      stockRemainingUnits,
      unitsPerPackage,
      costInListCurrency.toFixed(2),
      costInCop.toFixed(2),
      unitCostInListCurrency.toFixed(2),
      unitCostInCop.toFixed(2),
      parseFloat(d.package_price).toFixed(2),
      (parseFloat(d.package_price) * rateToCop).toFixed(2),
      pkgPriceUsd.toFixed(2),
      parseFloat(d.unit_price).toFixed(2),
      (parseFloat(d.unit_price) * rateToCop).toFixed(2),
      marginCop.toFixed(1),
      marginUsd.toFixed(1)
    ].join(',');
  }));

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const filename = `lista-precios-${priceList.code}.csv`;
  return { csv, filename };
}
