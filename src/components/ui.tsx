import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/state/AppContext';
import { radius, space, TOUCH } from '@/theme/theme';

type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function T({
  children,
  size = 16,
  weight = '400',
  tone = 'default',
  style,
  numberOfLines,
  onPress,
}: {
  onPress?: () => void;
  children: ReactNode;
  size?: number;
  weight?: TextStyle['fontWeight'];
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  const color = {
    default: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    primary: c.primary,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    info: c.info,
  }[tone];
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      numberOfLines={numberOfLines}
      onPress={onPress}
      suppressHighlighting
      style={[{ color, fontSize: size, fontWeight: weight }, style]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const c = useColors();
  const pad = padded ? { padding: space.lg, gap: space.md } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  compact,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = {
    primary: c.primary,
    secondary: c.surfaceAlt,
    ghost: 'transparent',
    danger: c.dangerBg,
  }[variant];
  const fg = {
    primary: c.primaryText,
    secondary: c.text,
    ghost: c.primary,
    danger: c.danger,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 40 : TOUCH,
          paddingHorizontal: compact ? space.md : space.lg,
          borderRadius: radius.md,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Text style={{ color: fg, fontSize: compact ? 15 : 18 }}>{icon}</Text> : null}
          <Text
            maxFontSizeMultiplier={1.3}
            style={{ color: fg, fontSize: compact ? 14 : 16, fontWeight: '700' }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'warning' | 'danger' | 'success';
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const toneBg = tone === 'warning' ? c.warningBg : tone === 'danger' ? c.dangerBg : c.successBg;
  const toneFg = tone === 'warning' ? c.warning : tone === 'danger' ? c.danger : c.success;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: space.md,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: tone ? toneBg : selected ? c.primary : c.surfaceAlt,
        borderWidth: 1,
        borderColor: tone ? toneFg : selected ? c.primary : c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{
          color: tone ? toneFg : selected ? c.primaryText : c.text,
          fontWeight: '600',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({
  children,
  gap = space.sm,
  style,
  wrap,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 4, flex: (style as ViewStyle | undefined)?.flex }}>
      {label ? (
        <T size={13} tone="muted" weight="600">
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={c.textFaint}
        maxFontSizeMultiplier={1.4}
        accessibilityLabel={label}
        {...props}
        style={[
          {
            minHeight: TOUCH,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surfaceAlt,
            color: c.text,
            paddingHorizontal: space.md,
            fontSize: 16,
            textAlignVertical: props.multiline ? 'top' : 'center',
            paddingVertical: props.multiline ? space.sm : 0,
          },
          style,
        ]}
      />
      {hint ? (
        <T size={12} tone="faint">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
      <T
        size={13}
        weight="700"
        tone="muted"
        style={{ textTransform: 'uppercase', letterSpacing: 1 }}
      >
        {children}
      </T>
      {right}
    </Row>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
      <T size={17} weight="700">
        {title}
      </T>
      {message ? (
        <T tone="muted" style={{ textAlign: 'center' }}>
          {message}
        </T>
      ) : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.bg,
        padding: space.xl,
      }}
    >
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Card>
      <T weight="700" tone="danger">
        Something went wrong
      </T>
      <T tone="muted">{error.message}</T>
      {onRetry ? <Button label="Retry" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingVertical: space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="600">{title}</T>
        {subtitle ? (
          <T size={13} tone="muted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {onPress ? <T tone="faint">›</T> : null}
    </Pressable>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 90, gap: 2 }}>
      <T size={12} tone="muted" weight="600">
        {label}
      </T>
      <T size={20} weight="700">
        {value}
      </T>
      {sub ? (
        <T size={12} tone="faint">
          {sub}
        </T>
      ) : null}
    </View>
  );
}

export function Segmented<const T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: NoInfer<T>;
  onChange(v: NoInfer<T>): void;
}) {
  return (
    <Row wrap>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </Row>
  );
}

export function Banner({
  tone,
  children,
  action,
}: {
  tone: 'warning' | 'danger' | 'success' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  const c = useColors();
  const bg = { warning: c.warningBg, danger: c.dangerBg, success: c.successBg, info: c.surfaceAlt }[
    tone
  ];
  const border = { warning: c.warning, danger: c.danger, success: c.success, info: c.info }[tone];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderLeftWidth: 4,
        borderLeftColor: border,
        borderRadius: radius.sm,
        padding: space.md,
        gap: space.sm,
      }}
    >
      {children}
      {action}
    </View>
  );
}
