import { useState } from 'react';
import { Keyboard } from 'react-native';
import { Button, Chip, Field, Row } from '@/components/ui';
import { useApp } from '@/state/AppContext';
import { BODY_WEIGHT_CONTEXTS, type BodyWeightContext } from '@/types/domain';
import { attempt } from '@/utils/errors';
import { parseDecimal, unitToKg } from '@/utils/units';

const CONTEXT_LABELS: Record<BodyWeightContext, string> = {
  morning: 'Morning',
  fasted: 'Fasted',
  postToilet: 'Post-toilet',
  other: 'Other',
};

export function QuickWeightEntry({ onSaved }: { onSaved?: () => void }) {
  const { repos, settings } = useApp();
  const [text, setText] = useState('');
  const [context, setContext] = useState<BodyWeightContext | undefined>('morning');
  const [saving, setSaving] = useState(false);
  const value = parseDecimal(text);

  const save = async () => {
    if (value === undefined || value <= 0) return;
    setSaving(true);
    const ok = await attempt('save body weight', () =>
      repos.bodyWeight.add({ weightKg: unitToKg(value, settings.unit), context }),
    );
    setSaving(false);
    if (ok) {
      setText('');
      Keyboard.dismiss();
      onSaved?.();
    }
  };

  return (
    <>
      <Row>
        <Field
          style={{ flex: 1 }}
          placeholder={`Body weight (${settings.unit})`}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={setText}
          onSubmitEditing={save}
          returnKeyType="done"
          accessibilityLabel="Body weight"
        />
        <Button label="Save" onPress={save} disabled={value === undefined} loading={saving} />
      </Row>
      <Row wrap>
        {BODY_WEIGHT_CONTEXTS.map((c) => (
          <Chip
            key={c}
            label={CONTEXT_LABELS[c]}
            selected={context === c}
            onPress={() => setContext(context === c ? undefined : c)}
          />
        ))}
      </Row>
    </>
  );
}

export { CONTEXT_LABELS };
