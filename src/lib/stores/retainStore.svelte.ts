import { generateQuestions, hashQuestion, type IMPPQuestion, type RetainTestConfig, type LLMConfig } from "$lib/api/llm";
import { getDb } from "$lib/api/db";

export interface RetainTestSession {
  id: number;
  startedAt: string;
  completedAt: string | null;
  scope: string;
  subject: string | null;
  difficulty: string;
  questionCount: number;
  correctCount: number;
  totalAnswered: number;
  scorePercent: number | null;
  durationSeconds: number | null;
}

export interface MasteryEntry {
  subject: string;
  subTopic: string | null;
  masteryScore: number;
  lastTestedDate: string | null;
}

let currentTest = $state<RetainTestSession | null>(null);
let currentQuestions = $state<IMPPQuestion[]>([]);
let currentQuestionIndex = $state(0);
let testHistory = $state<RetainTestSession[]>([]);
let masteryMap = $state<Record<string, MasteryEntry>>({});
let perQuestionResults = $state<{ answer: string; correct: boolean }[]>([]);

export function getCurrentTest(): RetainTestSession | null {
  return currentTest;
}

export function getCurrentQuestions(): IMPPQuestion[] {
  return currentQuestions;
}

export function getCurrentQuestionIndex(): number {
  return currentQuestionIndex;
}

export function getTestHistory(): RetainTestSession[] {
  return testHistory;
}

export function getMasteryMap(): Record<string, MasteryEntry> {
  return masteryMap;
}

export function getPerQuestionResults(): { answer: string; correct: boolean }[] {
  return perQuestionResults;
}

export function getMasteryLevel(
  score: number
): "unsicher" | "grundlagen" | "solide" | "sicher" {
  if (score < 0.3) return "unsicher";
  if (score < 0.6) return "grundlagen";
  if (score < 0.8) return "solide";
  return "sicher";
}

export function getMasteryColor(score: number): string {
  const level = getMasteryLevel(score);
  const colors = {
    unsicher: "text-mastery-unsicher",
    grundlagen: "text-mastery-grundlagen",
    solide: "text-mastery-solide",
    sicher: "text-mastery-sicher",
  };
  return colors[level];
}

export async function loadTestHistory(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM retain_tests ORDER BY started_at DESC LIMIT 50"
    );
    testHistory = rows.map((row) => ({
      id: row.id as number,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | null,
      scope: row.scope as string,
      subject: row.subject as string | null,
      difficulty: row.difficulty as string,
      questionCount: row.question_count as number,
      correctCount: row.correct_count as number,
      totalAnswered: row.total_answered as number,
      scorePercent: row.score_percent as number | null,
      durationSeconds: row.duration_seconds as number | null,
    }));
  } catch (error) {
    console.error("Failed to load test history:", error);
  }
}

export async function loadMastery(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM subject_mastery"
    );
    const map: Record<string, MasteryEntry> = {};
    for (const row of rows) {
      const key = row.sub_topic
        ? `${row.subject}::${row.sub_topic}`
        : (row.subject as string);
      map[key] = {
        subject: row.subject as string,
        subTopic: row.sub_topic as string | null,
        masteryScore: (row.mastery_score as number) ?? 0,
        lastTestedDate: row.last_tested_date as string | null,
      };
    }
    masteryMap = map;
  } catch (error) {
    console.error("Failed to load mastery:", error);
  }
}

export function updateMasteryScore(
  currentMastery: number,
  questionsCorrect: number,
  questionsTotal: number,
  difficulty: string
): number {
  if (questionsTotal === 0) return currentMastery;
  const accuracy = questionsCorrect / questionsTotal;
  const difficultyWeight: Record<string, number> = {
    basis: 0.6,
    anwendung: 1.0,
    transfer: 1.4,
  };
  const weight = difficultyWeight[difficulty] ?? 1.0;
  const weightedAccuracy = Math.min(accuracy * weight, 1.0);
  const alpha = 0.3;
  return alpha * weightedAccuracy + (1 - alpha) * currentMastery;
}

// ---------------------------------------------------------------------------
// Test Lifecycle
// ---------------------------------------------------------------------------

