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

// Common club-name abbreviations the Transfermarkt API uses interchangeably.
// Mapping is from short → canonical to avoid false positives like
// "Inter" (Inter Milan) being collapsed with "Inter Miami".
const CLUB_ALIASES: Record<string, string> = {
  "man city": "manchester city",
  "man utd": "manchester united",
  "man united": "manchester united",
  "spurs": "tottenham",
  "wolves": "wolverhampton",
  "psg": "paris saint-germain",
  "barca": "barcelona",
  "atleti": "atletico madrid",
  "atlético": "atletico madrid",
  "atletico": "atletico madrid",
  "juve": "juventus",
  "dortmund": "borussia dortmund",
  "leverkusen": "bayer leverkusen",
  "bayern": "bayern munich",
  "leipzig": "rb leipzig",
  "salzburg": "rb salzburg",
  "frankfurt": "eintracht frankfurt",
  "milan": "ac milan",
  "roma": "as roma",
  "lazio": "ss lazio",
  "napoli": "ssc napoli",
  "newcastle": "newcastle united",
  "west ham": "west ham united",
  "leeds": "leeds united",
  "real madrid castilla": "real madrid",
  "rm castilla": "real madrid",
};

// Strip youth / reserve markers + common club-type designators (FC, AFC…)
function normaliseClub(name: string): string {
  let n = name
    .replace(/\s+U(15|16|17|18|19|20|21|23)$/i, "")
    .replace(/\s+(II|Yth\.?|Youth|Reserves?|Jgd\.?|Aca\.?)$/i, "")
    .replace(/\s+B$/, "")
    // trailing club designators: "Arsenal FC" → "Arsenal"
    .replace(/\s+(FC|AFC|CF|SC|AC|FK|SK|CD|UD|RC)$/i, "")
    // leading club designators: "FC Barcelona" → "Barcelona"
    .replace(/^(FC|AC|AS|SC|SK|SS|RC|UD|CD|RB|TSG|TSV|VfL|VfB|FK|SV|US|RCD|CA|RSC)\s+/i, "")
    .trim()
    .toLowerCase();
  if (CLUB_ALIASES[n]) n = CLUB_ALIASES[n];
  return n;
}

// Filter out non-club entries the API sometimes returns
function isRealClub(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (n === "without club" || n === "retired" || n === "career break") return false;
  if (n.includes("unknown")) return false;
  return true;
}

function sameOrganization(a: string, b: string): boolean {
  return normaliseClub(a) === normaliseClub(b);
}

// Is this a youth / reserve / B-team stop?
function isYouthStop(name: string): boolean {
  return /\s+(U\d{2}|II|Yth\.?|Youth|Reserves?|Jgd\.?|B)$/i.test(name);
}

// Collapse consecutive same-organization stops (e.g. Atalanta Youth → Atalanta U17
// → Atalanta U19 → Atalanta) into a single senior-team entry.
function collapseSameOrganization(clubs: string[]): string[] {
  if (clubs.length === 0) return clubs;
  const out: string[] = [clubs[0]];
  for (let i = 1; i < clubs.length; i++) {
    const last = out[out.length - 1];
    const next = clubs[i];
    const sameOrg = sameOrganization(last, next);
    const lastYouth = isYouthStop(last);
    const nextYouth = isYouthStop(next);

    if (sameOrg && lastYouth && nextYouth) {
      // youth + youth at same org → collapse (keep the existing youth label)
      continue;
    }
    if (sameOrg && !lastYouth && !nextYouth) {
      // senior + senior at same org → collapse, prefer longer/full name
      if (next.length > last.length) out[out.length - 1] = next;
      continue;
    }
    // youth + senior (or senior + youth) at same org → keep both as separate stops
    out.push(next);
  }
  return out;
}

export function getRevealedClues(player: Player, tier: ClueTier) {
  const clues: Record<string, string | number | string[]> = {};

  // Tier 1: Career path — drop non-clubs, collapse same-org stops, hide current
  const rawPath = player.careerPath.map((s) => s.club).filter(isRealClub);
  const fullPath = collapseSameOrganization(rawPath);
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
