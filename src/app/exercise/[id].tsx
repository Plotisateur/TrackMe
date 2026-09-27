import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LineChart } from '@/components/LineChart';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorView,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  Stat,
  T,
} from '@/components/ui';
import { computeRecords, estimateOneRepMax } from '@/domain/records/records';
import { formatSetShort, painWarning } from '@/domain/workout/summary';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/features/exercises/labels';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import type { ExerciseHistoryEntry } from '@/types/domain';
import { formatShortDate } from '@/utils/date';
import { confirm, attempt } from '@/utils/errors';
import { formatNumber, formatWeight, kgToUnit } from '@/utils/units';

type Metric = 'weight' | 'e1rm' | 'volume' | 'reps';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos, settings } = useApp();
  const unit = settings.unit;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('weight');
  const [compare, setCompare] = useState(false);

  const base = useLoader(async () => {
    const exercise = await repos.exercises.getExercise(id);
    const variants = await repos.exercises.listVariants(id, { includeArchived: true });
    return { exercise, variants };
  }, [repos, id]);

  const selectedId =
    variantId ?? base.data?.variants.find((v) => !v.archived)?.id ?? base.data?.variants[0]?.id;

  const detail = useLoader(async () => {
    if (!selectedId) return null;
    const variant = await repos.exercises.getVariant(selectedId);
    const technique = variant?.techniqueProfileId
      ? await repos.exercises.getTechniqueProfile(variant.techniqueProfileId)
      : null;
    const history = await repos.exercises.getExerciseHistory(selectedId, { limit: 100 });
    return { variant, technique, history };
  }, [repos, selectedId]);

  const comparison = useLoader(async () => {
    if (!compare || !base.data) return [];
    const out: {
      label: string;
      last?: ExerciseHistoryEntry;
      best?: ReturnType<typeof computeRecords>['technical'];
    }[] = [];
    for (const v of base.data.variants) {
      const h = await repos.exercises.getExerciseHistory(v.id, { limit: 50 });
      out.push({
        label: v.label,
        last: h.find((x) => x.sets.length > 0),
        best: computeRecords(h, v.id).technical,
      });
    }
    return out;
  }, [repos, compare, base.data]);

  const ex = base.data?.exercise;
  const history = useMemo(() => detail.data?.history ?? [], [detail.data]);
  const repMin = ex?.defaultRepRangeMin;
  const repMax = ex?.defaultRepRangeMax;
  const range = useMemo(
    () => (repMin && repMax ? { min: repMin, max: repMax } : undefined),
    [repMin, repMax],
  );
  const records = useMemo(
    () => (selectedId ? computeRecords(history, selectedId, range) : undefined),
    [history, selectedId, range],
  );
  const [repWeight, setRepWeight] = useState<number | null>(null);

  const series = useMemo(() => {
    const chrono = [...history].reverse().filter((h) => h.sets.length > 0);
    return chrono
      .map((h) => {
        const valid = h.sets.filter((s) => s.techniqueValid);
        const t = Date.parse(h.date);
        if (metric === 'volume')
          return {
            t,
            value: kgToUnit(
              h.sets.reduce((a, s) => a + s.weightKg * s.reps, 0),
              unit,
            ),
          };
        if (valid.length === 0) return null;
        if (metric === 'weight')
          return { t, value: kgToUnit(Math.max(...valid.map((s) => s.weightKg)), unit) };
        if (metric === 'reps') {
          const w = repWeight ?? records?.weight?.weightKg;
          const at = valid.filter((s) => s.weightKg === w);
          return at.length ? { t, value: Math.max(...at.map((s) => s.reps)) } : null;
        }
        const e = valid
          .map((s) => estimateOneRepMax(s.weightKg, s.reps))
          .filter((x): x is number => x !== undefined);
        return e.length ? { t, value: kgToUnit(Math.max(...e), unit) } : null;
      })
      .filter((p): p is { t: number; value: number } => p !== null);
  }, [history, metric, unit, repWeight, records]);

  if (base.error)
    return (
      <Screen>
        <ErrorView error={base.error} onRetry={base.reload} />
      </Screen>
    );
  if (!base.data) return <Loading />;
  if (!ex)
    return (
      <Screen>
        <EmptyState title="Exercise not found" />
      </Screen>
    );

  const variants = base.data.variants;
  const d = detail.data;
  const last = history.find((h) => h.sets.length > 0);
  const cues = d?.technique?.cues?.split('\n').filter((l) => l.trim()) ?? [];
  const pain = selectedId ? painWarning(history, selectedId) : null;
  const painSessions = history.filter((h) => h.sets.some((s) => s.painFlag)).length;
  const lastValid = last?.sets.filter((s) => s.techniqueValid) ?? [];
  const workingWeight = lastValid.length
    ? Math.max(...lastValid.map((s) => s.weightKg))
    : undefined;
  const rirs = last?.sets.map((s) => s.rir).filter((r): r is number => r !== undefined) ?? [];
  const repRows = records
    ? [...records.repsByWeight.entries()].sort((a, b) => b[0] - a[0]).slice(0, 6)
    : [];

  const toggleArchive = () =>
    confirm(
      ex.archived ? 'Restore exercise?' : 'Archive exercise?',
      ex.archived
        ? 'It will appear in pickers again.'
        : 'It will be hidden from pickers and the library. All history is kept and stays visible in past sessions.',
      ex.archived ? 'Restore' : 'Archive',
      () =>
        attempt('archive exercise', async () => {
          await repos.exercises.setExerciseArchived(ex.id, !ex.archived);
          await base.reload();
        }),
      !ex.archived,
    );

  return (
    <>
      <Stack.Screen options={{ title: ex.name }} />
      <Screen edges={[]}>
        <T size={24} weight="800">
          {ex.name}
          {ex.archived ? ' (archived)' : ''}
        </T>
        <T tone="muted">
          {MUSCLE_LABELS[ex.muscleGroup]}
          {ex.secondaryMuscles?.length
            ? ` · ${ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}`
            : ''}
          {range ? ` · ${range.min}–${range.max} reps` : ''}
        </T>

        <SectionTitle
          right={
            <Button
              label="+ Variant"
              compact
              variant="ghost"
              onPress={() => router.push(`/variant/form?exerciseId=${ex.id}`)}
            />
          }
        >
          Variant
        </SectionTitle>
        <Row wrap>
          {variants.map((v) => (
            <Chip
              key={v.id}
              label={`${v.label}${v.archived ? ' (arch.)' : ''}`}
              selected={v.id === selectedId}
              onPress={() => setVariantId(v.id)}
            />
          ))}
        </Row>
        {d?.variant ? (
          <T size={13} tone="muted">
            {EQUIPMENT_LABELS[d.variant.equipmentType]}
            {d.variant.manufacturer ? ` · ${d.variant.manufacturer}` : ''}
            {d.variant.machineModel ? ` ${d.variant.machineModel}` : ''}
            {d.variant.attachment ? ` · ${d.variant.attachment}` : ''}
            {d.variant.seatSetting ? ` · seat ${d.variant.seatSetting}` : ''} · step{' '}
            {formatWeight(d.variant.weightIncrementKg, unit, true)}
          </T>
        ) : null}
        {selectedId ? (
          <Row>
            <Button
              label="Edit variant"
              compact
              variant="secondary"
              onPress={() => router.push(`/variant/form?id=${selectedId}`)}
            />
            <Button
              label="Edit technique"
              compact
              variant="secondary"
              onPress={() => router.push(`/variant/technique?variantId=${selectedId}`)}
            />
          </Row>
        ) : null}

        {pain ? (
          <Banner tone="danger">
            <T size={13}>
              Pain flagged in {pain.flaggedSessions} of the last {pain.lookback} sessions (
              {painSessions} total). Consider adjusting load, range of motion or technique. This is
              not a diagnosis.
            </T>
          </Banner>
        ) : null}

        <SectionTitle>Technique</SectionTitle>
        <Card>
          {cues.length === 0 && !d?.technique ? <T tone="muted">No technique cues yet.</T> : null}
          {cues.map((c, i) => (
            <T key={i}>• {c}</T>
          ))}
          {d?.technique?.tempoEccentric ? (
            <T tone="muted">Eccentric: {d.technique.tempoEccentric}</T>
          ) : null}
          {d?.technique?.tempoConcentric ? (
            <T tone="muted">Concentric: {d.technique.tempoConcentric}</T>
          ) : null}
          {d?.technique?.setupNotes ? <T tone="muted">Setup: {d.technique.setupNotes}</T> : null}
          {d?.technique?.rangeOfMotionNotes ? (
            <T tone="muted">ROM: {d.technique.rangeOfMotionNotes}</T>
          ) : null}
          {d?.technique?.painWarnings ? <T tone="warning">⚠ {d.technique.painWarnings}</T> : null}
        </Card>

        <SectionTitle>Current progression</SectionTitle>
        <Card>
          <Row wrap>
            <Stat
              label="Working load"
              value={formatWeight(workingWeight, unit, true)}
              sub={last ? formatShortDate(last.date) : 'no data'}
            />
            <Stat label="Rep range" value={range ? `${range.min}–${range.max}` : '—'} />
            <Stat
              label="Recent RIR"
              value={
                rirs.length ? formatNumber(rirs.reduce((a, b) => a + b, 0) / rirs.length, 1) : '—'
              }
            />
          </Row>
        </Card>

        <SectionTitle>Records (technique-valid only)</SectionTitle>
        <Card>
          <Row wrap>
            <Stat
              label="Technical PR"
              value={
                records?.technical
                  ? `${formatWeight(records.technical.weightKg, unit)} × ${records.technical.reps}`
                  : '—'
              }
              sub={records?.technical ? formatShortDate(records.technical.date) : undefined}
            />
            <Stat
              label="Load PR"
              value={
                records?.weight
                  ? `${formatWeight(records.weight.weightKg, unit)} × ${records.weight.reps}`
                  : '—'
              }
            />
            <Stat
              label="Est. 1RM"
              value={records?.e1rm ? formatWeight(records.e1rm.e1rm, unit, true) : '—'}
            />
          </Row>
          {repRows.length > 0 ? (
            <View style={{ gap: 2 }}>
              <T size={13} tone="muted" weight="600">
                Most reps at load
              </T>
              {repRows.map(([w, s]) => (
                <T key={w} size={14}>
                  {formatWeight(w, unit, true)}: {s.reps} reps ({formatShortDate(s.date)})
                </T>
              ))}
            </View>
          ) : null}
          <T size={12} tone="faint">
            Only {d?.variant?.label ?? 'this variant'} is included — other equipment is never mixed
            in.
          </T>
        </Card>

        <SectionTitle>Graph</SectionTitle>
        <Card>
          <Segmented
            options={[
              { value: 'weight', label: 'Load' },
              { value: 'reps', label: 'Reps @ load' },
              { value: 'e1rm', label: 'Est. 1RM' },
              { value: 'volume', label: 'Volume' },
            ]}
            value={metric}
            onChange={setMetric}
          />
          {metric === 'reps' && repRows.length > 0 ? (
            <Row wrap>
              {repRows.map(([w]) => (
                <Chip
                  key={w}
                  label={formatWeight(w, unit, true)}
                  selected={(repWeight ?? records?.weight?.weightKg) === w}
                  onPress={() => setRepWeight(w)}
                />
              ))}
            </Row>
          ) : null}
          <LineChart points={series} format={(v) => formatNumber(v, 1)} />
        </Card>

        <SectionTitle>History</SectionTitle>
        <Card>
          {history.length === 0 ? <T tone="muted">No sessions for this variant yet.</T> : null}
          {history.slice(0, 30).map((h) => (
            <Row key={h.instanceId} style={{ alignItems: 'flex-start' }}>
              <T tone="muted" style={{ width: 60 }}>
                {formatShortDate(h.date)}
              </T>
              <T style={{ flex: 1 }} onPress={() => router.push(`/session/${h.sessionId}`)}>
                {h.sets.length === 0
                  ? '—'
                  : h.sets
                      .map(
                        (s) =>
                          formatSetShort(s, formatWeight(s.weightKg, unit)) +
                          (s.techniqueValid ? '' : '✗') +
                          (s.painFlag ? '⚠' : ''),
                      )
                      .join('   ')}
              </T>
            </Row>
          ))}
        </Card>

        {variants.length > 1 ? (
          <>
            <SectionTitle>Compare variants</SectionTitle>
            <Card>
              {!compare ? (
                <Button
                  label="Compare variants side by side"
                  variant="secondary"
                  onPress={() => setCompare(true)}
                />
              ) : (
                <>
                  <T size={12} tone="warning">
                    Loads on different equipment are not directly comparable.
                  </T>
                  {(comparison.data ?? []).map((c) => (
                    <View key={c.label} style={{ gap: 2 }}>
                      <T weight="700">{c.label}</T>
                      <T size={14} tone="muted">
                        Last:{' '}
                        {c.last
                          ? c.last.sets
                              .map((s) => formatSetShort(s, formatWeight(s.weightKg, unit)))
                              .join('  ')
                          : '—'}
                      </T>
                      <T size={14} tone="muted">
                        Technical best:{' '}
                        {c.best ? `${formatWeight(c.best.weightKg, unit)} × ${c.best.reps}` : '—'}
                      </T>
                    </View>
                  ))}
                </>
              )}
            </Card>
          </>
        ) : null}

        <Row>
          <Button
            label="Edit exercise"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push(`/exercise/form?id=${ex.id}`)}
          />
          <Button
            label={ex.archived ? 'Restore' : 'Archive'}
            variant="danger"
            style={{ flex: 1 }}
            onPress={toggleArchive}
          />
        </Row>
      </Screen>
    </>
  );
}
