import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

const rateLimitedBody = (message: string) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

/** General protection for every API route. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitedBody('Too many requests. Please slow down.'),
});

/**
 * Brute-force protection for login. Keyed by IP + email so that, behind a shared proxy
 * (e.g. Vercel rewrites), one attacker hammering an account cannot lock out every user.
 * Only failed attempts count.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}:${email}`;
  },
  message: rateLimitedBody('Too many failed login attempts. Please try again in 15 minutes.'),
});
