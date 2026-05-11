/**
 * Fetch player data from Transfermarkt API and build the Footle player database.
 *
 * Usage: node scripts/fetch-players.mjs
 *
 * Pipeline:
 * 1. Get all clubs in the big-5 leagues
 * 2. Get each club's roster (already includes age/position/nationality)
 * 3. For each player, fetch transfer history → build career path
 * 4. Sort by market value, take top N per league
 * 5. Output src/data/players.json
 *
 * API: https://transfermarkt-api.fly.dev
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = "https://transfermarkt-api.fly.dev";

const LEAGUES = [
  { id: "GB1", name: "Premier League" },
  { id: "ES1", name: "La Liga" },
  { id: "L1", name: "Bundesliga" },
  { id: "IT1", name: "Serie A" },
  { id: "FR1", name: "Ligue 1" },
];

const SEASON = "2025";
const TOP_PER_LEAGUE = 60;       // ~300 total; tweak as needed
const MIN_CAREER_STOPS = 3;      // need a meaningful path
const REQUEST_DELAY_MS = 150;    // be polite

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(path, retries = 2) {
  const url = `${API_BASE}${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
      if (res.status === 404) return null;
      console.error(`  ${res.status} ${url}`);
    } catch (e) {
      console.error(`  ERR ${url}: ${e.message}`);
    }
    await sleep(500 * (attempt + 1));
  }
  return null;
}

function mapPosition(pos) {
  if (!pos) return "Unknown";
  const p = pos.toLowerCase();
  if (p.includes("goalkeeper") || p.includes("keeper")) return "Goalkeeper";
  if (p.includes("back") || p.includes("defender") || p.includes("sweeper"))
    return "Defender";
  if (p.includes("midfield")) return "Midfielder";
  if (
    p.includes("forward") ||
    p.includes("winger") ||
    p.includes("striker") ||
    p.includes("attack")
  )
    return "Forward";
  return pos;
}

function buildCareerPath(transfersPayload, currentClubName) {
  const transfers = transfersPayload?.transfers;
  if (!Array.isArray(transfers) || transfers.length === 0) return [];

  // API returns transfers newest-first → reverse to chronological
  const chrono = [...transfers].reverse();

  const path = [];
  const seen = new Set();
  const push = (club, season) => {
    if (!club?.name) return;
    // dedupe consecutive duplicates (loan returns etc.)
    if (path.length && path[path.length - 1].club === club.name) return;
    if (seen.has(club.name)) return;
    seen.add(club.name);
    path.push({ club: club.name, season: season || "" });
  };

  for (const t of chrono) {
    push(t.clubFrom, t.season);
    push(t.clubTo, t.season);
  }

  // Make sure last stop is the current club
  if (currentClubName && path.length) {
    const last = path[path.length - 1].club;
    if (last !== currentClubName) {
      // Some transfers list "Without Club" or short loans; force current club at the end
      if (!seen.has(currentClubName)) {
        path.push({ club: currentClubName, season: "" });
      }
    }
  }

  return path;
}

// Normalise a club name for the league-lookup map (strips youth/designators
// like the runtime does in src/lib/game.ts)
function normKey(name) {
  return name
    .replace(/\s+U(15|16|17|18|19|20|21|23)$/i, "")
    .replace(/\s+(II|Yth\.?|Youth|Reserves?|Jgd\.?|Aca\.?)$/i, "")
    .replace(/\s+B$/, "")
    .replace(/(\s+(FC|AFC|CF|SC|AC|BC|FK|SK|CD|UD|RC|Calcio|19\d{2}|20\d{2}))+$/i, "")
    .replace(/^(FC|AC|AS|SC|SK|SS|RC|UD|CD|RB|TSG|TSV|VfL|VfB|FK|SV|US|RCD|CA|RSC)\s+/i, "")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("Footle Player Data Pipeline");
  console.log("===========================\n");

  const allPlayers = [];

  // Pre-pass: build a club name → league map across all big-5 leagues so we
  // can look up the league for a player's latest transfer destination
  console.log("Building club → league map…");
  const clubToLeague = new Map();
  for (const league of LEAGUES) {
    const clubsResp = await fetchJSON(
      `/competitions/${league.id}/clubs?season_id=${SEASON}`
    );
    for (const club of clubsResp?.clubs || []) {
      clubToLeague.set(normKey(club.name), league.name);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`  ${clubToLeague.size} clubs mapped across ${LEAGUES.length} leagues\n`);

  for (const league of LEAGUES) {
    console.log(`\n=== ${league.name} ===`);
    const clubsResp = await fetchJSON(
      `/competitions/${league.id}/clubs?season_id=${SEASON}`
    );
    const clubs = clubsResp?.clubs || [];
    if (!clubs.length) {
      console.log(`  No clubs found, skipping`);
      continue;
    }
    console.log(`  ${clubs.length} clubs`);

    // Collect all players in the league with metadata
    const candidates = [];
    for (const club of clubs) {
      await sleep(REQUEST_DELAY_MS);
      const players = (await fetchJSON(`/clubs/${club.id}/players?season_id=${SEASON}`))?.players || [];
      for (const p of players) {
        candidates.push({
          ...p,
          currentClub: club.name,
          currentLeague: league.name,
        });
      }
    }
    console.log(`  ${candidates.length} candidate players`);

    // Sort by market value (desc), take the top N
    candidates.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
    const top = candidates.slice(0, TOP_PER_LEAGUE * 2); // grab extra in case some get skipped

    let added = 0;
    for (const p of top) {
      if (added >= TOP_PER_LEAGUE) break;
      await sleep(REQUEST_DELAY_MS);
      const transfers = await fetchJSON(`/players/${p.id}/transfers`);
      const careerPath = buildCareerPath(transfers, p.currentClub);

      if (careerPath.length < MIN_CAREER_STOPS) {
        continue;
      }

      // Prefer the destination of the most recent transfer as currentClub —
      // the season roster lags real life by months. Look up the league from
      // our pre-built map so currentLeague stays in sync.
      const latestTransfer = transfers?.transfers?.[0];
      const latestDestination = latestTransfer?.clubTo?.name;
      const currentClub = latestDestination || p.currentClub;
      const mappedLeague = clubToLeague.get(normKey(currentClub));
      const currentLeague = mappedLeague || p.currentLeague;

      const player = {
        id: String(p.id),
        name: p.name,
        nationality: Array.isArray(p.nationality) ? p.nationality[0] : (p.nationality || "Unknown"),
        position: mapPosition(p.position),
        age: p.age || 0,
        currentClub,
        currentLeague,
        careerPath,
        imageUrl: p.image || "",
      };
      allPlayers.push(player);
      added++;
      console.log(
        `  + ${player.name} (${player.position}, ${player.nationality}) — ${careerPath.length} clubs`
      );
    }
  }

  // De-duplicate by id (a player can appear in multiple league rosters mid-transfer)
  const byId = new Map();
  for (const p of allPlayers) byId.set(p.id, p);
  const deduped = Array.from(byId.values());

  console.log(`\n✅ Total players: ${deduped.length}`);

  const outDir = join(__dirname, "..", "src", "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "players.json");
  writeFileSync(outPath, JSON.stringify(deduped, null, 2));
  console.log(`💾 Saved to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
