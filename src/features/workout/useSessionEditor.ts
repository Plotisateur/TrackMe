import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetPatch } from '@/db/repositories/workoutRepository';
import { exerciseDisplayName } from '@/domain/workout/summary';
import { useApp } from '@/state/AppContext';
import { useRestTimer } from '@/stores/restTimerStore';
import type { WorkoutExerciseDetail, WorkoutSessionDetail, WorkoutSet } from '@/types/domain';
import { reportError } from '@/utils/errors';
import { type ExerciseInsight, loadInsights } from './workoutService';

export type EditorMode = 'active' | 'history';

/**
 * State + persistence for editing one session. Every change is written to SQLite immediately;
 * the UI updates optimistically and resyncs from the database if a write fails.
 */
export function useSessionEditor(sessionId: string, mode: EditorMode) {
  const { repos, settings } = useApp();
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>();
  const [insights, setInsights] = useState<Record<string, ExerciseInsight>>({});
  const [error, setError] = useState<Error>();
  const [reordered, setReordered] = useState(false);
  const startTimer = useRestTimer((s) => s.start);
  const detailRef = useRef(detail);
  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const reload = useCallback(async () => {
    try {
      const d = await repos.workouts.getSession(sessionId);
      setDetail(d);
      if (d) setInsights(await loadInsights(repos, d, settings));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [repos, sessionId, settings]);

  // Load on focus, so returning from the exercise picker shows the new exercise.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const mutateSets = (fn: (sets: WorkoutSet[], ex: WorkoutExerciseDetail) => WorkoutSet[]) =>
    setDetail((d) =>
      d ? { ...d, exercises: d.exercises.map((ex) => ({ ...ex, sets: fn(ex.sets, ex) })) } : d,
    );

  const persist = useCallback(
    async (action: string, fn: () => Promise<unknown>, resync = false) => {
      try {
        await fn();
        if (resync) await reload();
      } catch (e) {
        reportError(action, e);
        await reload();
      }
    },
    [reload],
  );

  const updateSet = useCallback(
    (setId: string, patch: SetPatch) => {
      mutateSets((sets) => sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)));
      return persist('save set', () => repos.workouts.updateSet(setId, patch));
    },
    [persist, repos],
  );

  const completeSet = useCallback(
    async (set: WorkoutSet, ex: WorkoutExerciseDetail) => {
      if (!set.reps || set.reps <= 0) {
        reportError('complete set', new Error('Enter the reps you performed first.'));
        return;
      }
      const completedAt = new Date().toISOString();
      mutateSets((sets) =>
        sets.map((s) => (s.id === set.id ? { ...s, completed: true, completedAt } : s)),
      );
      if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await persist('complete set', () =>
        repos.workouts.completeSet(set.id, {
          weightKg: set.weightKg,
          reps: set.reps,
          rir: set.rir,
        }),
      );
      if (mode === 'active') {
        const rest = ex.instance.restSeconds ?? settings.defaultRestSeconds;
        if (rest > 0) startTimer(rest, nextLabel(detailRef.current, set.id));
      }
    },
    [persist, repos, settings, mode, startTimer],
  );

  const uncompleteSet = useCallback(
    (setId: string) => {
      mutateSets((sets) =>
        sets.map((s) => (s.id === setId ? { ...s, completed: false, completedAt: undefined } : s)),
      );
      return persist('undo set', () => repos.workouts.uncompleteSet(setId));
    },
    [persist, repos],
  );

  const addSet = useCallback(
    (ex: WorkoutExerciseDetail) => {
      const prev = ex.sets[ex.sets.length - 1];
      return persist(
        'add set',
        () => repos.workouts.addSet(ex.instance.id, { weightKg: prev?.weightKg, reps: prev?.reps }),
        true,
      );
    },
    [persist, repos],
  );

  const deleteSet = useCallback(
    (setId: string) => persist('delete set', () => repos.workouts.deleteSet(setId), true),
    [persist, repos],
  );

  const move = useCallback(
    (instanceId: string, dir: -1 | 1) => {
      const d = detailRef.current;
      if (!d) return;
      const list = [...d.exercises];
      const i = list.findIndex((e) => e.instance.id === instanceId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      setDetail({ ...d, exercises: list });
      setReordered(true);
      if (settings.haptics) Haptics.selectionAsync().catch(() => {});
      return persist('reorder exercises', () =>
        repos.workouts.reorderExercises(
          d.session.id,
          list.map((e) => e.instance.id),
        ),
      );
    },
    [persist, repos, settings.haptics],
  );

  const saveOrderToTemplate = useCallback(async () => {
    const d = detailRef.current;
    if (!d?.session.templateId) return;
    await persist('save order to template', () =>
      repos.templates.reorderByVariants(
        d.session.templateId!,
        d.exercises.map((e) => e.variant.id),
      ),
    );
    setReordered(false);
  }, [persist, repos]);

  const removeExercise = useCallback(
    (instanceId: string) =>
      persist('remove exercise', () => repos.workouts.removeExercise(instanceId), true),
    [persist, repos],
  );

  const updateInstance = useCallback(
    (instanceId: string, patch: { notes?: string; restSeconds?: number }) => {
      setDetail((d) =>
        d
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.instance.id === instanceId ? { ...e, instance: { ...e.instance, ...patch } } : e,
              ),
            }
          : d,
      );
      return persist('save exercise', () => repos.workouts.updateInstance(instanceId, patch));
    },
    [persist, repos],
  );

  /** Reverts a load change from a suggestion: pending sets go back to last session's loads. */
  const dismissSuggestion = useCallback(
    async (ex: WorkoutExerciseDetail) => {
      const last = insights[ex.instance.id]?.last?.sets;
      if (!last?.length) return;
      const pending = ex.sets.filter((s) => !s.completed);
      for (const s of pending) {
        const ref = last[s.setIndex] ?? last[last.length - 1];
        await updateSet(s.id, { weightKg: ref.weightKg, reps: ref.reps });
      }
    },
    [insights, updateSet],
  );

  return {
    detail,
    insights,
    error,
    reload,
    reordered,
    updateSet,
    completeSet,
    uncompleteSet,
    addSet,
    deleteSet,
    move,
    saveOrderToTemplate,
    removeExercise,
    updateInstance,
    dismissSuggestion,
  };
}

export type SessionEditor = ReturnType<typeof useSessionEditor>;

/** "Lat Pulldown — set 2" style label of what comes after `setId`. */
function nextLabel(
  detail: WorkoutSessionDetail | null | undefined,
  setId: string,
): string | undefined {
  if (!detail) return undefined;
  const all = detail.exercises.flatMap((ex) => ex.sets.map((s) => ({ ex, s })));
  const idx = all.findIndex((x) => x.s.id === setId);
  const next =
    all.slice(idx + 1).find((x) => !x.s.completed) ??
    all.find((x) => !x.s.completed && x.s.id !== setId);
  if (!next) return undefined;
  return `${exerciseDisplayName(next.ex)} · set ${next.s.setIndex + 1}`;
}
