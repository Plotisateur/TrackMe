import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Field, Row, Screen, T } from '@/components/ui';
import { useApp } from '@/state/AppContext';
import { attempt } from '@/utils/errors';

const EMPTY = {
  name: '',
  cues: '',
  setupNotes: '',
  concentricNotes: '',
  eccentricNotes: '',
  rangeOfMotionNotes: '',
  tempoConcentric: '',
  tempoEccentric: '',
  stabilityNotes: '',
  painWarnings: '',
};

/** Technique profile editor. Sessions keep a snapshot, so edits never rewrite history. */
export default function TechniqueScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const { repos } = useApp();
  const [f, setF] = useState(EMPTY);
  const [title, setTitle] = useState('Technique');
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const v = await repos.exercises.getVariant(variantId);
      if (!v) return;
      setTitle(`${v.exercise.name} — ${v.label}`);
      const t = v.techniqueProfileId
        ? await repos.exercises.getTechniqueProfile(v.techniqueProfileId)
        : null;
      setF({
        ...EMPTY,
        name: t?.name ?? `${v.exercise.name} — ${v.label}`,
        ...Object.fromEntries(
          Object.entries(t ?? {}).filter(([k, val]) => k in EMPTY && typeof val === 'string'),
        ),
      });
    })();
  }, [variantId, repos]);

  const save = async () => {
    const opt = (s: string) => s.trim() || undefined;
    const ok = await attempt('save technique', async () => {
      await repos.exercises.saveTechniqueProfile(variantId, {
        name: f.name,
        cues: opt(f.cues),
        setupNotes: opt(f.setupNotes),
        concentricNotes: opt(f.concentricNotes),
        eccentricNotes: opt(f.eccentricNotes),
        rangeOfMotionNotes: opt(f.rangeOfMotionNotes),
        tempoConcentric: opt(f.tempoConcentric),
        tempoEccentric: opt(f.tempoEccentric),
        stabilityNotes: opt(f.stabilityNotes),
        painWarnings: opt(f.painWarnings),
      });
      return true;
    });
    if (ok) router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Technique' }} />
      <Screen edges={[]}>
        <T weight="700">{title}</T>
        <Field
          label="Cues (one per line — shown during the workout)"
          multiline
          value={f.cues}
          onChangeText={set('cues')}
          style={{ minHeight: 120 }}
          placeholder={'Elbows toward pockets\nNo momentum'}
        />
        <Row>
          <Field
            style={{ flex: 1 }}
            label="Eccentric tempo"
            value={f.tempoEccentric}
            onChangeText={set('tempoEccentric')}
            placeholder="2–3 s"
          />
          <Field
            style={{ flex: 1 }}
            label="Concentric tempo"
            value={f.tempoConcentric}
            onChangeText={set('tempoConcentric')}
            placeholder="explosive"
          />
        </Row>
        <Field label="Setup" multiline value={f.setupNotes} onChangeText={set('setupNotes')} />
        <Field
          label="Concentric"
          multiline
          value={f.concentricNotes}
          onChangeText={set('concentricNotes')}
        />
        <Field
          label="Eccentric"
          multiline
          value={f.eccentricNotes}
          onChangeText={set('eccentricNotes')}
        />
        <Field
          label="Range of motion"
          multiline
          value={f.rangeOfMotionNotes}
          onChangeText={set('rangeOfMotionNotes')}
        />
        <Field
          label="Stability"
          multiline
          value={f.stabilityNotes}
          onChangeText={set('stabilityNotes')}
        />
        <Field
          label="Pain warnings"
          multiline
          value={f.painWarnings}
          onChangeText={set('painWarnings')}
        />
        <Field label="Profile name" value={f.name} onChangeText={set('name')} />
        <Button label="Save technique" onPress={save} />
      </Screen>
    </>
  );
}
