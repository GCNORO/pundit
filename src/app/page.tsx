"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import players from "@/data/players.json";
import {
  getDailyPuzzleIndex,
  getTodayDateString,
  createGameState,
  getCurrentClueTier,
  getRevealedClues,
  makeGuess,
  generateShareText,
  loadGameState,
  saveGameState,
} from "@/lib/game";
import type { Player, GameState } from "@/lib/types";

export default function Home() {
  const todayDate = getTodayDateString();
  const puzzleIndex = getDailyPuzzleIndex(todayDate, players.length);
  const todayPlayer = players[puzzleIndex] as Player;

  const [gameState, setGameState] = useState<GameState>(() => {
    return loadGameState(todayDate) || createGameState(todayDate);
  });
  const [inputValue, setInputValue] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showCopied, setShowCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const wrongGuesses = gameState.guesses.filter(
    (g) => g.toLowerCase() !== todayPlayer.name.toLowerCase()
  ).length;
  const clueTier = getCurrentClueTier(wrongGuesses);
  const clues = getRevealedClues(todayPlayer, clueTier);
  const isGameOver = gameState.solved || gameState.failed;

  // Save state on change
  useEffect(() => {
    saveGameState(gameState);
  }, [gameState]);

  // Autocomplete filtering
  const filteredPlayers = inputValue.length >= 2
    ? players
        .filter((p) =>
          p.name.toLowerCase().includes(inputValue.toLowerCase())
        )
        .filter((p) => !gameState.guesses.includes(p.name))
        .slice(0, 8)
    : [];

  const handleSubmit = useCallback(
    (name: string) => {
      if (isGameOver) return;
      const trimmed = name.trim();
      if (!trimmed) return;

      // Must be a valid player from our database
      const validPlayer = players.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (!validPlayer) return;

      const newState = makeGuess(gameState, validPlayer.name, todayPlayer);
      setGameState(newState);
      setInputValue("");
      setShowAutocomplete(false);
      setActiveIndex(-1);
    },
    [gameState, todayPlayer, isGameOver]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredPlayers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && filteredPlayers[activeIndex]) {
        handleSubmit(filteredPlayers[activeIndex].name);
      } else if (filteredPlayers.length === 1) {
        handleSubmit(filteredPlayers[0].name);
      }
    } else if (e.key === "Escape") {
      setShowAutocomplete(false);
    }
  };

  const handleShare = async () => {
    const text = generateShareText(gameState, todayDate);
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>Foot</span>le
        </h1>
        <p>Guess the player from their career path</p>
      </header>

      {/* Clue Cards */}
      <div className="clues">
        {/* Tier 1: Career Path — always shown */}
        <div className="clue-card">
          <span className="clue-label">Career</span>
          <div className="career-path">
            {(clues.careerPath as string[]).map((club, i) => (
              <span key={i}>
                {i > 0 && <span className="career-arrow"> → </span>}
                <span className="career-stop">{club}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Tier 2: Position */}
        <div className={`clue-card ${clueTier < 2 ? "locked" : ""}`}>
          <span className="clue-label">Position</span>
          <span className="clue-value">
            {clueTier >= 2 ? (clues.position as string) : "???"}
          </span>
        </div>

        {/* Tier 3: Nationality */}
        <div className={`clue-card ${clueTier < 3 ? "locked" : ""}`}>
          <span className="clue-label">Nation</span>
          <span className="clue-value">
            {clueTier >= 3 ? (clues.nationality as string) : "???"}
          </span>
        </div>

        {/* Tier 4: Age */}
        <div className={`clue-card ${clueTier < 4 ? "locked" : ""}`}>
          <span className="clue-label">Age</span>
          <span className="clue-value">
            {clueTier >= 4 ? (clues.age as number) : "???"}
          </span>
        </div>

        {/* Tier 5: Current Club & League */}
        <div className={`clue-card ${clueTier < 5 ? "locked" : ""}`}>
          <span className="clue-label">Club</span>
          <span className="clue-value">
            {clueTier >= 5
              ? `${clues.currentClub} (${clues.currentLeague})`
              : "???"}
          </span>
        </div>
      </div>

      {/* Guess History */}
      {gameState.guesses.length > 0 && (
        <div className="guess-history">
          {gameState.guesses.map((guess, i) => {
            const isCorrect =
              guess.toLowerCase() === todayPlayer.name.toLowerCase();
            return (
              <div key={i} className="guess-entry">
                <span className="guess-icon">{isCorrect ? "🟢" : "🔴"}</span>
                <span className="guess-name">{guess}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Game Over */}
      {isGameOver ? (
        <div className={`result ${gameState.failed ? "failed" : ""}`}>
          <h2>{gameState.solved ? "You got it!" : "Not this time"}</h2>
          <p className="player-name">{todayPlayer.name}</p>
          <button className="share-btn" onClick={handleShare}>
            Share Result
          </button>
        </div>
      ) : (
        <>
          <p className="guess-counter">
            Guess {gameState.guesses.length + 1} of {gameState.maxGuesses}
          </p>
          <div className="guess-section">
            <div className="guess-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="guess-input"
                placeholder="Type a player name..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowAutocomplete(true);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowAutocomplete(true)}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                disabled={isGameOver}
                autoComplete="off"
              />
              {showAutocomplete && filteredPlayers.length > 0 && (
                <div className="autocomplete">
                  {filteredPlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className={`autocomplete-item ${
                        i === activeIndex ? "active" : ""
                      }`}
                      onMouseDown={() => handleSubmit(p.name)}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <footer className="footer">
        Footle — A new player every day
      </footer>

      {showCopied && <div className="copied-toast">Copied to clipboard!</div>}
    </div>
  );
}
