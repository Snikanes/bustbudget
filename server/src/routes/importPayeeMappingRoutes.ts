import { Router, Request, Response, NextFunction } from 'express';
import * as importPayeeMappingService from '../services/importPayeeMappingService.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/import-payee-mappings
router.get('/', asyncHandler(async (req, res) => {
  const mappings = importPayeeMappingService.getAllMappings();
  res.json({ mappings });
}));

// POST /api/import-payee-mappings
router.post('/', asyncHandler(async (req, res) => {
  const { originalPayee, payeeId } = req.body as { originalPayee: string; payeeId: string };
  const mapping = importPayeeMappingService.upsertMapping(originalPayee, payeeId);
  res.status(201).json({ mapping });
}));

// DELETE /api/import-payee-mappings/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  importPayeeMappingService.deleteMapping(req.params.id);
  res.status(204).send();
}));

export default router;
