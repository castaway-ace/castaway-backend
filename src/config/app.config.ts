import { registerAs } from '@nestjs/config';
import z from 'zod';

const schema = z.object({
  appPort: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.string()
});

export type AppConfig = z.infer<typeof schema>;

export const appConfig = registerAs('app', (): AppConfig => {
  return schema.parse({
    appPort: process.env.APP_PORT,
    nodeEnv: process.env.NODE_ENV,
  });
});
