import { v4 as uuidv4 } from 'uuid';

/**
 * Migration to link import_payee_mapping to the payee table.
 *
 * Changes:
 * - Replace mapped_payee (text) with payee_id (foreign key to payee table)
 * - Remove category_id (will use payee.last_category_id instead)
 *
 * This ensures single source of truth for payee names and unified category defaults.
 */
export async function up({ context: queryInterface }) {
  // 1. Add payee_id column (nullable initially for migration)
  await queryInterface.sequelize.query(`
    ALTER TABLE import_payee_mapping ADD COLUMN payee_id TEXT
  `);

  // 2. For each existing mapping, find or create payee and set payee_id
  const [mappings] = await queryInterface.sequelize.query(
    `SELECT id, mapped_payee, category_id FROM import_payee_mapping`
  );

  for (const mapping of mappings) {
    // Check if payee already exists
    const [existingPayees] = await queryInterface.sequelize.query(
      `SELECT id FROM payee WHERE name = ?`,
      { replacements: [mapping.mapped_payee] }
    );

    let payeeId;
    if (existingPayees.length > 0) {
      payeeId = existingPayees[0].id;
      // If mapping had a category_id and payee doesn't have last_category_id, update it
      if (mapping.category_id) {
        const [payeeRow] = await queryInterface.sequelize.query(
          `SELECT last_category_id FROM payee WHERE id = ?`,
          { replacements: [payeeId] }
        );
        if (payeeRow.length > 0 && !payeeRow[0].last_category_id) {
          await queryInterface.sequelize.query(
            `UPDATE payee SET last_category_id = ? WHERE id = ?`,
            { replacements: [mapping.category_id, payeeId] }
          );
        }
      }
    } else {
      // Create new payee with mapping's category_id as last_category_id
      payeeId = uuidv4();
      await queryInterface.sequelize.query(
        `INSERT INTO payee (id, name, last_category_id, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        { replacements: [payeeId, mapping.mapped_payee, mapping.category_id] }
      );
    }

    // Update mapping with payee_id
    await queryInterface.sequelize.query(
      `UPDATE import_payee_mapping SET payee_id = ? WHERE id = ?`,
      { replacements: [payeeId, mapping.id] }
    );
  }

  // 3. Rebuild table without mapped_payee and category_id (SQLite limitation)
  await queryInterface.sequelize.query(`
    CREATE TABLE import_payee_mapping_new (
      id TEXT PRIMARY KEY,
      original_payee TEXT NOT NULL UNIQUE,
      payee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (payee_id) REFERENCES payee(id) ON DELETE CASCADE
    )
  `);

  await queryInterface.sequelize.query(`
    INSERT INTO import_payee_mapping_new (id, original_payee, payee_id, created_at, updated_at)
    SELECT id, original_payee, payee_id, created_at, updated_at FROM import_payee_mapping
  `);

  await queryInterface.sequelize.query(`DROP TABLE import_payee_mapping`);
  await queryInterface.sequelize.query(`ALTER TABLE import_payee_mapping_new RENAME TO import_payee_mapping`);

  // 4. Recreate index
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_import_payee_mapping_original ON import_payee_mapping(original_payee)
  `);

  // 5. Recreate update trigger
  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_import_payee_mapping_updated
        AFTER UPDATE ON import_payee_mapping
        FOR EACH ROW
    BEGIN
        UPDATE import_payee_mapping SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
}

export async function down({ context: queryInterface }) {
  // Rebuild table with original schema (mapped_payee and category_id)
  await queryInterface.sequelize.query(`
    CREATE TABLE import_payee_mapping_old (
      id TEXT PRIMARY KEY,
      original_payee TEXT NOT NULL UNIQUE,
      mapped_payee TEXT NOT NULL,
      category_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL
    )
  `);

  // Migrate data back by joining with payee table
  await queryInterface.sequelize.query(`
    INSERT INTO import_payee_mapping_old (id, original_payee, mapped_payee, category_id, created_at, updated_at)
    SELECT ipm.id, ipm.original_payee, p.name, p.last_category_id, ipm.created_at, ipm.updated_at
    FROM import_payee_mapping ipm
    JOIN payee p ON ipm.payee_id = p.id
  `);

  await queryInterface.sequelize.query(`DROP TABLE import_payee_mapping`);
  await queryInterface.sequelize.query(`ALTER TABLE import_payee_mapping_old RENAME TO import_payee_mapping`);

  // Recreate index
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_import_payee_mapping_original ON import_payee_mapping(original_payee)
  `);

  // Recreate update trigger
  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_import_payee_mapping_updated
        AFTER UPDATE ON import_payee_mapping
        FOR EACH ROW
    BEGIN
        UPDATE import_payee_mapping SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
}
