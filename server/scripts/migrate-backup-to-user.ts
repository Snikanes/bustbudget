#!/usr/bin/env npx tsx

/**
 * Script to migrate data from a pre-multi-user backup to the current multi-user database,
 * associating all data with a specific user ID.
 *
 * This script handles the schema difference where old backups don't have user_id columns.
 *
 * Usage: npx tsx scripts/migrate-backup-to-user.ts <backup-file-path> <user-id>
 *
 * Example: npx tsx scripts/migrate-backup-to-user.ts ../backups/budget_20260131_183500_1800d96.db abc123
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROD_DB_PATH = join(__dirname, '../data/budget.db');

// Tables that need user_id added during migration (in dependency order)
const TABLES_WITH_USER_ID = [
  'account',
  'category_group',
  'category',
  'payee',
  'transaction',
  'monthly_budget',
  'category_target',
  'import_payee_mapping',
];

// Tables without user_id (copy directly)
const TABLES_WITHOUT_USER_ID = ['transfer'];

// All tables in order for deletion (reverse this for clearing)
const ALL_USER_TABLES = [...TABLES_WITH_USER_ID, ...TABLES_WITHOUT_USER_ID];

function getColumnNames(db: Database.Database, tableName: string): string[] {
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as Array<{ name: string }>;
  return columns.map((col) => col.name);
}

function migrateData(backupPath: string, userId: string): void {
  console.log(`\nMigrating data from: ${backupPath}`);
  console.log(`To production DB: ${PROD_DB_PATH}`);
  console.log(`For user ID: ${userId}\n`);

  // Open both databases
  const backupDb = new Database(backupPath, { readonly: true });
  const prodDb = new Database(PROD_DB_PATH);

  try {
    // Verify user exists in production database
    const user = prodDb
      .prepare('SELECT id, email, name FROM user WHERE id = ?')
      .get(userId) as { id: string; email: string; name: string } | undefined;

    if (!user) {
      console.error(`Error: User with ID '${userId}' not found in production database.`);
      console.error('\nAvailable users:');
      const users = prodDb.prepare('SELECT id, email, name FROM user').all() as Array<{
        id: string;
        email: string;
        name: string;
      }>;
      if (users.length === 0) {
        console.error('  (no users found - create a user first by logging in)');
      } else {
        for (const u of users) {
          console.error(`  ${u.id} - ${u.email} (${u.name || 'no name'})`);
        }
      }
      process.exit(1);
    }

    console.log(`Found user: ${user.email} (${user.name || 'no name'})`);

    // Disable foreign keys temporarily for bulk operations
    prodDb.pragma('foreign_keys = OFF');

    // Start a transaction for atomicity
    const migrate = prodDb.transaction(() => {
      // Clear existing data for this user in reverse order (respecting FKs)
      console.log(`\nClearing existing data for user ${userId}...`);

      // First delete transfers that reference user's transactions
      const transferDeleteResult = prodDb
        .prepare(
          `
        DELETE FROM transfer
        WHERE from_txn_id IN (SELECT id FROM "transaction" WHERE user_id = ?)
           OR to_txn_id IN (SELECT id FROM "transaction" WHERE user_id = ?)
      `
        )
        .run(userId, userId);
      console.log(`  Deleted ${transferDeleteResult.changes} rows from transfer`);

      // Delete from tables with user_id in reverse order
      for (const table of [...TABLES_WITH_USER_ID].reverse()) {
        const deleteStmt = prodDb.prepare(`DELETE FROM "${table}" WHERE user_id = ?`);
        const result = deleteStmt.run(userId);
        console.log(`  Deleted ${result.changes} rows from ${table}`);
      }

      console.log('\nMigrating data from backup...');

      // Migrate tables with user_id
      for (const table of TABLES_WITH_USER_ID) {
        migrateTableWithUserId(backupDb, prodDb, table, userId);
      }

      // Migrate transfer table (no user_id needed)
      migrateTransferTable(backupDb, prodDb);
    });

    // Execute the transaction
    migrate();

    // Re-enable foreign keys and verify
    prodDb.pragma('foreign_keys = ON');

    // Verify foreign key integrity
    const fkCheck = prodDb.pragma('foreign_key_check') as Array<{
      table: string;
      rowid: number;
      parent: string;
      fkid: number;
    }>;
    if (fkCheck.length > 0) {
      console.error('\nWarning: Foreign key violations detected:');
      for (const violation of fkCheck) {
        console.error(
          `  Table: ${violation.table}, Row: ${violation.rowid}, Parent: ${violation.parent}`
        );
      }
    } else {
      console.log('\nForeign key integrity: OK');
    }

    console.log('\nMigration completed successfully!');

    // Print summary
    console.log('\nData summary for user:');
    for (const table of TABLES_WITH_USER_ID) {
      const count = prodDb
        .prepare(`SELECT COUNT(*) as count FROM "${table}" WHERE user_id = ?`)
        .get(userId) as { count: number };
      console.log(`  ${table}: ${count.count} rows`);
    }

    // Count transfers via transactions
    const transferCount = prodDb
      .prepare(
        `
      SELECT COUNT(*) as count FROM transfer
      WHERE from_txn_id IN (SELECT id FROM "transaction" WHERE user_id = ?)
    `
      )
      .get(userId) as { count: number };
    console.log(`  transfer: ${transferCount.count} rows`);
  } finally {
    backupDb.close();
    prodDb.close();
  }
}

function migrateTableWithUserId(
  backupDb: Database.Database,
  prodDb: Database.Database,
  table: string,
  userId: string
): void {
  // Get column names from both databases
  const backupColumns = getColumnNames(backupDb, table);
  const prodColumns = getColumnNames(prodDb, table);

  // Find common columns (excluding user_id since backup doesn't have it)
  const prodColumnsWithoutUserId = prodColumns.filter((col) => col !== 'user_id');
  const commonColumns = backupColumns.filter((col) => prodColumnsWithoutUserId.includes(col));

  if (commonColumns.length === 0) {
    console.log(`  Skipping ${table} - no common columns`);
    return;
  }

  // Read all rows from backup
  const selectSql = `SELECT "${commonColumns.join('", "')}" FROM "${table}"`;
  const rows = backupDb.prepare(selectSql).all();

  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (empty)`);
    return;
  }

  // Prepare insert statement with user_id added
  const insertColumns = ['user_id', ...commonColumns];
  const placeholders = insertColumns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO "${table}" ("${insertColumns.join('", "')}") VALUES (${placeholders})`;
  const insertStmt = prodDb.prepare(insertSql);

  // Insert each row with user_id prepended
  let inserted = 0;
  for (const row of rows) {
    const values = [userId, ...commonColumns.map((col) => (row as Record<string, unknown>)[col])];
    try {
      insertStmt.run(...values);
      inserted++;
    } catch (error) {
      console.error(`  Warning: Failed to insert row in ${table}:`, error);
    }
  }

  console.log(`  ${table}: ${inserted} rows migrated`);
}

function migrateTransferTable(backupDb: Database.Database, prodDb: Database.Database): void {
  const table = 'transfer';

  // Get column names
  const backupColumns = getColumnNames(backupDb, table);
  const prodColumns = getColumnNames(prodDb, table);

  // Use only columns that exist in both
  const commonColumns = backupColumns.filter((col) => prodColumns.includes(col));

  if (commonColumns.length === 0) {
    console.log(`  Skipping ${table} - no common columns`);
    return;
  }

  // Read all rows from backup
  const selectSql = `SELECT "${commonColumns.join('", "')}" FROM "${table}"`;
  const rows = backupDb.prepare(selectSql).all();

  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (empty)`);
    return;
  }

  // Prepare insert statement
  const placeholders = commonColumns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO "${table}" ("${commonColumns.join('", "')}") VALUES (${placeholders})`;
  const insertStmt = prodDb.prepare(insertSql);

  // Insert each row
  let inserted = 0;
  for (const row of rows) {
    const values = commonColumns.map((col) => (row as Record<string, unknown>)[col]);
    try {
      insertStmt.run(...values);
      inserted++;
    } catch (error) {
      console.error(`  Warning: Failed to insert row in ${table}:`, error);
    }
  }

  console.log(`  ${table}: ${inserted} rows migrated`);
}

// Main entry point
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/migrate-backup-to-user.ts <backup-file-path> <user-id>');
  console.error(
    'Example: npx tsx scripts/migrate-backup-to-user.ts ../backups/budget_20260131_183500_1800d96.db abc123'
  );
  console.error('\nTo find available user IDs, run the script with any backup path and');
  console.error('an invalid user ID - it will list available users.');
  process.exit(1);
}

const backupPath = resolve(args[0]);
const userId = args[1];

// Verify backup file exists
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

migrateData(backupPath, userId);
