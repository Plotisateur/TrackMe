import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  ErrorView,
  Field,
  ListRow,
  Row,
  Screen,
  T,
} from '@/components/ui';
import { MUSCLE_LABELS } from '@/features/exercises/labels';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain';
import { formatShortDate } from '@/utils/date';

export default function ExercisesScreen() {
  const { repos } = useApp();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const loader = useLoader(
    () => repos.exercises.listExercises({ includeArchived: showArchived }),
    [repos, showArchived],
  );

  const present = useMemo(
    () => new Set((loader.data ?? []).map((e) => e.muscleGroup)),
    [loader.data],
  );
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (loader.data ?? []).filter(
      (e) =>
        (!muscle || e.muscleGroup === muscle) &&
        (!q || `${e.name} ${e.variants.map((v) => v.label).join(' ')}`.toLowerCase().includes(q)),
    );
  }, [loader.data, query, muscle]);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={28} weight="800">
          Exercises
        </T>
        <Button label="+ New" compact onPress={() => router.push('/exercise/form')} />
      </Row>
      <Field
        placeholder="Search"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search exercises"
      />
      <Row wrap>
        <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
        {MUSCLE_GROUPS.filter((m) => present.has(m)).map((m) => (
          <Chip
            key={m}
            label={MUSCLE_LABELS[m]}
            selected={muscle === m}
            onPress={() => setMuscle(muscle === m ? null : m)}
          />
        ))}
        <Chip label="Archived" selected={showArchived} onPress={() => setShowArchived((s) => !s)} />
      </Row>
      {loader.error ? <ErrorView error={loader.error} onRetry={loader.reload} /> : null}
      {loader.data && list.length === 0 ? <EmptyState title="No exercises match" /> : null}
      {list.map((e) => (
        <ListRow
          key={e.id}
          title={`${e.name}${e.archived ? ' (archived)' : ''}`}
          subtitle={[
            MUSCLE_LABELS[e.muscleGroup],
            e.variants.map((v) => v.label).join(', ') || 'No variants',
            e.lastPerformedAt ? `last ${formatShortDate(e.lastPerformedAt)}` : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push(`/exercise/${e.id}`)}
        />
      ))}
    </Screen>
  );
}
