import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { ImportProfileRow, ImportProfile } from '../models/types.js';

function rowToProfile(row: ImportProfileRow): ImportProfile {
  return {
    id: row.id,
    name: row.name,
    fileType: row.file_type,
    config: JSON.parse(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllProfiles(userId: string): ImportProfile[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM import_profile WHERE user_id = ? ORDER BY name'
  ).all(userId) as ImportProfileRow[];
  return rows.map(rowToProfile);
}

export function createProfile(
  userId: string,
  name: string,
  fileType: string,
  config: Record<string, unknown>
): ImportProfile {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO import_profile (id, user_id, name, file_type, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, fileType, JSON.stringify(config), now, now);

  const row = db.prepare(
    'SELECT * FROM import_profile WHERE id = ?'
  ).get(id) as ImportProfileRow;
  return rowToProfile(row);
}

export function updateProfile(
  userId: string,
  id: string,
  updates: { name?: string; config?: Record<string, unknown> }
): ImportProfile {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare(
    'SELECT * FROM import_profile WHERE user_id = ? AND id = ?'
  ).get(userId, id) as ImportProfileRow | undefined;

  if (!existing) {
    throw new Error('Import profile not found');
  }

  const newName = updates.name ?? existing.name;
  const newConfig = updates.config ? JSON.stringify(updates.config) : existing.config;

  db.prepare(
    'UPDATE import_profile SET name = ?, config = ?, updated_at = ? WHERE user_id = ? AND id = ?'
  ).run(newName, newConfig, now, userId, id);

  const row = db.prepare(
    'SELECT * FROM import_profile WHERE id = ?'
  ).get(id) as ImportProfileRow;
  return rowToProfile(row);
}

export function deleteProfile(userId: string, id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM import_profile WHERE user_id = ? AND id = ?').run(userId, id);
}
