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

export type LLMProvider = "claude" | "openai" | "gemini" | "openrouter" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** Provider metadata for UI */
export const LLM_PROVIDERS: Record<LLMProvider, {
  label: string;
  models: { value: string; label: string }[];
  needsApiKey: boolean;
  keyPlaceholder: string;
  helpUrl: string;
  helpSteps: string[];
  costNote: string;
}> = {
  claude: {
    label: "Claude (Anthropic)",
    models: [
      { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
    needsApiKey: true,
    keyPlaceholder: "sk-ant-...",
    helpUrl: "console.anthropic.com",
    helpSteps: [
      "Gehe zu console.anthropic.com",
      "Erstelle ein Konto oder logge dich ein",
      "Navigiere zu API Keys im Dashboard",
      'Klicke auf "Create Key"',
      "Kopiere den Key (beginnt mit sk-ant-...)",
    ],
    costNote: "Ca. $0.01–0.05 pro Retain-Test. Neue Konten erhalten $5 Guthaben.",
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ],
    needsApiKey: true,
    keyPlaceholder: "sk-...",
    helpUrl: "platform.openai.com/api-keys",
    helpSteps: [
      "Gehe zu platform.openai.com",
      "Erstelle ein Konto oder logge dich ein",
      'Navigiere zu "API Keys"',
      'Klicke auf "Create new secret key"',
      "Kopiere den Key (beginnt mit sk-...)",
    ],
    costNote: "Ca. $0.01–0.03 pro Retain-Test mit GPT-4o Mini.",
  },
  gemini: {
    label: "Google Gemini",
    models: [
      { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
    needsApiKey: true,
    keyPlaceholder: "AIza...",
    helpUrl: "aistudio.google.com/apikey",
    helpSteps: [
      "Gehe zu aistudio.google.com/apikey",
      "Melde dich mit deinem Google-Konto an",
      'Klicke auf "Create API Key"',
      "Kopiere den generierten Key",
    ],
    costNote: "Kostenloses Kontingent verfügbar. Danach ca. $0.01 pro Test.",
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (via OR)" },
      { value: "openai/gpt-4o", label: "GPT-4o (via OR)" },
      { value: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash (via OR)" },
      { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (via OR)" },
      { value: "deepseek/deepseek-r1", label: "DeepSeek R1 (via OR)" },
    ],
    needsApiKey: true,
    keyPlaceholder: "sk-or-...",
    helpUrl: "openrouter.ai/keys",
    helpSteps: [
      "Gehe zu openrouter.ai",
      "Erstelle ein Konto (Google/GitHub Login)",
      'Navigiere zu "Keys"',
      'Klicke auf "Create Key"',
      "Kopiere den Key (beginnt mit sk-or-...)",
    ],
    costNote: "Zugang zu hunderten Modellen. Preise variieren je nach Modell.",
  },
  ollama: {
    label: "Ollama (Lokal)",
    models: [
      { value: "llama3.1", label: "Llama 3.1" },
      { value: "mistral", label: "Mistral" },
      { value: "gemma2", label: "Gemma 2" },
      { value: "qwen2.5", label: "Qwen 2.5" },
    ],
    needsApiKey: false,
    keyPlaceholder: "",
    helpUrl: "ollama.com",
    helpSteps: [
      "Installiere Ollama von ollama.com",
      "Starte Ollama",
      "Lade ein Modell: ollama pull llama3.1",
    ],
    costNote: "Kostenlos – läuft lokal auf deinem Mac.",
  },
};

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

export function buildSystemPrompt(config: RetainTestConfig): string {
  const difficultyInstructions = buildDifficultyInstructions(config);
  const scopeInstructions = buildScopeInstructions(config);

  return `Du bist ein erfahrener IMPP-Fragenautor für das deutsche M2-Staatsexamen (2. Abschnitt der Ärztlichen Prüfung). Deine Aufgabe ist es, prüfungsnahe MC-Fragen zu erstellen, die dem IMPP-Stil entsprechen.

## Allgemeine Regeln

1. Erstelle genau ${config.questionCount} Fragen im IMPP-Stil.
2. Jede Frage hat genau 5 Antwortmöglichkeiten (A–E), von denen genau eine korrekt ist.
3. Verwende durchgehend deutsche medizinische Fachterminologie.
4. Die Distraktoren (falschen Antworten) müssen plausibel sein und typische Denkfehler von Studierenden widerspiegeln.
5. Vermeide Absolutformulierungen (\u201eimmer\u201c, \u201enie\u201c) als Marker für falsche Antworten.
6. Formuliere die Fragen so, dass sie klinisch relevant und prüfungsnah sind.

## Schwierigkeitsgrad

${difficultyInstructions}

## Themenbereich

${scopeInstructions}

## Ausgabeformat

Antworte ausschließlich mit einem JSON-Array. Kein Markdown, kein erklärender Text, nur valides JSON.

Jedes Element im Array hat folgende Struktur:
{
  "stem": "Fragetext (ggf. mit klinischer Vignette, Laborwerten etc.)",
  "options": [
    { "label": "A", "text": "Antwortmöglichkeit A" },
    { "label": "B", "text": "Antwortmöglichkeit B" },
    { "label": "C", "text": "Antwortmöglichkeit C" },
    { "label": "D", "text": "Antwortmöglichkeit D" },
    { "label": "E", "text": "Antwortmöglichkeit E" }
  ],
  "correctAnswer": "B",
  "explanation": "Ausführliche Erklärung auf Deutsch, warum B richtig ist und die anderen Optionen falsch sind. Inklusive pathophysiologischem Hintergrund und klinischer Relevanz.",
  "difficulty": "basis",
  "subject": "Innere Medizin",
  "topics": ["Kardiologie", "Herzinsuffizienz"],
  "questionType": "factual"
}

Für "difficulty" verwende: "basis", "anwendung" oder "transfer".
Für "questionType" verwende: "clinical_vignette", "factual" oder "key_feature".

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
- ca. ${transfer} Fragen auf Transfer-Niveau (fächerübergreifende komplexe Szenarien mit mehreren Diagnosen oder Komplikationen)`;
  }

  switch (config.difficulty) {
    case "basis":
      return `Alle Fragen auf Basis-Niveau:
- Direktes Faktenwissen: Definitionen, Klassifikationen, Normwerte
- Klare, präzise Fragestellungen ohne klinische Vignetten
- questionType: "factual"`;

    case "anwendung":
      return `Alle Fragen auf Anwendungs-Niveau:
- Klinische Vignetten mit realistischer Patientenvorstellung
- Relevante Laborwerte, Vitalparameter und Befunde angeben
- Frage nach Diagnose, nächstem diagnostischen Schritt oder Therapie
- questionType: "clinical_vignette"`;

    case "transfer":
      return `Alle Fragen auf Transfer-Niveau:
- Fächerübergreifende, komplexe klinische Szenarien
- Mehrere Komorbiditäten, Medikamenteninteraktionen oder Komplikationen
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

  return `Fächerübergreifend (Cross-Topic Retain-Test)
Themen: ${config.topics.join(", ")}
Erstelle Fragen, die diese Themen fächerübergreifend abdecken. Jede Frage sollte das Hauptthema klar zuordnen.`;
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

export function parseQuestionsResponse(raw: string): IMPPQuestion[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new Error(
        `Ungültige LLM-Antwort: Kein JSON-Array gefunden. ${e instanceof Error ? e.message : ""}`
      );
    }
    parsed = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Ungültige LLM-Antwort: Erwartetes JSON-Array.");
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

const USER_PROMPT_SUFFIX = (count: number) =>
  `Erstelle jetzt ${count} IMPP-Fragen gemäß den Anweisungen. Antworte ausschließlich mit dem JSON-Array.`;

export async function generateQuestions(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  switch (llmConfig.provider) {
    case "claude":
      return generateWithClaude(config, llmConfig);
    case "openai":
      return generateWithOpenAICompatible(config, llmConfig, "https://api.openai.com/v1/chat/completions");
    case "openrouter":
      return generateWithOpenAICompatible(config, llmConfig, "https://openrouter.ai/api/v1/chat/completions");
    case "gemini":
      return generateWithGemini(config, llmConfig);
    case "ollama":
      return generateWithOllama(config, llmConfig);
    default:
      throw new Error(`Unbekannter LLM-Provider: ${llmConfig.provider}`);
  }
}

// --- Claude (Anthropic) ---
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
        { role: "user", content: USER_PROMPT_SUFFIX(config.questionCount) },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API Fehler (${response.status}): ${errorBody}`);
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

// --- OpenAI-compatible (OpenAI + OpenRouter) ---
async function generateWithOpenAICompatible(
  config: RetainTestConfig,
  llmConfig: LLMConfig,
  endpoint: string
): Promise<IMPPQuestion[]> {
  const systemPrompt = buildSystemPrompt(config);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${llmConfig.apiKey}`,
  };

  // OpenRouter requires extra headers
  if (llmConfig.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://m2-lernbegleiter.app";
    headers["X-Title"] = "M2 Lernbegleiter";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: llmConfig.model,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: USER_PROMPT_SUFFIX(config.questionCount) },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const providerName = llmConfig.provider === "openrouter" ? "OpenRouter" : "OpenAI";
    throw new Error(`${providerName} API Fehler (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Keine Antwort vom API erhalten.");
  }

  return parseQuestionsResponse(data.choices[0].message.content);
}

// --- Google Gemini ---
async function generateWithGemini(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  const systemPrompt = buildSystemPrompt(config);
  const model = llmConfig.model || "gemini-2.0-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llmConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: USER_PROMPT_SUFFIX(config.questionCount) }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Fehler (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API: Keine Textantwort erhalten.");
  }

  return parseQuestionsResponse(text);
}

// --- Ollama (local) ---
async function generateWithOllama(
  config: RetainTestConfig,
  llmConfig: LLMConfig
): Promise<IMPPQuestion[]> {
  const baseUrl = llmConfig.baseUrl ?? "http://localhost:11434";
  const systemPrompt = buildSystemPrompt(config);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: llmConfig.model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: USER_PROMPT_SUFFIX(config.questionCount) },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama API Fehler (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    message: { content: string };
  };

  return parseQuestionsResponse(data.message.content);
}
