import { Router, Request, Response, NextFunction } from 'express';
import * as payeeService from '../services/payeeService.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/payees
router.get('/', asyncHandler(async (req, res) => {
  const payees = payeeService.getAllPayees();
  res.json({ payees });
}));

// POST /api/payees
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body as { name: string };
  const payee = payeeService.createPayee(name);
  res.status(201).json({ payee });
}));

export default router;
