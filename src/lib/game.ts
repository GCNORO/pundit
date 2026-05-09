import { Player, GameState, ClueTier } from "./types";

const MAX_GUESSES = 5;

// Deterministic daily puzzle based on date
export function getDailyPuzzleIndex(date: string, totalPlayers: number): number {
  // Simple hash from date string
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    const char = date.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % totalPlayers;
}

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

export function createGameState(date: string): GameState {
  return {
    puzzleDate: date,
    guesses: [],
    maxGuesses: MAX_GUESSES,
    solved: false,
    failed: false,
  };
}

export function getCurrentClueTier(wrongGuesses: number): ClueTier {
  return Math.min(wrongGuesses + 1, 5) as ClueTier;
}

export function getRevealedClues(player: Player, tier: ClueTier) {
  const clues: Record<string, string | number | string[]> = {};

  // Tier 1: Career path — hide the current club (last stop) until tier 5
  const fullPath = player.careerPath.map((s) => s.club);
  if (tier >= 5) {
    clues.careerPath = fullPath;
  } else {
    // Replace the current/last club with a placeholder
    const trimmed = [...fullPath];
    if (
      trimmed.length > 0 &&
      trimmed[trimmed.length - 1].toLowerCase() ===
        player.currentClub.toLowerCase()
    ) {
      trimmed[trimmed.length - 1] = "???";
    }
    clues.careerPath = trimmed;
  }

  // Tier 2+: Position
  if (tier >= 2) clues.position = player.position;

  // Tier 3+: Nationality
  if (tier >= 3) clues.nationality = player.nationality;

  // Tier 4+: Age
  if (tier >= 4) clues.age = player.age;

  // Tier 5: Current club & league
  if (tier >= 5) {
    clues.currentClub = player.currentClub;
    clues.currentLeague = player.currentLeague;
  }

  return clues;
}

export function makeGuess(
  state: GameState,
  guessName: string,
  correctPlayer: Player
): GameState {
  const newGuesses = [...state.guesses, guessName];
  const isCorrect =
    guessName.toLowerCase().trim() === correctPlayer.name.toLowerCase().trim();

  return {
    ...state,
    guesses: newGuesses,
    solved: isCorrect,
    failed: !isCorrect && newGuesses.length >= MAX_GUESSES,
  };
}

// Generate shareable result (Wordle-style)
export function generateShareText(state: GameState, date: string): string {
  const guessCount = state.solved
    ? state.guesses.length
    : "X";
  const squares = state.guesses
    .map((_, i) =>
      i === state.guesses.length - 1 && state.solved ? "🟢" : "🔴"
    )
    .join("");

  return `Pundit ${date} ${guessCount}/${MAX_GUESSES}\n${squares}`;
}

// Load/save game state from localStorage
const STORAGE_KEY = "pundit-state";

export function loadGameState(date: string): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: GameState = JSON.parse(raw);
    if (state.puzzleDate !== date) return null; // new day, new puzzle
    return state;
  } catch {
    return null;
  }
}

export function saveGameState(state: GameState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
