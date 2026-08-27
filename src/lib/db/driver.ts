import fs from "node:fs";
import path from "node:path";
import { applyMigrations } from "./migrate";

/**
 * Camada de acesso ao banco.
 *
 * - Sem DATABASE_URL  -> PGlite: Postgres real embutido (WASM), persistido em .data/pglite.
 *                        Zero setup, ideal para desenvolvimento e demonstração.
 * - Com DATABASE_URL  -> Postgres de verdade (Supabase, Neon, RDS...).
 *
 * As duas pontas falam o MESMO SQL, então nada no app precisa mudar na migração.
 */

export type QueryResult<T> = { rows: T[] };

interface Driver {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

async function createPgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  const isFirstBoot = !fs.existsSync(dataDir);

  // PGlite não cria diretórios recursivamente.
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });

  const pg = await PGlite.create({ dataDir });

  if (isFirstBoot) {
    await pg.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    const { seed } = await import("./seed");
    await seed({ query: (sql, params) => pg.query(sql, params as never[]) });
    console.log("\n  ✓ Banco local criado e populado (.data/pglite)\n");
  }

  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params as never[]);
      return { rows: res.rows as T[] };
    },
  };
}

async function createPostgresDriver(url: string): Promise<Driver> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { prepare: false, max: 5 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return { rows: rows as unknown as T[] };
    },
  };
}

/**
 * Aplica as migrações no boot, uma vez por processo.
 *
 * Um erro aqui não derruba o app: o banco pode estar num estado em que o
 * DDL não é permitido (usuário só de leitura, por exemplo) e as telas ainda
 * funcionarem. A publicação do catálogo roda as mesmas migrações e aí sim
 * mostra o erro para quem clicou.
 */
async function withMigrations(driver: Driver): Promise<Driver> {
  try {
    await applyMigrations((sql) => driver.query(sql));
  } catch (error) {
    console.error("  ! Falha ao aplicar migrações de schema:", error);
  }
  return driver;
}

// Singleton — sobrevive ao hot-reload do Next em desenvolvimento.
const globalForDb = globalThis as unknown as { __lmsDriver?: Promise<Driver> };

function getDriver(): Promise<Driver> {
  if (!globalForDb.__lmsDriver) {
    const url = process.env.DATABASE_URL;
    const driver = url ? createPostgresDriver(url) : createPgliteDriver();
    globalForDb.__lmsDriver = driver.then(withMigrations);
  }
  return globalForDb.__lmsDriver;
}

/** Executa uma query parametrizada ($1, $2, ...) e devolve as linhas tipadas. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const driver = await getDriver();
  const { rows } = await driver.query<T>(sql, params);
  return rows;
}

/** Mesma coisa, mas devolve só a primeira linha (ou null). */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
