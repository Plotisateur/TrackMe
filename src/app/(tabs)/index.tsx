import { router } from 'expo-router';
import { Alert } from 'react-native';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  Row,
  Screen,
  SectionTitle,
  Stat,
  T,
} from '@/components/ui';
import { QuickWeightEntry } from '@/features/bodyWeight/QuickWeightEntry';
import { MacroCard } from '@/features/nutrition/MacroCard';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { bodyWeightStats } from '@/domain/bodyWeight/trend';
import { useLoader } from '@/hooks/useLoader';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { DAY_MS, formatDuration, formatLongDate, formatShortDate } from '@/utils/date';
import { attempt } from '@/utils/errors';
import { formatWeight } from '@/utils/units';

export default function TodayScreen() {
  const { repos, settings } = useApp();
  const { start, starting } = useStartWorkout();
  const refreshActive = useActiveSession((s) => s.refresh);
  const now = useNow();
  const loader = useLoader(async () => {
    const [active, templates, last, weights] = await Promise.all([
      repos.workouts.getActiveSession(),
      repos.templates.listTemplates(),
      repos.workouts.listSessions({ limit: 1 }),
      repos.bodyWeight.list({ since: new Date(Date.now() - 40 * DAY_MS).toISOString() }),
    ]);
    await refreshActive(repos);
    return { active, templates, last: last[0], weight: bodyWeightStats(weights) };
  }, [repos]);

  const d = loader.data;
  const primary = d?.templates.find((t) => t.isPrimary) ?? d?.templates[0];
  const others = d?.templates.filter((t) => t.id !== primary?.id) ?? [];

  const discard = (id: string) =>
    Alert.alert(
      'Abandon workout?',
      'The session is kept as discarded and will not count in history.',
      [
        { text: 'Keep training', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: () =>
            attempt('abandon workout', async () => {
              await repos.workouts.discardSession(id);
              await loader.reload();
            }),
        },
      ],
    );

  return (
    <Screen>
      <T size={13} tone="muted" weight="600">
        {formatLongDate(new Date())}
      </T>
      <T size={28} weight="800">
        Today
      </T>
      {loader.error ? <ErrorView error={loader.error} onRetry={loader.reload} /> : null}

      {d?.active ? (
        <Banner
          tone="success"
          action={
            <Row>
              <Button
                label="Resume workout"
                style={{ flex: 1 }}
                onPress={() => router.push(`/workout/${d.active!.id}`)}
              />
              <Button label="Abandon" variant="danger" onPress={() => discard(d.active!.id)} />
            </Row>
          }
        >
          <T weight="700">{d.active.name} in progress</T>
          <T size={13} tone="muted">
            Started {formatDuration(now - Date.parse(d.active.startedAt))} ago
          </T>
        </Banner>
      ) : primary ? (
        <Card>
          <T size={13} tone="muted" weight="600">
            NEXT WORKOUT
          </T>
          <T size={22} weight="800">
            {primary.name}
          </T>
          <T tone="muted">{primary.exerciseCount} exercises</T>
          <Button
            label={`Start ${primary.name}`}
            icon="▶"
            onPress={() => start(primary.id)}
            loading={starting === primary.id}
            disabled={!!starting}
          />
        </Card>
      ) : d ? (
        <EmptyState
          title="No templates yet"
          message="Create a template or start an empty workout."
          action={
            <Button
              label="Templates"
              variant="secondary"
              onPress={() => router.push('/template')}
            />
          }
        />
      ) : null}

      {!d?.active && others.length > 0 ? (
        <>
          <SectionTitle>Other templates</SectionTitle>
          {others.map((t) => (
            <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T weight="700" style={{ flex: 1 }}>
                {t.name}
              </T>
              <Button
                label="Start"
                compact
                variant="secondary"
                onPress={() => start(t.id)}
                loading={starting === t.id}
                disabled={!!starting}
              />
            </Card>
          ))}
        </>
      ) : null}
      {!d?.active ? (
        <Row>
          <Button
            label="Empty workout"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => start()}
            disabled={!!starting}
          />
          <Button
            label="Templates"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/template')}
          />
        </Row>
      ) : null}

      <SectionTitle>Body weight</SectionTitle>
      <Card>
        <Row>
          <Stat label="Current" value={formatWeight(d?.weight.current, settings.unit, true)} />
          <Stat label="7-day avg" value={formatWeight(d?.weight.average7, settings.unit, true)} />
          {settings.bodyWeightTargetKg ? (
            <Stat
              label="Target"
              value={formatWeight(settings.bodyWeightTargetKg, settings.unit, true)}
            />
          ) : null}
        </Row>
        <QuickWeightEntry onSaved={loader.reload} />
      </Card>

      {settings.macrosEnabled ? <MacroCard /> : null}

      {d?.last ? (
        <>
          <SectionTitle>Last session</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T weight="700">{d.last.name}</T>
              <T tone="muted">{formatShortDate(d.last.startedAt)}</T>
            </Row>
            <T tone="muted">
              {d.last.completedAt
                ? formatDuration(Date.parse(d.last.completedAt) - Date.parse(d.last.startedAt))
                : ''}{' '}
              · {d.last.completedSetCount} sets · {d.last.exerciseCount} exercises
            </T>
            <Button
              label="View summary"
              variant="ghost"
              compact
              onPress={() => router.push(`/summary/${d.last!.id}?from=today`)}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
