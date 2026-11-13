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
 * Brute-force protection for login, keyed by client IP + email; only failed attempts count.
 * Correct client IPs depend on TRUST_PROXY_HOPS — otherwise every user behind the Vercel
 * rewrite would share one IP and a single attacker could lock everyone out.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}:${email}`;
  },
  message: rateLimitedBody('Too many failed login attempts. Please try again in 15 minutes.'),
});
