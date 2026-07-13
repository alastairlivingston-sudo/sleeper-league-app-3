#!/usr/bin/env node
// Fetches current-season standings, head-to-heads, extremes, and per-game
// positional breakdowns (ap/bp: QB/RB/WR/TE/K/DEF) + starter lists (as/bs).

const path = require("path");
const L = require("./lib");
const { BASE, get, posPoints, starterList, benchList, writeJson } = L;

const OUT = path.join(__dirname, "../docs/data/stats.json");

async function fetchAllMatchups(leagueId, playoffWeekStart) {
  const all = [];
  for (let w = 1; w <= 18; w++) {
    try {
      const week = await get(`${BASE}/league/${leagueId}/matchups/${w}`);
      if (!week || week.length === 0) break;
      all.push({ week: w, entries: week, playoff: w >= playoffWeekStart });
    } catch (e) { if (e.notFound) break; throw e; }
  }
  return all;
}

async function main() {
  const league = await L.findActiveLeague("games");
  const leagueId = league.league_id;
  const playoffWeekStart = L.playoffWeekStart(league);

  console.log("Fetching /players/nfl for position data...");
  const [users, rosters, players] = await Promise.all([
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    L.getPlayers(),
  ]);
  const posMap = L.skillPosMap(players);

  const userMap = {};
  for (const u of users) {
    userMap[u.user_id] = { name: u.display_name, team: u.metadata?.team_name || u.display_name };
  }

  const rosterOwner = {};
  for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;

  const standingsArr = rosters
    .filter((r) => r.owner_id)
    .map((r) => {
      const uid = r.owner_id;
      const s = r.settings || {};
      return {
        manager: userMap[uid]?.name || uid,
        team: userMap[uid]?.team || uid,
        wins: s.wins || 0,
        losses: s.losses || 0,
        ties: s.ties || 0,
        pf: parseFloat((s.fpts || 0) + "." + String(s.fpts_decimal || 0).padStart(2, "0")),
        pa: parseFloat((s.fpts_against || 0) + "." + String(s.fpts_against_decimal || 0).padStart(2, "0")),
        streak: s.streak || 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);

  const matchupWeeks = await fetchAllMatchups(leagueId, playoffWeekStart);

  // head-to-head matrix: h2h[managerA][managerB] = { wins, losses, pf, pa }
  const h2h = {};
  const games = [];

  for (const { week, entries, playoff } of matchupWeeks) {
    const paired = {};
    for (const e of entries) {
      if (!e.matchup_id) continue;
      if (!paired[e.matchup_id]) paired[e.matchup_id] = [];
      paired[e.matchup_id].push(e);
    }
    for (const pair of Object.values(paired)) {
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const aUid = rosterOwner[x.roster_id];
      const bUid = rosterOwner[y.roster_id];
      const aName = userMap[aUid]?.name || String(x.roster_id);
      const bName = userMap[bUid]?.name || String(y.roster_id);
      games.push({
        week, playoff,
        a: aName, b: bName,
        pa: x.points || 0, pb: y.points || 0,
        ap: posPoints(x, posMap), bp: posPoints(y, posMap),
        as: starterList(x, posMap, false), bs: starterList(y, posMap, false), // lineup order
        ab: benchList(x, posMap), bb: benchList(y, posMap),
      });

      if (!playoff) {
        if (!h2h[aName]) h2h[aName] = {};
        if (!h2h[bName]) h2h[bName] = {};
        if (!h2h[aName][bName]) h2h[aName][bName] = { wins: 0, losses: 0, pf: 0, pa: 0 };
        if (!h2h[bName][aName]) h2h[bName][aName] = { wins: 0, losses: 0, pf: 0, pa: 0 };

        const pa = x.points || 0;
        const pb = y.points || 0;
        h2h[aName][bName].pf += pa;
        h2h[aName][bName].pa += pb;
        h2h[bName][aName].pf += pb;
        h2h[bName][aName].pa += pa;
        if (pa > pb) {
          h2h[aName][bName].wins++;
          h2h[bName][aName].losses++;
        } else if (pb > pa) {
          h2h[bName][aName].wins++;
          h2h[aName][bName].losses++;
        }
      }
    }
  }

  // round pf/pa in h2h to 2 decimals
  for (const a of Object.values(h2h)) {
    for (const b of Object.values(a)) {
      b.pf = Math.round(b.pf * 100) / 100;
      b.pa = Math.round(b.pa * 100) / 100;
    }
  }

  // extremes (regular season only)
  const regGames = games.filter((g) => !g.playoff && g.pa > 0 && g.pb > 0);
  let closest = null, blowout = null, highWeek = null;

  for (const g of regGames) {
    const diff = Math.abs(g.pa - g.pb);
    const high = Math.max(g.pa, g.pb);
    if (!closest || diff < Math.abs(closest.pa - closest.pb)) closest = g;
    if (!blowout || diff > Math.abs(blowout.pa - blowout.pb)) blowout = g;
    if (!highWeek || high > Math.max(highWeek.pa, highWeek.pb)) highWeek = g;
  }

  // NB: the per-game `games` array (heavy: as/bs/ab/bb) is intentionally NOT
  // serialised — the artifact only reads standings/headToHead/extremes, and the
  // full game list lives in history.json. `games` is still used above to derive
  // headToHead + extremes.
  const out = {
    league: league.name,
    season: league.season,
    standings: standingsArr,
    headToHead: h2h,
    extremes: {
      closestGame: closest,
      biggestBlowout: blowout,
      highestScoringGame: highWeek,
    },
  };

  writeJson(OUT, out);
  console.log(`Wrote ${OUT}`);
  console.log(`Standings: ${standingsArr.length} teams, ${games.length} games processed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
