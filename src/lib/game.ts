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

// Canonical display names for clubs the Transfermarkt API returns under
// multiple short forms. Key = lowercase normalised form, value = display.
// Always prefer the longer / fuller version (e.g. "Liverpool FC" over "Liverpool",
// "FC Barcelona" over "Barcelona", "Manchester City" over "Man City").
const CANONICAL_NAMES: Record<string, string> = {
  // Premier League
  "man city": "Manchester City",
  "manchester city": "Manchester City",
  "man utd": "Manchester United",
  "man united": "Manchester United",
  "manchester united": "Manchester United",
  "newcastle": "Newcastle United",
  "newcastle united": "Newcastle United",
  "west ham": "West Ham United",
  "west ham united": "West Ham United",
  "leeds": "Leeds United",
  "leeds united": "Leeds United",
  "spurs": "Tottenham Hotspur",
  "tottenham": "Tottenham Hotspur",
  "tottenham hotspur": "Tottenham Hotspur",
  "wolves": "Wolverhampton Wanderers",
  "wolverhampton": "Wolverhampton Wanderers",
  "wolverhampton wanderers": "Wolverhampton Wanderers",
  "arsenal": "Arsenal FC",
  "chelsea": "Chelsea FC",
  "liverpool": "Liverpool FC",
  "everton": "Everton FC",
  "fulham": "Fulham FC",
  "brentford": "Brentford FC",
  "brighton": "Brighton & Hove Albion",
  "brighton & hove albion": "Brighton & Hove Albion",
  "nottm forest": "Nottingham Forest",
  "nottingham forest": "Nottingham Forest",
  "aston villa": "Aston Villa",
  "crystal palace": "Crystal Palace",
  // La Liga
  "barcelona": "FC Barcelona",
  "fc barcelona": "FC Barcelona",
  "barca": "FC Barcelona",
  "real madrid": "Real Madrid",
  "real madrid castilla": "Real Madrid",
  "rm castilla": "Real Madrid",
  "atletico": "Atlético Madrid",
  "atlético": "Atlético Madrid",
  "atleti": "Atlético Madrid",
  "atletico madrid": "Atlético Madrid",
  "atlético madrid": "Atlético Madrid",
  "real sociedad": "Real Sociedad",
  "athletic": "Athletic Bilbao",
  "athletic bilbao": "Athletic Bilbao",
  "valencia": "Valencia CF",
  "villarreal": "Villarreal CF",
  "sevilla": "Sevilla FC",
  "real betis": "Real Betis",
  "betis": "Real Betis",
  "las palmas": "UD Las Palmas",
  "ud las palmas": "UD Las Palmas",
  // Bundesliga
  "bayern": "Bayern Munich",
  "fc bayern": "Bayern Munich",
  "bayern munich": "Bayern Munich",
  "dortmund": "Borussia Dortmund",
  "borussia dortmund": "Borussia Dortmund",
  "b. dortmund": "Borussia Dortmund",
  "leverkusen": "Bayer Leverkusen",
  "bayer leverkusen": "Bayer Leverkusen",
  "bayer 04 leverkusen": "Bayer Leverkusen",
  "leipzig": "RB Leipzig",
  "rb leipzig": "RB Leipzig",
  "salzburg": "RB Salzburg",
  "rb salzburg": "RB Salzburg",
  "frankfurt": "Eintracht Frankfurt",
  "eintracht frankfurt": "Eintracht Frankfurt",
  "stuttgart": "VfB Stuttgart",
  "vfb stuttgart": "VfB Stuttgart",
  "wolfsburg": "VfL Wolfsburg",
  "vfl wolfsburg": "VfL Wolfsburg",
  "1.fc köln": "1. FC Köln",
  "fc köln": "1. FC Köln",
  // Serie A
  "milan": "AC Milan",
  "ac milan": "AC Milan",
  "inter": "Inter Milan",
  "inter milan": "Inter Milan",
  "roma": "AS Roma",
  "as roma": "AS Roma",
  "lazio": "SS Lazio",
  "ss lazio": "SS Lazio",
  "napoli": "SSC Napoli",
  "ssc napoli": "SSC Napoli",
  "juve": "Juventus",
  "juventus": "Juventus",
  // Ligue 1
  "psg": "Paris Saint-Germain",
  "paris saint-germain": "Paris Saint-Germain",
  "marseille": "Olympique Marseille",
  "olympique marseille": "Olympique Marseille",
  "lyon": "Olympique Lyon",
  "olympique lyon": "Olympique Lyon",
  "monaco": "AS Monaco",
  "as monaco": "AS Monaco",
  "saint-étienne": "AS Saint-Étienne",
  "st-étienne": "AS Saint-Étienne",
  "as saint-étienne": "AS Saint-Étienne",
};

// Lookup the canonical / preferred display form. Returns the original name if no override exists.
function canonicalName(name: string): string {
  const key = normaliseClub(name);
  return CANONICAL_NAMES[key] || name;
}

// Strip youth / reserve markers + common club-type designators (FC, AFC…)
// Returns a lowercase normalised key used for matching duplicates.
function normaliseClub(name: string): string {
  return name
    .replace(/\s+U(15|16|17|18|19|20|21|23)$/i, "")
    .replace(/\s+(II|Yth\.?|Youth|Reserves?|Jgd\.?|Aca\.?)$/i, "")
    .replace(/\s+B$/, "")
    // trailing club designators: "Arsenal FC" → "Arsenal"
    .replace(/\s+(FC|AFC|CF|SC|AC|FK|SK|CD|UD|RC)$/i, "")
    // leading club designators: "FC Barcelona" → "Barcelona"
    .replace(/^(FC|AC|AS|SC|SK|SS|RC|UD|CD|RB|TSG|TSV|VfL|VfB|FK|SV|US|RCD|CA|RSC)\s+/i, "")
    .replace(/\s+0?\d{1,2}\s+/g, " ") // strip embedded numbers like "Bayer 04"
    .trim()
    .toLowerCase();
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
  const collapsed = collapseSameOrganization(rawPath);
  // Replace senior-team names with their canonical form (e.g. "Liverpool" → "Liverpool FC")
  const fullPath = collapsed.map((c) => (isYouthStop(c) ? c : canonicalName(c)));
  if (tier >= 5) {
    clues.careerPath = fullPath;
  } else {
    // Replace the current/last club with a placeholder.
    // Compare via normaliseClub so e.g. "Newcastle United" (canonical) matches
    // "Newcastle" (raw currentClub).
    const trimmed = [...fullPath];
    if (
      trimmed.length > 0 &&
      !isYouthStop(trimmed[trimmed.length - 1]) &&
      normaliseClub(trimmed[trimmed.length - 1]) ===
        normaliseClub(player.currentClub)
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

  // Tier 5: Current club & league (use canonical display name)
  if (tier >= 5) {
    clues.currentClub = canonicalName(player.currentClub);
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
