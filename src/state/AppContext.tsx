import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { createRepositories, type Repositories } from '@/db/repositories';
import { darkPalette, lightPalette, type Palette } from '@/theme/theme';
import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

interface AppContextValue {
  repos: Repositories;
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  reloadSettings(): Promise<void>;
  colors: Palette;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const repos = useMemo(() => createRepositories(sqlite), [sqlite]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const system = useColorScheme();

  const reloadSettings = useCallback(async () => {
    setSettings(await repos.settings.getSettings());
  }, [repos]);

  useEffect(() => {
    let active = true;
    repos.settings
      .getSettings()
      .then((s) => {
        if (active) setSettings(s);
      })
      .catch((e) => console.warn('settings load failed, using defaults', e))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [repos]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      await repos.settings.saveSettings(next);
      setSettings(next);
    },
    [repos, settings],
  );

  const scheme = settings.theme === 'system' ? (system ?? 'dark') : settings.theme;
  const colors = scheme === 'light' ? lightPalette : darkPalette;

  const value = useMemo(
    () => ({ repos, settings, updateSettings, reloadSettings, colors }),
    [repos, settings, updateSettings, reloadSettings, colors],
  );
  if (!loaded) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export const useRepos = () => useApp().repos;
export const useSettings = () => useApp().settings;
export const useColors = () => useApp().colors;
