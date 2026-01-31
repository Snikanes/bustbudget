/**
 * Migration to add user_id to all data tables for multi-tenancy.
 *
 * Since we're starting with a clean slate, this migration:
 * 1. Drops all existing data tables (transfer first due to FK)
 * 2. Recreates them with user_id columns and updated UNIQUE constraints
 *
 * WARNING: This migration deletes all existing data!
 */
export async function up({ context: queryInterface }) {
  // Drop tables in order (respecting foreign keys)
  // transfer references transaction
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS transfer`);
  // monthly_budget, category_target reference category
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS monthly_budget`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category_target`);
  // import_payee_mapping references payee
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS import_payee_mapping`);
  // transaction references account, category
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "transaction"`);
  // category references category_group
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category`);
  // payee standalone
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS payee`);
  // category_group standalone
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS category_group`);
  // account standalone
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS account`);

  // Drop triggers
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_account_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_group_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_payee_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_transaction_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_monthly_budget_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_category_target_updated`);
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_import_payee_mapping_updated`);

  // Recreate account table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE account (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      UNIQUE (user_id, name)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_account_user ON account(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_account_updated
      AFTER UPDATE ON account
      FOR EACH ROW
    BEGIN
      UPDATE account SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate category_group table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE category_group (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      UNIQUE (user_id, name)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_group_user ON category_group(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_group_sort ON category_group(sort_order)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_category_group_updated
      AFTER UPDATE ON category_group
      FOR EACH ROW
    BEGIN
      UPDATE category_group SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate payee table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE payee (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      last_category_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (last_category_id) REFERENCES category(id) ON DELETE SET NULL,
      UNIQUE (user_id, name)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_payee_user ON payee(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_payee_name ON payee(name)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_payee_updated
      AFTER UPDATE ON payee
      FOR EACH ROW
    BEGIN
      UPDATE payee SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate category table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE category (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      group_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES category_group(id) ON DELETE SET NULL,
      UNIQUE (user_id, group_id, name)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_user ON category(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_group ON category(group_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_sort ON category(group_id, sort_order)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_category_updated
      AFTER UPDATE ON category
      FOR EACH ROW
    BEGIN
      UPDATE category SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate transfer table (no user_id needed - validates through transaction)
  await queryInterface.sequelize.query(`
    CREATE TABLE transfer (
      id TEXT PRIMARY KEY,
      from_txn_id TEXT NOT NULL,
      to_txn_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (from_txn_id),
      UNIQUE (to_txn_id),
      CHECK (from_txn_id != to_txn_id)
    )
  `);

  // Recreate transaction table with user_id
  // is_cleared: 0 = uncleared, 1 = cleared, 2 = reconciled
  await queryInterface.sequelize.query(`
    CREATE TABLE "transaction" (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
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
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL,
      FOREIGN KEY (transfer_id) REFERENCES transfer(id) ON DELETE SET NULL,
      CHECK (transfer_id IS NULL OR category_id IS NULL),
      CHECK (is_starting_balance = 0 OR category_id IS NULL)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_user ON "transaction"(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_account ON "transaction"(account_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_category ON "transaction"(category_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_date ON "transaction"(date)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_transfer ON "transaction"(transfer_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_transaction_year_month ON "transaction"(substr(date, 1, 7))
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_transaction_updated
      AFTER UPDATE ON "transaction"
      FOR EACH ROW
    BEGIN
      UPDATE "transaction" SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate monthly_budget table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE monthly_budget (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      assigned_amount INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE,
      UNIQUE (user_id, category_id, year_month),
      CHECK (year_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_monthly_budget_user ON monthly_budget(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_monthly_budget_category ON monthly_budget(category_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_monthly_budget_month ON monthly_budget(year_month)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_monthly_budget_lookup ON monthly_budget(category_id, year_month)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_monthly_budget_updated
      AFTER UPDATE ON monthly_budget
      FOR EACH ROW
    BEGIN
      UPDATE monthly_budget SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate category_target table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE category_target (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('monthly', 'yearly', 'by_date')),
      target_amount INTEGER NOT NULL,
      target_date TEXT NOT NULL,
      recurrence_day INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE,
      UNIQUE (user_id, category_id)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_target_user ON category_target(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_category_target_category ON category_target(category_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_category_target_updated
      AFTER UPDATE ON category_target
      FOR EACH ROW
    BEGIN
      UPDATE category_target SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Recreate import_payee_mapping table with user_id
  await queryInterface.sequelize.query(`
    CREATE TABLE import_payee_mapping (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_payee TEXT NOT NULL,
      payee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (payee_id) REFERENCES payee(id) ON DELETE CASCADE,
      UNIQUE (user_id, original_payee)
    )
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_import_payee_mapping_user ON import_payee_mapping(user_id)
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX idx_import_payee_mapping_original ON import_payee_mapping(original_payee)
  `);

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
  // This is a destructive migration - down would need to restore original schema
  // Since we're starting fresh, just drop and let initial schema migration run
  console.warn('WARNING: Rolling back this migration requires manual database reset.');
  console.warn('Run: rm server/data/budget.db && npm run dev');
}
