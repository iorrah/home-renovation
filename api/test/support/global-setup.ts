// Runs once, in the main Vitest process, before any e2e file: migrates the test database.
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/database.options.js';
import { TEST_DATABASE_URL } from './test-database.js';

export default async function setup() {
  const dataSource = await new DataSource(buildDataSourceOptions(TEST_DATABASE_URL)).initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
