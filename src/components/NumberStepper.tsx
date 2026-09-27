import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useColors } from '@/state/AppContext';
import { radius, TOUCH } from '@/theme/theme';
import { formatNumber, parseDecimal } from '@/utils/units';

/**
 * Inline numeric control: [−] [value] [+]. Tapping the value opens the numeric keypad;
 * the buttons adjust by `step` without the keyboard. Commits on blur/submit.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimals = 2,
  label,
  suffix,
  integer,
}: {
  value: number | undefined;
  onChange(v: number | undefined): void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  label: string;
  suffix?: string;
  integer?: boolean;
}) {
  const c = useColors();
  const display = value === undefined ? '' : formatNumber(value, decimals);
  // Edit buffer, only used while the field is focused.
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);

  const clamp = (n: number) => Math.min(max, Math.max(min, integer ? Math.round(n) : n));

  const commit = () => {
    setFocused(false);
    const parsed = parseDecimal(text);
    const next = parsed === undefined ? undefined : clamp(parsed);
    if (next !== value) onChange(next);
  };

  const bump = (dir: 1 | -1) => {
    const base = focused ? (parseDecimal(text) ?? value ?? 0) : (value ?? 0);
    const next = clamp(Number((base + dir * step).toFixed(4)));
    setText(formatNumber(next, decimals));
    onChange(next);
  };

  const btn = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dir > 0 ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => bump(dir)}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.border : c.surfaceAlt,
      })}
    >
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>{dir > 0 ? '+' : '−'}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: focused ? c.primary : c.border,
          overflow: 'hidden',
        }}
      >
        {btn(-1)}
        <TextInput
          accessibilityLabel={label}
          value={focused ? text : display}
          onChangeText={(t) => {
            setText(t);
            // Commit as you type so tapping "complete" with the keypad open uses the new value.
            const parsed = parseDecimal(t);
            if (parsed !== undefined && clamp(parsed) !== value) onChange(clamp(parsed));
          }}
          onFocus={() => {
            setText(display);
            setFocused(true);
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          returnKeyType="done"
          selectTextOnFocus
          maxFontSizeMultiplier={1.3}
          placeholder="–"
          placeholderTextColor={c.textFaint}
          style={{
            flex: 1,
            minWidth: 44,
            height: TOUCH,
            textAlign: 'center',
            fontSize: 20,
            fontWeight: '700',
            color: c.text,
            backgroundColor: c.bg,
            paddingHorizontal: 2,
          }}
        />
        {btn(1)}
      </View>
      {suffix ? (
        <Text
          style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}
          maxFontSizeMultiplier={1.3}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}
