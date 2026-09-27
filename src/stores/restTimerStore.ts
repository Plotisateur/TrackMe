import { create } from 'zustand';

export interface RestTimerState {
  /** Absolute end time (ms epoch). Absolute so it stays accurate across backgrounding/restarts. */
  endsAt?: number;
  durationSec: number;
  label?: string;
  notificationId?: string;
  finishedAt?: number;
}

interface RestTimerActions {
  start(seconds: number, label?: string): void;
  addTime(seconds: number): void;
  skip(): void;
  finish(): void;
  hydrate(state: RestTimerState): void;
  setNotificationId(id: string | undefined): void;
}

export const REST_PRESETS = [60, 90, 120, 180] as const;

export const useRestTimer = create<RestTimerState & RestTimerActions>((set, get) => ({
  durationSec: 0,
  start(seconds, label) {
    set({
      endsAt: Date.now() + seconds * 1000,
      durationSec: seconds,
      label,
      finishedAt: undefined,
    });
  },
  addTime(seconds) {
    const { endsAt, durationSec } = get();
    if (!endsAt) return;
    const next = Math.max(Date.now(), endsAt + seconds * 1000);
    set({ endsAt: next, durationSec: Math.max(0, durationSec + seconds) });
  },
  skip() {
    set({ endsAt: undefined, finishedAt: undefined });
  },
  finish() {
    set({ endsAt: undefined, finishedAt: Date.now() });
  },
  hydrate(state) {
    set(state);
  },
  setNotificationId(id) {
    set({ notificationId: id });
  },
}));
