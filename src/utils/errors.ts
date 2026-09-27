import { Alert } from 'react-native';

/** Surfaces a failed operation to the user — persistence errors must never be silent. */
export function reportError(action: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[${action}]`, e);
  Alert.alert(`Could not ${action}`, message);
}

/** Runs an async action and reports failures visibly. Returns undefined on failure. */
export async function attempt<T>(action: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    reportError(action, e);
    return undefined;
  }
}

export function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  destructive = true,
) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
