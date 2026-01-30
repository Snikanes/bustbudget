import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/budget.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function initializeDatabase(): void {
  // Ensure data directory exists
  const dataDir = dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schemaPath = join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  // Run migrations for existing databases
  runMigrations();

  console.log('Database initialized at', DB_PATH);
}

function runMigrations(): void {
  // Migration: Add category_id to import_payee_mapping if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(import_payee_mapping)").all() as Array<{ name: string }>;
  const hasCategory = tableInfo.some((col) => col.name === 'category_id');

  if (tableInfo.length > 0 && !hasCategory) {
    db.exec(`
      ALTER TABLE import_payee_mapping
      ADD COLUMN category_id TEXT REFERENCES category(id) ON DELETE SET NULL
    `);
    console.log('Migration: Added category_id to import_payee_mapping');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
