import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH ?? join(__dirname, '../../data/budget.db');

export async function runMigrations(): Promise<void> {
  // Ensure data directory exists
  const dataDir = dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB_PATH,
    logging: false,
  });

  const umzug = new Umzug({
    migrations: {
      glob: join(__dirname, 'migrations/*.js'),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    const pending = await umzug.pending();
    if (pending.length > 0) {
      console.log(`Running ${pending.length} pending migration(s)...`);
      await umzug.up();
      console.log('Migrations completed successfully.');
    } else {
      console.log('No pending migrations.');
    }
  } finally {
    await sequelize.close();
  }
}
