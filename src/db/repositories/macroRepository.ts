import type { DailyMacroEntry } from '@/types/domain';
import { type Db, v } from '../database';
import { type MacroRow, mapMacro } from './rows';

export function createMacroRepository(db: Db) {
  return {
    async get(date: string): Promise<DailyMacroEntry | null> {
      const r = await db.getFirstAsync<MacroRow>(
        'SELECT * FROM daily_macro_entries WHERE date = ?',
        date,
      );
      return r ? mapMacro(r) : null;
    },

    async list(limit = 30): Promise<DailyMacroEntry[]> {
      const rows = await db.getAllAsync<MacroRow>(
        'SELECT * FROM daily_macro_entries ORDER BY date DESC LIMIT ?',
        limit,
      );
      return rows.map(mapMacro);
    },

    async upsert(entry: DailyMacroEntry): Promise<void> {
      await db.runAsync(
        `INSERT INTO daily_macro_entries (date, calories, protein_g, carbs_g, fat_g, training_day)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET calories = excluded.calories, protein_g = excluded.protein_g,
           carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, training_day = excluded.training_day`,
        entry.date,
        v(entry.calories),
        v(entry.proteinG),
        v(entry.carbsG),
        v(entry.fatG),
        v(entry.trainingDay),
      );
    },
  };
}

export type MacroRepository = ReturnType<typeof createMacroRepository>;
