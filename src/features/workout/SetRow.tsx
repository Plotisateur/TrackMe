import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { NumberStepper } from '@/components/NumberStepper';
import { AutoSaveField } from '@/components/AutoSaveField';
import { Button, Chip, Row, T } from '@/components/ui';
import type { SetPatch } from '@/db/repositories/workoutRepository';
import { useApp } from '@/state/AppContext';
import { radius, space, TOUCH } from '@/theme/theme';
import type { PainSeverity, WorkoutSet } from '@/types/domain';
import { confirm } from '@/utils/errors';
import { formatWeight, kgToUnit, unitToKg } from '@/utils/units';

const RIR_OPTIONS = [0, 1, 2, 3, 4];

interface Props {
  set: WorkoutSet;
  expanded: boolean;
  isCurrent: boolean;
  weightStepKg: number;
  onExpand(): void;
  onChange(patch: SetPatch): void;
  onComplete(): void;
  onUndo(): void;
  onDelete(): void;
}

/**
 * One set. Compact when not being edited; expanded rows show inline kg / reps / RIR controls
 * and a large complete button — no modal, no navigation.
 */
export function SetRow({
  set,
  expanded,
  isCurrent,
  weightStepKg,
  onExpand,
  onChange,
  onComplete,
  onUndo,
  onDelete,
}: Props) {
  const { colors: c, settings } = useApp();
  const [noteOpen, setNoteOpen] = useState(!!set.notes);
  const unit = settings.unit;
  const n = set.setIndex + 1;

  if (!expanded) {
    const rir = settings.rirEnabled && set.rir !== undefined ? ` @${set.rir}` : '';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Set ${n}, ${set.completed ? 'completed' : 'not completed'}, ${formatWeight(set.weightKg, unit, true)} for ${set.reps ?? 'no'} reps. Tap to edit`}
        onPress={onExpand}
        style={({ pressed }) => ({
          minHeight: TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          backgroundColor: set.completed ? c.successBg : c.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <T weight="800" tone={set.completed ? 'success' : 'muted'} style={{ width: 28 }}>
          {set.completed ? '✓' : ''}
          {n}
        </T>
        <T size={17} weight="700" style={{ flex: 1 }}>
          {formatWeight(set.weightKg, unit)} {unit} × {set.reps ?? '—'}
          {rir}
        </T>
        {!set.techniqueValid ? <Chip label="Tech ✗" tone="warning" /> : null}
        {set.painFlag ? <Chip label="Pain" tone="danger" /> : null}
        {set.notes ? <T tone="faint">✎</T> : null}
      </Pressable>
    );
  }

  const weightStep = unit === 'kg' ? weightStepKg : 5;

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: set.completed ? c.success : isCurrent ? c.primary : c.border,
        backgroundColor: c.surfaceAlt,
        padding: space.sm,
        gap: space.sm,
      }}
    >
      <Row wrap style={{ justifyContent: 'space-between' }}>
        <T weight="800" tone={set.completed ? 'success' : 'default'}>
          {set.completed ? `✓ Set ${n}` : `Set ${n}`}
        </T>
        <Row gap={6} wrap>
          <Chip
            label={set.techniqueValid ? 'Tech ✓' : 'Tech ✗'}
            tone={set.techniqueValid ? undefined : 'warning'}
            accessibilityLabel={
              set.techniqueValid
                ? 'Technique valid. Tap to mark degraded'
                : 'Technique degraded. Tap to mark valid'
            }
            onPress={() => onChange({ techniqueValid: !set.techniqueValid })}
          />
          <Chip
            label="Pain"
            tone={set.painFlag ? 'danger' : undefined}
            accessibilityLabel={set.painFlag ? 'Pain flagged. Tap to clear' : 'Flag pain'}
            onPress={() =>
              onChange(
                set.painFlag
                  ? { painFlag: false, painArea: undefined, painSeverity: undefined }
                  : { painFlag: true },
              )
            }
          />
          <Chip
            label="✎"
            selected={noteOpen}
            accessibilityLabel="Set note"
            onPress={() => setNoteOpen((o) => !o)}
          />
          <Chip
            label="🗑"
            accessibilityLabel={`Delete set ${n}`}
            onPress={() => confirm('Delete set?', `Set ${n} will be removed.`, 'Delete', onDelete)}
          />
        </Row>
      </Row>

      <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
        <NumberStepper
          label={`Set ${n} weight`}
          suffix={unit}
          value={
            set.weightKg === undefined ? undefined : Number(kgToUnit(set.weightKg, unit).toFixed(2))
          }
          step={weightStep}
          onChange={(v) => onChange({ weightKg: v === undefined ? undefined : unitToKg(v, unit) })}
        />
        <NumberStepper
          label={`Set ${n} reps`}
          suffix="reps"
          integer
          max={100}
          value={set.reps}
          onChange={(v) => onChange({ reps: v })}
        />
      </Row>

      {settings.rirEnabled ? (
        <Row gap={6} wrap>
          <T size={13} tone="muted" weight="600" style={{ width: 32 }}>
            RIR
          </T>
          {RIR_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={r === 4 ? '4+' : String(r)}
              selected={set.rir === r}
              accessibilityLabel={`Reps in reserve ${r}`}
              onPress={() => onChange({ rir: set.rir === r ? undefined : r })}
            />
          ))}
        </Row>
      ) : null}

      {set.completed ? (
        <Button
          label="Undo completion"
          variant="secondary"
          onPress={onUndo}
          accessibilityLabel={`Undo completion of set ${n}`}
        />
      ) : (
        <Button
          label={`Complete set ${n}`}
          icon="✓"
          onPress={onComplete}
          style={{ minHeight: 56 }}
        />
      )}

      {set.painFlag ? (
        <View style={{ gap: space.sm }}>
          <AutoSaveField
            placeholder="Where? (e.g. lower back)"
            initialValue={set.painArea}
            onSave={(t) => onChange({ painArea: t.trim() || undefined })}
            accessibilityLabel="Pain area"
          />
          <Row gap={6} wrap>
            <T size={13} tone="muted" weight="600">
              Severity
            </T>
            {([1, 2, 3, 4, 5] as PainSeverity[]).map((s) => (
              <Chip
                key={s}
                label={String(s)}
                selected={set.painSeverity === s}
                accessibilityLabel={`Pain severity ${s} of 5`}
                onPress={() => onChange({ painSeverity: set.painSeverity === s ? undefined : s })}
              />
            ))}
          </Row>
        </View>
      ) : null}

      {noteOpen ? (
        <AutoSaveField
          placeholder="Set note"
          initialValue={set.notes}
          onSave={(t) => onChange({ notes: t.trim() || undefined })}
          accessibilityLabel={`Set ${n} note`}
        />
      ) : null}
    </View>
  );
}
