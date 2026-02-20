// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IMPPQuestion {
  id: string;
  stem: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  difficulty: "basis" | "anwendung" | "transfer";
  subject: string;
  topics: string[];
  questionType: "clinical_vignette" | "factual" | "key_feature";
}

export interface RetainTestConfig {
  scope: "cross-topic" | "single-subject";
  subject?: string;
  topics: string[];
  difficulty: "basis" | "anwendung" | "transfer" | "mixed";
  questionCount: number;
}

export interface LLMConfig {
  provider: "claude" | "ollama";
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

export function buildSystemPrompt(config: RetainTestConfig): string {
  const difficultyInstructions = buildDifficultyInstructions(config);
  const scopeInstructions = buildScopeInstructions(config);

  return `Du bist ein erfahrener IMPP-Fragenautor f\u00fcr das deutsche M2-Staatsexamen (2. Abschnitt der \u00c4rztlichen Pr\u00fcfung). Deine Aufgabe ist es, pr\u00fcfungsnahe MC-Fragen zu erstellen, die dem IMPP-Stil entsprechen.

## Allgemeine Regeln

1. Erstelle genau ${config.questionCount} Fragen im IMPP-Stil.
2. Jede Frage hat genau 5 Antwortm\u00f6glichkeiten (A\u2013E), von denen genau eine korrekt ist.
3. Verwende durchgehend deutsche medizinische Fachterminologie.
4. Die Distraktoren (falschen Antworten) m\u00fcssen plausibel sein und typische Denkfehler von Studierenden widerspiegeln.
5. Vermeide Absolutformulierungen (\u201eimmer\u201c, \u201enie\u201c) als Marker f\u00fcr falsche Antworten.
6. Formuliere die Fragen so, dass sie klinisch relevant und pr\u00fcfungsnah sind.

## Schwierigkeitsgrad

${difficultyInstructions}

## Themenbereich

${scopeInstructions}

## Ausgabeformat

Antworte ausschlie\u00dflich mit einem JSON-Array. Kein Markdown, kein erkl\u00e4render Text, nur valides JSON.

Jedes Element im Array hat folgende Struktur:
{
  "stem": "Fragetext (ggf. mit klinischer Vignette, Laborwerten etc.)",
  "options": [
    { "label": "A", "text": "Antwortm\u00f6glichkeit A" },
    { "label": "B", "text": "Antwortm\u00f6glichkeit B" },
    { "label": "C", "text": "Antwortm\u00f6glichkeit C" },
    { "label": "D", "text": "Antwortm\u00f6glichkeit D" },
    { "label": "E", "text": "Antwortm\u00f6glichkeit E" }
  ],
  "correctAnswer": "B",
  "explanation": "Ausf\u00fchrliche Erkl\u00e4rung auf Deutsch, warum B richtig ist und die anderen Optionen falsch sind. Inklusive pathophysiologischem Hintergrund und klinischer Relevanz.",
  "difficulty": "basis",
  "subject": "Innere Medizin",
  "topics": ["Kardiologie", "Herzinsuffizienz"],
  "questionType": "factual"
}

F\u00fcr "difficulty" verwende: "basis", "anwendung" oder "transfer".
F\u00fcr "questionType" verwende: "clinical_vignette", "factual" oder "key_feature".

Beginne jetzt mit der Erstellung der ${config.questionCount} Fragen.`;
}

function buildDifficultyInstructions(config: RetainTestConfig): string {
  if (config.difficulty === "mixed") {
    const total = config.questionCount;
    const basis = Math.round(total * 0.3);
    const transfer = Math.round(total * 0.2);
    const anwendung = total - basis - transfer;
    return `Erstelle einen Mix aus verschiedenen Schwierigkeitsgraden:
- ca. ${basis} Fragen auf Basis-Niveau (direktes Faktenwissen, Definitionen, Klassifikationen)
- ca. ${anwendung} Fragen auf Anwendungs-Niveau (klinische Vignetten mit Patientenvorstellung, Laborwerten, Diagnostik und Therapie)
- ca. ${transfer} Fragen auf Transfer-Niveau (f\u00e4cher\u00fcbergreifende komplexe Szenarien mit mehreren Diagnosen oder Komplikationen)`;
  }

  switch (config.difficulty) {
    case "basis":
      return `Alle Fragen auf Basis-Niveau:
- Direktes Faktenwissen: Definitionen, Klassifikationen, Normwerte
- Klare, pr\u00e4zise Fragestellungen ohne klinische Vignetten
- questionType: "factual"`;

    case "anwendung":
      return `Alle Fragen auf Anwendungs-Niveau:
- Klinische Vignetten mit realistischer Patientenvorstellung
- Relevante Laborwerte, Vitalparameter und Befunde angeben
- Frage nach Diagnose, n\u00e4chstem diagnostischen Schritt oder Therapie
- questionType: "clinical_vignette"`;

    case "transfer":
      return `Alle Fragen auf Transfer-Niveau:
- F\u00e4cher\u00fcbergreifende, komplexe klinische Szenarien
- Mehrere Komorbidit\u00e4ten, Medikamenteninteraktionen oder Komplikationen
- Erfordert Wissenstransfer aus mehreren Fachgebieten
- questionType: "key_feature" oder "clinical_vignette"`;
  }
}

function buildScopeInstructions(config: RetainTestConfig): string {
  if (config.scope === "single-subject" && config.subject) {
    return `Fachgebiet: ${config.subject}
Themen: ${config.topics.join(", ")}
Erstelle alle Fragen zu den genannten Themen innerhalb dieses Fachgebiets.`;
  }

  return `F\u00e4cher\u00fcbergreifend (Cross-Topic Retain-Test)
Themen: ${config.topics.join(", ")}
Erstelle Fragen, die diese Themen f\u00e4cher\u00fcbergreifend abdecken. Jede Frage sollte das Hauptthema klar zuordnen.`;
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

export function parseQuestionsResponse(raw: string): IMPPQuestion[] {
  // Strip markdown code fences if the LLM wraps its response
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Try to extract a JSON array from the response
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new Error(
        `Ung\u00fcltige LLM-Antwort: Kein JSON-Array gefunden. ${e instanceof Error ? e.message : ""}`
      );
    }
    parsed = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Ung\u00fcltige LLM-Antwort: Erwartetes JSON-Array.");
  }

