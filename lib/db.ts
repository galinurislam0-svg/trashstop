// Ортақ дерекқор (Neon Postgres). DATABASE_URL болмаса — null (жергілікті файл режимі).
import { Pool } from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const g = globalThis as unknown as { __tsPool?: Pool; __tsReady?: Promise<void> };

export const pool: Pool | null = url ? (g.__tsPool ??= new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } })) : null;

/** Кестелер бар екеніне көз жеткізу (бір рет) */
export function ready() {
  if (!pool) return Promise.resolve();
  g.__tsReady ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS ts_state (id int PRIMARY KEY, doc jsonb NOT NULL, seq int NOT NULL, version bigint NOT NULL DEFAULT 1);
       CREATE TABLE IF NOT EXISTS ts_photo (key text PRIMARY KEY, data text NOT NULL);
       CREATE TABLE IF NOT EXISTS ts_ai_cache (key text PRIMARY KEY, data jsonb NOT NULL, created timestamptz NOT NULL DEFAULT now());`,
    )
    .then(() => undefined);
  return g.__tsReady;
}
