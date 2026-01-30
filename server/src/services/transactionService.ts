import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  TransactionRow,
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  ImportTransactionItem,
  ImportTransactionsResponse,
} from '../models/types.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../middleware/errorHandler.js';
import { upsertPayee } from './payeeService.js';

interface TransactionWithJoins extends TransactionRow {
  category_name: string | null;
  transfer_account_id: string | null;
  transfer_account_name: string | null;
}

function rowToTransaction(row: TransactionWithJoins): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    transferId: row.transfer_id,
    transferAccountId: row.transfer_account_id,
    transferAccountName: row.transfer_account_name,
    date: row.date,
    amount: row.amount,
    payee: row.payee,
    memo: row.memo,
    isCleared: row.is_cleared === 1,
    isStartingBalance: row.is_starting_balance === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BASE_QUERY = `
  SELECT
    t.*,
    c.name as category_name,
    other_t.account_id as transfer_account_id,
    other_a.name as transfer_account_name
  FROM "transaction" t
  LEFT JOIN category c ON c.id = t.category_id
  LEFT JOIN transfer tr ON tr.id = t.transfer_id
  LEFT JOIN "transaction" other_t ON (
    (tr.from_txn_id = t.id AND tr.to_txn_id = other_t.id) OR
    (tr.to_txn_id = t.id AND tr.from_txn_id = other_t.id)
  )
  LEFT JOIN account other_a ON other_a.id = other_t.account_id
`;

export function getTransactionsByAccount(accountId: string): Transaction[] {
  const db = getDb();
  const rows = db.prepare(`
    ${BASE_QUERY}
    WHERE t.account_id = ?
    ORDER BY t.date DESC, t.created_at DESC
  `).all(accountId) as TransactionWithJoins[];

  return rows.map(rowToTransaction);
}

export function getTransactionById(id: string): Transaction {
  const db = getDb();
  const row = db.prepare(`
    ${BASE_QUERY}
    WHERE t.id = ?
  `).get(id) as TransactionWithJoins | undefined;

  if (!row) {
    throw new NotFoundError('Transaction', id);
  }

  return rowToTransaction(row);
}

