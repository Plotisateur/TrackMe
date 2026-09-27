import { useState } from 'react';
import { View } from 'react-native';
import { AutoSaveField } from '@/components/AutoSaveField';
import { Banner, Button, Card, Chip, Row, T } from '@/components/ui';
import { formatSetShort } from '@/domain/workout/summary';
import { useApp } from '@/state/AppContext';
import { REST_PRESETS } from '@/stores/restTimerStore';
import { space } from '@/theme/theme';
import type { WorkoutExerciseDetail } from '@/types/domain';
import { formatClock, formatShortDate } from '@/utils/date';
import { confirm } from '@/utils/errors';
import { formatWeight } from '@/utils/units';
import { SetRow } from './SetRow';
import type { EditorMode, SessionEditor } from './useSessionEditor';
import type { ExerciseInsight } from './workoutService';

const SUGGESTION_ICON = {
  increase_weight: '↑',
  increase_reps: '↗',
  maintain: '→',
  reduce_weight: '↓',
} as const;

interface Props {
  ex: WorkoutExerciseDetail;
  index: number;
  count: number;
  insight?: ExerciseInsight;
  editor: SessionEditor;
  mode: EditorMode;
}

export function ExerciseCard({ ex, index, count, insight, editor, mode }: Props) {
  const { colors: c, settings } = useApp();
  const unit = settings.unit;
  const current = ex.sets.find((s) => !s.completed);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCues, setShowCues] = useState(true);
  const [showNotes, setShowNotes] = useState(!!ex.instance.notes);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const done = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
  const i = ex.instance;
  const technique = insight?.technique;
  const cues =
    technique?.cues
      ?.split('\n')
      .map((l) => l.trim())
      .filter(Boolean) ?? [];
  const suggestion = mode === 'active' && !suggestionDismissed ? insight?.suggestion : null;
  const rest = i.restSeconds ?? settings.defaultRestSeconds;

  const isExpanded = (id: string) =>
    expandedId ? expandedId === id : mode === 'active' && current?.id === id;

  const target =
    `${i.targetSets} × ${i.targetRepMin}–${i.targetRepMax}` +
    (settings.rirEnabled && i.targetRirMin !== undefined
      ? ` @ RIR ${i.targetRirMin}${i.targetRirMax !== undefined && i.targetRirMax !== i.targetRirMin ? `–${i.targetRirMax}` : ''}`
      : '');

  const cycleRest = () => {
    const idx = REST_PRESETS.findIndex((p) => p === rest);
    const next = REST_PRESETS[(idx + 1) % REST_PRESETS.length];
    editor.updateInstance(i.id, { restSeconds: next });
  };

  return (
    <Card style={done ? { borderColor: c.success, borderWidth: 1 } : undefined}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={18} weight="800">
            {done ? '✓ ' : ''}
            {ex.variant.exercise.name.toUpperCase()}
          </T>
          <T tone="muted" weight="600">
            {ex.variant.label}
            {ex.variant.manufacturer && !ex.variant.label.includes(ex.variant.manufacturer)
              ? ` · ${ex.variant.manufacturer}`
              : ''}
            {ex.variant.seatSetting ? ` · seat ${ex.variant.seatSetting}` : ''}
          </T>
        </View>
        <Row gap={4}>
          <Button
            label="▲"
            compact
            variant="secondary"
            disabled={index === 0}
            onPress={() => editor.move(i.id, -1)}
            accessibilityLabel={`Move ${ex.variant.exercise.name} up`}
          />
          <Button
            label="▼"
            compact
            variant="secondary"
            disabled={index === count - 1}
            onPress={() => editor.move(i.id, 1)}
            accessibilityLabel={`Move ${ex.variant.exercise.name} down`}
          />
        </Row>
      </Row>

      {insight?.last ? (
        <T size={14}>
          <T size={14} tone="muted">
            Last ({formatShortDate(insight.last.date)}):{' '}
          </T>
          {insight.last.sets
            .map(
              (s) =>
                formatSetShort(s, formatWeight(s.weightKg, unit)) + (s.techniqueValid ? '' : ' ✗'),
            )
            .join('   ')}
        </T>
      ) : (
        <T size={14} tone="faint">
          No previous session for this variant
        </T>
      )}
      {insight?.bestTechnical ? (
        <T size={14} tone="muted">
          Best technical: {formatWeight(insight.bestTechnical.weightKg, unit)} ×{' '}
          {insight.bestTechnical.reps} ({formatShortDate(insight.bestTechnical.date)})
        </T>
      ) : null}
      <Row wrap>
        <T size={14} weight="700">
          Target {target}
        </T>
        {mode === 'active' ? (
          <Chip
            label={`Rest ${formatClock(rest)}`}
            onPress={cycleRest}
            accessibilityLabel={`Rest ${rest} seconds. Tap to change`}
          />
        ) : null}
      </Row>

      {suggestion ? (
        <Banner
          tone={
            suggestion.type === 'increase_weight'
              ? 'success'
              : suggestion.type === 'reduce_weight'
                ? 'warning'
                : 'info'
          }
          action={
            <Row>
              <Button
                label="Dismiss"
                compact
                variant="ghost"
                onPress={() => {
                  setSuggestionDismissed(true);
                  if (
                    suggestion.type === 'increase_weight' ||
                    suggestion.type === 'reduce_weight'
                  ) {
                    editor.dismissSuggestion(ex);
                  }
                }}
              />
            </Row>
          }
        >
          <T weight="700">
            {SUGGESTION_ICON[suggestion.type]} Aim{' '}
            {formatWeight(suggestion.suggestedWeightKg, unit)} {unit} × {suggestion.targetReps}
          </T>
          <T size={13} tone="muted">
            {suggestion.reason}
          </T>
        </Banner>
      ) : null}

      {insight?.painWarning ? (
        <Banner tone="danger">
          <T size={13}>
            Pain flagged in {insight.painWarning.flaggedSessions} of the last{' '}
            {insight.painWarning.lookback} sessions. Consider adjusting load, range or technique.
            This is not a diagnosis.
          </T>
        </Banner>
      ) : null}

      {cues.length > 0 || technique?.tempoEccentric ? (
        <View style={{ gap: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={13} weight="700" tone="muted">
              TECHNIQUE
            </T>
            <Button
              label={showCues ? 'Hide' : 'Show'}
              compact
              variant="ghost"
              onPress={() => setShowCues((s) => !s)}
              accessibilityLabel={showCues ? 'Hide technique cues' : 'Show technique cues'}
            />
          </Row>
          {showCues ? (
            <>
              {cues.map((cue, k) => (
                <T key={k} size={15}>
                  • {cue}
                </T>
              ))}
              {technique?.tempoEccentric || technique?.tempoConcentric ? (
                <T size={13} tone="muted">
                  Tempo: {technique.tempoEccentric ? `eccentric ${technique.tempoEccentric}` : ''}
                  {technique.tempoEccentric && technique.tempoConcentric ? ' · ' : ''}
                  {technique.tempoConcentric ? `concentric ${technique.tempoConcentric}` : ''}
                </T>
              ) : null}
              {technique?.painWarnings ? (
                <T size={13} tone="warning">
                  ⚠ {technique.painWarnings}
                </T>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        {ex.sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            expanded={isExpanded(s.id)}
            isCurrent={current?.id === s.id}
            weightStepKg={ex.variant.weightIncrementKg}
            onExpand={() => setExpandedId(s.id)}
            onChange={(patch) => editor.updateSet(s.id, patch)}
            onComplete={() => {
              setExpandedId(null);
              editor.completeSet(s, ex);
            }}
            onUndo={() => {
              setExpandedId(s.id);
              editor.uncompleteSet(s.id);
            }}
            onDelete={() => editor.deleteSet(s.id)}
          />
        ))}
      </View>

      <Row wrap>
        <Button label="+ Set" compact variant="secondary" onPress={() => editor.addSet(ex)} />
        <Button
          label={showNotes ? 'Hide note' : i.notes ? 'Note ✎' : '+ Note'}
          compact
          variant="secondary"
          onPress={() => setShowNotes((s) => !s)}
        />
        <Button
          label="Remove"
          compact
          variant="ghost"
          onPress={() =>
            confirm(
              'Remove exercise?',
              `${ex.variant.exercise.name} and its sets will be removed from this session.`,
              'Remove',
              () => editor.removeExercise(i.id),
            )
          }
        />
      </Row>
      {showNotes ? (
        <AutoSaveField
          placeholder="Exercise note (machine setting, feel, …)"
          multiline
          initialValue={i.notes}
          onSave={(t) => editor.updateInstance(i.id, { notes: t })}
          accessibilityLabel={`${ex.variant.exercise.name} note`}
        />
      ) : null}
    </Card>
  );
}
