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

  const shareText = generateShareText(gameState, todayDate);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTextWithUrl = encodeURIComponent(`${shareText}\n${shareUrl}`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = `${shareText}\n${shareUrl}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({
          title: "Footle",
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed — silently ignore
      }
    } else {
      handleCopy();
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && !!(navigator as Navigator).share;

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

          <div className="share-menu">
            <p className="share-label">Share your result</p>
            <div className="share-buttons">
              {canNativeShare && (
                <button
                  className="share-icon-btn share-native"
                  onClick={handleNativeShare}
                  aria-label="Share via device"
                  title="Share..."
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                  </svg>
                </button>
              )}
              <a
                className="share-icon-btn share-whatsapp"
                href={`https://wa.me/?text=${encodedTextWithUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                title="WhatsApp"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.044zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                </svg>
              </a>
              <a
                className="share-icon-btn share-x"
                href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                title="X (Twitter)"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                className="share-icon-btn share-telegram"
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Telegram"
                title="Telegram"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
              <a
                className="share-icon-btn share-facebook"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                title="Facebook"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                className="share-icon-btn share-reddit"
                href={`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Reddit"
                title="Reddit"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
                </svg>
              </a>
              <button
                className="share-icon-btn share-copy"
                onClick={handleCopy}
                aria-label="Copy to clipboard"
                title="Copy"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
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
