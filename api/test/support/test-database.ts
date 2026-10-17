// Matches the postgres-test service in docker-compose.yml. CI overrides it with TEST_DATABASE_URL.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://renovation:renovation@localhost:5433/renovation_test';
