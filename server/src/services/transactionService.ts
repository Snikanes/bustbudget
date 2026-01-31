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
  // is_cleared: 0 = uncleared, 1 = cleared, 2 = reconciled
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
    isCleared: row.is_cleared >= 1,
    isReconciled: row.is_cleared === 2,
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

export function getTransactionsByAccount(userId: string, accountId: string): Transaction[] {
  const db = getDb();
  const rows = db.prepare(`
    ${BASE_QUERY}
    WHERE t.user_id = ? AND t.account_id = ?
    ORDER BY t.date DESC, t.created_at DESC
  `).all(userId, accountId) as TransactionWithJoins[];

  return rows.map(rowToTransaction);
}

export function getTransactionById(userId: string, id: string): Transaction {
  const db = getDb();
  const row = db.prepare(`
    ${BASE_QUERY}
    WHERE t.user_id = ? AND t.id = ?
  `).get(userId, id) as TransactionWithJoins | undefined;

  if (!row) {
    throw new NotFoundError('Transaction', id);
  }

  return rowToTransaction(row);
}

export function createTransaction(userId: string, accountId: string, data: CreateTransactionRequest): Transaction {
  const db = getDb();

  // Validate date is not in future
  const today = new Date().toISOString().split('T')[0];
  if (data.date > today) {
    throw new ValidationError('Transaction date cannot be in the future', {
      providedDate: data.date,
      currentDate: today,
    });
  }

  // Validate account exists and belongs to user
  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  // Validate category exists and belongs to user if provided
  if (data.categoryId) {
    const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, data.categoryId);
    if (!category) {
      throw new NotFoundError('Category', data.categoryId);
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO "transaction" (id, user_id, account_id, category_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
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
    upsertPayee(userId, data.payee, data.categoryId);
  }

  return getTransactionById(userId, id);
}

export function updateTransaction(userId: string, id: string, data: UpdateTransactionRequest): Transaction {
  const db = getDb();

  // Get existing transaction
  const existing = db.prepare('SELECT * FROM "transaction" WHERE user_id = ? AND id = ?').get(userId, id) as TransactionRow | undefined;
  if (!existing) {
    throw new NotFoundError('Transaction', id);
  }

  // is_cleared: 0 = uncleared, 1 = cleared, 2 = reconciled
  const isCleared = existing.is_cleared >= 1;
  const isReconciled = existing.is_cleared === 2;
  const isStartingBalance = existing.is_starting_balance === 1;

  // Check editability rules
  if (isReconciled) {
    // Reconciled transactions: only memo can be edited (cannot un-reconcile)
    const attemptedFields: string[] = [];
    if (data.date !== undefined) attemptedFields.push('date');
    if (data.amount !== undefined) attemptedFields.push('amount');
    if (data.payee !== undefined) attemptedFields.push('payee');
    if (data.categoryId !== undefined) attemptedFields.push('categoryId');
    if (data.isCleared !== undefined) attemptedFields.push('isCleared');

    if (attemptedFields.length > 0) {
      throw new BusinessRuleError(
        'RECONCILED_TRANSACTION_IMMUTABLE',
        'Reconciled transactions can only have memo updated',
        { transactionId: id, attemptedFields, allowedFields: ['memo'] }
      );
    }
  } else if (isCleared) {
    // Cleared transactions: only memo and isCleared can be edited
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

  // Validate category belongs to user if provided
  if (data.categoryId) {
    const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, data.categoryId);
    if (!category) {
      throw new NotFoundError('Category', data.categoryId);
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
    params.push(userId, id);
    db.prepare(`UPDATE "transaction" SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`).run(...params);
  }

  // Update payee-category association if payee or categoryId changed
  // Get the final state of the transaction to determine payee and category
  const updated = getTransactionById(userId, id);
  if (updated.payee && updated.categoryId && !updated.transferId) {
    upsertPayee(userId, updated.payee, updated.categoryId);
  }

  return updated;
}

export function deleteTransaction(userId: string, id: string): void {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM "transaction" WHERE user_id = ? AND id = ?').get(userId, id) as TransactionRow | undefined;
  if (!existing) {
    throw new NotFoundError('Transaction', id);
  }

  // If this is part of a transfer, delete the transfer and both transactions
  if (existing.transfer_id) {
    const transfer = db.prepare('SELECT * FROM transfer WHERE id = ?').get(existing.transfer_id) as { from_txn_id: string; to_txn_id: string } | undefined;
    if (transfer) {
      db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, transfer.from_txn_id);
      db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, transfer.to_txn_id);
      db.prepare('DELETE FROM transfer WHERE id = ?').run(existing.transfer_id);
      return;
    }
  }

  db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, id);
}

export function createStartingBalance(userId: string, accountId: string, amount: number, date: string): Transaction {
  const db = getDb();

  // Validate account exists and belongs to user
  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  // Check if starting balance already exists
  const existing = db.prepare(`
    SELECT id FROM "transaction" WHERE user_id = ? AND account_id = ? AND is_starting_balance = 1
  `).get(userId, accountId);

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
    INSERT INTO "transaction" (id, user_id, account_id, date, amount, payee, is_cleared, is_starting_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Starting Balance', 1, 1, ?, ?)
  `).run(id, userId, accountId, date, amount, now, now);

  return getTransactionById(userId, id);
}

export function importTransactions(
  userId: string,
  accountId: string,
  items: ImportTransactionItem[]
): ImportTransactionsResponse {
  const db = getDb();

  // Validate account exists and belongs to user
  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
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
      WHERE user_id = ? AND account_id = ?
        AND date = ?
        AND amount = ?
    `).get(userId, accountId, item.date, item.amount);

    if (duplicate) {
      skipped++;
      continue;
    }

    // Validate category belongs to user if provided
    if (item.categoryId) {
      const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, item.categoryId);
      if (!category) {
        // Skip transactions with invalid categories
        skipped++;
        continue;
      }
    }

    // Create the transaction
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO "transaction" (id, user_id, account_id, category_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      userId,
      accountId,
      item.categoryId ?? null,
      item.date,
      item.amount,
      item.payee ?? null,
      item.memo ?? null,
      now,
      now
    );

    importedTransactions.push(getTransactionById(userId, id));
  }

  return {
    imported: importedTransactions.length,
    skipped,
    transactions: importedTransactions,
  };
}

export function reconcileAccount(userId: string, accountId: string): { reconciledCount: number } {
  const db = getDb();

  // Validate account exists and belongs to user
  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  // Update all cleared transactions (is_cleared = 1) to reconciled (is_cleared = 2)
  const result = db.prepare(`
    UPDATE "transaction"
    SET is_cleared = 2
    WHERE user_id = ? AND account_id = ? AND is_cleared = 1
  `).run(userId, accountId);

  return { reconciledCount: result.changes };
}
