import { AsyncLocalStorage } from 'async_hooks';

export interface AuditCtx {
  userId: number | null;
  ip: string;
}

export const auditStorage = new AsyncLocalStorage<AuditCtx>();

export function getAuditCtx(): AuditCtx | undefined {
  return auditStorage.getStore();
}
