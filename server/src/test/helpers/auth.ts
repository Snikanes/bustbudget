import { generateAccessToken } from '../../utils/jwt.js';

export function makeAuthCookie(userId: string, email: string): string {
  return `access_token=${generateAccessToken({ userId, email })}`;
}
