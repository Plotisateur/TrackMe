import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_TABLES, validateBackup } from './backupSchema';
import { toCsv } from './csv';

const empty = () => Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));

describe('validateBackup', () => {
  it('accepts a well-formed backup', () => {
    const r = validateBackup(
      {
        format: BACKUP_FORMAT,
        schemaVersion: 2,
        exportedAt: 'x',
        data: { ...empty(), exercises: [{ id: 'a', name: 'x' }] },
      },
      2,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.counts.exercises).toBe(1);
  });

  it('rejects foreign files and missing keys', () => {
    expect(validateBackup({ hello: 1 }, 2).ok).toBe(false);
    const r = validateBackup(
      {
        format: BACKUP_FORMAT,
        schemaVersion: 2,
        exportedAt: 'x',
        data: { ...empty(), exercises: [{ name: 'x' }] },
      },
      2,
    );
    expect(r.ok).toBe(false);
  });

  it('rejects backups from a newer schema', () => {
    const r = validateBackup(
      { format: BACKUP_FORMAT, schemaVersion: 9, exportedAt: 'x', data: empty() },
      2,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer/);
  });
});

describe('toCsv', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'say "hi"'],
          [null, 1],
        ],
      ),
    ).toBe('a,b\r\n"x,y","say ""hi"""\r\n,1\r\n');
  });
});
