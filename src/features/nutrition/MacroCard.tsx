import { useState } from 'react';
import { Button, Card, Field, Row, T } from '@/components/ui';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import { localDateKey } from '@/utils/date';
import { attempt } from '@/utils/errors';

/** Minimal daily macro totals (V2.5, optional). Training day follows today's completed workout. */
export function MacroCard() {
  const { repos, settings } = useApp();
  const today = localDateKey();
  const loader = useLoader(async () => {
    const entry = await repos.macros.get(today);
    const sessions = await repos.workouts.listSessions({
      since: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      limit: 1,
    });
    return { entry, trained: sessions.length > 0 };
  }, [repos, today]);
  const [form, setForm] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const entry = loader.data?.entry;
  const [syncedEntry, setSyncedEntry] = useState<typeof entry>();
  if (entry && entry !== syncedEntry) {
    setSyncedEntry(entry);
    setForm({
      calories: entry.calories?.toString() ?? '',
      proteinG: entry.proteinG?.toString() ?? '',
      carbsG: entry.carbsG?.toString() ?? '',
      fatG: entry.fatG?.toString() ?? '',
    });
  }

  const trainingDay = loader.data?.entry?.trainingDay || loader.data?.trained || false;
  const t = settings.macroTargets;
  const num = (s: string) =>
    s.trim() === '' ? undefined : Math.round(Number(s.replace(',', '.'))) || undefined;

  const save = () =>
    attempt('save macros', async () => {
      await repos.macros.upsert({
        date: today,
        calories: num(form.calories),
        proteinG: num(form.proteinG),
        carbsG: num(form.carbsG),
        fatG: num(form.fatG),
        trainingDay,
      });
      await loader.reload();
    });

  const field = (key: keyof typeof form, label: string, target: string) => (
    <Field
      style={{ flex: 1 }}
      label={label}
      hint={target}
      keyboardType="number-pad"
      value={form[key]}
      onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
    />
  );

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="700">Macros today</T>
        <T size={13} tone={trainingDay ? 'success' : 'muted'}>
          {trainingDay ? 'Training day' : 'Rest day'}
        </T>
      </Row>
      <Row>
        {field('calories', 'kcal', `${t.calories}`)}
        {field('proteinG', 'Protein g', `${t.proteinMinG}–${t.proteinMaxG}`)}
      </Row>
      <Row>
        {field('carbsG', 'Carbs g', `${trainingDay ? t.carbsTrainingDayG : t.carbsRestDayG}`)}
        {field('fatG', 'Fat g', `~${t.fatG}`)}
      </Row>
      <Button label="Save macros" variant="secondary" onPress={save} />
    </Card>
  );
}
