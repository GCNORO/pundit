/**
 * Fetch player data from Transfermarkt API and build the Footle player database.
 *
 * Usage: node scripts/fetch-players.mjs
 *
 * This script:
 * 1. Searches for top players from the big 5 leagues
 * 2. Fetches each player's profile and transfer history
 * 3. Builds ordered career paths
 * 4. Outputs src/data/players.json
 *
 * API: https://transfermarkt-api.fly.dev
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = "https://transfermarkt-api.fly.dev";

// Top 5 league competition IDs on Transfermarkt
const LEAGUES = [
  { id: "GB1", name: "Premier League" },
  { id: "ES1", name: "La Liga" },
  { id: "L1", name: "Bundesliga" },
  { id: "IT1", name: "Serie A" },
  { id: "FR1", name: "Ligue 1" },
];

// Rate limiting — be respectful
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(path) {
  const url = `${API_BASE}${path}`;
  console.log(`  GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ERROR ${res.status} for ${url}`);
    return null;
  }
  return res.json();
}

async function getLeaguePlayers(leagueId, season = "2024") {
  // Get clubs in the league
  const data = await fetchJSON(
    `/competitions/${leagueId}/clubs?season_id=${season}`
  );
  if (!data?.clubs) return [];
  return data.clubs;
}

async function getClubPlayers(clubId, season = "2024") {
  const data = await fetchJSON(`/clubs/${clubId}/players?season_id=${season}`);
  if (!data?.players) return [];
  return data.players;
}

async function getPlayerProfile(playerId) {
  return fetchJSON(`/players/${playerId}/profile`);
}

async function getPlayerTransfers(playerId) {
  return fetchJSON(`/players/${playerId}/transfers`);
}

function buildCareerPath(transfers) {
  if (!transfers?.transferHistory) return [];

  // Transfers are typically newest-first, so reverse for chronological order
  const history = [...transfers.transferHistory].reverse();

  const career = [];
  const seen = new Set();

  for (const t of history) {
    // Add the "from" club if not seen
    if (t.from?.name && !seen.has(t.from.name)) {
      seen.add(t.from.name);
      career.push({
        club: t.from.name,
        season: t.date || "",
      });
    }
    // Add the "to" club
    if (t.to?.name && !seen.has(t.to.name)) {
      seen.add(t.to.name);
      career.push({
        club: t.to.name,
        season: t.date || "",
      });
    }
  }

  return career;
}

function mapPosition(pos) {
  if (!pos) return "Unknown";
  const p = pos.toLowerCase();
  if (p.includes("goalkeeper") || p.includes("keeper")) return "Goalkeeper";
  if (p.includes("back") || p.includes("centre-back") || p.includes("defender"))
    return "Defender";
  if (p.includes("midfield")) return "Midfielder";
  if (
    p.includes("forward") ||
    p.includes("winger") ||
    p.includes("striker") ||
    p.includes("centre-forward")
  )
    return "Forward";
  return pos;
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

async function main() {
  console.log("Footle Player Data Pipeline");
  console.log("===========================\n");

  const allPlayers = [];
  const targetPerLeague = 25; // ~125 total, curate down to 100

  for (const league of LEAGUES) {
    console.log(`\nProcessing ${league.name}...`);
    const clubs = await getLeaguePlayers(league.id);
    if (!clubs.length) {
      console.log(`  No clubs found for ${league.name}, skipping`);
      continue;
    }

    let leaguePlayers = 0;

    for (const club of clubs) {
      if (leaguePlayers >= targetPerLeague) break;

      console.log(`  Club: ${club.name}`);
      await sleep(500);

      const players = await getClubPlayers(club.id);
      if (!players.length) continue;

      // Take top 2-3 players per club (by market value or just first listed)
      const topPlayers = players.slice(0, 3);

      for (const p of topPlayers) {
        if (leaguePlayers >= targetPerLeague) break;

        await sleep(500);
        const profile = await getPlayerProfile(p.id);
        if (!profile) continue;

        await sleep(500);
        const transfers = await getPlayerTransfers(p.id);
        const careerPath = buildCareerPath(transfers);

        // Skip players with very short career paths (not interesting for the game)
        if (careerPath.length < 2) {
          console.log(`  Skipping ${profile.name} (career too short)`);
          continue;
        }

        const player = {
          id: String(p.id),
          name: profile.name || p.name,
          nationality: profile.nationality || "Unknown",
          position: mapPosition(profile.position || p.position),
          age: calculateAge(profile.dateOfBirth),
          currentClub: club.name,
          currentLeague: league.name,
          careerPath,
          imageUrl: profile.imageUrl || p.image || "",
        };

        allPlayers.push(player);
        leaguePlayers++;
        console.log(
          `  Added: ${player.name} (${player.position}, ${player.nationality}) — ${careerPath.length} clubs`
        );
      }
    }
  }

  console.log(`\nTotal players fetched: ${allPlayers.length}`);

  // Write output
  const outDir = join(__dirname, "..", "src", "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "players.json");
  writeFileSync(outPath, JSON.stringify(allPlayers, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main().catch(console.error);
