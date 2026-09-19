import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production the app is served same-origin (nginx proxies both / and /api
// to this process), so these only matter for the Vite dev server.
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

// nginx terminates TLS and forwards X-Forwarded-* headers.
app.set('trust proxy', 1);

app.use(cors({
  origin: corsOrigins,
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

// The same relative path resolves in both layouts: src/app.ts during
// development and dist/app.js inside the image.
const clientDist = process.env.CLIENT_DIST_PATH ?? join(__dirname, '../../client/dist');

// Only mounted when a built client is actually present. During development
// Vite serves the client and this directory does not exist.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    index: false,
    setHeaders: (res, filePath) => {
      // Hashed asset filenames can be cached forever; index.html cannot, or
      // clients keep loading the previous build after a deploy.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // SPA fallback for client-side routes. Unknown /api paths keep falling
  // through to the error handler instead of returning index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    // sendFile bypasses the static handler above, so set the header here too.
    res.sendFile(join(clientDist, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
}

app.use(errorHandler);

export default app;
