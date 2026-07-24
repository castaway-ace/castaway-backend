import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

const bootstrap = async () => {
  const app = await NestFactory.create(WorkerModule);

  // Let Nest close the BullMQ worker (draining the active job) and disconnect
  // Prisma on SIGTERM/SIGINT, so a redeploy shuts the worker down cleanly.
  app.enableShutdownHooks();

  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT);

  console.log(`Castaway worker running on http://localhost:${PORT}`);
};

await bootstrap();
