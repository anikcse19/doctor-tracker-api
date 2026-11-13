import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthenticatedAdmin } from '../../types/express.js';
import { Admin } from './admin.model.js';
import type { LoginInput } from './auth.schema.js';

export const BCRYPT_COST = 12;
const JWT_ALGORITHM = 'HS256';

interface SessionTokenPayload {
  sub: string;
  role: 'admin';
}

// Compared against when the email doesn't exist, so a failed login takes the same time
// whether or not the account exists (prevents user enumeration via response timing).
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', BCRYPT_COST);

export async function login({ email, password }: LoginInput) {
  const admin = await Admin.findOne({ email }).select('+passwordHash');

  const passwordMatches = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !passwordMatches) {
    // Deliberately identical message for "no such user" and "wrong password".
    throw ApiError.unauthorized('Invalid email or password');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const payload: SessionTokenPayload = { sub: admin.id, role: 'admin' };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { token, admin: toAuthenticatedAdmin(admin) };
}

/** Verifies the token AND that the admin still exists (a deleted account loses access immediately). */
export async function resolveSession(token: string): Promise<AuthenticatedAdmin> {
  let payload: SessionTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as SessionTokenPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }

  const admin = await Admin.findById(payload.sub).lean();
  if (!admin) throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');

  return toAuthenticatedAdmin({ ...admin, id: String(admin._id) });
}

function toAuthenticatedAdmin(admin: { id: string; name: string; email: string }) {
  return { id: admin.id, name: admin.name, email: admin.email, role: 'admin' as const };
}
