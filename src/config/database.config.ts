import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  url: z.url(),
});

export type DatabaseConfig = z.infer<typeof schema>;

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  return schema.parse({
    url: process.env.DATABASE_URL,
  });
});