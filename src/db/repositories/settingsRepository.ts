import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';
import type { Db } from '../database';

const SETTINGS_KEY = 'settings';

export function createSettingsRepository(db: Db) {
  async function getValue<T>(key: string): Promise<T | null> {
    const r = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      key,
    );
    if (!r) return null;
    try {
      return JSON.parse(r.value) as T;
    } catch {
      return null;
    }
  }

  async function setValue(key: string, value: unknown): Promise<void> {
    if (value === undefined || value === null) {
      await db.runAsync('DELETE FROM app_settings WHERE key = ?', key);
      return;
    }
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      JSON.stringify(value),
    );
  }

  return {
    getValue,
    setValue,

    async getSettings(): Promise<AppSettings> {
      const stored = (await getValue<Partial<AppSettings>>(SETTINGS_KEY)) ?? {};
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        macroTargets: { ...DEFAULT_SETTINGS.macroTargets, ...(stored.macroTargets ?? {}) },
      };
    },

    async saveSettings(settings: AppSettings): Promise<void> {
      await setValue(SETTINGS_KEY, settings);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
