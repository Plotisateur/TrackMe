/**
 * Minimal async SQLite surface used by repositories. `expo-sqlite`'s SQLiteDatabase
 * satisfies it structurally; tests use a node:sqlite adapter. Keeping repositories on this
 * interface is what lets them run under Vitest without a device.
 */
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlValue[]): Promise<RunResult>;
  getAllAsync<T>(source: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** undefined → NULL, booleans → 0/1 */
export function v(value: string | number | boolean | undefined | null): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

/** NULL → undefined */
export function opt<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

export const bool = (value: number | null | undefined) => value === 1;
