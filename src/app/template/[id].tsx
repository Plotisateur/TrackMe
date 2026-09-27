import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorView,
  Field,
  Loading,
  Row,
  Screen,
  SectionTitle,
  T,
} from '@/components/ui';
import type { TemplateExerciseInput } from '@/db/repositories/templateRepository';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import type { WorkoutTemplateExerciseDetail } from '@/types/domain';
import { attempt, confirm } from '@/utils/errors';

function PrescriptionEditor({
  te,
  onSave,
}: {
  te: WorkoutTemplateExerciseDetail;
  onSave(input: TemplateExerciseInput): void;
}) {
  const initial = {
    sets: String(te.targetSets),
    min: String(te.targetRepMin),
    max: String(te.targetRepMax),
    rirMin: te.targetRirMin?.toString() ?? '',
    rirMax: te.targetRirMax?.toString() ?? '',
    rest: te.restSeconds?.toString() ?? '',
  };
  const [f, setF] = useState(initial);
  const int = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const commit = () => {
    const sets = int(f.sets);
    const min = int(f.min);
    const max = int(f.max);
    if (!sets || sets < 1 || !min || !max || min > max) {
      setF(initial);
      return;
    }
    onSave({
      targetSets: sets,
      targetRepMin: min,
      targetRepMax: max,
      targetRirMin: int(f.rirMin),
      targetRirMax: int(f.rirMax),
      restSeconds: int(f.rest),
      notes: te.notes,
    });
  };
  const field = (key: keyof typeof f, label: string) => (
    <Field
      style={{ flex: 1 }}
      label={label}
      keyboardType="number-pad"
      value={f[key]}
      onChangeText={(v) => setF((p) => ({ ...p, [key]: v }))}
      onEndEditing={commit}
    />
  );
  return (
    <>
      <Row>
        {field('sets', 'Sets')}
        {field('min', 'Reps min')}
        {field('max', 'Reps max')}
      </Row>
      <Row>
        {field('rirMin', 'RIR min')}
        {field('rirMax', 'RIR max')}
        {field('rest', 'Rest s')}
      </Row>
    </>
  );
}

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useApp();
  const { start, starting } = useStartWorkout();
  const loader = useLoader(() => repos.templates.getTemplate(id), [repos, id]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const t = loader.data;

  const [syncedId, setSyncedId] = useState<string>();
  if (t && t.id !== syncedId) {
    setSyncedId(t.id);
    setName(t.name);
    setDescription(t.description ?? '');
  }

  if (loader.error)
    return (
      <Screen>
        <ErrorView error={loader.error} onRetry={loader.reload} />
      </Screen>
    );
  if (t === undefined) return <Loading />;
  if (t === null)
    return (
      <Screen>
        <EmptyState title="Template not found" />
      </Screen>
    );

  const act = (action: string, fn: () => Promise<unknown>) =>
    attempt(action, async () => {
      await fn();
      await loader.reload();
    });

  const move = (index: number, dir: -1 | 1) => {
    const ids = t.exercises.map((e) => e.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    act('reorder', () => repos.templates.reorderExercises(t.id, ids));
  };

  return (
    <>
      <Stack.Screen options={{ title: t.name }} />
      <Screen edges={[]}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          onEndEditing={() =>
            name.trim() &&
            act('rename template', () => repos.templates.updateTemplate(t.id, { name }))
          }
        />
        <Field
          label="Description"
          multiline
          value={description}
          onChangeText={setDescription}
          onEndEditing={() =>
            act('save description', () =>
              repos.templates.updateTemplate(t.id, {
                description: description.trim() || undefined,
              }),
            )
          }
        />
        <Button
          label="Start this workout"
          icon="▶"
          loading={starting === t.id}
          onPress={() => start(t.id)}
        />
        <Row>
          <Button
            label={t.isPrimary ? '★ Primary' : 'Make primary'}
            compact
            variant="secondary"
            disabled={t.isPrimary}
            onPress={() => act('set primary', () => repos.templates.setPrimary(t.id))}
          />
          <Button
            label="Duplicate"
            compact
            variant="secondary"
            onPress={async () => {
              const copy = await attempt('duplicate template', () =>
                repos.templates.duplicateTemplate(t.id),
              );
              if (copy) router.replace(`/template/${copy.id}`);
            }}
          />
          <Button
            label="Delete"
            compact
            variant="danger"
            onPress={() =>
              confirm(
                'Delete template?',
                'Past sessions are kept. Only the template is removed.',
                'Delete',
                async () => {
                  const ok = await attempt('delete template', async () => {
                    await repos.templates.deleteTemplate(t.id);
                    return true;
                  });
                  if (ok) router.back();
                },
              )
            }
          />
        </Row>

        <SectionTitle>Exercises</SectionTitle>
        {t.exercises.length === 0 ? (
          <EmptyState title="No exercises" message="Add exercises to build this template." />
        ) : null}
        {t.exercises.map((te, i) => (
          <Card key={te.id}>
            <Row style={{ alignItems: 'flex-start' }}>
              <T weight="700" style={{ flex: 1 }}>
                {i + 1}. {te.variant.exercise.name}
                <T tone="muted"> — {te.variant.label}</T>
              </T>
              <Button
                label="▲"
                compact
                variant="secondary"
                disabled={i === 0}
                onPress={() => move(i, -1)}
                accessibilityLabel={`Move ${te.variant.exercise.name} up`}
              />
              <Button
                label="▼"
                compact
                variant="secondary"
                disabled={i === t.exercises.length - 1}
                onPress={() => move(i, 1)}
                accessibilityLabel={`Move ${te.variant.exercise.name} down`}
              />
            </Row>
            <PrescriptionEditor
              te={te}
              onSave={(input) =>
                act('save targets', () => repos.templates.updateExercise(te.id, input))
              }
            />
            <Button
              label="Remove"
              compact
              variant="ghost"
              onPress={() =>
                confirm('Remove from template?', te.variant.exercise.name, 'Remove', () =>
                  act('remove exercise', () => repos.templates.removeExercise(te.id)),
                )
              }
            />
          </Card>
        ))}
        <Button
          label="Add exercise"
          icon="+"
          variant="secondary"
          onPress={() => router.push(`/pick-exercise?templateId=${t.id}`)}
        />
      </Screen>
    </>
  );
}
