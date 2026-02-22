import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/index.js';

export function clearAllData(): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM refresh_token').run();
    db.prepare('DELETE FROM import_payee_mapping').run();
    db.prepare('DELETE FROM import_profile').run();
    db.prepare('DELETE FROM monthly_budget').run();
    db.prepare('DELETE FROM category_target').run();
    db.prepare('UPDATE "transaction" SET transfer_id = NULL').run();
    db.prepare('DELETE FROM transfer').run();
    db.prepare('DELETE FROM "transaction"').run();
    db.prepare('DELETE FROM category').run();
    db.prepare('DELETE FROM payee').run();
    db.prepare('DELETE FROM category_group').run();
    db.prepare('DELETE FROM account').run();
    db.prepare('DELETE FROM user').run();
  })();
}

export function createTestUser(overrides?: { id?: string; email?: string }): { id: string; email: string } {
  const db = getDb();
  const id = overrides?.id ?? uuidv4();
  const email = overrides?.email ?? `test-${id}@example.com`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO user (id, google_id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, `google-${id}`, email, 'Test User', now, now);
  return { id, email };
}
