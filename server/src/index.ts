import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/index.js';
import accountRoutes from './routes/accountRoutes.js';
import categoryGroupRoutes from './routes/categoryGroupRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import categoryTargetRoutes from './routes/categoryTargetRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import payeeRoutes from './routes/payeeRoutes.js';
import importPayeeMappingRoutes from './routes/importPayeeMappingRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/category-groups', categoryGroupRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/categories', categoryTargetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/payees', payeeRoutes);
app.use('/api/import-payee-mappings', importPayeeMappingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
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
