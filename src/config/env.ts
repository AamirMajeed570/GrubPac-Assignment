import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3000'), 10),

  database: {
    url: requireEnv('DATABASE_URL'),
    testUrl: optionalEnv('TEST_DATABASE_URL', ''),
  },

  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
    password: process.env['REDIS_PASSWORD'],
  },

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  rateLimit: {
    authWindowMs: parseInt(optionalEnv('AUTH_RATE_LIMIT_WINDOW_MS', '60000'), 10),
    authMax: parseInt(optionalEnv('AUTH_RATE_LIMIT_MAX', '10'), 10),
  },

  email: {
    from: optionalEnv('EMAIL_FROM', 'onboarding@resend.dev'),
    resendApiKey: process.env['RESEND_API_KEY'],
  },

  isProduction: process.env['NODE_ENV'] === 'production',
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isTest: process.env['NODE_ENV'] === 'test',
} as const;
