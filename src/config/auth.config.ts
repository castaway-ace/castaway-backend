// auth.config.ts
import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => {
  const env = process.env;
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
    bcryptRounds: env.BCRYPT_ROUNDS,
  };
});

export type AuthConfig = ReturnType<typeof authConfig>;