export function createTransaction(accountId: string, data: CreateTransactionRequest): Transaction {
  const db = getDb();

  // Validate date is not in future
  const today = new Date().toISOString().split('T')[0];
  if (data.date > today) {
    throw new ValidationError('Transaction date cannot be in the future', {
      providedDate: data.date,
      currentDate: today,
    });
  }

  // Validate account exists
  const account = db.prepare('SELECT id FROM account WHERE id = ?').get(accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  // Validate category exists if provided
  if (data.categoryId) {
    const category = db.prepare('SELECT id FROM category WHERE id = ?').get(data.categoryId);
    if (!category) {
      throw new NotFoundError('Category', data.categoryId);
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO "transaction" (id, account_id, category_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    accountId,
    data.categoryId ?? null,
    data.date,
    data.amount,
    data.payee ?? null,
    data.memo ?? null,
    data.isCleared ? 1 : 0,
    now,
    now
  );

  // Update payee-category association if both payee and category are provided
  if (data.payee && data.categoryId) {
    upsertPayee(data.payee, data.categoryId);
  }

  return getTransactionById(id);
}

export function updateTransaction(id: string, data: UpdateTransactionRequest): Transaction {
  const db = getDb();

  // Get existing transaction
  const existing = db.prepare('SELECT * FROM "transaction" WHERE id = ?').get(id) as TransactionRow | undefined;
  if (!existing) {
    throw new NotFoundError('Transaction', id);
  }

  const isCleared = existing.is_cleared === 1;
  const isStartingBalance = existing.is_starting_balance === 1;

  // Check editability rules
  if (isCleared) {
    // Cleared transactions: only memo can be edited
    const attemptedFields: string[] = [];
    if (data.date !== undefined) attemptedFields.push('date');
    if (data.amount !== undefined) attemptedFields.push('amount');
    if (data.payee !== undefined) attemptedFields.push('payee');
    if (data.categoryId !== undefined) attemptedFields.push('categoryId');

    if (attemptedFields.length > 0) {
      throw new BusinessRuleError(
        'CLEARED_TRANSACTION_IMMUTABLE',
        'Cleared transactions can only have memo updated',
        { transactionId: id, attemptedFields, allowedFields: ['memo', 'isCleared'] }
      );
    }
  }

  // Validate date is not in future
  if (data.date !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    if (data.date > today) {
      throw new ValidationError('Transaction date cannot be in the future', {
        providedDate: data.date,
        currentDate: today,
      });
    }
  }

  // Starting balance: cannot change amount or add category
  if (isStartingBalance) {
    if (data.amount !== undefined) {
      throw new BusinessRuleError(
        'STARTING_BALANCE_IMMUTABLE',
        'Starting balance amount cannot be changed',
        { transactionId: id }
      );
    }
    if (data.categoryId !== undefined && data.categoryId !== null) {
      throw new BusinessRuleError(
        'STARTING_BALANCE_NO_CATEGORY',
        'Starting balance cannot have a category',
        { transactionId: id }
      );
    }
  }

  // Build update query
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.date !== undefined) {
    updates.push('date = ?');
    params.push(data.date);
  }
  if (data.amount !== undefined) {
    updates.push('amount = ?');
    params.push(data.amount);
  }
  if (data.payee !== undefined) {
    updates.push('payee = ?');
    params.push(data.payee);
  }
  if ('categoryId' in data) {
    updates.push('category_id = ?');
    params.push(data.categoryId ?? null);
  }
  if (data.memo !== undefined) {
    updates.push('memo = ?');
    params.push(data.memo);
  }
  if (data.isCleared !== undefined) {
    updates.push('is_cleared = ?');
    params.push(data.isCleared ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE "transaction" SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Update payee-category association if payee or categoryId changed
  // Get the final state of the transaction to determine payee and category
  const updated = getTransactionById(id);
  if (updated.payee && updated.categoryId && !updated.transferId) {
    upsertPayee(updated.payee, updated.categoryId);
  }

  return updated;
}

export function deleteTransaction(id: string): void {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM "transaction" WHERE id = ?').get(id) as TransactionRow | undefined;
  if (!existing) {
    throw new NotFoundError('Transaction', id);
  }

  // If this is part of a transfer, delete the transfer and both transactions
  if (existing.transfer_id) {
    const transfer = db.prepare('SELECT * FROM transfer WHERE id = ?').get(existing.transfer_id) as { from_txn_id: string; to_txn_id: string } | undefined;
    if (transfer) {
      db.prepare('DELETE FROM "transaction" WHERE id = ?').run(transfer.from_txn_id);
      db.prepare('DELETE FROM "transaction" WHERE id = ?').run(transfer.to_txn_id);
      db.prepare('DELETE FROM transfer WHERE id = ?').run(existing.transfer_id);
      return;
    }
  }

  db.prepare('DELETE FROM "transaction" WHERE id = ?').run(id);
}

export function createStartingBalance(accountId: string, amount: number, date: string): Transaction {
  const db = getDb();

  // Validate account exists
  const account = db.prepare('SELECT id FROM account WHERE id = ?').get(accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  // Check if starting balance already exists
  const existing = db.prepare(`
    SELECT id FROM "transaction" WHERE account_id = ? AND is_starting_balance = 1
  `).get(accountId);

  if (existing) {
    throw new BusinessRuleError(
      'STARTING_BALANCE_EXISTS',
      'Account already has a starting balance',
      { accountId }
    );
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO "transaction" (id, account_id, date, amount, payee, is_cleared, is_starting_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Starting Balance', 1, 1, ?, ?)
  `).run(id, accountId, date, amount, now, now);

  return getTransactionById(id);
}

export function importTransactions(
  accountId: string,
  items: ImportTransactionItem[]
): ImportTransactionsResponse {
  const db = getDb();

  // Validate account exists
  const account = db.prepare('SELECT id FROM account WHERE id = ?').get(accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  const importedTransactions: Transaction[] = [];
  let skipped = 0;

  // Get today's date for validation
  const today = new Date().toISOString().split('T')[0];

  for (const item of items) {
    // Skip future-dated transactions
    if (item.date > today) {
      skipped++;
      continue;
    }

    // Check for duplicate: same date + amount (payee doesn't need to match - user may have entered manually with different name)
    const duplicate = db.prepare(`
      SELECT id FROM "transaction"
      WHERE account_id = ?
        AND date = ?
        AND amount = ?
    `).get(accountId, item.date, item.amount);

    if (duplicate) {
      skipped++;
      continue;
    }

    // Create the transaction
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO "transaction" (id, account_id, category_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      accountId,
      item.categoryId ?? null,
      item.date,
      item.amount,
      item.payee ?? null,
      item.memo ?? null,
      now,
      now
    );

    importedTransactions.push(getTransactionById(id));
  }

  return {
    imported: importedTransactions.length,
    skipped,
    transactions: importedTransactions,
  };
}
