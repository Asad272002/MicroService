import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const databasePath = process.env.DB_PATH ?? 'data/dev.sqlite';

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
