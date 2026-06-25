import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { OpenApiService } from './openapi/openapi.service.js';

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3000;

  const config = new DocumentBuilder()
    .setTitle('Castaway')
    .setDescription('Castaway API')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.get(OpenApiService).setDocument(document);

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(port);

  console.log(`Castaway running on http://localhost:${port}`);
};

await bootstrap();
