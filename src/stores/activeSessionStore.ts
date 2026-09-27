import { create } from 'zustand';
import type { Repositories } from '@/db/repositories';

interface ActiveSessionState {
  /** Mirrors the single 'active' row in workout_sessions so every screen can offer "Resume". */
  active?: { id: string; name: string; startedAt: string };
  refresh(repos: Repositories): Promise<void>;
}

export const useActiveSession = create<ActiveSessionState>((set) => ({
  active: undefined,
  async refresh(repos) {
    const s = await repos.workouts.getActiveSession();
    set({ active: s ? { id: s.id, name: s.name, startedAt: s.startedAt } : undefined });
  },
}));
