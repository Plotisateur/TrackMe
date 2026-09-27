import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { AutoSaveField } from '@/components/AutoSaveField';
import { Button, Card, EmptyState, ErrorView, Loading, Screen, T } from '@/components/ui';
import { ExerciseCard } from '@/features/workout/ExerciseCard';
import { useSessionEditor } from '@/features/workout/useSessionEditor';
import { useApp } from '@/state/AppContext';
import { formatDuration, formatLongDate } from '@/utils/date';
import { attempt } from '@/utils/errors';
import { formatWeight, parseDecimal, unitToKg } from '@/utils/units';

/** Full session detail with in-place correction: loads/reps, forgotten sets, notes. */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos, settings } = useApp();
  const editor = useSessionEditor(id, 'history');
  const d = editor.detail;

  if (editor.error)
    return (
      <Screen>
        <ErrorView error={editor.error} onRetry={editor.reload} />
      </Screen>
    );
  if (d === undefined) return <Loading />;
  if (d === null)
    return (
      <Screen>
        <EmptyState title="Session not found" />
      </Screen>
    );
  const s = d.session;

  const saveBodyWeight = (text: string) =>
    attempt('save body weight', async () => {
      const kg = parseDecimal(text);
      await repos.workouts.updateSession(s.id, {
        bodyWeightKg: kg === undefined || kg <= 0 ? undefined : unitToKg(kg, settings.unit),
      });
    });
  const saveNotes = (text: string) =>
    attempt('save notes', () =>
      repos.workouts.updateSession(s.id, { notes: text.trim() || undefined }),
    );

  const remove = () =>
    Alert.alert(
      'Delete session?',
      'This permanently deletes the session and all of its sets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await attempt('delete session', async () => {
              await repos.workouts.deleteSession(s.id);
              return true;
            });
            if (ok) router.back();
          },
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: s.name }} />
      <Screen edges={[]}>
        <T size={13} tone="muted" weight="600">
          {formatLongDate(s.startedAt)}
          {s.completedAt
            ? ` · ${formatDuration(Date.parse(s.completedAt) - Date.parse(s.startedAt))}`
            : ''}
          {s.status !== 'completed' ? ` · ${s.status}` : ''}
        </T>
        <Card>
          <AutoSaveField
            key={`bw-${s.id}`}
            label={`Body weight (${settings.unit})`}
            keyboardType="decimal-pad"
            initialValue={s.bodyWeightKg ? formatWeight(s.bodyWeightKg, settings.unit) : ''}
            onSave={saveBodyWeight}
            placeholder="—"
          />
          <AutoSaveField
            key={`notes-${s.id}`}
            label="Session notes"
            multiline
            initialValue={s.notes}
            onSave={saveNotes}
          />
        </Card>

        {d.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.instance.id}
            ex={ex}
            index={i}
            count={d.exercises.length}
            insight={editor.insights[ex.instance.id]}
            editor={editor}
            mode="history"
          />
        ))}

        <Button
          label="Add exercise"
          icon="+"
          variant="secondary"
          onPress={() => router.push(`/pick-exercise?sessionId=${s.id}`)}
        />
        {s.status === 'completed' ? (
          <Button
            label="View summary"
            variant="secondary"
            onPress={() => router.push(`/summary/${s.id}?from=session`)}
          />
        ) : null}
        <Button label="Delete session" variant="danger" onPress={remove} />
      </Screen>
    </>
  );
}
