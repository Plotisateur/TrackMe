import type { Db } from '../database';
import { MIGRATIONS } from './index';

export interface Migration {
  version: number;
  name: string;
  up(db: Db): Promise<void>;
}

export const LATEST_SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each inside its own transaction, and records the
 * schema version in PRAGMA user_version. Safe to call on every launch.
 */
export async function migrate(db: Db, migrations: Migration[] = MIGRATIONS): Promise<number> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  let current = await getSchemaVersion(db);
  const pending = [...migrations]
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
