import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { loginSchema } from './auth.schema.js';
import * as authService from './auth.service.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { token, admin } = await authService.login(input);
  setSessionCookie(res, token);
  // The token itself is never returned in the body — it lives only in the HttpOnly cookie.
  sendSuccess(res, { admin });
}

export function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  res.status(204).end();
}

export function me(req: Request, res: Response) {
  if (!req.admin) throw ApiError.unauthorized();
  sendSuccess(res, { admin: req.admin });
}
