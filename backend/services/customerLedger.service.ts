import CustomerLedger from '../models/CustomerLedger';
import Customer from '../models/Customer';

interface LedgerEntryParams {
  customerId: number;
  transactionDate: Date;
  transactionType: 'sale' | 'payment' | 'credit_note' | 'cancellation' | 'adjustment';
  referenceId: number | null;
  referenceType: 'sale' | 'sale_payment' | 'credit_note' | null;
  description: string;
  debit: number;   // USD — incrementa deuda
  credit: number;  // USD — reduce deuda
  createdBy: number;
  transaction: any; // Sequelize transaction
}

/**
 * Inserts a ledger entry for a customer.
 * Reads current credit_used and credit_balance to compute balance_after.
 * The caller is responsible for updating those fields on Customer — this function only logs.
 */
export async function recordLedgerEntry(params: LedgerEntryParams): Promise<void> {
  const {
    customerId, transactionDate, transactionType,
    referenceId, referenceType, description,
    debit, credit, createdBy, transaction
  } = params;

  if (!customerId) return; // Consumidor final — no ledger

  const customer = await Customer.findByPk(customerId, { transaction }) as any;
  if (!customer) return;

  const creditUsed = parseFloat(customer.credit_used || 0);
  const creditBalance = parseFloat(customer.credit_balance || 0);
  // Net position: positive = customer owes, negative = customer has credit
  const currentNet = creditUsed - creditBalance;
  const balanceAfter = currentNet + debit - credit;

  await CustomerLedger.create({
    customer_id: customerId,
    transaction_date: transactionDate,
    transaction_type: transactionType,
    reference_id: referenceId,
    reference_type: referenceType,
    description,
    debit,
    credit,
    balance_after: balanceAfter,
    created_by: createdBy
  } as any, { transaction });
}
