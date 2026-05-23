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
  transfer_account_name: string | null;
}

function rowToTransaction(row: TransactionWithJoins): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    linkedTransactionId: row.linked_transaction_id,
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
    transfer_a.name as transfer_account_name
  FROM "transaction" t
  LEFT JOIN category c ON c.id = t.category_id
  LEFT JOIN account transfer_a ON transfer_a.id = t.transfer_account_id
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

export function bulkToggleCleared(userId: string, accountId: string): { updatedCount: number } {
  const db = getDb();

  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  const transactions = db.prepare(`
    SELECT id, is_cleared FROM "transaction"
    WHERE user_id = ? AND account_id = ? AND is_cleared < 2
  `).all(userId, accountId) as { id: string; is_cleared: number }[];

  if (transactions.length === 0) {
    return { updatedCount: 0 };
  }

  const unclearedCount = transactions.filter(t => t.is_cleared === 0).length;
  const newState = unclearedCount > 0 ? 1 : 0;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE "transaction"
    SET is_cleared = ?, updated_at = ?
    WHERE user_id = ? AND account_id = ? AND is_cleared < 2
  `);

  const result = stmt.run(newState, now, userId, accountId);

  return { updatedCount: result.changes };
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

  const today = new Date().toISOString().split('T')[0];
  if (data.date > today) {
    throw new ValidationError('Transaction date cannot be in the future', {
      providedDate: data.date,
      currentDate: today,
    });
  }

  const account = db.prepare('SELECT id, name FROM account WHERE user_id = ? AND id = ?').get(userId, accountId) as { id: string; name: string } | undefined;
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  if (data.transferAccountId) {
    return createTransferTransaction(userId, accountId, account.name, data);
  }

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
    id, userId, accountId,
    data.categoryId ?? null,
    data.date, data.amount,
    data.payee ?? null, data.memo ?? null,
    data.isCleared ? 1 : 0,
    now, now
  );

  if (data.payee && data.categoryId) {
    upsertPayee(userId, data.payee, data.categoryId);
  }

  return getTransactionById(userId, id);
}

function createTransferTransaction(userId: string, accountId: string, accountName: string, data: CreateTransactionRequest): Transaction {
  const db = getDb();
  const transferAccountId = data.transferAccountId!;

  if (transferAccountId === accountId) {
    throw new ValidationError('Transfer must be between different accounts');
  }

  const targetAccount = db.prepare('SELECT id, name FROM account WHERE user_id = ? AND id = ?').get(userId, transferAccountId) as { id: string; name: string } | undefined;
  if (!targetAccount) {
    throw new NotFoundError('Account', transferAccountId);
  }

  if (data.amount <= 0) {
    throw new ValidationError('Transfer amount must be positive');
  }

  const primaryId = uuidv4();
  const siblingId = uuidv4();
  const now = new Date().toISOString();

  const insertTxn = db.transaction(() => {
    db.prepare(`
      INSERT INTO "transaction" (id, user_id, account_id, linked_transaction_id, transfer_account_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      primaryId, userId, accountId, siblingId, transferAccountId,
      data.date, -data.amount,
      `Transfer to ${targetAccount.name}`,
      data.memo ?? null, data.isCleared ? 1 : 0,
      now, now
    );

    db.prepare(`
      INSERT INTO "transaction" (id, user_id, account_id, linked_transaction_id, transfer_account_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      siblingId, userId, transferAccountId, primaryId, accountId,
      data.date, data.amount,
      `Transfer from ${accountName}`,
      data.memo ?? null, data.isCleared ? 1 : 0,
      now, now
    );
  });

  insertTxn();

  return getTransactionById(userId, primaryId);
}

export function updateTransaction(userId: string, id: string, data: UpdateTransactionRequest): Transaction {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM "transaction" WHERE user_id = ? AND id = ?').get(userId, id) as TransactionRow | undefined;
  if (!existing) {
    throw new NotFoundError('Transaction', id);
  }

  const isCleared = existing.is_cleared >= 1;
  const isReconciled = existing.is_cleared === 2;
  const isStartingBalance = existing.is_starting_balance === 1;
  const isTransfer = existing.linked_transaction_id !== null;

  if (isReconciled) {
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
  } else if (isTransfer && isCleared) {
    if (data.date !== undefined || data.amount !== undefined) {
      throw new BusinessRuleError(
        'CLEARED_TRANSFER_IMMUTABLE',
        'Cleared transfers can only have memo updated',
        { transactionId: id }
      );
    }
  } else if (isCleared) {
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

  if (isTransfer && data.categoryId !== undefined) {
    throw new ValidationError('Cannot set category on a transfer transaction');
  }

  if (data.date !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    if (data.date > today) {
      throw new ValidationError('Transaction date cannot be in the future', {
        providedDate: data.date,
        currentDate: today,
      });
    }
  }

  if (data.categoryId) {
    const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, data.categoryId);
    if (!category) {
      throw new NotFoundError('Category', data.categoryId);
    }
  }

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

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

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

  if (isTransfer && existing.linked_transaction_id) {
    const siblingUpdates: string[] = [];
    const siblingParams: (string | number | null)[] = [];

    if (data.date !== undefined) {
      siblingUpdates.push('date = ?');
      siblingParams.push(data.date);
    }
    if (data.memo !== undefined) {
      siblingUpdates.push('memo = ?');
      siblingParams.push(data.memo);
    }
    if (data.isCleared !== undefined) {
      siblingUpdates.push('is_cleared = ?');
      siblingParams.push(data.isCleared ? 1 : 0);
    }
    if (data.amount !== undefined) {
      siblingUpdates.push('amount = ?');
      siblingParams.push(-data.amount);
    }

    if (siblingUpdates.length > 0) {
      siblingParams.push(userId, existing.linked_transaction_id);
      db.prepare(`UPDATE "transaction" SET ${siblingUpdates.join(', ')} WHERE user_id = ? AND id = ?`).run(...siblingParams);
    }
  }

  const updated = getTransactionById(userId, id);
  if (updated.payee && updated.categoryId && !updated.linkedTransactionId) {
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

  if (existing.linked_transaction_id) {
    db.transaction(() => {
      db.prepare('UPDATE "transaction" SET linked_transaction_id = NULL WHERE user_id = ? AND id = ?').run(userId, existing.linked_transaction_id);
      db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, existing.linked_transaction_id);
      db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, id);
    })();
    return;
  }

  db.prepare('DELETE FROM "transaction" WHERE user_id = ? AND id = ?').run(userId, id);
}

export function createStartingBalance(userId: string, accountId: string, amount: number, date: string): Transaction {
  const db = getDb();

  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

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

  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  const importedTransactions: Transaction[] = [];
  let skipped = 0;

  const today = new Date().toISOString().split('T')[0];

  const existingRows = db.prepare(`
    SELECT date, amount, payee FROM "transaction"
    WHERE user_id = ? AND account_id = ?
  `).all(userId, accountId) as Array<{ date: string; amount: number; payee: string | null }>;

  const existingKeys = new Set(
    existingRows.map((r) => `${r.date}|${r.amount}|${r.payee ?? ''}`)
  );

  for (const item of items) {
    if (item.date > today) {
      skipped++;
      continue;
    }

    const key = `${item.date}|${item.amount}|${item.payee ?? ''}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    if (item.categoryId) {
      const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, item.categoryId);
      if (!category) {
        skipped++;
        continue;
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO "transaction" (id, user_id, account_id, category_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id, userId, accountId,
      item.categoryId ?? null,
      item.date, item.amount,
      item.payee ?? null, item.memo ?? null,
      now, now
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

  const account = db.prepare('SELECT id FROM account WHERE user_id = ? AND id = ?').get(userId, accountId);
  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  const result = db.prepare(`
    UPDATE "transaction"
    SET is_cleared = 2
    WHERE user_id = ? AND account_id = ? AND is_cleared = 1
  `).run(userId, accountId);

  return { reconciledCount: result.changes };
}
