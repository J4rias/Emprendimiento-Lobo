/**
 * Guarda contra la regresión detectada el 2026-08-19: la migración 20260706000001
 * agregó `deleted_at` a 14 tablas, pero 12 modelos seguían con `paranoid: false`.
 * Resultado: `.destroy()` borraba físicamente en rutas que decían "soft delete".
 */
const { sequelize } = require('../models');
const db = require('../models');

// tabla → modelo, para las 14 tablas que tienen deleted_at
const PARANOID_MODELS = [
  'Brand', 'Category', 'Customer', 'ExchangeRate', 'PackagingType',
  'PreOrder', 'PresentationType', 'PriceList', 'Product', 'Quote',
  'Role', 'Sale', 'Supplier', 'User'
];

beforeAll(async () => { await sequelize.authenticate(); });
afterAll(async () => { await sequelize.close(); });

describe('soft delete unificado', () => {
  it('toda tabla con deleted_at tiene su modelo en paranoid: true', async () => {
    const [rows] = await sequelize.query(`
      SELECT TABLE_NAME AS t FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'deleted_at'
    `);
    const tablas = rows.map(r => r.t);

    const sinParanoid = [];
    for (const [nombre, modelo] of Object.entries(sequelize.models)) {
      if (tablas.includes(modelo.getTableName()) && !modelo.options.paranoid) {
        sinParanoid.push(`${nombre} (${modelo.getTableName()})`);
      }
    }
    expect(sinParanoid).toEqual([]);
  });

  it('los modelos esperados están declarados como paranoid', () => {
    for (const nombre of PARANOID_MODELS) {
      expect(db[nombre]).toBeDefined();
      expect(db[nombre].options.paranoid).toBe(true);
    }
  });

  it('los modelos paranoid apuntan a la columna deleted_at, no a deletedAt', () => {
    for (const nombre of PARANOID_MODELS) {
      expect(db[nombre].options.deletedAt).toBe('deleted_at');
    }
  });

  it('destroy() marca la fila en vez de borrarla', async () => {
    const marca = await db.Brand.create({
      name: `__test_soft_delete_${Date.now()}`,
      created_by: 1
    });
    const id = marca.id;

    await marca.destroy();

    expect(await db.Brand.findByPk(id)).toBeNull();               // invisible por defecto
    const conBorradas = await db.Brand.findByPk(id, { paranoid: false });
    expect(conBorradas).not.toBeNull();                            // pero sigue en la tabla
    expect(conBorradas.deleted_at || conBorradas.deletedAt).toBeTruthy();

    await conBorradas.destroy({ force: true });                    // limpieza real
  });
});
