import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { Transfer, CreateTransferRequest } from '../models/types.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../middleware/errorHandler.js';

export function createTransfer(data: CreateTransferRequest): Transfer {
  const db = getDb();

  // Validate accounts exist and are different
  if (data.fromAccountId === data.toAccountId) {
    throw new ValidationError('Transfer must be between different accounts');
  }

  const fromAccount = db.prepare('SELECT id, name FROM account WHERE id = ?').get(data.fromAccountId) as { id: string; name: string } | undefined;
  if (!fromAccount) {
    throw new NotFoundError('Account', data.fromAccountId);
  }

  const toAccount = db.prepare('SELECT id, name FROM account WHERE id = ?').get(data.toAccountId) as { id: string; name: string } | undefined;
  if (!toAccount) {
    throw new NotFoundError('Account', data.toAccountId);
  }

  // Validate date is not in future
  const today = new Date().toISOString().split('T')[0];
  if (data.date > today) {
    throw new ValidationError('Transaction date cannot be in the future', {
      providedDate: data.date,
      currentDate: today,
    });
  }

  // Validate amount is positive
  if (data.amount <= 0) {
    throw new ValidationError('Transfer amount must be positive');
  }

  const transferId = uuidv4();
  const fromTxnId = uuidv4();
  const toTxnId = uuidv4();
  const now = new Date().toISOString();

  // Use a transaction to ensure atomicity
  const insertTransfer = db.transaction(() => {
    // Step 1: Create transactions WITHOUT transfer_id
    db.prepare(`
      INSERT INTO "transaction" (id, account_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fromTxnId,
      data.fromAccountId,
      data.date,
      -data.amount,
      `Transfer to ${toAccount.name}`,
      data.memo ?? null,
      data.isCleared ? 1 : 0,
      now,
      now
    );

    db.prepare(`
      INSERT INTO "transaction" (id, account_id, date, amount, payee, memo, is_cleared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      toTxnId,
      data.toAccountId,
      data.date,
      data.amount,
      `Transfer from ${fromAccount.name}`,
      data.memo ?? null,
      data.isCleared ? 1 : 0,
      now,
      now
    );

    // Step 2: Create transfer record
    db.prepare(`
      INSERT INTO transfer (id, from_txn_id, to_txn_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(transferId, fromTxnId, toTxnId, now);

    // Step 3: Update transactions with transfer_id
    db.prepare('UPDATE "transaction" SET transfer_id = ? WHERE id = ?').run(transferId, fromTxnId);
    db.prepare('UPDATE "transaction" SET transfer_id = ? WHERE id = ?').run(transferId, toTxnId);
  });

  insertTransfer();

  return {
    id: transferId,
    fromTransactionId: fromTxnId,
    toTransactionId: toTxnId,
    fromAccountId: data.fromAccountId,
    toAccountId: data.toAccountId,
    amount: data.amount,
    date: data.date,
    memo: data.memo ?? null,
    createdAt: now,
  };
}

export function getTransferById(id: string): Transfer {
  const db = getDb();

  const transfer = db.prepare(`
    SELECT
      tr.id,
      tr.from_txn_id,
      tr.to_txn_id,
      tr.created_at,
      from_t.account_id as from_account_id,
      to_t.account_id as to_account_id,
      to_t.amount as amount,
      from_t.date as date,
      from_t.memo as memo
    FROM transfer tr
    JOIN "transaction" from_t ON from_t.id = tr.from_txn_id
    JOIN "transaction" to_t ON to_t.id = tr.to_txn_id
    WHERE tr.id = ?
  `).get(id) as {
    id: string;
    from_txn_id: string;
    to_txn_id: string;
    created_at: string;
    from_account_id: string;
    to_account_id: string;
    amount: number;
    date: string;
    memo: string | null;
  } | undefined;

  if (!transfer) {
    throw new NotFoundError('Transfer', id);
  }

  return {
    id: transfer.id,
    fromTransactionId: transfer.from_txn_id,
    toTransactionId: transfer.to_txn_id,
    fromAccountId: transfer.from_account_id,
    toAccountId: transfer.to_account_id,
    amount: transfer.amount,
    date: transfer.date,
    memo: transfer.memo,
    createdAt: transfer.created_at,
  };
}

export function updateTransfer(
  id: string,
  data: { date?: string; amount?: number; memo?: string; isCleared?: boolean }
): Transfer {
  const db = getDb();

  // Get existing transfer
  const existing = getTransferById(id);

  // Get the transactions
  const fromTxn = db.prepare('SELECT * FROM "transaction" WHERE id = ?').get(existing.fromTransactionId) as { is_cleared: number } | undefined;

  if (!fromTxn) {
    throw new NotFoundError('Transaction', existing.fromTransactionId);
  }

  // If cleared, only memo can be edited
  if (fromTxn.is_cleared === 1) {
    if (data.date !== undefined || data.amount !== undefined) {
      throw new BusinessRuleError(
        'CLEARED_TRANSFER_IMMUTABLE',
        'Cleared transfers can only have memo updated',
        { transferId: id }
      );
    }
  }

  // Validate date is not in future
  if (data.date !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    if (data.date > today) {
      throw new ValidationError('Transaction date cannot be in the future');
    }
  }

  // Update both transactions
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.date !== undefined) {
    updates.push('date = ?');
    params.push(data.date);
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
    const stmt = db.prepare(`UPDATE "transaction" SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params, existing.fromTransactionId);
    stmt.run(...params, existing.toTransactionId);
  }

  // Update amounts separately (need to negate for from transaction)
  if (data.amount !== undefined) {
    db.prepare('UPDATE "transaction" SET amount = ? WHERE id = ?').run(-data.amount, existing.fromTransactionId);
    db.prepare('UPDATE "transaction" SET amount = ? WHERE id = ?').run(data.amount, existing.toTransactionId);
  }

  return getTransferById(id);
}

export function deleteTransfer(id: string): void {
  const db = getDb();

  const existing = db.prepare('SELECT from_txn_id, to_txn_id FROM transfer WHERE id = ?').get(id) as { from_txn_id: string; to_txn_id: string } | undefined;

  if (!existing) {
    throw new NotFoundError('Transfer', id);
  }

  // Delete transactions and transfer
  db.prepare('DELETE FROM "transaction" WHERE id = ?').run(existing.from_txn_id);
  db.prepare('DELETE FROM "transaction" WHERE id = ?').run(existing.to_txn_id);
  db.prepare('DELETE FROM transfer WHERE id = ?').run(id);
}
