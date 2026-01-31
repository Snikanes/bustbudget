import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateWithGoogle,
  refreshAccessToken,
  revokeRefreshToken,
} from '../services/authService.js';
import { getUserById } from '../services/userService.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../utils/jwt.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * POST /api/auth/google
 * Exchange a Google ID token for app tokens
 */
router.post('/google', asyncHandler(async (req, res) => {
  const { idToken } = req.body as { idToken: string };

  if (!idToken) {
    res.status(400).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Google ID token is required',
      },
    });
    return;
  }

  const { accessToken, refreshToken, user } = await authenticateWithGoogle(idToken);

  // Set cookies
  res.cookie('access_token', accessToken, getAccessTokenCookieOptions());
  res.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions());

  res.json({ user });
}));

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    res.status(401).json({
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token not found',
      },
    });
    return;
  }

  const result = refreshAccessToken(refreshToken);

  if (!result) {
    // Clear invalid cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      },
    });
    return;
  }

  // Set new access token cookie
  res.cookie('access_token', result.accessToken, getAccessTokenCookieOptions());

  res.json({ user: result.user });
}));

/**
 * POST /api/auth/logout
 * Logout the user (revoke refresh token, clear cookies)
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }

  // Clear cookies
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');

  res.json({ success: true });
}));

/**
 * GET /api/auth/me
 * Get the currently authenticated user
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = getUserById(req.user!.userId);
  res.json({ user });
}));

export default router;
