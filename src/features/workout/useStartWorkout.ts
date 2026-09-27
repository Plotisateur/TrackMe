import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ActiveSessionExistsError } from '@/db/repositories/workoutRepository';
import { useApp } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { reportError } from '@/utils/errors';
import { startEmptySession, startSessionFromTemplate } from './workoutService';

/** Starts a workout, guarding against a second concurrent active session. */
export function useStartWorkout() {
  const { repos, settings } = useApp();
  const refresh = useActiveSession((s) => s.refresh);
  const [starting, setStarting] = useState<string | null>(null);

  const start = useCallback(
    async (templateId?: string) => {
      setStarting(templateId ?? 'empty');
      try {
        const session = templateId
          ? await startSessionFromTemplate(repos, templateId, settings)
          : await startEmptySession(repos);
        await refresh(repos);
        router.push(`/workout/${session.id}`);
      } catch (e) {
        if (e instanceof ActiveSessionExistsError) {
          Alert.alert('Workout in progress', e.message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Resume', onPress: () => router.push(`/workout/${e.sessionId}`) },
          ]);
        } else {
          reportError('start workout', e);
        }
      } finally {
        setStarting(null);
      }
    },
    [repos, settings, refresh],
  );

  return { start, starting };
}
