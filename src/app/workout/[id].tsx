import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Banner, Button, EmptyState, ErrorView, Loading, Row, Screen, T } from '@/components/ui';
import { ExerciseCard } from '@/features/workout/ExerciseCard';
import { useSessionEditor } from '@/features/workout/useSessionEditor';
import { useNow } from '@/hooks/useNow';
import { useApp } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { useRestTimer } from '@/stores/restTimerStore';
import { formatDuration } from '@/utils/date';
import { attempt } from '@/utils/errors';
import { formatWeight } from '@/utils/units';

function KeepAwake() {
  useKeepAwake('workout');
  return null;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos, settings } = useApp();
  const editor = useSessionEditor(id, 'active');
  const refreshActive = useActiveSession((s) => s.refresh);
  const skipTimer = useRestTimer((s) => s.skip);
  const now = useNow();
  const [finishing, setFinishing] = useState(false);

  const d = editor.detail;
  if (editor.error)
    return (
      <Screen>
        <ErrorView error={editor.error} onRetry={editor.reload} />
      </Screen>
    );
  if (d === undefined) return <Loading />;
  if (d === null) {
    return (
      <Screen>
        <EmptyState
          title="Workout not found"
          action={<Button label="Back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }
  if (d.session.status !== 'active') {
    return (
      <Screen>
        <EmptyState
          title="This workout is finished"
          action={
            <Button
              label="View summary"
              onPress={() => router.replace(`/summary/${d.session.id}`)}
            />
          }
        />
      </Screen>
    );
  }

  const all = d.exercises.flatMap((e) => e.sets);
  const doneCount = all.filter((s) => s.completed).length;
  const pending = all.length - doneCount;

  const finish = () => {
    const doFinish = async () => {
      setFinishing(true);
      const ok = await attempt('finish workout', async () => {
        await repos.workouts.completeSession(d.session.id);
        return true;
      });
      setFinishing(false);
      if (!ok) return;
      skipTimer();
      await refreshActive(repos);
      router.replace(`/summary/${d.session.id}`);
    };
    if (doneCount === 0) {
      Alert.alert(
        'No sets completed',
        'Complete at least one set, or abandon the workout instead.',
      );
      return;
    }
    Alert.alert(
      'Finish workout?',
      pending > 0
        ? `${pending} planned set${pending > 1 ? 's were' : ' was'} not completed and will be dropped.`
        : 'Great work. Your session will be saved to history.',
      [
        { text: 'Keep training', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ],
    );
  };

  const abandon = () =>
    Alert.alert(
      'Abandon workout?',
      'The session is kept as discarded and will not appear in history or progression.',
      [
        { text: 'Keep training', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            const ok = await attempt('abandon workout', async () => {
              await repos.workouts.discardSession(d.session.id);
              return true;
            });
            if (!ok) return;
            skipTimer();
            await refreshActive(repos);
            router.back();
          },
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: d.session.name }} />
      {settings.keepAwakeDuringWorkout ? <KeepAwake /> : null}
      <Screen edges={[]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T tone="muted" weight="600">
            {formatDuration(now - Date.parse(d.session.startedAt))} · {doneCount}/{all.length} sets
          </T>
          {d.session.bodyWeightKg ? (
            <T tone="muted">BW {formatWeight(d.session.bodyWeightKg, settings.unit, true)}</T>
          ) : null}
        </Row>

        {editor.reordered && d.session.templateId ? (
          <Banner
            tone="info"
            action={
              <Button
                label="Save this order to template"
                compact
                variant="secondary"
                onPress={editor.saveOrderToTemplate}
              />
            }
          >
            <T size={13}>Order changed for this session only.</T>
          </Banner>
        ) : null}

        {d.exercises.length === 0 ? (
          <EmptyState title="No exercises yet" message="Add the first exercise to begin." />
        ) : null}

        {d.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.instance.id}
            ex={ex}
            index={i}
            count={d.exercises.length}
            insight={editor.insights[ex.instance.id]}
            editor={editor}
            mode="active"
          />
        ))}

        <Button
          label="Add exercise"
          icon="+"
          variant="secondary"
          onPress={() => router.push(`/pick-exercise?sessionId=${d.session.id}`)}
        />
        <Button label="Finish workout" icon="✓" onPress={finish} loading={finishing} />
        <Button label="Abandon workout" variant="danger" onPress={abandon} />
      </Screen>
    </>
  );
}
