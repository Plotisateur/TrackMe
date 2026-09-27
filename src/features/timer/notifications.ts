import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REST_CHANNEL_ID = 'rest-timer';

let playSoundInForeground = true;

export function setForegroundSound(enabled: boolean) {
  playSoundInForeground = enabled;
}

/** Call once at startup. In the foreground the in-app bar + haptics replace the banner. */
export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: playSoundInForeground,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
      enableVibrate: true,
      sound: 'default',
    });
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleRestDone(
  endsAt: number,
  label?: string,
): Promise<string | undefined> {
  if (!(await ensurePermission())) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest over',
      body: label ? `Next set: ${label}` : 'Time for your next set.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endsAt,
      channelId: REST_CHANNEL_ID,
    },
  });
}

export async function cancelRestDone(id: string | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or cleared — nothing to cancel.
  }
}
