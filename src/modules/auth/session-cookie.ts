import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../../config/env.js';

export const SESSION_COOKIE = 'dt_session';

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Converts "8h" / "30m" / "7d" (already validated in env.ts) to milliseconds. */
function durationToMs(duration: string): number {
  const unit = duration.slice(-1) as keyof typeof UNIT_MS;
  return Number(duration.slice(0, -1)) * UNIT_MS[unit];
}

const baseCookieOptions: CookieOptions = {
  httpOnly: true, // not readable from JavaScript → immune to token theft via XSS
  secure: isProduction, // HTTPS only in production
  sameSite: 'lax', // not sent on cross-site POSTs → CSRF mitigation
  path: '/',
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: durationToMs(env.JWT_EXPIRES_IN),
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions);
}
