import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';

import { GlobalHttpExceptionFilter } from './common/global-http-exception.filter';

export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  return app;
}
