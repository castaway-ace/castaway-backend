import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.url(),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Storage
  STORAGE_ENDPOINT: z.string(),
  STORAGE_PORT: z.coerce.number().int().positive().optional(),
  STORAGE_ACCESS_KEY: z.string(),
  STORAGE_SECRET_KEY: z.string(),
  STORAGE_BUCKET: z.string(),
  STORAGE_USE_SSL: z.coerce.boolean().default(false),
  STORAGE_REGION: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.url(),
  FACEBOOK_CLIENT_ID: z.string(),
  FACEBOOK_CLIENT_SECRET: z.string(),
  FACEBOOK_CALLBACK_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;
