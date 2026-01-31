import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// Environment variables with defaults for development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY: SignOptions['expiresIn'] = (process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m') as SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

/**
 * Generate an access token (JWT) for a user
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode an access token
 * Returns null if invalid or expired
 */
export function verifyAccessToken(token: string): DecodedAccessToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedAccessToken;
  } catch {
    return null;
  }
}

/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate refresh token expiration date
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
}

/**
 * Cookie options for access token (HTTP-only, secure in production)
 */
export function getAccessTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    path: '/',
  };
}

/**
 * Cookie options for refresh token (HTTP-only, secure in production)
 */
export function getRefreshTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
}
