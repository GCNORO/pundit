export interface CareerStop {
  club: string;
  season: string; // e.g. "2015-2018"
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  position: string;
  age: number;
  currentClub: string;
  currentLeague: string;
  careerPath: CareerStop[]; // ordered chronologically
  imageUrl?: string;
}

export interface GameState {
  puzzleDate: string; // YYYY-MM-DD
  guesses: string[]; // player names guessed
  maxGuesses: number;
  solved: boolean;
  failed: boolean;
}

// Clue tiers — what's revealed at each guess number
// Guess 1 (wrong): career path only
// Guess 2 (wrong): + position
// Guess 3 (wrong): + nationality
// Guess 4 (wrong): + age
// Guess 5 (wrong): + current club & league
export type ClueTier = 1 | 2 | 3 | 4 | 5;
