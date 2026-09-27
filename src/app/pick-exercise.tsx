import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { addExerciseToSession, defaultPrescription } from '@/features/workout/workoutService';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import type { VariantWithExercise } from '@/types/domain';
import { attempt } from '@/utils/errors';
import { MUSCLE_LABELS } from '@/features/exercises/labels';

/** Variant picker used to add an exercise to the active session or to a template. */
export default function PickExerciseScreen() {
  const { sessionId, templateId } = useLocalSearchParams<{
    sessionId?: string;
    templateId?: string;
  }>();
  const { repos, settings } = useApp();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const loader = useLoader(() => repos.exercises.listAllVariants(), [repos]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, VariantWithExercise[]>();
    for (const v of loader.data ?? []) {
      const hay = `${v.exercise.name} ${v.label} ${v.exercise.muscleGroup}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const list = map.get(v.exercise.id) ?? [];
      list.push(v);
      map.set(v.exercise.id, list);
    }
    return [...map.values()];
  }, [loader.data, query]);

  const pick = async (v: VariantWithExercise) => {
    setBusy(v.id);
    const ok = await attempt('add exercise', async () => {
      if (sessionId) await addExerciseToSession(repos, sessionId, v.id, settings);
      else if (templateId)
        await repos.templates.addExercise(templateId, v.id, defaultPrescription(v, settings));
      return true;
    });
    setBusy(null);
    if (ok) router.back();
  };

  return (
    <Screen edges={[]}>
      <Field
        placeholder="Search exercises"
        value={query}
        onChangeText={setQuery}
        autoFocus
        accessibilityLabel="Search exercises"
      />
      <Button label="New exercise" variant="ghost" onPress={() => router.push('/exercise/form')} />
      {groups.map((variants) => (
        <Card key={variants[0].exercise.id}>
          <T weight="700">{variants[0].exercise.name}</T>
          <T size={13} tone="muted">
            {MUSCLE_LABELS[variants[0].exercise.muscleGroup]}
          </T>
          <Row wrap>
            {variants.map((v) => (
              <Button
                key={v.id}
                label={v.label}
                compact
                variant="secondary"
                loading={busy === v.id}
                disabled={!!busy}
                onPress={() => pick(v)}
                accessibilityLabel={`Add ${v.exercise.name} ${v.label}`}
              />
            ))}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
