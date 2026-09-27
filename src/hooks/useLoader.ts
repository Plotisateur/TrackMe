import { useFocusEffect } from 'expo-router';
import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface Loader<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload(): Promise<void>;
  /** Replace data locally (optimistic update) without refetching. */
  setData(updater: (prev: T | undefined) => T | undefined): void;
}

/**
 * Loads data from repositories and refreshes whenever the screen regains focus.
 * Keeps showing the previous data while reloading so screens don't flash.
 */
export function useLoader<T>(fn: () => Promise<T>, deps: DependencyList): Loader<T> {
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  // Generic loader: callers pass their own dependency list, like useEffect.
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);

  const reload = useCallback(async () => {
    try {
      const result = await load();
      if (mounted.current) {
        setDataState(result);
        setError(undefined);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, loading, reload, setData: setDataState };
}
