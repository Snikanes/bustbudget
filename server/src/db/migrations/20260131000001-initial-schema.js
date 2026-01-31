/**
 * Initial database schema migration.
 * Creates all tables required for the YNAB Clone application.
 * All amounts are stored as INTEGER (cents/øre) to avoid floating-point issues.
 * Positive = inflow, Negative = outflow.
 */
export async function up({ context: queryInterface }) {
  // Account table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Category group table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS category_group (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_category_group_sort ON category_group(sort_order)
  `);

  // Payee table (stores payee-category associations for auto-fill)
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "payee" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      last_category_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (last_category_id) REFERENCES category(id) ON DELETE SET NULL
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_payee_name ON payee(name)
  `);

  // Category table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS category (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES category_group(id) ON DELETE SET NULL,
      UNIQUE (group_id, name)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_category_group ON category(group_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_category_sort ON category(group_id, sort_order)
  `);

  // Transfer table (links two transactions)
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS transfer (
      id TEXT PRIMARY KEY,
      from_txn_id TEXT NOT NULL,
      to_txn_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (from_txn_id),
      UNIQUE (to_txn_id),
      CHECK (from_txn_id != to_txn_id)
    )
  `);

  // Transaction table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "transaction" (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      category_id TEXT,
      transfer_id TEXT,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payee TEXT,
      memo TEXT,
      is_cleared INTEGER NOT NULL DEFAULT 0,
      is_starting_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL,
      FOREIGN KEY (transfer_id) REFERENCES transfer(id) ON DELETE SET NULL,
      CHECK (transfer_id IS NULL OR category_id IS NULL),
      CHECK (is_starting_balance = 0 OR category_id IS NULL)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_transaction_account ON "transaction"(account_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_transaction_category ON "transaction"(category_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_transaction_date ON "transaction"(date)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_transaction_transfer ON "transaction"(transfer_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_transaction_year_month ON "transaction"(substr(date, 1, 7))
  `);

  // Monthly budget table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS monthly_budget (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      assigned_amount INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE,
      UNIQUE (category_id, year_month),
      CHECK (year_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_monthly_budget_category ON monthly_budget(category_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_monthly_budget_month ON monthly_budget(year_month)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_monthly_budget_lookup ON monthly_budget(category_id, year_month)
  `);

  // Category target table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS category_target (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('monthly', 'yearly', 'by_date')),
      target_amount INTEGER NOT NULL,
      target_date TEXT NOT NULL,
      recurrence_day INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE,
      UNIQUE (category_id)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_category_target_category ON category_target(category_id)
  `);

  // Import payee mapping table (maps payees from import files to user-preferred names and categories)
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS import_payee_mapping (
      id TEXT PRIMARY KEY,
      original_payee TEXT NOT NULL UNIQUE,
      mapped_payee TEXT NOT NULL,
      category_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_import_payee_mapping_original ON import_payee_mapping(original_payee)
  `);

  // Triggers for updated_at timestamps
  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_account_updated
      AFTER UPDATE ON account
      FOR EACH ROW
    BEGIN
      UPDATE account SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_category_group_updated
      AFTER UPDATE ON category_group
      FOR EACH ROW
    BEGIN
      UPDATE category_group SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_category_updated
      AFTER UPDATE ON category
      FOR EACH ROW
    BEGIN
      UPDATE category SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_payee_updated
      AFTER UPDATE ON payee
      FOR EACH ROW
    BEGIN
      UPDATE payee SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_transaction_updated
      AFTER UPDATE ON "transaction"
      FOR EACH ROW
    BEGIN
      UPDATE "transaction" SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_monthly_budget_updated
      AFTER UPDATE ON monthly_budget
      FOR EACH ROW
    BEGIN
      UPDATE monthly_budget SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_category_target_updated
      AFTER UPDATE ON category_target
      FOR EACH ROW
    BEGIN
      UPDATE category_target SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_import_payee_mapping_updated
      AFTER UPDATE ON import_payee_mapping
      FOR EACH ROW
    BEGIN
      UPDATE import_payee_mapping SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
}

export async function down({ context: queryInterface }) {
  // Drop triggers first
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_import_payee_mapping_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_target_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_monthly_budget_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_transaction_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_payee_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_group_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_account_updated`);

  // Drop tables in reverse dependency order
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS import_payee_mapping`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category_target`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS monthly_budget`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "transaction"`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS transfer`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS payee`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category_group`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS account`);
}
