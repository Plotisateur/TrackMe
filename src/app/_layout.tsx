import { type ErrorBoundaryProps, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DATABASE_NAME } from '@/db/config';
import { migrate } from '@/db/migrations/runner';
import { RestTimerBar } from '@/features/timer/RestTimerBar';
import { RestTimerController } from '@/features/timer/RestTimerController';
import { setupNotifications } from '@/features/timer/notifications';
import { ActiveWorkoutPill } from '@/features/workout/ActiveWorkoutPill';
import { AppProvider, useApp } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { darkPalette } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function initDatabase(db: SQLiteDatabase) {
  await migrate(db);
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} onError={onDbError}>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function onDbError(e: Error) {
  SplashScreen.hideAsync().catch(() => {});
  throw e;
}

function AppShell() {
  const { colors, repos } = useApp();
  const pathname = usePathname();
  const refreshActive = useActiveSession((s) => s.refresh);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    setupNotifications().catch((e) => console.warn('notification setup failed', e));
    refreshActive(repos).catch((e) => console.warn(e));
  }, [repos, refreshActive]);

  const inTabs =
    !pathname.startsWith('/workout') &&
    !pathname.startsWith('/summary') &&
    !pathname.startsWith('/session') &&
    !pathname.startsWith('/exercise') &&
    !pathname.startsWith('/variant') &&
    !pathname.startsWith('/template') &&
    !pathname.startsWith('/pick');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors === darkPalette ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen
          name="summary/[id]"
          options={{ title: 'Summary', headerBackVisible: false }}
        />
        <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="exercise/form" options={{ title: 'Exercise', presentation: 'modal' }} />
        <Stack.Screen name="variant/form" options={{ title: 'Variant', presentation: 'modal' }} />
        <Stack.Screen
          name="variant/technique"
          options={{ title: 'Technique', presentation: 'modal' }}
        />
        <Stack.Screen name="template/index" options={{ title: 'Templates' }} />
        <Stack.Screen name="template/[id]" options={{ title: 'Template' }} />
        <Stack.Screen
          name="pick-exercise"
          options={{ title: 'Add exercise', presentation: 'modal' }}
        />
      </Stack>
      <BottomOverlays inTabs={inTabs} onWorkout={pathname.startsWith('/workout')} />
      <RestTimerController />
    </View>
  );
}

function BottomOverlays({ inTabs, onWorkout }: { inTabs: boolean; onWorkout: boolean }) {
  const offset = inTabs ? 64 : 8;
  return (
    <>
      {!onWorkout ? <ActiveWorkoutPill bottomOffset={offset} /> : null}
      <RestTimerBar bottomOffset={offset} />
    </>
  );
}

/** Application-level crash screen. Data is safe in SQLite; retry re-renders the route. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const c = darkPalette;
  return (
    <View
      style={{ flex: 1, backgroundColor: c.bg, padding: 24, paddingTop: insets.top + 24, gap: 16 }}
    >
      <Text style={{ color: c.danger, fontSize: 22, fontWeight: '800' }}>Something broke</Text>
      <Text style={{ color: c.textMuted, fontSize: 16 }}>
        Your workout data is stored on this device and has not been lost. Try again — if it keeps
        happening, export a backup from Settings.
      </Text>
      <Text style={{ color: c.textFaint, fontSize: 13 }}>{error.message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{
          backgroundColor: c.primary,
          borderRadius: 12,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 16 }}>Try again</Text>
      </Pressable>
    </View>
  );
}
