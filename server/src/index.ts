import 'dotenv/config';
import { initializeDatabase } from './db/index.js';
import app from './app.js';

const PORT = process.env.PORT || 3001;

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