  return (parsed as Record<string, unknown>[]).map((q) => ({
    id: crypto.randomUUID(),
    stem: String(q.stem ?? ""),
    options: Array.isArray(q.options)
      ? (q.options as { label: string; text: string }[]).map((o) => ({
          label: String(o.label ?? ""),
          text: String(o.text ?? ""),
        }))
      : [],
    correctAnswer: String(q.correctAnswer ?? ""),
    explanation: String(q.explanation ?? ""),
    difficulty: validateDifficulty(q.difficulty),
    subject: String(q.subject ?? ""),
    topics: Array.isArray(q.topics) ? q.topics.map(String) : [],
    questionType: validateQuestionType(q.questionType),
  }));
}

function validateDifficulty(
  val: unknown
): "basis" | "anwendung" | "transfer" {
  if (val === "basis" || val === "anwendung" || val === "transfer") {
    return val;
  }
  return "basis";
}

function validateQuestionType(
  val: unknown
): "clinical_vignette" | "factual" | "key_feature" {
  if (
    val === "clinical_vignette" ||
    val === "factual" ||
    val === "key_feature"
  ) {
    return val;
  }
  return "factual";
}

// ---------------------------------------------------------------------------
// Question Hashing (SHA-256, deduplication)
// ---------------------------------------------------------------------------

export async function hashQuestion(question: IMPPQuestion): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(question.stem);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// LLM API Calls
// ---------------------------------------------------------------------------

export async function generateQuestions(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  if (llmConfig.provider === "claude") {
    return generateWithClaude(config, llmConfig);
  }

  if (llmConfig.provider === "ollama") {
    return generateWithOllama(config, llmConfig);
  }

  throw new Error(`Unbekannter LLM-Provider: ${llmConfig.provider}`);
}

async function generateWithClaude(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  const systemPrompt = buildSystemPrompt(config);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": llmConfig.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: llmConfig.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Erstelle jetzt ${config.questionCount} IMPP-Fragen gem\u00e4\u00df den Anweisungen. Antworte ausschlie\u00dflich mit dem JSON-Array.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Claude API Fehler (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const textBlock = data.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude API: Keine Textantwort erhalten.");
  }

  return parseQuestionsResponse(textBlock.text);
}

async function generateWithOllama(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  const baseUrl = llmConfig.baseUrl ?? "http://localhost:11434";
  const systemPrompt = buildSystemPrompt(config);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llmConfig.model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Erstelle jetzt ${config.questionCount} IMPP-Fragen gem\u00e4\u00df den Anweisungen. Antworte ausschlie\u00dflich mit dem JSON-Array.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Ollama API Fehler (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    message: { content: string };
  };

  return parseQuestionsResponse(data.message.content);
}
