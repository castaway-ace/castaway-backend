import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { PrismaClientExceptionFilter } from './prisma/prisma.filter.js';

const ENVS = ['development'];

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const env = process.env.NODE_ENV as string;

  if (ENVS.includes(env)) {
    const swaggerUsername = process.env.SWAGGER_USERNAME as string;
    const swaggerPassword = process.env.SWAGGER_PASSWORD as string;

    app.use(
      ['/docs', '/docs-json', '/docs-yaml'],
      basicAuth({
        challenge: true,
        users: {
          [swaggerUsername]: swaggerPassword,
        },
      }),
    );

    const config = new DocumentBuilder()
      .setTitle('Castaway')
      .setDescription('The API documentation')
      .setVersion('0.1')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  const PORT = process.env.PORT ?? 3000;

  await app.listen(PORT);

  console.log(`Castaway running on http://localhost:${PORT}`);
};

await bootstrap();
