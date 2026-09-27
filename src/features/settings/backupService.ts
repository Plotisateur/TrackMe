import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import type { Repositories } from '@/db/repositories';
import type { ImportMode, ImportResult } from '@/db/repositories/backupRepository';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations/runner';
import { BACKUP_TABLES, type Backup, validateBackup } from '@/domain/backup/backupSchema';
import { localDateKey } from '@/utils/date';

function writeCacheFile(name: string, content: string): File {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  return file;
}

async function share(file: File, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title, UTI: mimeType });
}

export async function exportJsonBackup(repos: Repositories) {
  const backup = await repos.backup.exportAll();
  const file = writeCacheFile(
    `gamma-tracker-backup-${localDateKey()}.json`,
    JSON.stringify(backup, null, 2),
  );
  await share(file, 'application/json', 'Save Gamma Tracker backup');
}

export type CsvKind = 'workouts' | 'sets' | 'body-weight';

export async function exportCsv(repos: Repositories, kind: CsvKind) {
  const content =
    kind === 'workouts'
      ? await repos.backup.workoutsCsv()
      : kind === 'sets'
        ? await repos.backup.setsCsv()
        : await repos.backup.bodyWeightCsv();
  const file = writeCacheFile(`${kind}.csv`, content);
  await share(file, 'text/csv', `Export ${kind}.csv`);
}

/** Lets the user pick a backup file and returns it validated, or null when cancelled. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  const check = validateBackup(raw, LATEST_SCHEMA_VERSION);
  if (!check.ok) throw new Error(check.error);
  return check.backup;
}

export function describeBackup(b: Backup): string {
  const d = b.data;
  return [
    `Exported ${b.exportedAt.slice(0, 10)} (schema v${b.schemaVersion})`,
    `${d.workout_sessions.length} sessions, ${d.workout_sets.length} sets`,
    `${d.exercises.length} exercises, ${d.exercise_variants.length} variants`,
    `${d.body_weight_entries.length} body-weight entries`,
  ].join('\n');
}

/** Asks how to import; existing data is never overwritten without an explicit confirmation. */
export function chooseImportMode(backup: Backup): Promise<ImportMode | null> {
  const total = BACKUP_TABLES.reduce((n, t) => n + backup.data[t].length, 0);
  return new Promise((resolve) => {
    Alert.alert(
      'Import backup',
      `${describeBackup(backup)}\n\nMerge adds only records you don't already have (${total} rows checked). Replace deletes everything on this device first.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Merge', onPress: () => resolve('merge') },
        {
          text: 'Replace all…',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Replace all data?',
              'Everything currently on this device will be deleted and replaced by the backup.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
                { text: 'Replace', style: 'destructive', onPress: () => resolve('replace') },
              ],
            ),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export async function importBackup(
  repos: Repositories,
  backup: Backup,
  mode: ImportMode,
): Promise<ImportResult> {
  return repos.backup.importAll(backup, mode);
}
