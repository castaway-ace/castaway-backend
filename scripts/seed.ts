import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from '../src/seed/seed.module.js';
import { SeedService } from '../src/seed/seed.service.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Seed');
  const appContext = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seedService = appContext.get(SeedService);
    await seedService.run();
  } catch (error) {
    logger.error('Seed failed', error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await appContext.close();
  }
}

void bootstrap();
