// Entry point for the TypeORM CLI (migrations). The Nest app does not import this file.
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: use the real environment (CI, Docker).
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

export default new DataSource(buildDataSourceOptions(databaseUrl));
