import { Client, ClientConfig } from 'pg';

export const TEST_PG_CONFIG: ClientConfig = {
  host: process.env.TEST_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.TEST_DB_PORT || '5439', 10), // Dedicated test database container
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || 'test',
};

/**
 * MANDATORY SAFETY GUARD:
 * Refuses to run any test if the connected database does not contain 'test' in its name.
 */
export async function assertTestDatabaseGuard(client: Client): Promise<void> {
  const res = await client.query('SELECT current_database() as db_name');
  const dbName = (res.rows[0]?.db_name || '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Refusing to run tests against database "${dbName}". ` +
      `Tests must run strictly against a database with "test" in its name (e.g. "test" or "starciti_test").`
    );
  }
}

/**
 * Creates and connects a verified test client against the test database.
 */
export async function createTestClient(overrideConfig?: Partial<ClientConfig>): Promise<Client> {
  const config = { ...TEST_PG_CONFIG, ...overrideConfig };
  const client = new Client(config);
  try {
    await client.connect();
    await assertTestDatabaseGuard(client);
    return client;
  } catch (err: any) {
    // If local Supabase port 54322 is not reachable, fallback to port 5439 test database
    if (config.port === 54322 && err.code === 'ECONNREFUSED') {
      console.warn('Port 54322 unreachable, falling back to port 5439 test database...');
      const fallbackClient = new Client({ ...config, port: 5439 });
      await fallbackClient.connect();
      await assertTestDatabaseGuard(fallbackClient);
      return fallbackClient;
    }
    throw err;
  }
}

/**
 * Executes a test block within an isolated transaction that automatically rolls back.
 */
export async function withTestTransaction<T>(
  client: Client,
  fn: (txClient: Client) => Promise<T>
): Promise<T> {
  await assertTestDatabaseGuard(client);
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    return result;
  } finally {
    await client.query('ROLLBACK');
  }
}
