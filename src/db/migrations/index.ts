import { m001Initial } from './001_initial';
import { m002SeedGamma } from './002_seed_gamma';
import type { Migration } from './runner';

/** Append-only. Never edit a migration that has shipped — add a new one. */
export const MIGRATIONS: Migration[] = [m001Initial, m002SeedGamma];
