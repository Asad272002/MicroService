import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { seedDatabase } from '../src/database/seed-database';

export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
  dbPath: string;
}> {
  const dbPath = join(
    process.cwd(),
    'data',
    `test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );

  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  process.env.DB_PATH = dbPath;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();

  const dataSource = app.get(DataSource);
  await seedDatabase(dataSource);

  return { app, dataSource, dbPath };
}

export async function destroyTestApp(
  app: INestApplication,
  dbPath: string,
): Promise<void> {
  await app.close();
  rmSync(dbPath, { force: true });
  delete process.env.DB_PATH;
}
