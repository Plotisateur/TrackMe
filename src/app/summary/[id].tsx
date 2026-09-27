import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorView,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Stat,
  T,
} from '@/components/ui';
import { buildSummary } from '@/features/workout/workoutService';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import type { PersonalRecordType } from '@/domain/records/records';
import { formatDuration, formatShortDate } from '@/utils/date';
import { formatWeight, kgToUnit } from '@/utils/units';

const PR_LABEL: Record<PersonalRecordType, string> = {
  technical: 'Technical PR',
  weight: 'Load PR',
  reps: 'Rep PR',
  e1rm: 'Est. strength PR',
};

export default function SummaryScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { repos, settings } = useApp();
  const unit = settings.unit;
  const loader = useLoader(() => buildSummary(repos, id, settings), [repos, id, settings]);

  if (loader.error)
    return (
      <Screen>
        <ErrorView error={loader.error} onRetry={loader.reload} />
      </Screen>
    );
  if (loader.data === undefined) return <Loading />;
  const r = loader.data;
  if (!r)
    return (
      <Screen>
        <EmptyState title="Session not found" />
      </Screen>
    );
  const s = r.summary;
  // Technical PRs are the headline; other PR types follow.
  const records = [...r.records].sort(
    (a, b) => (a.type === 'technical' ? -1 : 0) - (b.type === 'technical' ? -1 : 0),
  );
  const technicalCount = r.records.filter((x) => x.type === 'technical').length;

  return (
    <>
      <Stack.Screen options={{ headerBackVisible: from !== undefined }} />
      <Screen edges={[]}>
        <T size={24} weight="800">
          {r.session.name} — {formatShortDate(r.session.startedAt)}
        </T>
        <T tone="muted">
          {formatDuration(s.durationMs)} · {s.totalSets} working sets
        </T>

        <Card>
          <Row wrap>
            <Stat label="Exercises" value={`${s.exercisesCompleted}/${s.exercisesTotal}`} />
            <Stat label="Sets" value={String(s.totalSets)} />
            <Stat label="Reps" value={String(s.totalReps)} />
          </Row>
          <Row wrap>
            <Stat label="Volume" value={`${Math.round(kgToUnit(s.volumeKg, unit))} ${unit}`} />
            <Stat label="Duration" value={formatDuration(s.durationMs)} />
            {s.bodyWeightKg ? (
              <Stat label="Body weight" value={formatWeight(s.bodyWeightKg, unit, true)} />
            ) : null}
          </Row>
        </Card>

        <SectionTitle>
          {technicalCount > 0
            ? `${technicalCount} technical PR${technicalCount > 1 ? 's' : ''}`
            : 'Records'}
        </SectionTitle>
        <Card>
          {records.length === 0 ? (
            <T tone="muted">No new records this time — consistency counts.</T>
          ) : null}
          {records.map((pr, i) => (
            <T key={i}>
              <T
                weight={pr.type === 'technical' ? '800' : '600'}
                tone={pr.type === 'technical' ? 'success' : 'default'}
              >
                {PR_LABEL[pr.type]}
              </T>{' '}
              · {pr.name}: {formatWeight(pr.set.weightKg, unit)} × {pr.set.reps}
              {pr.previous ? (
                <T tone="muted">
                  {' '}
                  (was {formatWeight(pr.previous.weightKg, unit)} × {pr.previous.reps})
                </T>
              ) : null}
            </T>
          ))}
        </Card>

        <SectionTitle>Next session</SectionTitle>
        <Card>
          {r.next.length === 0 ? <T tone="muted">No suggestions.</T> : null}
          {r.next.map((n) => (
            <T key={n.instanceId}>
              • {n.name} → aim {formatWeight(n.suggestion.suggestedWeightKg, unit)} ×{' '}
              {n.suggestion.targetReps}
              {n.suggestion.type === 'increase_weight'
                ? ' (load ↑)'
                : n.suggestion.type === 'reduce_weight'
                  ? ' (load ↓)'
                  : ''}
            </T>
          ))}
        </Card>

        {s.techniqueInvalid.length > 0 ? (
          <>
            <SectionTitle>Technique-degraded sets</SectionTitle>
            <Card>
              {s.techniqueInvalid.map((f) => (
                <T key={f.instanceId} tone="warning">
                  • {f.name}: {f.count} set{f.count > 1 ? 's' : ''} (excluded from progression)
                </T>
              ))}
            </Card>
          </>
        ) : null}

        {s.painFlags.length > 0 ? (
          <>
            <SectionTitle>Pain flags</SectionTitle>
            <Card>
              {s.painFlags.map((f) => (
                <T key={f.instanceId} tone="danger">
                  • {f.name}: {f.count} set{f.count > 1 ? 's' : ''}
                  {f.detail ? ` — ${f.detail}` : ''}
                </T>
              ))}
            </Card>
          </>
        ) : null}

        <Row>
          <Button
            label="Edit session"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push(`/session/${id}`)}
          />
          <Button
            label="Done"
            style={{ flex: 1 }}
            onPress={() => (from ? router.back() : router.dismissTo('/'))}
          />
        </Row>
      </Screen>
    </>
  );
}
