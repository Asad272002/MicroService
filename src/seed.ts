import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DataSource } from 'typeorm';

import { DATABASE_ENTITIES, getDatabaseOptions } from './database/database.config';
import { seedDatabase } from './database/seed-database';

async function runSeed(): Promise<void> {
  const databasePath = process.env.DB_PATH ?? 'data/dev.sqlite';
  const databaseOptions = getDatabaseOptions(databasePath);

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const dataSource = new DataSource({
    type: 'sqlite',
    database: databasePath,
    entities: DATABASE_ENTITIES,
    synchronize: databaseOptions.synchronize ?? true,
  });

  await dataSource.initialize();
  await seedDatabase(dataSource);
  await dataSource.destroy();

  process.stdout.write('Database seeded successfully.\n');
}

void runSeed();
