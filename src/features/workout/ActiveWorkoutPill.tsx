import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { useColors } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { useRestTimer } from '@/stores/restTimerStore';
import { radius, space } from '@/theme/theme';

/** Keeps the active workout one tap away from every screen. */
export function ActiveWorkoutPill({ bottomOffset }: { bottomOffset: number }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const active = useActiveSession((s) => s.active);
  const timerRunning = useRestTimer((s) => s.endsAt !== undefined);
  if (!active) return null;
  // Sit above the rest timer bar when both are visible.
  const extra = timerRunning ? 96 : 0;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space.md,
        right: space.md,
        bottom: insets.bottom + bottomOffset + extra,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resume workout ${active.name}`}
        onPress={() => router.push(`/workout/${active.id}`)}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: radius.lg,
          backgroundColor: c.primary,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
          elevation: 6,
        })}
      >
        <T weight="700" style={{ color: c.primaryText }} numberOfLines={1}>
          ● {active.name} in progress
        </T>
        <T weight="800" style={{ color: c.primaryText }}>
          Resume ›
        </T>
      </Pressable>
    </View>
  );
}
