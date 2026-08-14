import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;
export function databasePool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Production persistence never falls back to files or fixtures.");
  return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX ?? 10), ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : undefined });
}
export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return databasePool().query<T>(text, values); }
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await databasePool().connect();
  try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function closeDatabase() { if (pool) { await pool.end(); pool = undefined; } }
