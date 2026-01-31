/**
 * Migration to add user authentication tables.
 *
 * Creates:
 * - user table for storing user accounts (Google OAuth)
 * - refresh_token table for JWT refresh token storage
 */
export async function up({ context: queryInterface }) {
  // Create user table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      picture TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create index on google_id for OAuth lookups
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_user_google_id ON user(google_id)
  `);

  // Create index on email for lookups
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email)
  `);

  // Create updated_at trigger for user table
  await queryInterface.sequelize.query(`
    CREATE TRIGGER IF NOT EXISTS trg_user_updated
      AFTER UPDATE ON user
      FOR EACH ROW
    BEGIN
      UPDATE user SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Create refresh_token table
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS refresh_token (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    )
  `);

  // Create index for token lookups
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_token(token_hash)
  `);

  // Create index for user's tokens
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_token(user_id)
  `);
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_user_updated`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_refresh_token_user`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_refresh_token_hash`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS refresh_token`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_user_email`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_user_google_id`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS user`);
}
