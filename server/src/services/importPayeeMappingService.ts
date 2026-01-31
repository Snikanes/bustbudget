import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { ImportPayeeMappingWithPayeeRow, ImportPayeeMapping } from '../models/types.js';

function rowToMapping(row: ImportPayeeMappingWithPayeeRow): ImportPayeeMapping {
  return {
    id: row.id,
    originalPayee: row.original_payee,
    payeeId: row.payee_id,
    payeeName: row.payee_name,
    lastCategoryId: row.last_category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_PAYEE = `
  SELECT
    ipm.id,
    ipm.original_payee,
    ipm.payee_id,
    ipm.created_at,
    ipm.updated_at,
    p.name AS payee_name,
    p.last_category_id
  FROM import_payee_mapping ipm
  JOIN payee p ON ipm.payee_id = p.id
`;

export function getAllMappings(userId: string): ImportPayeeMapping[] {
  const db = getDb();
  const rows = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.user_id = ? ORDER BY ipm.original_payee`).all(userId) as ImportPayeeMappingWithPayeeRow[];
  return rows.map(rowToMapping);
}

export function getMappingByOriginalPayee(userId: string, originalPayee: string): ImportPayeeMapping | null {
  const db = getDb();
  const row = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.user_id = ? AND ipm.original_payee = ?`).get(userId, originalPayee) as ImportPayeeMappingWithPayeeRow | undefined;
  return row ? rowToMapping(row) : null;
}

export function upsertMapping(userId: string, originalPayee: string, payeeId: string): ImportPayeeMapping {
  const db = getDb();

  // Check if mapping already exists
  const existing = db.prepare('SELECT id FROM import_payee_mapping WHERE user_id = ? AND original_payee = ?').get(userId, originalPayee) as { id: string } | undefined;

  if (existing) {
    // Update existing mapping
    db.prepare('UPDATE import_payee_mapping SET payee_id = ? WHERE user_id = ? AND id = ?').run(payeeId, userId, existing.id);
    const updated = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.user_id = ? AND ipm.id = ?`).get(userId, existing.id) as ImportPayeeMappingWithPayeeRow;
    return rowToMapping(updated);
  } else {
    // Create new mapping
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO import_payee_mapping (id, user_id, original_payee, payee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, originalPayee, payeeId, now, now);

    const created = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.user_id = ? AND ipm.id = ?`).get(userId, id) as ImportPayeeMappingWithPayeeRow;
    return rowToMapping(created);
  }
}

export function deleteMapping(userId: string, id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM import_payee_mapping WHERE user_id = ? AND id = ?').run(userId, id);
}

export function getMappingsByPayeeId(userId: string, payeeId: string): { id: string; originalPayee: string }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, original_payee
    FROM import_payee_mapping
    WHERE user_id = ? AND payee_id = ?
    ORDER BY original_payee
  `).all(userId, payeeId) as { id: string; original_payee: string }[];

  return rows.map(row => ({
    id: row.id,
    originalPayee: row.original_payee,
  }));
}
