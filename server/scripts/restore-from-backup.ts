#!/usr/bin/env npx tsx

/**
 * Script to restore data from a backup database to the production database.
 * The production database must already have the schema (via migrations).
 *
 * Usage: npx tsx scripts/restore-from-backup.ts <backup-file-path>
 *
 * Example: npx tsx scripts/restore-from-backup.ts ../backups/budget_20260131_081457_57a1a81.db
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROD_DB_PATH = join(__dirname, '../data/budget.db');

// Tables in order of insertion (respecting foreign key dependencies)
const TABLES_IN_ORDER = [
  'account',
  'category_group',
  'category',
  'payee',
  'transfer',
  'transaction',
  'monthly_budget',
  'category_target',
  'import_payee_mapping',
];

function getColumnNames(db: Database.Database, tableName: string): string[] {
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;
  return columns.map(col => col.name);
}

function restoreData(backupPath: string): void {
  console.log(`\nRestoring data from: ${backupPath}`);
  console.log(`To production DB: ${PROD_DB_PATH}\n`);

  // Open both databases
  const backupDb = new Database(backupPath, { readonly: true });
  const prodDb = new Database(PROD_DB_PATH);

  try {
    // Disable foreign keys temporarily for bulk insert
    prodDb.pragma('foreign_keys = OFF');

    // Start a transaction for atomicity
    const restore = prodDb.transaction(() => {
      // Clear existing data in reverse order (to respect foreign keys)
      console.log('Clearing existing data...');
      for (const table of [...TABLES_IN_ORDER].reverse()) {
        const deleteStmt = prodDb.prepare(`DELETE FROM "${table}"`);
        const result = deleteStmt.run();
        console.log(`  Deleted ${result.changes} rows from ${table}`);
      }

      console.log('\nRestoring data from backup...');

      // Insert data for each table
      for (const table of TABLES_IN_ORDER) {
        // Get column names from backup (in case schemas differ slightly)
        const backupColumns = getColumnNames(backupDb, table);
        const prodColumns = getColumnNames(prodDb, table);

        // Use only columns that exist in both databases
        const commonColumns = backupColumns.filter(col => prodColumns.includes(col));

        if (commonColumns.length === 0) {
          console.log(`  Skipping ${table} - no common columns`);
          continue;
        }

        // Read all rows from backup
        const selectSql = `SELECT "${commonColumns.join('", "')}" FROM "${table}"`;
        const rows = backupDb.prepare(selectSql).all();

        if (rows.length === 0) {
          console.log(`  ${table}: 0 rows (empty)`);
          continue;
        }

        // Prepare insert statement
        const placeholders = commonColumns.map(() => '?').join(', ');
        const insertSql = `INSERT INTO "${table}" ("${commonColumns.join('", "')}") VALUES (${placeholders})`;
        const insertStmt = prodDb.prepare(insertSql);

        // Insert each row
        for (const row of rows) {
          const values = commonColumns.map(col => (row as Record<string, unknown>)[col]);
          insertStmt.run(...values);
        }

        console.log(`  ${table}: ${rows.length} rows restored`);
      }
    });

    // Execute the transaction
    restore();

    // Re-enable foreign keys and verify
    prodDb.pragma('foreign_keys = ON');

    // Verify foreign key integrity
    const fkCheck = prodDb.pragma('foreign_key_check') as Array<unknown>;
    if (fkCheck.length > 0) {
      console.error('\nWarning: Foreign key violations detected:');
      console.error(fkCheck);
    } else {
      console.log('\nForeign key integrity: OK');
    }

    console.log('\nRestore completed successfully!');

    // Print summary
    console.log('\nData summary:');
    for (const table of TABLES_IN_ORDER) {
      const count = prodDb.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };
      console.log(`  ${table}: ${count.count} rows`);
    }

  } finally {
    backupDb.close();
    prodDb.close();
  }
}

// Main entry point
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npx tsx scripts/restore-from-backup.ts <backup-file-path>');
  console.error('Example: npx tsx scripts/restore-from-backup.ts ../backups/budget_20260131_081457_57a1a81.db');
  process.exit(1);
}

const backupPath = resolve(args[0]);

// Verify backup file exists
import fs from 'fs';
if (!fs.existsSync(backupPath)) {
  console.error(`Error: Backup file not found: ${backupPath}`);
  process.exit(1);
}

// Verify production database exists
if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`Error: Production database not found: ${PROD_DB_PATH}`);
  console.error('Run the server first to create the schema via migrations.');
  process.exit(1);
}

restoreData(backupPath);
