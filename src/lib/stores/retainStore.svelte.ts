import type { IMPPQuestion, RetainTestConfig } from "$lib/api/llm";
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