export async function startTest(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<void> {
  const db = await getDb();

  // Create test session in DB
  const result = await db.execute(
    `INSERT INTO retain_tests (scope, subject, difficulty, question_count, lookback_days)
     VALUES (?, ?, ?, ?, ?)`,
    [config.scope, config.subject ?? null, config.difficulty, config.questionCount, 14]
  );

  const testId = result.lastInsertId ?? 0;

  currentTest = {
    id: testId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    scope: config.scope,
    subject: config.subject ?? null,
    difficulty: config.difficulty,
    questionCount: config.questionCount,
    correctCount: 0,
    totalAnswered: 0,
    scorePercent: null,
    durationSeconds: null,
  };

  // Generate questions via LLM
  const questions = await generateQuestions(config, llmConfig);

  // Cache questions in DB and link to test
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const hash = await hashQuestion(q);

    // Insert question (ignore if already cached by hash)
    await db.execute(
      `INSERT OR IGNORE INTO retain_questions (hash, stem, options, correct_answer, explanation, difficulty, subject, topics, question_type, llm_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hash, q.stem, JSON.stringify(q.options), q.correctAnswer, q.explanation, q.difficulty, q.subject, JSON.stringify(q.topics), q.questionType, llmConfig.model]
    );

    // Get question ID
    const qRows = await db.select<Record<string, unknown>[]>(
      "SELECT id FROM retain_questions WHERE hash = ?",
      [hash]
    );
    if (qRows.length > 0) {
      await db.execute(
        `INSERT INTO retain_test_questions (test_id, question_id, question_order)
         VALUES (?, ?, ?)`,
        [testId, qRows[0].id, i + 1]
      );
    }
  }

  currentQuestions = questions;
  currentQuestionIndex = 0;
  perQuestionResults = [];
}

export async function answerQuestion(
  answer: string
): Promise<{ correct: boolean; correctAnswer: string }> {
  const question = currentQuestions[currentQuestionIndex];
  if (!question || !currentTest) throw new Error("No active test");

  const correct = answer === question.correctAnswer;

  const db = await getDb();

  // Find question ID from DB
  const hash = await hashQuestion(question);
  const qRows = await db.select<Record<string, unknown>[]>(
    "SELECT id FROM retain_questions WHERE hash = ?",
    [hash]
  );

  if (qRows.length > 0) {
    await db.execute(
      `UPDATE retain_test_questions SET user_answer = ?, is_correct = ?, answered_at = datetime('now')
       WHERE test_id = ? AND question_id = ?`,
      [answer, correct ? 1 : 0, currentTest.id, qRows[0].id]
    );
  }

  // Track per-question result
  perQuestionResults = [...perQuestionResults, { answer, correct }];

  // Update current test state
  currentTest = {
    ...currentTest,
    totalAnswered: currentTest.totalAnswered + 1,
    correctCount: currentTest.correctCount + (correct ? 1 : 0),
  };

  return { correct, correctAnswer: question.correctAnswer };
}

export function nextQuestion(): boolean {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    return true; // more questions
  }
  return false; // no more questions
}

export async function finishTest(): Promise<void> {
  if (!currentTest) return;

  const scorePercent =
    currentTest.totalAnswered > 0
      ? Math.round((currentTest.correctCount / currentTest.totalAnswered) * 100)
      : 0;

  const startTime = new Date(currentTest.startedAt).getTime();
  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  const db = await getDb();
  await db.execute(
    `UPDATE retain_tests SET completed_at = datetime('now'), correct_count = ?, total_answered = ?, score_percent = ?, duration_seconds = ?
     WHERE id = ?`,
    [currentTest.correctCount, currentTest.totalAnswered, scorePercent, durationSeconds, currentTest.id]
  );

  // Update mastery per subject using perQuestionResults
  const subjectScores: Record<string, { correct: number; total: number }> = {};
  for (let i = 0; i < currentQuestions.length; i++) {
    const q = currentQuestions[i];
    const sub = q.subject;
    if (!subjectScores[sub]) subjectScores[sub] = { correct: 0, total: 0 };
    subjectScores[sub].total++;
    if (perQuestionResults[i]?.correct) {
      subjectScores[sub].correct++;
    }
  }

  // Update mastery for each subject tested
  for (const [subject, scores] of Object.entries(subjectScores)) {
    const currentMastery = masteryMap[subject]?.masteryScore ?? 0;
    const newMastery = updateMasteryScore(
      currentMastery,
      scores.correct,
      scores.total,
      currentTest.difficulty
    );

    await db.execute(
      `INSERT INTO subject_mastery (subject, mastery_score, retain_test_lifetime_correct, retain_test_lifetime_total, last_tested_date, updated_at)
       VALUES (?, ?, ?, ?, date('now'), datetime('now'))
       ON CONFLICT(subject, sub_topic) DO UPDATE SET
         mastery_score = ?,
         retain_test_lifetime_correct = retain_test_lifetime_correct + ?,
         retain_test_lifetime_total = retain_test_lifetime_total + ?,
         last_tested_date = date('now'),
         updated_at = datetime('now')`,
      [subject, newMastery, scores.correct, scores.total, newMastery, scores.correct, scores.total]
    );

    // Record mastery history
    await db.execute(
      `INSERT INTO mastery_history (subject, mastery_score, source) VALUES (?, ?, 'retain-test')`,
      [subject, newMastery]
    );
  }

  // Update test state
  currentTest = {
    ...currentTest,
    completedAt: new Date().toISOString(),
    scorePercent,
    durationSeconds,
  };

  // Reload
  await loadMastery();
  await loadTestHistory();
}

export function resetTest(): void {
  currentTest = null;
  currentQuestions = [];
  currentQuestionIndex = 0;
  perQuestionResults = [];
}

export async function loadCachedQuestions(
  subject: string | null,
  difficulty: string,
  count: number
): Promise<IMPPQuestion[]> {
  const db = await getDb();
  let query = "SELECT * FROM retain_questions";
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (subject) {
    conditions.push("subject = ?");
    params.push(subject);
  }
  if (difficulty !== "mixed") {
    conditions.push("difficulty = ?");
    params.push(difficulty);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY RANDOM() LIMIT ?";
  params.push(count);

  const rows = await db.select<Record<string, unknown>[]>(query, params);
  return rows.map((row) => ({
    id: crypto.randomUUID(),
    stem: row.stem as string,
    options: JSON.parse(row.options as string),
    correctAnswer: row.correct_answer as string,
    explanation: row.explanation as string,
    difficulty: row.difficulty as "basis" | "anwendung" | "transfer",
    subject: row.subject as string,
    topics: JSON.parse((row.topics as string) ?? "[]"),
    questionType: row.question_type as "clinical_vignette" | "factual" | "key_feature",
  }));
}
