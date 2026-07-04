import { Request, Response } from 'express';

import { Product, Category, ProductPresentation, PackagingType, Inventory, PriceList, PriceListDetail, CompanySettings, sequelize } from '../models';

const logger = require('../config/logger');

export const getCatalog = async (req: Request, res: Response) => {
  try {
    // 1. Company info
    const company = await CompanySettings.findOne({
      attributes: ['name', 'address', 'phone', 'email', 'tax_id']
    }) as any;

    // 2. Default active price list
    const priceList = await PriceList.findOne({
      where: { isDefault: true, status: 'active', isDeleted: false },
      attributes: ['id', 'name', 'currency']
    }) as any;

    if (!priceList) {
      return res.json({ company, priceList: null, categories: [], products: [], topProducts: [], newArrivals: [] });
    }

    // 3. Products with stock, prices, and category info — single optimized query
    const products = await sequelize.query(`
      SELECT
        p.id,
        p.name,
        p.image_url,
        p.category_id,
        c.name AS category_name,
        c.color AS category_color,
        pkt.name AS packaging,
        pp.units_per_package,
        ROUND(pld.package_price, 2) AS package_price,
        ROUND(pld.unit_price, 2) AS unit_price,
        CASE WHEN i.quantity <= pp.units_per_package * 2 THEN 1 ELSE 0 END AS low_stock
      FROM price_list_details pld
      JOIN products p ON p.id = pld.product_id AND p.is_active = 1
      JOIN categories c ON c.id = p.category_id AND c.is_active = 1
      JOIN product_presentations pp ON pp.id = pld.presentation_id
      LEFT JOIN packaging_types pkt ON pkt.id = pp.packaging_type_id
      JOIN inventory i ON i.product_id = p.id AND i.quantity > 0
      WHERE pld.price_list_id = :priceListId
        AND pld.package_price > 0
      ORDER BY c.name, p.name
    `, {
      replacements: { priceListId: priceList.id },
      type: (sequelize as any).QueryTypes.SELECT
    }) as any[];

    // 4. Extract unique categories from products
    const categoryMap: { [key: string]: any } = {};
    products.forEach((p: any) => {
      if (!categoryMap[p.category_id]) {
        categoryMap[p.category_id] = {
          id: p.category_id,
          name: p.category_name,
          color: p.category_color,
          productCount: 0
        };
      }
      categoryMap[p.category_id].productCount++;
    });
    const categories = Object.values(categoryMap).sort((a: any, b: any) => a.name.localeCompare(b.name));

    // 5. Top products (most sold in last 30 days)
    const topRows = await sequelize.query(`
      SELECT sd.product_id, SUM(sd.quantity) AS total_sold
      FROM sale_details sd
      JOIN sales s ON s.id = sd.sale_id
      WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND s.status IN ('completed', 'pending')
      GROUP BY sd.product_id
      ORDER BY total_sold DESC
      LIMIT 30
    `, { type: (sequelize as any).QueryTypes.SELECT });

    // Filter to only include products that are in our catalog
    const productIds = new Set(products.map((p: any) => p.id));
    const topProducts = topRows
      .map((r: any) => r.product_id)
      .filter((id: any) => productIds.has(id))
      .slice(0, 20);

    // 6. New arrivals (recent inventory ingress in last 15 days)
    const newRows = await sequelize.query(`
      SELECT DISTINCT im.product_id, MAX(im.created_at) AS latest
      FROM inventory_movements im
      WHERE im.movement_type = 'ingreso'
        AND im.created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)
      GROUP BY im.product_id
      ORDER BY latest DESC
      LIMIT 30
    `, { type: (sequelize as any).QueryTypes.SELECT });

    const newArrivals = newRows
      .map((r: any) => r.product_id)
      .filter((id: any) => productIds.has(id))
      .slice(0, 20);

    // Clean product response (don't expose category_color in each product)
    const cleanProducts = products.map((p: any) => {
      const { category_color, ...rest } = p;
      return rest;
    });

    res.json({
      company,
      priceList: { name: priceList.name, currency: priceList.currency },
      categories,
      products: cleanProducts,
      topProducts,
      newArrivals
    });

  } catch (error) {
    logger.error('Error fetching catalog', { error: (error as Error).message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};