// auth.config.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => {
  const env = process.env;
  return {
    appPort: env.APP_PORT,
    nodeEnv: env.NODE_ENV,
  };
});

export type AppConfig = ReturnType<typeof appConfig>;