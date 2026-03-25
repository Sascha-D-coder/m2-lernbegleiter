import {
  checkConnection,
  findM2Decks,
  getCardsDueCount,
  getDeckStats,
  getUnseenCountPerDeck,
  type DeckStats,
} from "$lib/api/ankiConnect";

let connected = $state(false);
let deckNames = $state<string[]>([]);
let cardsDue = $state(0);
let deckStatsMap = $state<Record<string, DeckStats>>({});
let unseenMap = $state<Record<string, number>>({});
let lastSynced = $state<Date | null>(null);
let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function isConnected(): boolean {
  return connected;
}

export function getDeckNamesList(): string[] {
  return deckNames;
}

export function getCardsDueCount_(): number {
  return cardsDue;
}

export function getDeckStatsMap(): Record<string, DeckStats> {
  return deckStatsMap;
}

export function getLastSynced(): Date | null {
  return lastSynced;
}

export function getUnseenMap(): Record<string, number> {
  return unseenMap;
}

export async function syncAnki(): Promise<void> {
  try {
    connected = await checkConnection();
    if (!connected) return;

    // Find M2 decks
    deckNames = await findM2Decks();

    // Get due count
    if (deckNames.length > 0) {
      cardsDue = await getCardsDueCount(deckNames);

      // Get stats per deck
      for (const deck of deckNames) {
        try {
          const stats = await getDeckStats(deck);
          Object.assign(deckStatsMap, stats);
        } catch {
          // Individual deck stats failure is non-critical
        }
      }

      // Get unseen (new) card counts for leaf decks
      try {
        unseenMap = await getUnseenCountPerDeck(deckNames);
      } catch {
        // Non-critical
      }
    }

    lastSynced = new Date();
  } catch {
    connected = false;
  }
}

export function startPolling(intervalMs = 300000): void {
  // Default: poll every 5 minutes
  stopPolling();
  syncAnki(); // Initial sync
  pollingInterval = setInterval(syncAnki, intervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
