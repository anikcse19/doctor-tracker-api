import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { resolveSession } from '../modules/auth/auth.service.js';
import { SESSION_COOKIE } from '../modules/auth/session-cookie.js';

/**
 * Requires a valid session. The token is read from the HttpOnly cookie (browser clients)
 * or an `Authorization: Bearer` header (API clients / testing tools).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const cookieToken: unknown = req.cookies?.[SESSION_COOKIE];
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = typeof cookieToken === 'string' && cookieToken ? cookieToken : bearerToken;

  if (!token) throw ApiError.unauthorized();

  req.admin = await resolveSession(token);
  next();
};
