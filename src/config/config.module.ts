// config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema.js';
import { appConfig } from './app.config.js';
import { authConfig } from './auth.config.js';
import z from 'zod';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, authConfig],
      validate: (raw: Record<string, unknown>) => {
        const result = envSchema.safeParse(raw);
        if (!result.success) {
          throw new Error(
            `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
          );
        }
        return result.data;
      },
    }),
  ],
})
export class ConfigModule {}