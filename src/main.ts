import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import hbsModule from 'hbs';
import { join } from 'path';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const hbs = hbsModule as { registerPartials: (dir: string) => void };

  const viewsDir = join(import.meta.dirname, '..', '..', 'views');
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('hbs');
  app.set('view options', { layout: 'layouts/main' });
  hbs.registerPartials(join(viewsDir, 'partials'));

  const publicDir = join(import.meta.dirname, '..', '..', 'public');
  app.useStaticAssets(publicDir);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 3600000 }, // 1 hour
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  console.log(`Castaway running on http://localhost:${port}`);
}

void bootstrap();
