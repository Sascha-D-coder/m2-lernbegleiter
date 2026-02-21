const ANKI_URL = "http://127.0.0.1:8765";

interface AnkiResponse<T> {
  result: T;
  error: string | null;
}

async function ankiInvoke<T>(
  action: string,
  params?: Record<string, unknown>
): Promise<T> {
  const payload = JSON.stringify({ action, version: 6, params });

  // Try using Tauri shell plugin to bypass webview CORS restrictions
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const cmd = Command.create("curl", [
      "-s",
      "-X", "POST",
      "-H", "Content-Type: application/json",
      "-d", payload,
      "--connect-timeout", "5",
      ANKI_URL,
    ]);
    const output = await cmd.execute();
    if (output.code !== 0) {
      throw new Error(`curl failed: ${output.stderr}`);
    }
    const data: AnkiResponse<T> = JSON.parse(output.stdout);
    if (data.error) throw new Error(data.error);
    return data.result;
  } catch (shellError) {
    // Fallback: direct fetch (works in dev mode / non-Tauri)
    try {
      const response = await fetch(ANKI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const data: AnkiResponse<T> = await response.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    } catch {
      throw shellError;
    }
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    await ankiInvoke("version");
    return true;
  } catch {
    return false;
  }
}

export async function getDeckNames(): Promise<string[]> {
  return ankiInvoke<string[]>("deckNames");
}

export async function findM2Decks(): Promise<string[]> {
  const decks = await getDeckNames();
  return decks.filter(
    (d) =>
      d.toLowerCase().includes("ankizin") ||
      d.toLowerCase().includes("ankiphil") ||
      d.toLowerCase().includes("zankiphil") ||
      d.toLowerCase().includes("m2") ||
      d.toLowerCase().includes("klinik")
  );
}

export interface DeckStats {
  deck_id: number;
  name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

export async function getDeckStats(
  deckName: string
): Promise<Record<string, DeckStats>> {
  return ankiInvoke("getDeckStats", { decks: [deckName] });
}

export async function findCardsByQuery(query: string): Promise<number[]> {
  return ankiInvoke<number[]>("findCards", { query });
}

export async function getCardsDueCount(deckNames: string[]): Promise<number> {
  const queries = deckNames.map((d) => `"deck:${d}" is:due`).join(" OR ");
  if (!queries) return 0;
  const cards = await ankiInvoke<number[]>("findCards", { query: queries });
  return cards.length;
}

export async function getHighYieldCards(
  subject: string
): Promise<number[]> {
  const query = `tag:*AMBOSS*${subject}* (tag:*yield* OR tag:*high*)`;
  return ankiInvoke<number[]>("findCards", { query });
}

export async function getReviewsByDay(): Promise<[number, number][]> {
  return ankiInvoke<[number, number][]>("getNumCardsReviewedByDay");
}
