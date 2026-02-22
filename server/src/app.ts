import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import categoryGroupRoutes from './routes/categoryGroupRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import categoryTargetRoutes from './routes/categoryTargetRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import payeeRoutes from './routes/payeeRoutes.js';
import importPayeeMappingRoutes from './routes/importPayeeMappingRoutes.js';
import importProfileRoutes from './routes/importProfileRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/accounts', requireAuth, accountRoutes);
app.use('/api/category-groups', requireAuth, categoryGroupRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/categories', requireAuth, categoryTargetRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/budgets', requireAuth, budgetRoutes);
app.use('/api/payees', requireAuth, payeeRoutes);
app.use('/api/import-payee-mappings', requireAuth, importPayeeMappingRoutes);
app.use('/api/import-profiles', requireAuth, importProfileRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
