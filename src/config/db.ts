import mongoose from 'mongoose';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

// Treat any user-supplied value inside a query filter as a literal, never as an operator.
// This blocks `{ "$ne": null }`-style NoSQL injection even if a value slips past validation.
mongoose.set('sanitizeFilter', true);
// Reject unknown fields in filters instead of silently dropping them.
mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    // Build indexes automatically in development; in production they are synced explicitly
    // by the seed script / on boot below so we never block requests on index builds.
    autoIndex: !isProduction,
  });

  if (isProduction) {
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  }

  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
