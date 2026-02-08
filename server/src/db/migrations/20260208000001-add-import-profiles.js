export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS import_profile (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    )
  `);
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS import_profile');
}
