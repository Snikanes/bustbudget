import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './db/index.js';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import categoryGroupRoutes from './routes/categoryGroupRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import categoryTargetRoutes from './routes/categoryTargetRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import payeeRoutes from './routes/payeeRoutes.js';
import importPayeeMappingRoutes from './routes/importPayeeMappingRoutes.js';
import importProfileRoutes from './routes/importProfileRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/accounts', requireAuth, accountRoutes);
app.use('/api/category-groups', requireAuth, categoryGroupRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/categories', requireAuth, categoryTargetRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/transfers', requireAuth, transferRoutes);
app.use('/api/budgets', requireAuth, budgetRoutes);
app.use('/api/payees', requireAuth, payeeRoutes);
app.use('/api/import-payee-mappings', requireAuth, importPayeeMappingRoutes);
app.use('/api/import-profiles', requireAuth, importProfileRoutes);

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
