import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { PayeeRow, Payee } from '../models/types.js';

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
