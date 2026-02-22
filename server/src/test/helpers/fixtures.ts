import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/index.js';

const yesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0];

export function createAccount(userId: string, overrides?: { name?: string; isClosed?: boolean }): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO account (id, user_id, name, is_closed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, overrides?.name ?? 'Test Account', overrides?.isClosed ? 1 : 0, now, now);
  return id;
}

export function createCategoryGroup(userId: string, overrides?: { name?: string; sortOrder?: number }): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO category_group (id, user_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, overrides?.name ?? 'Test Group', overrides?.sortOrder ?? 0, now, now);
  return id;
}

export function createCategory(
  userId: string,
  overrides?: { name?: string; groupId?: string | null; sortOrder?: number }
): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO category (id, user_id, group_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    userId,
    overrides?.groupId ?? null,
    overrides?.name ?? 'Test Category',
    overrides?.sortOrder ?? 0,
    now,
    now,
  );
  return id;
}

export function createTransaction(
  userId: string,
  accountId: string,
  overrides?: {
    amount?: number;
    date?: string;
    categoryId?: string | null;
    payee?: string | null;
    memo?: string | null;
    isCleared?: number;
    isStartingBalance?: boolean;
  },
): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO "transaction"
     (id, user_id, account_id, category_id, date, amount, payee, memo, is_cleared, is_starting_balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    accountId,
    overrides?.categoryId ?? null,
    overrides?.date ?? yesterday(),
    overrides?.amount ?? -10000,
    overrides?.payee ?? null,
    overrides?.memo ?? null,
    overrides?.isCleared ?? 0,
    overrides?.isStartingBalance ? 1 : 0,
    now,
    now,
  );
  return id;
}

export function createTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  overrides?: { amount?: number; date?: string },
): { transferId: string; fromTxnId: string; toTxnId: string } {
  const db = getDb();
  const transferId = uuidv4();
  const fromTxnId = uuidv4();
  const toTxnId = uuidv4();
  const now = new Date().toISOString();
  const date = overrides?.date ?? yesterday();
  const amount = overrides?.amount ?? 100000;

  db.prepare(
    `INSERT INTO "transaction"
     (id, user_id, account_id, date, amount, payee, is_cleared, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(fromTxnId, userId, fromAccountId, date, -amount, 'Transfer', now, now);

  db.prepare(
    `INSERT INTO "transaction"
     (id, user_id, account_id, date, amount, payee, is_cleared, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(toTxnId, userId, toAccountId, date, amount, 'Transfer', now, now);

  db.prepare(
    'INSERT INTO transfer (id, from_txn_id, to_txn_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(transferId, fromTxnId, toTxnId, now);

  db.prepare('UPDATE "transaction" SET transfer_id = ? WHERE id = ?').run(transferId, fromTxnId);
  db.prepare('UPDATE "transaction" SET transfer_id = ? WHERE id = ?').run(transferId, toTxnId);

  return { transferId, fromTxnId, toTxnId };
}

export function createPayee(userId: string, name: string, categoryId?: string | null): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO payee (id, user_id, name, last_category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, name, categoryId ?? null, now, now);
  return id;
}

export function createMonthlyBudget(
  userId: string,
  categoryId: string,
  yearMonth: string,
  assignedAmount: number,
): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO monthly_budget (id, user_id, category_id, year_month, assigned_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, categoryId, yearMonth, assignedAmount, now, now);
  return id;
}

export function createCategoryTarget(
  userId: string,
  categoryId: string,
  overrides?: {
    targetType?: 'monthly' | 'yearly' | 'by_date';
    targetAmount?: number;
    targetDate?: string;
    recurrenceDay?: number | null;
  },
): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO category_target (id, user_id, category_id, target_type, target_amount, target_date, recurrence_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    categoryId,
    overrides?.targetType ?? 'monthly',
    overrides?.targetAmount ?? 10000,
    overrides?.targetDate ?? '2026-12-31',
    overrides?.recurrenceDay ?? null,
    now,
    now,
  );
  return id;
}
