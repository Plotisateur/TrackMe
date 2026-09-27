import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Field, Row, Screen, SectionTitle, Segmented } from '@/components/ui';
import { EQUIPMENT_LABELS } from '@/features/exercises/labels';
import { useApp } from '@/state/AppContext';
import { EQUIPMENT_TYPES, type EquipmentType } from '@/types/domain';
import { attempt, confirm, reportError } from '@/utils/errors';
import { formatWeight, parseDecimal, unitToKg } from '@/utils/units';

export default function VariantFormScreen() {
  const { id, exerciseId } = useLocalSearchParams<{ id?: string; exerciseId?: string }>();
  const { repos, settings } = useApp();
  const unit = settings.unit;
  const [f, setF] = useState({
    label: '',
    manufacturer: '',
    machineModel: '',
    attachment: '',
    seatSetting: '',
    notes: '',
    increment: unit === 'kg' ? '5' : '10',
    refWeight: '',
    refReps: '',
  });
  const [equipment, setEquipment] = useState<EquipmentType>('machine');
  const [archived, setArchived] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!id) return;
    repos.exercises.getVariant(id).then((v) => {
      if (!v) return;
      setEquipment(v.equipmentType);
      setArchived(v.archived);
      setF({
        label: v.label,
        manufacturer: v.manufacturer ?? '',
        machineModel: v.machineModel ?? '',
        attachment: v.attachment ?? '',
        seatSetting: v.seatSetting ?? '',
        notes: v.notes ?? '',
        increment: formatWeight(v.weightIncrementKg, unit),
        refWeight: v.referenceWeightKg !== undefined ? formatWeight(v.referenceWeightKg, unit) : '',
        refReps: v.referenceReps?.toString() ?? '',
      });
    });
  }, [id, repos, unit]);

  const save = async () => {
    if (!f.label.trim()) return reportError('save variant', new Error('Label is required.'));
    const inc = parseDecimal(f.increment);
    if (!inc || inc <= 0)
      return reportError('save variant', new Error('Load increment must be positive.'));
    const ref = parseDecimal(f.refWeight);
    const reps = parseInt(f.refReps, 10);
    const input = {
      label: f.label,
      equipmentType: equipment,
      manufacturer: f.manufacturer.trim() || undefined,
      machineModel: f.machineModel.trim() || undefined,
      attachment: f.attachment.trim() || undefined,
      seatSetting: f.seatSetting.trim() || undefined,
      notes: f.notes.trim() || undefined,
      weightIncrementKg: unitToKg(inc, unit),
      referenceWeightKg: ref === undefined ? undefined : unitToKg(ref, unit),
      referenceReps: Number.isFinite(reps) ? reps : undefined,
    };
    const ok = await attempt('save variant', async () => {
      if (id) await repos.exercises.updateVariant(id, input);
      else if (exerciseId) await repos.exercises.createVariant(exerciseId, input);
      return true;
    });
    if (ok) router.back();
  };

  const toggleArchive = () =>
    confirm(
      archived ? 'Restore variant?' : 'Archive variant?',
      archived
        ? 'It will show up in pickers again.'
        : 'It will be hidden from pickers. Its history is kept.',
      archived ? 'Restore' : 'Archive',
      async () => {
        const ok = await attempt('archive variant', async () => {
          await repos.exercises.setVariantArchived(id!, !archived);
          return true;
        });
        if (ok) router.back();
      },
      !archived,
    );

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Edit variant' : 'New variant' }} />
      <Screen edges={[]}>
        <Field
          label="Label"
          value={f.label}
          onChangeText={set('label')}
          placeholder="e.g. Technogym / Neutral grip"
        />
        <SectionTitle>Equipment</SectionTitle>
        <Segmented
          options={EQUIPMENT_TYPES.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))}
          value={equipment}
          onChange={setEquipment}
        />
        <Row>
          <Field
            style={{ flex: 1 }}
            label="Manufacturer"
            value={f.manufacturer}
            onChangeText={set('manufacturer')}
          />
          <Field
            style={{ flex: 1 }}
            label="Model"
            value={f.machineModel}
            onChangeText={set('machineModel')}
          />
        </Row>
        <Row>
          <Field
            style={{ flex: 1 }}
            label="Attachment"
            value={f.attachment}
            onChangeText={set('attachment')}
          />
          <Field
            style={{ flex: 1 }}
            label="Seat setting"
            value={f.seatSetting}
            onChangeText={set('seatSetting')}
          />
        </Row>
        <Field
          label={`Load increment (${unit})`}
          keyboardType="decimal-pad"
          value={f.increment}
          onChangeText={set('increment')}
          hint="Step used by +/− buttons and load-increase suggestions."
        />
        <Row>
          <Field
            style={{ flex: 1 }}
            label={`Reference load (${unit})`}
            keyboardType="decimal-pad"
            value={f.refWeight}
            onChangeText={set('refWeight')}
          />
          <Field
            style={{ flex: 1 }}
            label="Reference reps"
            keyboardType="number-pad"
            value={f.refReps}
            onChangeText={set('refReps')}
          />
        </Row>
        <Field label="Notes" multiline value={f.notes} onChangeText={set('notes')} />
        <Button label="Save" onPress={save} />
        {id ? (
          <Button
            label={archived ? 'Restore variant' : 'Archive variant'}
            variant="danger"
            onPress={toggleArchive}
          />
        ) : null}
      </Screen>
    </>
  );
}
