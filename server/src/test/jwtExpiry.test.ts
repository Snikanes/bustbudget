import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { parseAccessTokenExpiry } from '../utils/jwt.js';

function lifetimeSeconds(expiresIn: ReturnType<typeof parseAccessTokenExpiry>): number {
  const token = jwt.sign({ userId: 'u', email: 'e' }, 'secret', { expiresIn });
  const decoded = jwt.decode(token) as { iat: number; exp: number };
  return decoded.exp - decoded.iat;
}

describe('parseAccessTokenExpiry', () => {
  it('defaults to a day when unset or blank', () => {
    expect(lifetimeSeconds(parseAccessTokenExpiry(undefined))).toBe(86400);
    expect(lifetimeSeconds(parseAccessTokenExpiry('   '))).toBe(86400);
  });

  it('passes timespan strings through', () => {
    expect(lifetimeSeconds(parseAccessTokenExpiry('15m'))).toBe(900);
    expect(lifetimeSeconds(parseAccessTokenExpiry('1d'))).toBe(86400);
  });

  // Left as a string this reaches ms() as 15 milliseconds, floors to a
  // zero-second lifetime, and every issued token is instantly expired.
  it('reads a bare number as seconds, not milliseconds', () => {
    expect(lifetimeSeconds(parseAccessTokenExpiry('15'))).toBe(15);
    expect(lifetimeSeconds('15' as never)).toBe(0);
  });
});
