/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import type { Db, RunResult, SqlValue } from '@/db/database';

/** In-memory node:sqlite database exposing the same async surface as expo-sqlite. Tests only. */
export function createTestDb(): Db & { close(): void } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  let depth = 0;
  return {
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, ...params: SqlValue[]): Promise<RunResult> {
      const r = raw.prepare(source).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(source: string, ...params: SqlValue[]) {
      return raw.prepare(source).all(...params) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlValue[]) {
      return (raw.prepare(source).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      if (depth > 0) throw new Error('nested transaction');
      depth++;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      raw.close();
    },
  };
}
