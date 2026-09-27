import { useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Row, T } from '@/components/ui';
import { useColors } from '@/state/AppContext';
import { REST_PRESETS, useRestTimer } from '@/stores/restTimerStore';
import { radius, space } from '@/theme/theme';
import { formatClock } from '@/utils/date';

/** Compact persistent rest timer rendered above every screen. */
export function RestTimerBar({ bottomOffset = 64 }: { bottomOffset?: number }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { endsAt, durationSec, label, finishedAt, addTime, skip, start } = useRestTimer();
  const now = useNow(250, endsAt !== undefined || finishedAt !== undefined);
  const [expanded, setExpanded] = useState(false);

  const showDone = !endsAt && finishedAt !== undefined && now - finishedAt < 5000;
  if (!endsAt && !showDone) return null;

  const remaining = endsAt ? (endsAt - now) / 1000 : 0;
  const progress =
    endsAt && durationSec > 0 ? Math.min(1, Math.max(0, 1 - remaining / durationSec)) : 1;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space.md,
        right: space.md,
        bottom: insets.bottom + bottomOffset,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: showDone ? c.successBg : c.surfaceAlt,
          borderColor: showDone ? c.success : c.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.sm,
          gap: space.sm,
          elevation: 8,
        }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showDone
                ? 'Rest over'
                : `Rest timer ${formatClock(remaining)} remaining. Tap for presets`
            }
            onPress={() => setExpanded((e) => !e)}
            style={{
              flex: 1,
              paddingHorizontal: space.sm,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <T size={24} weight="800" tone={showDone ? 'success' : 'default'}>
              {showDone ? 'Rest over — go!' : formatClock(remaining)}
            </T>
            {label ? (
              <T size={12} tone="muted" numberOfLines={1}>
                {showDone ? label : `Next: ${label}`}
              </T>
            ) : null}
          </Pressable>
          {!showDone ? (
            <Row>
              <Button label="+30 s" variant="secondary" compact onPress={() => addTime(30)} />
              <Button
                label="Skip"
                variant="ghost"
                compact
                onPress={skip}
                accessibilityLabel="Skip rest timer"
              />
            </Row>
          ) : null}
        </Row>
        {!showDone ? (
          <View style={{ height: 4, backgroundColor: c.border, borderRadius: 2 }}>
            <View
              style={{
                height: 4,
                width: `${progress * 100}%`,
                backgroundColor: c.primary,
                borderRadius: 2,
              }}
            />
          </View>
        ) : null}
        {expanded && !showDone ? (
          <Row wrap>
            {REST_PRESETS.map((s) => (
              <Chip key={s} label={formatClock(s)} onPress={() => start(s, label)} />
            ))}
          </Row>
        ) : null}
      </View>
    </View>
  );
}
