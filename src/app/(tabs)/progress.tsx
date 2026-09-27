import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { LineChart } from '@/components/LineChart';
import {
  Button,
  Card,
  Chip,
  ErrorView,
  ListRow,
  Row,
  Screen,
  SectionTitle,
  Stat,
  T,
} from '@/components/ui';
import { bodyWeightStats, dailyWeights, smoothedSeries } from '@/domain/bodyWeight/trend';
import { CONTEXT_LABELS, QuickWeightEntry } from '@/features/bodyWeight/QuickWeightEntry';
import { MUSCLE_LABELS } from '@/features/exercises/labels';
import { useLoader } from '@/hooks/useLoader';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/state/AppContext';
import type { MuscleGroup } from '@/types/domain';
import { DAY_MS, formatShortDate, formatTime, startOfMonth, startOfWeek } from '@/utils/date';
import { attempt } from '@/utils/errors';
import { formatNumber, formatWeight, kgToUnit } from '@/utils/units';

const signed = (n: number | undefined, unit: string, suffix = '') =>
  n === undefined
    ? '—'
    : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), 2)} ${unit}${suffix}`;

export default function ProgressScreen() {
  const { repos, settings } = useApp();
  const unit = settings.unit;
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [showAllWeights, setShowAllWeights] = useState(false);
  const now = useNow(60 * 60 * 1000);

  const loader = useLoader(async () => {
    const now = new Date();
    const [weights, week, month, muscles, variants] = await Promise.all([
      repos.bodyWeight.list({ since: new Date(Date.now() - 400 * DAY_MS).toISOString() }),
      repos.workouts.countCompletedSince(startOfWeek(now).toISOString()),
      repos.workouts.countCompletedSince(startOfMonth(now).toISOString()),
      repos.workouts.setsPerMuscleSince(startOfWeek(now).toISOString()),
      repos.exercises.listAllVariants(),
    ]);
    return { weights, week, month, muscles, variants };
  }, [repos]);

  const selected = variantId ?? loader.data?.variants[0]?.id;
  const variantHistory = useLoader(
    async () => (selected ? repos.exercises.getExerciseHistory(selected, { limit: 60 }) : []),
    [repos, selected],
  );

  const d = loader.data;
  const stats = useMemo(() => bodyWeightStats(d?.weights ?? [], new Date(now)), [d?.weights, now]);
  const weightChart = useMemo(() => {
    const since = now - range * DAY_MS;
    const daily = dailyWeights(d?.weights ?? []);
    const toUnit = (p: { t: number; value: number }) => ({
      t: p.t,
      value: kgToUnit(p.value, unit),
    });
    return {
      raw: daily.filter((x) => x.t >= since).map((x) => toUnit({ t: x.t, value: x.weightKg })),
      smooth: smoothedSeries(daily)
        .filter((x) => x.t >= since)
        .map(toUnit),
    };
  }, [d?.weights, range, unit, now]);

  const exerciseSeries = useMemo(
    () =>
      [...(variantHistory.data ?? [])]
        .reverse()
        .map((h) => {
          const valid = h.sets.filter((s) => s.techniqueValid);
          return valid.length
            ? {
                t: Date.parse(h.date),
                value: kgToUnit(Math.max(...valid.map((s) => s.weightKg)), unit),
              }
            : null;
        })
        .filter((p): p is { t: number; value: number } => p !== null),
    [variantHistory.data, unit],
  );

  const removeWeight = (id: string) =>
    Alert.alert('Delete entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          attempt('delete entry', async () => {
            await repos.bodyWeight.remove(id);
            await loader.reload();
          }),
      },
    ]);

  const selectedVariant = d?.variants.find((v) => v.id === selected);

  return (
    <Screen>
      <T size={28} weight="800">
        Progress
      </T>
      {loader.error ? <ErrorView error={loader.error} onRetry={loader.reload} /> : null}

      <SectionTitle>Body weight</SectionTitle>
      <Card>
        <Row wrap>
          <Stat label="Current" value={formatWeight(stats.current, unit, true)} />
          <Stat label="7-day avg" value={formatWeight(stats.average7, unit, true)} />
          <Stat
            label="Trend"
            value={
              stats.trendPerWeek === undefined
                ? '—'
                : signed(kgToUnit(stats.trendPerWeek, unit), unit, '/wk')
            }
          />
        </Row>
        <Row wrap>
          <Stat
            label="7 days"
            value={signed(
              stats.change7 === undefined ? undefined : kgToUnit(stats.change7, unit),
              unit,
            )}
          />
          <Stat
            label="30 days"
            value={signed(
              stats.change30 === undefined ? undefined : kgToUnit(stats.change30, unit),
              unit,
            )}
          />
          <Stat label="Target" value={formatWeight(settings.bodyWeightTargetKg, unit, true)} />
        </Row>
        <Row>
          {([30, 90, 365] as const).map((r) => (
            <Chip
              key={r}
              label={r === 365 ? '1 y' : `${r} d`}
              selected={range === r}
              onPress={() => setRange(r)}
            />
          ))}
        </Row>
        <LineChart
          points={weightChart.raw}
          overlay={weightChart.smooth}
          target={
            settings.bodyWeightTargetKg ? kgToUnit(settings.bodyWeightTargetKg, unit) : undefined
          }
          format={(v) => formatNumber(v, 1)}
          emptyText="Log your weight to see the trend."
        />
        <T size={12} tone="faint">
          Dots are daily weigh-ins; the bold line is the 7-day average. Single weigh-ins fluctuate —
          trust the trend.
        </T>
        <QuickWeightEntry onSaved={loader.reload} />
        {(d?.weights ?? []).slice(0, showAllWeights ? 60 : 5).map((w) => (
          <ListRow
            key={w.id}
            title={`${formatWeight(w.weightKg, unit, true)}`}
            subtitle={`${formatShortDate(w.recordedAt)} ${formatTime(w.recordedAt)}${w.context ? ` · ${CONTEXT_LABELS[w.context]}` : ''}`}
            right={
              <Button label="Delete" compact variant="ghost" onPress={() => removeWeight(w.id)} />
            }
          />
        ))}
        {(d?.weights.length ?? 0) > 5 ? (
          <Button
            label={showAllWeights ? 'Show less' : 'Show more'}
            variant="ghost"
            compact
            onPress={() => setShowAllWeights((s) => !s)}
          />
        ) : null}
      </Card>

      <SectionTitle>Training consistency</SectionTitle>
      <Card>
        <Row>
          <Stat label="This week" value={String(d?.week ?? '—')} sub="workouts" />
          <Stat label="This month" value={String(d?.month ?? '—')} sub="workouts" />
        </Row>
      </Card>

      <SectionTitle>Exercise progress</SectionTitle>
      <Card>
        <Row wrap>
          {(d?.variants ?? []).map((v) => (
            <Chip
              key={v.id}
              label={`${v.exercise.name} · ${v.label}`}
              selected={v.id === selected}
              onPress={() => setVariantId(v.id)}
            />
          ))}
        </Row>
        <T size={13} tone="muted">
          Top technique-valid load per session
          {selectedVariant ? ` — ${selectedVariant.exercise.name} (${selectedVariant.label})` : ''}
        </T>
        <LineChart
          points={exerciseSeries}
          format={(v) => formatNumber(v, 1)}
          emptyText="No sessions for this variant yet."
        />
        {selectedVariant ? (
          <Button
            label="Open exercise"
            variant="ghost"
            compact
            onPress={() => router.push(`/exercise/${selectedVariant.exercise.id}`)}
          />
        ) : null}
      </Card>

      <SectionTitle>Working sets this week</SectionTitle>
      <Card>
        {(d?.muscles ?? []).length === 0 ? <T tone="muted">No completed sets this week.</T> : null}
        {(d?.muscles ?? []).map((m) => (
          <Row key={m.muscleGroup} style={{ justifyContent: 'space-between' }}>
            <T>{MUSCLE_LABELS[m.muscleGroup as MuscleGroup] ?? m.muscleGroup}</T>
            <T weight="700">{m.sets}</T>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
