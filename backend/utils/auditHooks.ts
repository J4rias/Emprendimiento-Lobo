import { getAuditCtx } from '../middleware/auditContext';
import AuditLog from '../models/AuditLog';

const logger = require('../config/logger');

const SENSITIVE_FIELDS = new Set(['password', 'credit_pin', 'token']);
const PRICE_FIELDS = new Set([
  'base_price', 'cost', 'package_cost',
  'package_price', 'package_price_usd', 'purchase_currency',
]);

function omitSensitive(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!SENSITIVE_FIELDS.has(k)) result[k] = v;
  }
  return result;
}

async function writeAuditLog(params: {
  tableName: string;
  recordId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL';
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
}): Promise<void> {
  const ctx = getAuditCtx();
  if (!ctx) return; // skip non-HTTP context (migrations, seeders, cron)

  AuditLog.create({
    table_name: params.tableName,
    record_id: params.recordId,
    action: params.action,
    user_id: ctx.userId,
    ip: ctx.ip || null,
    old_values: params.oldValues,
    new_values: params.newValues,
  }).catch((err: any) =>
    logger.error('Audit log write failed', { table: params.tableName, err: err.message })
  );
}

function getDiff(instance: any): { old: Record<string, any>; new: Record<string, any> } | null {
  const changedFields = instance.changed() as string[] | false;
  if (!changedFields || changedFields.length === 0) return null;

  const oldVals: Record<string, any> = {};
  const newVals: Record<string, any> = {};
  for (const field of changedFields) {
    oldVals[field] = instance._previousDataValues[field];
    newVals[field] = instance.dataValues[field];
  }
  return { old: oldVals, new: newVals };
}

interface ModelMap {
  Sale: any;
  ExchangeRate: any;
  User: any;
  Product: any;
  ProductPresentation: any;
}

export function registerAuditHooks(models: ModelMap): void {
  const { Sale, ExchangeRate, User, Product, ProductPresentation } = models;

  // ─── Sale: only log CANCEL ───────────────────────────────────────────────────
  Sale.addHook('afterUpdate', 'auditSaleCancel', async (instance: any) => {
    const changedFields = instance.changed() as string[] | false;
    if (!changedFields || !changedFields.includes('status')) return;
    if (instance.getDataValue('status') !== 'cancelled') return;

    const diff = getDiff(instance);
    await writeAuditLog({
      tableName: 'sales',
      recordId: instance.id,
      action: 'CANCEL',
      oldValues: diff?.old ?? null,
      newValues: diff?.new ?? null,
    });
  });

  // ─── ExchangeRate ────────────────────────────────────────────────────────────
  ExchangeRate.addHook('afterCreate', 'auditExRateCreate', async (instance: any) => {
    await writeAuditLog({
      tableName: 'exchange_rates',
      recordId: instance.id,
      action: 'CREATE',
      oldValues: null,
      newValues: instance.toJSON(),
    });
  });

  ExchangeRate.addHook('afterUpdate', 'auditExRateUpdate', async (instance: any) => {
    const diff = getDiff(instance);
    if (!diff) return;
    await writeAuditLog({
      tableName: 'exchange_rates',
      recordId: instance.id,
      action: 'UPDATE',
      oldValues: diff.old,
      newValues: diff.new,
    });
  });

  ExchangeRate.addHook('afterDestroy', 'auditExRateDelete', async (instance: any) => {
    await writeAuditLog({
      tableName: 'exchange_rates',
      recordId: instance.id,
      action: 'DELETE',
      oldValues: instance.toJSON(),
      newValues: null,
    });
  });

  // ─── User ────────────────────────────────────────────────────────────────────
  User.addHook('afterCreate', 'auditUserCreate', async (instance: any) => {
    await writeAuditLog({
      tableName: 'users',
      recordId: instance.id,
      action: 'CREATE',
      oldValues: null,
      newValues: omitSensitive(instance.toJSON()),
    });
  });

  User.addHook('afterUpdate', 'auditUserUpdate', async (instance: any) => {
    const diff = getDiff(instance);
    if (!diff) return;
    await writeAuditLog({
      tableName: 'users',
      recordId: instance.id,
      action: 'UPDATE',
      oldValues: omitSensitive(diff.old),
      newValues: omitSensitive(diff.new),
    });
  });

  User.addHook('afterDestroy', 'auditUserDelete', async (instance: any) => {
    await writeAuditLog({
      tableName: 'users',
      recordId: instance.id,
      action: 'DELETE',
      oldValues: omitSensitive(instance.toJSON()),
      newValues: null,
    });
  });

  // ─── Product ─────────────────────────────────────────────────────────────────
  Product.addHook('afterCreate', 'auditProductCreate', async (instance: any) => {
    await writeAuditLog({
      tableName: 'products',
      recordId: instance.id,
      action: 'CREATE',
      oldValues: null,
      newValues: instance.toJSON(),
    });
  });

  Product.addHook('afterUpdate', 'auditProductUpdate', async (instance: any) => {
    const diff = getDiff(instance);
    if (!diff) return;
    await writeAuditLog({
      tableName: 'products',
      recordId: instance.id,
      action: 'UPDATE',
      oldValues: diff.old,
      newValues: diff.new,
    });
  });

  Product.addHook('afterDestroy', 'auditProductDelete', async (instance: any) => {
    await writeAuditLog({
      tableName: 'products',
      recordId: instance.id,
      action: 'DELETE',
      oldValues: instance.toJSON(),
      newValues: null,
    });
  });

  // ─── ProductPresentation: only price field changes ───────────────────────────
  ProductPresentation.addHook(
    'afterUpdate',
    'auditPresentationPriceUpdate',
    async (instance: any) => {
      const changedFields = instance.changed() as string[] | false;
      if (!changedFields) return;

      const priceChanged = changedFields.some((f: string) => PRICE_FIELDS.has(f));
      if (!priceChanged) return;

      const oldVals: Record<string, any> = {};
      const newVals: Record<string, any> = {};
      for (const field of changedFields) {
        if (PRICE_FIELDS.has(field)) {
          oldVals[field] = instance._previousDataValues[field];
          newVals[field] = instance.dataValues[field];
        }
      }

      await writeAuditLog({
        tableName: 'product_presentations',
        recordId: instance.id,
        action: 'UPDATE',
        oldValues: { product_id: instance.product_id, ...oldVals },
        newValues: { product_id: instance.product_id, ...newVals },
      });
    }
  );
}
