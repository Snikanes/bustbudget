import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Middleware that requires authentication.
 * Extracts and verifies JWT from access_token cookie.
 * Attaches user info to request object.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (!accessToken) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  const decoded = verifyAccessToken(accessToken);
  if (!decoded) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  // Attach user info to request
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
  };

  next();
}

/**
 * Optional auth middleware - extracts user if token present, but doesn't require it.
 * Useful for routes that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (accessToken) {
    const decoded = verifyAccessToken(accessToken);
    if (decoded) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    }
  }

  next();
}
