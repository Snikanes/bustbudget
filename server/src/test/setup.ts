import { beforeAll, beforeEach } from 'vitest';
import { initializeDatabase } from '../db/index.js';
import { clearAllData } from './helpers/db.js';

let initialized = false;

beforeAll(async () => {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
});

beforeEach(() => {
  clearAllData();
});
