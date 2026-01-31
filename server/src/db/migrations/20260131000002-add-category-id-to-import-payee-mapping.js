/**
 * Placeholder migration for documentation purposes.
 * The category_id column is already included in the initial schema migration.
 * This migration exists to document the history of the database schema evolution.
 */
export async function up({ context: queryInterface }) {
  // Check if category_id column already exists
  const [results] = await queryInterface.sequelize.query(
    `PRAGMA table_info(import_payee_mapping)`
  );

  const hasCategory = results.some(col => col.name === 'category_id');

  if (!hasCategory) {
    await queryInterface.sequelize.query(`
      ALTER TABLE import_payee_mapping
      ADD COLUMN category_id TEXT REFERENCES category(id) ON DELETE SET NULL
    `);
  }
}

export async function down({ context: queryInterface }) {
  // SQLite doesn't support DROP COLUMN directly
  // This would require recreating the table, which is risky for a rollback
  // For safety, this is a no-op
  console.log('Warning: Cannot drop category_id column from import_payee_mapping in SQLite without recreating table');
}
