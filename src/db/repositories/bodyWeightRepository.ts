import type { BodyWeightContext, BodyWeightEntry } from '@/types/domain';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/date';
import { type Db, v } from '../database';
import { type BodyWeightRow, mapBodyWeight } from './rows';

export function createBodyWeightRepository(db: Db) {
  return {
    async list(opts: { since?: string } = {}): Promise<BodyWeightEntry[]> {
      const rows = await db.getAllAsync<BodyWeightRow>(
        'SELECT * FROM body_weight_entries WHERE recorded_at >= ? ORDER BY recorded_at DESC',
        opts.since ?? '',
      );
      return rows.map(mapBodyWeight);
    },

    async latest(): Promise<BodyWeightEntry | null> {
      const r = await db.getFirstAsync<BodyWeightRow>(
        'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC LIMIT 1',
      );
      return r ? mapBodyWeight(r) : null;
    },

    async add(input: {
      weightKg: number;
      recordedAt?: string;
      context?: BodyWeightContext;
      notes?: string;
    }): Promise<BodyWeightEntry> {
      const entry: BodyWeightEntry = {
        id: newId(),
        recordedAt: input.recordedAt ?? nowIso(),
        weightKg: input.weightKg,
        context: input.context,
        notes: input.notes?.trim() || undefined,
      };
      await db.runAsync(
        'INSERT INTO body_weight_entries (id, recorded_at, weight_kg, context, notes) VALUES (?, ?, ?, ?, ?)',
        entry.id,
        entry.recordedAt,
        entry.weightKg,
        v(entry.context),
        v(entry.notes),
      );
      return entry;
    },

    async remove(id: string): Promise<void> {
      await db.runAsync('DELETE FROM body_weight_entries WHERE id = ?', id);
    },
  };
}

export type BodyWeightRepository = ReturnType<typeof createBodyWeightRepository>;
