import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Card, Field, Row, Screen, SectionTitle, Segmented } from '@/components/ui';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/features/exercises/labels';
import { useApp } from '@/state/AppContext';
import {
  EQUIPMENT_TYPES,
  EXERCISE_CATEGORIES,
  type EquipmentType,
  type ExerciseCategory,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@/types/domain';
import { attempt, reportError } from '@/utils/errors';

export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repos } = useApp();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [category, setCategory] = useState<ExerciseCategory>('compound');
  const [repMin, setRepMin] = useState('8');
  const [repMax, setRepMax] = useState('12');
  const [variantLabel, setVariantLabel] = useState('');
  const [equipment, setEquipment] = useState<EquipmentType>('machine');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    repos.exercises.getExercise(id).then((e) => {
      if (!e) return;
      setName(e.name);
      setMuscle(e.muscleGroup);
      setCategory(e.category);
      setRepMin(e.defaultRepRangeMin?.toString() ?? '');
      setRepMax(e.defaultRepRangeMax?.toString() ?? '');
    });
  }, [id, repos]);

  const save = async () => {
    if (!name.trim()) return reportError('save exercise', new Error('Name is required.'));
    const min = parseInt(repMin, 10);
    const max = parseInt(repMax, 10);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      return reportError('save exercise', new Error('Rep range minimum is above the maximum.'));
    }
    const input = {
      name,
      muscleGroup: muscle,
      category,
      defaultRepRangeMin: Number.isFinite(min) ? min : undefined,
      defaultRepRangeMax: Number.isFinite(max) ? max : undefined,
    };
    setSaving(true);
    const result = await attempt('save exercise', async () => {
      if (id) {
        await repos.exercises.updateExercise(id, input);
        return id;
      }
      const e = await repos.exercises.createExercise(input);
      await repos.exercises.createVariant(e.id, {
        label: variantLabel.trim() || EQUIPMENT_LABELS[equipment],
        equipmentType: equipment,
        weightIncrementKg: equipment === 'dumbbell' ? 2 : equipment === 'barbell' ? 2.5 : 5,
      });
      return e.id;
    });
    setSaving(false);
    if (!result) return;
    if (id) router.back();
    else router.replace(`/exercise/${result}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit exercise' : 'New exercise' }} />
      <Screen edges={[]}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Seated Cable Row"
        />
        <SectionTitle>Muscle group</SectionTitle>
        <Segmented
          options={MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))}
          value={muscle}
          onChange={setMuscle}
        />
        <SectionTitle>Category</SectionTitle>
        <Segmented
          options={EXERCISE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          value={category}
          onChange={setCategory}
        />
        <Row>
          <Field
            style={{ flex: 1 }}
            label="Default reps min"
            keyboardType="number-pad"
            value={repMin}
            onChangeText={setRepMin}
          />
          <Field
            style={{ flex: 1 }}
            label="Default reps max"
            keyboardType="number-pad"
            value={repMax}
            onChangeText={setRepMax}
          />
        </Row>
        {!id ? (
          <Card>
            <SectionTitle>First variant</SectionTitle>
            <Field
              label="Variant label"
              value={variantLabel}
              onChangeText={setVariantLabel}
              placeholder="e.g. Cable / Straight Bar"
              hint="Performances are only compared within the same variant."
            />
            <Segmented
              options={EQUIPMENT_TYPES.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))}
              value={equipment}
              onChange={setEquipment}
            />
          </Card>
        ) : null}
        <Button label="Save" onPress={save} loading={saving} />
      </Screen>
    </>
  );
}
