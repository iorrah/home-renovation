import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities.js';
import { migrations } from './migrations/index.js';

/** Shared by the Nest app, the TypeORM CLI, the seed script and the e2e test setup. */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations,
    // Schema changes only ever happen through reviewed migrations.
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'each',
  };
}
