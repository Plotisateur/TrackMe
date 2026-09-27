import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { useApp } from '@/state/AppContext';
import { type RestTimerState, useRestTimer } from '@/stores/restTimerStore';
import { cancelRestDone, scheduleRestDone, setForegroundSound } from './notifications';

const STORAGE_KEY = 'restTimer';

/**
 * Glue between the ephemeral timer store and the device: restores a running timer after a
 * restart, persists changes, keeps the OS notification in sync and signals completion.
 */
export function RestTimerController() {
  const { repos, settings } = useApp();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => setForegroundSound(settings.sound), [settings.sound]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await repos.settings.getValue<RestTimerState>(STORAGE_KEY);
      if (cancelled || !saved) return;
      if (saved.endsAt && saved.endsAt > Date.now()) useRestTimer.getState().hydrate(saved);
    })();

    const unsubscribe = useRestTimer.subscribe((s, prev) => {
      const { endsAt, durationSec, label, notificationId } = s;
      repos.settings
        .setValue(STORAGE_KEY, endsAt ? { endsAt, durationSec, label, notificationId } : null)
        .catch((e) => console.warn('rest timer persist failed', e));
      if (s.endsAt === prev.endsAt) return;
      (async () => {
        await cancelRestDone(prev.notificationId);
        if (s.endsAt && s.endsAt > Date.now()) {
          const id = await scheduleRestDone(s.endsAt, s.label).catch(() => undefined);
          // Only keep the id if the timer wasn't changed meanwhile.
          if (useRestTimer.getState().endsAt === s.endsAt)
            useRestTimer.getState().setNotificationId(id);
          else await cancelRestDone(id);
        } else if (prev.notificationId) {
          useRestTimer.getState().setNotificationId(undefined);
        }
      })();
    });

    const tick = setInterval(() => {
      const { endsAt, finish } = useRestTimer.getState();
      if (endsAt && Date.now() >= endsAt) {
        finish();
        if (settingsRef.current.haptics) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(tick);
    };
  }, [repos]);

  return null;
}
