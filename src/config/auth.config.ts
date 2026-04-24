import { registerAs } from '@nestjs/config';
import z from 'zod';

const schema = z.object({
  accessSecret: z.string().min(32),
  accessTtlSeconds: z.coerce.number().int().positive().default(900),
  refreshTtlSeconds: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  bcryptRounds: z.coerce.number().int().min(10).max(15).default(12),
});

export type AuthConfig = z.infer<typeof schema>;

export const authConfig = registerAs('auth', (): AuthConfig => {
  return schema.parse({
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessTtlSeconds: process.env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: process.env.JWT_REFRESH_TTL_SECONDS,
    bcryptRounds: process.env.BCRYPT_ROUNDS,
  });
});