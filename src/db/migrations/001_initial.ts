import type { Migration } from './runner';

export const m001Initial: Migration = {
  version: 1,
  name: 'initial schema',
  async up(db) {
    await db.execAsync(`
CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  secondary_muscles TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  default_rep_range_min INTEGER,
  default_rep_range_max INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE technique_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  cues TEXT,
  setup_notes TEXT,
  concentric_notes TEXT,
  eccentric_notes TEXT,
  range_of_motion_notes TEXT,
  tempo_concentric TEXT,
  tempo_eccentric TEXT,
  stability_notes TEXT,
  pain_warnings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE exercise_variants (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  manufacturer TEXT,
  machine_model TEXT,
  attachment TEXT,
  seat_setting TEXT,
  technique_profile_id TEXT REFERENCES technique_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  weight_increment_kg REAL NOT NULL DEFAULT 2.5,
  reference_weight_kg REAL,
  reference_reps INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_exercise_variants_exercise ON exercise_variants(exercise_id);

CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workout_template_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_variant_id TEXT NOT NULL REFERENCES exercise_variants(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  target_rep_min INTEGER NOT NULL,
  target_rep_max INTEGER NOT NULL,
  target_rir_min INTEGER,
  target_rir_max INTEGER,
  rest_seconds INTEGER,
  notes TEXT
);
CREATE INDEX idx_template_exercises_template ON workout_template_exercises(template_id, order_index);
CREATE INDEX idx_template_exercises_variant ON workout_template_exercises(exercise_variant_id);

CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  body_weight_kg REAL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'discarded'))
);
CREATE INDEX idx_sessions_started_at ON workout_sessions(started_at);
CREATE INDEX idx_sessions_status ON workout_sessions(status, started_at);
-- At most one active session at any time.
CREATE UNIQUE INDEX idx_sessions_single_active ON workout_sessions(status) WHERE status = 'active';

CREATE TABLE workout_exercise_instances (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_variant_id TEXT NOT NULL REFERENCES exercise_variants(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  notes TEXT,
  technique_profile_snapshot TEXT,
  target_sets INTEGER NOT NULL,
  target_rep_min INTEGER NOT NULL,
  target_rep_max INTEGER NOT NULL,
  target_rir_min INTEGER,
  target_rir_max INTEGER,
  rest_seconds INTEGER
);
CREATE INDEX idx_instances_session ON workout_exercise_instances(session_id, order_index);
CREATE INDEX idx_instances_variant ON workout_exercise_instances(exercise_variant_id);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_exercise_instance_id TEXT NOT NULL REFERENCES workout_exercise_instances(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  rir INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  technique_valid INTEGER NOT NULL DEFAULT 1,
  pain_flag INTEGER NOT NULL DEFAULT 0,
  pain_area TEXT,
  pain_severity INTEGER CHECK (pain_severity IS NULL OR pain_severity BETWEEN 1 AND 5),
  notes TEXT,
  completed_at TEXT
);
CREATE INDEX idx_sets_instance ON workout_sets(workout_exercise_instance_id, set_index);
CREATE INDEX idx_sets_completed_at ON workout_sets(completed_at);

CREATE TABLE body_weight_entries (
  id TEXT PRIMARY KEY NOT NULL,
  recorded_at TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  context TEXT,
  notes TEXT
);
CREATE INDEX idx_body_weight_recorded_at ON body_weight_entries(recorded_at);

CREATE TABLE daily_macro_entries (
  date TEXT PRIMARY KEY NOT NULL,
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  training_day INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`);
  },
};
