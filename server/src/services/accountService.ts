import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  AccountRow,
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '../models/types.js';
import { NotFoundError, BusinessRuleError } from '../middleware/errorHandler.js';

function rowToAccount(row: AccountRow & { balance?: number; cleared_balance?: number; uncleared_balance?: number }): Account {
  return {
    id: row.id,
    name: row.name,
    isClosed: row.is_closed === 1,
    balance: row.balance ?? 0,
    clearedBalance: row.cleared_balance ?? 0,
    unclearedBalance: row.uncleared_balance ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllAccounts(): Account[] {
  const db = getDb();
  // is_cleared: 0 = uncleared, 1 = cleared, 2 = reconciled
  // Cleared balance includes both cleared and reconciled transactions
  const rows = db.prepare(`
    SELECT
      a.*,
      COALESCE(SUM(t.amount), 0) as balance,
      COALESCE(SUM(CASE WHEN t.is_cleared >= 1 THEN t.amount ELSE 0 END), 0) as cleared_balance,
      COALESCE(SUM(CASE WHEN t.is_cleared = 0 THEN t.amount ELSE 0 END), 0) as uncleared_balance
    FROM account a
    LEFT JOIN "transaction" t ON t.account_id = a.id
    WHERE a.is_closed = 0
    GROUP BY a.id
    ORDER BY a.name
  `).all() as (AccountRow & { balance: number; cleared_balance: number; uncleared_balance: number })[];

  return rows.map(rowToAccount);
}

export function getAccountById(id: string): Account {
  const db = getDb();
  // is_cleared: 0 = uncleared, 1 = cleared, 2 = reconciled
  // Cleared balance includes both cleared and reconciled transactions
  const row = db.prepare(`
    SELECT
      a.*,
      COALESCE(SUM(t.amount), 0) as balance,
      COALESCE(SUM(CASE WHEN t.is_cleared >= 1 THEN t.amount ELSE 0 END), 0) as cleared_balance,
      COALESCE(SUM(CASE WHEN t.is_cleared = 0 THEN t.amount ELSE 0 END), 0) as uncleared_balance
    FROM account a
    LEFT JOIN "transaction" t ON t.account_id = a.id
    WHERE a.id = ?
    GROUP BY a.id
  `).get(id) as (AccountRow & { balance: number; cleared_balance: number; uncleared_balance: number }) | undefined;

  if (!row) {
    throw new NotFoundError('Account', id);
  }

  return rowToAccount(row);
}

export function createAccount(data: CreateAccountRequest): Account {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO account (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, data.name, now, now);

  // Create starting balance transaction if provided
  if (data.initialBalance !== undefined && data.initialBalance !== 0) {
    const txnId = uuidv4();
    const date = data.initialBalanceDate || now.split('T')[0];
    db.prepare(`
      INSERT INTO "transaction" (id, account_id, date, amount, payee, is_cleared, is_starting_balance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(txnId, id, date, data.initialBalance, 'Starting Balance', now, now);
  }

  return getAccountById(id);
}

export function updateAccount(id: string, data: UpdateAccountRequest): Account {
  const db = getDb();

  // Check account exists
  const existing = db.prepare('SELECT id FROM account WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('Account', id);
  }

  if (data.name !== undefined) {
    db.prepare('UPDATE account SET name = ? WHERE id = ?').run(data.name, id);
  }

  return getAccountById(id);
}

export function deleteAccount(id: string): void {
  const db = getDb();

  // Check account exists
  const existing = db.prepare('SELECT id FROM account WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('Account', id);
  }

  // Check for existing transactions
  const txnCount = db.prepare('SELECT COUNT(*) as count FROM "transaction" WHERE account_id = ?').get(id) as { count: number };
  if (txnCount.count > 0) {
    throw new BusinessRuleError(
      'ACCOUNT_HAS_TRANSACTIONS',
      'Cannot delete account with existing transactions',
      { accountId: id, transactionCount: txnCount.count }
    );
  }

  db.prepare('DELETE FROM account WHERE id = ?').run(id);
}

export function closeAccount(id: string): Account {
  const db = getDb();

  // Check account exists
  const existing = db.prepare('SELECT id FROM account WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('Account', id);
  }

  db.prepare('UPDATE account SET is_closed = 1 WHERE id = ?').run(id);
  return getAccountById(id);
}
