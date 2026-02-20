import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:m2_lernbegleiter.db");
    await runMigrations(db);
  }
  return db;
}

async function runMigrations(db: Database): Promise<void> {
  // Create migrations tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.select<{ name: string }[]>(
    "SELECT name FROM migrations"
  );
  const appliedNames = new Set(applied.map((m) => m.name));

  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      await db.execute(migration.sql);
      await db.execute("INSERT INTO migrations (name) VALUES (?)", [
        migration.name,
      ]);
      console.log(`Migration applied: ${migration.name}`);
    }
  }
}

const migrations = [
  {
    name: "001_initial",
    sql: `
      -- User settings (singleton row)
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        exam_date TEXT DEFAULT '2026-10-14',
        semester_end_date TEXT DEFAULT '2026-07-20',
        june_vacation_start TEXT DEFAULT '2026-06-01',
        june_vacation_end TEXT DEFAULT '2026-06-14',
        sept_vacation_start TEXT DEFAULT '2026-09-07',
        sept_vacation_end TEXT DEFAULT '2026-09-13',
        semester_hours_per_day REAL DEFAULT 2.5,
        fulltime_hours_per_day REAL DEFAULT 7.0,
        weekends_off INTEGER DEFAULT 1,
        pharma_prioritized INTEGER DEFAULT 1,
        anki_deck_names TEXT DEFAULT '[]',
        llm_provider TEXT DEFAULT 'claude',
        llm_api_key TEXT,
        llm_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
        notification_enabled INTEGER DEFAULT 1,
        notification_morning_time TEXT DEFAULT '08:00',
        notification_evening_time TEXT DEFAULT '20:00',
        theme TEXT DEFAULT 'dark',
        widget_position_x INTEGER DEFAULT 20,
        widget_position_y INTEGER DEFAULT 20,
        widget_mode TEXT DEFAULT 'normal',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO settings (id) VALUES (1);

      -- AMBOSS study plan days
      CREATE TABLE IF NOT EXISTS amboss_days (
        id INTEGER PRIMARY KEY,
        day_number INTEGER UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        sub_topic TEXT,
        chapters TEXT NOT NULL DEFAULT '[]',
        kreuzen_session_id TEXT,
        estimated_hours REAL DEFAULT 7.0,
        question_count INTEGER DEFAULT 80,
        is_optional INTEGER DEFAULT 0,
        sort_order INTEGER NOT NULL,
        anki_tag_query TEXT
      );

      -- Calendar mapping (stretched plan)
      CREATE TABLE IF NOT EXISTS calendar_days (
        id INTEGER PRIMARY KEY,
        date TEXT UNIQUE NOT NULL,
        phase TEXT NOT NULL,
        amboss_day_id INTEGER REFERENCES amboss_days(id),
        split_fraction REAL DEFAULT 1.0,
        split_part TEXT,
        anki_target INTEGER DEFAULT 0,
        retain_test_scheduled INTEGER DEFAULT 0,
        is_kreuzen_only INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Daily progress tracking
      CREATE TABLE IF NOT EXISTS daily_progress (
        id INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        amboss_day_id INTEGER REFERENCES amboss_days(id),
        reading_completed INTEGER DEFAULT 0,
        reading_minutes INTEGER DEFAULT 0,
        kreuzen_completed INTEGER DEFAULT 0,
        kreuzen_correct INTEGER DEFAULT 0,
        kreuzen_total INTEGER DEFAULT 0,
        kreuzen_percent REAL,
        anki_cards_reviewed INTEGER DEFAULT 0,
        anki_new_cards INTEGER DEFAULT 0,
        retain_test_taken INTEGER DEFAULT 0,
        retain_test_score REAL,
        study_hours REAL DEFAULT 0,
        notes TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(date, amboss_day_id)
      );

      -- Subject mastery tracking
      CREATE TABLE IF NOT EXISTS subject_mastery (
        id INTEGER PRIMARY KEY,
        subject TEXT NOT NULL,
        sub_topic TEXT,
        mastery_score REAL DEFAULT 0.0,
        kreuzen_lifetime_correct INTEGER DEFAULT 0,
        kreuzen_lifetime_total INTEGER DEFAULT 0,
        retain_test_lifetime_correct INTEGER DEFAULT 0,
        retain_test_lifetime_total INTEGER DEFAULT 0,
        last_studied_date TEXT,
        last_tested_date TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(subject, sub_topic)
      );

      -- Anki sync cache
      CREATE TABLE IF NOT EXISTS anki_cache (
        id INTEGER PRIMARY KEY,
        deck_name TEXT NOT NULL UNIQUE,
        total_cards INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        learn_count INTEGER DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        last_synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS anki_daily_reviews (
        id INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        deck_name TEXT NOT NULL,
        cards_reviewed INTEGER DEFAULT 0,
        UNIQUE(date, deck_name)
      );

      -- Study streaks
      CREATE TABLE IF NOT EXISTS streaks (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_study_date TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO streaks (id) VALUES (1);

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_days(date);
      CREATE INDEX IF NOT EXISTS idx_progress_date ON daily_progress(date);
      CREATE INDEX IF NOT EXISTS idx_mastery_subject ON subject_mastery(subject);
    `,
  },
  {
    name: "002_retain_test",
    sql: `
      -- Retain test sessions
      CREATE TABLE IF NOT EXISTS retain_tests (
        id INTEGER PRIMARY KEY,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        scope TEXT NOT NULL,
        subject TEXT,
        lookback_days INTEGER,
        difficulty TEXT NOT NULL,
        question_count INTEGER NOT NULL,
        correct_count INTEGER DEFAULT 0,
        total_answered INTEGER DEFAULT 0,
        score_percent REAL,
        duration_seconds INTEGER
      );

      -- Cached questions
      CREATE TABLE IF NOT EXISTS retain_questions (
        id INTEGER PRIMARY KEY,
        hash TEXT UNIQUE NOT NULL,
        stem TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        subject TEXT NOT NULL,
        topics TEXT NOT NULL DEFAULT '[]',
        question_type TEXT NOT NULL,
        llm_model TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Test-question junction
      CREATE TABLE IF NOT EXISTS retain_test_questions (
        id INTEGER PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES retain_tests(id),
        question_id INTEGER NOT NULL REFERENCES retain_questions(id),
        question_order INTEGER NOT NULL,
        user_answer TEXT,
        is_correct INTEGER,
        time_spent_seconds INTEGER,
        answered_at TEXT,
        UNIQUE(test_id, question_id)
      );

      -- Mastery history
      CREATE TABLE IF NOT EXISTS mastery_history (
        id INTEGER PRIMARY KEY,
        subject TEXT NOT NULL,
        sub_topic TEXT,
        mastery_score REAL NOT NULL,
        source TEXT NOT NULL,
        recorded_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_retain_tests_date ON retain_tests(started_at);
      CREATE INDEX IF NOT EXISTS idx_questions_subject ON retain_questions(subject);
      CREATE INDEX IF NOT EXISTS idx_mastery_history ON mastery_history(subject, recorded_at);
    `,
  },
];
