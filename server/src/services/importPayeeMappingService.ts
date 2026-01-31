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

export function getAllMappings(): ImportPayeeMapping[] {
  const db = getDb();
  const rows = db.prepare(`${SELECT_WITH_PAYEE} ORDER BY ipm.original_payee`).all() as ImportPayeeMappingWithPayeeRow[];
  return rows.map(rowToMapping);
}

export function getMappingByOriginalPayee(originalPayee: string): ImportPayeeMapping | null {
  const db = getDb();
  const row = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.original_payee = ?`).get(originalPayee) as ImportPayeeMappingWithPayeeRow | undefined;
  return row ? rowToMapping(row) : null;
}

export function upsertMapping(originalPayee: string, payeeId: string): ImportPayeeMapping {
  const db = getDb();

  // Check if mapping already exists
  const existing = db.prepare('SELECT id FROM import_payee_mapping WHERE original_payee = ?').get(originalPayee) as { id: string } | undefined;

  if (existing) {
    // Update existing mapping
    db.prepare('UPDATE import_payee_mapping SET payee_id = ? WHERE id = ?').run(payeeId, existing.id);
    const updated = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.id = ?`).get(existing.id) as ImportPayeeMappingWithPayeeRow;
    return rowToMapping(updated);
  } else {
    // Create new mapping
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO import_payee_mapping (id, original_payee, payee_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, originalPayee, payeeId, now, now);

    const created = db.prepare(`${SELECT_WITH_PAYEE} WHERE ipm.id = ?`).get(id) as ImportPayeeMappingWithPayeeRow;
    return rowToMapping(created);
  }
}

export function deleteMapping(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM import_payee_mapping WHERE id = ?').run(id);
}

export function getMappingsByPayeeId(payeeId: string): { id: string; originalPayee: string }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, original_payee
    FROM import_payee_mapping
    WHERE payee_id = ?
    ORDER BY original_payee
  `).all(payeeId) as { id: string; original_payee: string }[];

  return rows.map(row => ({
    id: row.id,
    originalPayee: row.original_payee,
  }));
}
