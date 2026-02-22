import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DB_PATH = join(__dirname, '../../test-data/test.db');

export async function setup() {
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';

  const dir = dirname(TEST_DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH);
  }

  const { runMigrations } = await import('../db/runMigrations.js');
  await runMigrations();
}

export async function teardown() {
  // test-data/ left for inspection; CI can delete the directory
}
