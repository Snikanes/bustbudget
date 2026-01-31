import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { PayeeRow, Payee, PayeeWithDetails } from '../models/types.js';
import { getMappingsByPayeeId } from './importPayeeMappingService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

function rowToPayee(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    lastCategoryId: row.last_category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllPayees(): Payee[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM payee
    ORDER BY name COLLATE NOCASE ASC
  `).all() as PayeeRow[];

  return rows.map(rowToPayee);
}

export function getPayeeByName(name: string): Payee | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM payee WHERE name = ?
  `).get(name) as PayeeRow | undefined;

  return row ? rowToPayee(row) : null;
}

export function upsertPayee(name: string, categoryId: string | null): Payee {
  const db = getDb();
  const now = new Date().toISOString();

  // Try to find existing payee
  const existing = db.prepare('SELECT id FROM payee WHERE name = ?').get(name) as { id: string } | undefined;

  if (existing) {
    // Update existing payee's last category
    db.prepare(`
      UPDATE payee SET last_category_id = ?, updated_at = ?
      WHERE id = ?
    `).run(categoryId, now, existing.id);

    return getPayeeByName(name)!;
  } else {
    // Create new payee
    const id = uuidv4();
    db.prepare(`
      INSERT INTO payee (id, name, last_category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, categoryId, now, now);

    return {
      id,
      name,
      lastCategoryId: categoryId,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export function createPayee(name: string): Payee {
  const db = getDb();

  // Check if payee already exists
  const existing = getPayeeByName(name);
  if (existing) {
    return existing;
  }

  // Create new payee
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO payee (id, name, last_category_id, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?)
  `).run(id, name, now, now);

  return {
    id,
    name,
    lastCategoryId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPayeeById(id: string): Payee | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM payee WHERE id = ?
  `).get(id) as PayeeRow | undefined;

  return row ? rowToPayee(row) : null;
}

export function getPayeeWithDetails(id: string): PayeeWithDetails | null {
  const db = getDb();

  // Get the payee
  const row = db.prepare(`
    SELECT * FROM payee WHERE id = ?
  `).get(id) as PayeeRow | undefined;

  if (!row) {
    return null;
  }

  // Count transactions with this payee name
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM "transaction" WHERE payee = ?
  `).get(row.name) as { count: number };

  // Get renaming rules for this payee
  const renamingRules = getMappingsByPayeeId(id);

  return {
    id: row.id,
    name: row.name,
    lastCategoryId: row.last_category_id,
    transactionCount: countResult.count,
    renamingRules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function updatePayee(id: string, name: string): Payee {
  const db = getDb();

  // Get current payee
  const current = db.prepare('SELECT * FROM payee WHERE id = ?').get(id) as PayeeRow | undefined;
  if (!current) {
    throw new NotFoundError('Payee', id);
  }

  // Check if name is empty
  if (!name.trim()) {
    throw new ValidationError('Payee name cannot be empty');
  }

  // Check if new name conflicts with existing payee (case-insensitive)
  const existing = db.prepare(
    'SELECT id FROM payee WHERE LOWER(name) = LOWER(?) AND id != ?'
  ).get(name, id) as { id: string } | undefined;

  if (existing) {
    throw new ValidationError(`A payee with the name "${name}" already exists`);
  }

  const oldName = current.name;
  const now = new Date().toISOString();

  // Update the payee name
  db.prepare(`
    UPDATE payee SET name = ?, updated_at = ?
    WHERE id = ?
  `).run(name, now, id);

  // Update all transactions that use the old payee name
  db.prepare(`
    UPDATE "transaction" SET payee = ?
    WHERE payee = ?
  `).run(name, oldName);

  return getPayeeById(id)!;
}

export function deletePayee(id: string): void {
  const db = getDb();

  // Get the payee to find its name
  const payee = db.prepare('SELECT name FROM payee WHERE id = ?').get(id) as { name: string } | undefined;

  if (!payee) {
    throw new NotFoundError('Payee', id);
  }

  // Set payee = NULL for all transactions with this payee name
  db.prepare(`
    UPDATE "transaction" SET payee = NULL
    WHERE payee = ?
  `).run(payee.name);

  // Delete the payee (CASCADE will delete import_payee_mappings)
  db.prepare('DELETE FROM payee WHERE id = ?').run(id);
}
