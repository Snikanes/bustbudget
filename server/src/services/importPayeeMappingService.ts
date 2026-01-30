import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { ImportPayeeMappingRow, ImportPayeeMapping } from '../models/types.js';

function rowToMapping(row: ImportPayeeMappingRow): ImportPayeeMapping {
  return {
    id: row.id,
    originalPayee: row.original_payee,
    mappedPayee: row.mapped_payee,
    categoryId: row.category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllMappings(): ImportPayeeMapping[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM import_payee_mapping ORDER BY original_payee').all() as ImportPayeeMappingRow[];
  return rows.map(rowToMapping);
}

export function getMappingByOriginalPayee(originalPayee: string): ImportPayeeMapping | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM import_payee_mapping WHERE original_payee = ?').get(originalPayee) as ImportPayeeMappingRow | undefined;
  return row ? rowToMapping(row) : null;
}

export function upsertMapping(originalPayee: string, mappedPayee: string, categoryId: string | null): ImportPayeeMapping {
  const db = getDb();

  // Check if mapping already exists
  const existing = db.prepare('SELECT * FROM import_payee_mapping WHERE original_payee = ?').get(originalPayee) as ImportPayeeMappingRow | undefined;

  if (existing) {
    // Update existing mapping
    db.prepare('UPDATE import_payee_mapping SET mapped_payee = ?, category_id = ? WHERE id = ?').run(mappedPayee, categoryId, existing.id);
    const updated = db.prepare('SELECT * FROM import_payee_mapping WHERE id = ?').get(existing.id) as ImportPayeeMappingRow;
    return rowToMapping(updated);
  } else {
    // Create new mapping
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO import_payee_mapping (id, original_payee, mapped_payee, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, originalPayee, mappedPayee, categoryId, now, now);

    const created = db.prepare('SELECT * FROM import_payee_mapping WHERE id = ?').get(id) as ImportPayeeMappingRow;
    return rowToMapping(created);
  }
}

export function deleteMapping(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM import_payee_mapping WHERE id = ?').run(id);
}
