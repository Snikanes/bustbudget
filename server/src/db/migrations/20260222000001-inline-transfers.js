export async function up({ context: queryInterface }) {
  // Step 1: Add new columns to transaction
  await queryInterface.sequelize.query(`
    ALTER TABLE "transaction" ADD COLUMN linked_transaction_id TEXT
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE "transaction" ADD COLUMN transfer_account_id TEXT
  `);

  // Step 2: Backfill from existing transfer + transaction data
  // For the "from" transaction: linked = to_txn, transfer_account = to_txn's account
  await queryInterface.sequelize.query(`
    UPDATE "transaction"
    SET linked_transaction_id = (
      SELECT tr.to_txn_id FROM transfer tr WHERE tr.from_txn_id = "transaction".id
    ),
    transfer_account_id = (
      SELECT other_t.account_id
      FROM transfer tr
      JOIN "transaction" other_t ON other_t.id = tr.to_txn_id
      WHERE tr.from_txn_id = "transaction".id
    )
    WHERE transfer_id IS NOT NULL
      AND id IN (SELECT from_txn_id FROM transfer)
  `);

  // For the "to" transaction: linked = from_txn, transfer_account = from_txn's account
  await queryInterface.sequelize.query(`
    UPDATE "transaction"
    SET linked_transaction_id = (
      SELECT tr.from_txn_id FROM transfer tr WHERE tr.to_txn_id = "transaction".id
    ),
    transfer_account_id = (
      SELECT other_t.account_id
      FROM transfer tr
      JOIN "transaction" other_t ON other_t.id = tr.from_txn_id
      WHERE tr.to_txn_id = "transaction".id
    )
    WHERE transfer_id IS NOT NULL
      AND id IN (SELECT to_txn_id FROM transfer)
  `);

  // Step 3: Rebuild transaction table without transfer_id, with new constraints
  // SQLite doesn't support DROP COLUMN or ADD CONSTRAINT, so we rebuild
  await queryInterface.sequelize.query(`
    CREATE TABLE "transaction_new" (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      category_id TEXT,
      linked_transaction_id TEXT,
      transfer_account_id TEXT,
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
      FOREIGN KEY (transfer_account_id) REFERENCES account(id) ON DELETE RESTRICT,
      CHECK (linked_transaction_id IS NULL OR category_id IS NULL),
      CHECK (is_starting_balance = 0 OR category_id IS NULL)
    )
  `);

  await queryInterface.sequelize.query(`
    INSERT INTO "transaction_new"
      (id, user_id, account_id, category_id, linked_transaction_id, transfer_account_id,
       date, amount, payee, memo, is_cleared, is_starting_balance, created_at, updated_at)
    SELECT
      id, user_id, account_id, category_id, linked_transaction_id, transfer_account_id,
      date, amount, payee, memo, is_cleared, is_starting_balance, created_at, updated_at
    FROM "transaction"
  `);

  await queryInterface.sequelize.query(`DROP TABLE "transaction"`);
  await queryInterface.sequelize.query(`ALTER TABLE "transaction_new" RENAME TO "transaction"`);

  // Step 4: Recreate indexes
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_user ON "transaction"(user_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_account ON "transaction"(account_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_category ON "transaction"(category_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_date ON "transaction"(date)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_linked ON "transaction"(linked_transaction_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_transfer_account ON "transaction"(transfer_account_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_year_month ON "transaction"(substr(date, 1, 7))`);

  // Step 5: Recreate the updated_at trigger
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_transaction_updated`);
  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_transaction_updated
      AFTER UPDATE ON "transaction"
      FOR EACH ROW
    BEGIN
      UPDATE "transaction" SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Step 6: Drop the transfer table
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS transfer`);
}

export async function down({ context: queryInterface }) {
  // Recreate transfer table
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

  // Rebuild transaction table with transfer_id
  await queryInterface.sequelize.query(`
    CREATE TABLE "transaction_new" (
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
    INSERT INTO "transaction_new"
      (id, user_id, account_id, category_id, date, amount, payee, memo,
       is_cleared, is_starting_balance, created_at, updated_at)
    SELECT
      id, user_id, account_id, category_id, date, amount, payee, memo,
      is_cleared, is_starting_balance, created_at, updated_at
    FROM "transaction"
  `);

  await queryInterface.sequelize.query(`DROP TABLE "transaction"`);
  await queryInterface.sequelize.query(`ALTER TABLE "transaction_new" RENAME TO "transaction"`);

  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_user ON "transaction"(user_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_account ON "transaction"(account_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_category ON "transaction"(category_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_date ON "transaction"(date)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_transfer ON "transaction"(transfer_id)`);
  await queryInterface.sequelize.query(`CREATE INDEX idx_transaction_year_month ON "transaction"(substr(date, 1, 7))`);

  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_transaction_updated`);
  await queryInterface.sequelize.query(`
    CREATE TRIGGER trg_transaction_updated
      AFTER UPDATE ON "transaction"
      FOR EACH ROW
    BEGIN
      UPDATE "transaction" SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
}
