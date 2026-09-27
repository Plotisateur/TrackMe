import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch } from 'react-native';
import { Button, Card, Field, Row, Screen, SectionTitle, Segmented, T } from '@/components/ui';
import {
  chooseImportMode,
  exportCsv,
  exportJsonBackup,
  importBackup,
  pickBackup,
} from '@/features/settings/backupService';
import { useApp } from '@/state/AppContext';
import { useActiveSession } from '@/stores/activeSessionStore';
import { useRestTimer } from '@/stores/restTimerStore';
import type { AppSettings, MacroTargets } from '@/types/settings';
import { attempt } from '@/utils/errors';
import { formatWeight, parseDecimal, unitToKg } from '@/utils/units';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations/runner';

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange(v: boolean): void;
  hint?: string;
}) {
  const { colors } = useApp();
  return (
    <Row style={{ justifyContent: 'space-between', minHeight: 48 }}>
      <Row style={{ flex: 1 }}>
        <T style={{ flex: 1 }}>
          {label}
          {hint ? (
            <T size={12} tone="faint">
              {'\n'}
              {hint}
            </T>
          ) : null}
        </T>
      </Row>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.text}
      />
    </Row>
  );
}

export default function SettingsScreen() {
  const { repos, settings, updateSettings, reloadSettings } = useApp();
  const refreshActive = useActiveSession((s) => s.refresh);
  const skipTimer = useRestTimer((s) => s.skip);
  const [busy, setBusy] = useState<string | null>(null);
  const [rest, setRest] = useState(String(settings.defaultRestSeconds));
  const [macros, setMacros] = useState<Record<keyof MacroTargets, string>>(() =>
    stringify(settings.macroTargets),
  );
  const targetText = settings.bodyWeightTargetKg
    ? formatWeight(settings.bodyWeightTargetKg, settings.unit)
    : '';
  const [target, setTarget] = useState(targetText);
  const [syncedTarget, setSyncedTarget] = useState(targetText);
  if (targetText !== syncedTarget) {
    setSyncedTarget(targetText);
    setTarget(targetText);
  }

  const save = (patch: Partial<AppSettings>) =>
    attempt('save settings', () => updateSettings(patch));

  const run = async (key: string, action: string, fn: () => Promise<void>) => {
    setBusy(key);
    await attempt(action, fn);
    setBusy(null);
  };

  const doImport = () =>
    run('import', 'import backup', async () => {
      const backup = await pickBackup();
      if (!backup) return;
      const mode = await chooseImportMode(backup);
      if (!mode) return;
      const res = await importBackup(repos, backup, mode);
      await reloadSettings();
      await refreshActive(repos);
      Alert.alert(
        'Import complete',
        `${res.inserted} records added, ${res.skipped} already present.`,
      );
    });

  const reset = () =>
    Alert.alert(
      'Reset app data?',
      'Deletes all workouts, exercises, templates and body-weight entries. Export a backup first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: () =>
                  run('reset', 'reset data', async () => {
                    skipTimer();
                    await repos.backup.resetAll();
                    await reloadSettings();
                    await refreshActive(repos);
                    Alert.alert(
                      'Reset complete',
                      'Default Gamma exercises and template were restored.',
                    );
                  }),
              },
            ]),
        },
      ],
    );

  const macroField = (key: keyof MacroTargets, label: string) => (
    <Field
      style={{ flex: 1 }}
      label={label}
      keyboardType="number-pad"
      value={macros[key]}
      onChangeText={(v) => setMacros((m) => ({ ...m, [key]: v }))}
      onEndEditing={() => {
        const n = parseInt(macros[key], 10);
        if (Number.isFinite(n) && n >= 0)
          save({ macroTargets: { ...settings.macroTargets, [key]: n } });
      }}
    />
  );

  return (
    <Screen>
      <T size={28} weight="800">
        Settings
      </T>

      <SectionTitle>Training</SectionTitle>
      <Card>
        <T weight="600">Units</T>
        <Segmented
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={settings.unit}
          onChange={(unit) => save({ unit })}
        />
        <Field
          label="Default rest (seconds)"
          keyboardType="number-pad"
          value={rest}
          onChangeText={setRest}
          onEndEditing={() => {
            const n = parseInt(rest, 10);
            if (Number.isFinite(n) && n >= 0 && n <= 1800) save({ defaultRestSeconds: n });
            else setRest(String(settings.defaultRestSeconds));
          }}
          hint="Used when an exercise has no rest time of its own."
        />
        <Toggle
          label="Track RIR"
          value={settings.rirEnabled}
          onChange={(rirEnabled) => save({ rirEnabled })}
        />
        <Toggle
          label="Allow load increase at failure"
          hint="Off: reaching the top of the range at RIR 0 does not unlock more load."
          value={settings.allowIncreaseAtFailure}
          onChange={(allowIncreaseAtFailure) => save({ allowIncreaseAtFailure })}
        />
        <Button
          label="Manage templates"
          variant="secondary"
          onPress={() => router.push('/template')}
        />
      </Card>

      <SectionTitle>Feedback</SectionTitle>
      <Card>
        <Toggle
          label="Haptics"
          value={settings.haptics}
          onChange={(haptics) => save({ haptics })}
        />
        <Toggle label="Timer sound" value={settings.sound} onChange={(sound) => save({ sound })} />
        <Toggle
          label="Keep screen on during workout"
          value={settings.keepAwakeDuringWorkout}
          onChange={(keepAwakeDuringWorkout) => save({ keepAwakeDuringWorkout })}
        />
        <T weight="600">Theme</T>
        <Segmented
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          value={settings.theme}
          onChange={(theme) => save({ theme })}
        />
      </Card>

      <SectionTitle>Body & nutrition</SectionTitle>
      <Card>
        <Field
          label={`Body weight target (${settings.unit})`}
          keyboardType="decimal-pad"
          value={target}
          onChangeText={setTarget}
          onEndEditing={() => {
            const n = parseDecimal(target);
            save({ bodyWeightTargetKg: n && n > 0 ? unitToKg(n, settings.unit) : undefined });
          }}
        />
        <Toggle
          label="Daily macro tracking"
          value={settings.macrosEnabled}
          onChange={(macrosEnabled) => save({ macrosEnabled })}
        />
        {settings.macrosEnabled ? (
          <>
            <Row>
              {macroField('calories', 'kcal')}
              {macroField('fatG', 'Fat g')}
            </Row>
            <Row>
              {macroField('proteinMinG', 'Protein min g')}
              {macroField('proteinMaxG', 'Protein max g')}
            </Row>
            <Row>
              {macroField('carbsRestDayG', 'Carbs rest g')}
              {macroField('carbsTrainingDayG', 'Carbs training g')}
            </Row>
          </>
        ) : null}
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <T size={13} tone="muted">
          Everything is stored on this device only. Export regularly.
        </T>
        <Button
          label="Export JSON backup"
          loading={busy === 'json'}
          onPress={() => run('json', 'export backup', () => exportJsonBackup(repos))}
        />
        <Button
          label="Import JSON backup"
          variant="secondary"
          loading={busy === 'import'}
          onPress={doImport}
        />
        <Row>
          <Button
            label="workouts.csv"
            compact
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => run('csv1', 'export CSV', () => exportCsv(repos, 'workouts'))}
          />
          <Button
            label="sets.csv"
            compact
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => run('csv2', 'export CSV', () => exportCsv(repos, 'sets'))}
          />
        </Row>
        <Button
          label="body-weight.csv"
          compact
          variant="secondary"
          onPress={() => run('csv3', 'export CSV', () => exportCsv(repos, 'body-weight'))}
        />
        <Button
          label="Reset app data"
          variant="danger"
          loading={busy === 'reset'}
          onPress={reset}
        />
      </Card>
      <T size={12} tone="faint" style={{ textAlign: 'center' }}>
        Gamma Tracker 2.0 · schema v{LATEST_SCHEMA_VERSION}
      </T>
    </Screen>
  );
}

function stringify(m: MacroTargets): Record<keyof MacroTargets, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)])) as Record<
    keyof MacroTargets,
    string
  >;
}
