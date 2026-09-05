// Real data layer, backed by the Supabase tables in supabase/schema.sql.
// Replaces src/data/mockData.js everywhere it was used.

import { supabase } from "./supabase.js";

// ── Tournaments ──────────────────────────────────────────────

export function parseTournamentConditions(t) {
  if (!t) return null;

  let conditions = {
    prizePoolTotal: 0,
    firstPrize: "",
    secondPrize: "",
    thirdPrize: "",
    platform: "eFootball Mobile",
    bannerUrl: "/images/3.jpg",
    status: "open",
    matchDuration: "10 mins",
    extraTime: "ON",
    penalties: "ON",
    squadType: "Dream Team (Max 3100)",
    connectionReq: "Stable 4G / Wi-Fi (Min 3-4 bars)",
    gracePeriod: "15 minutes",
    rulesText: t.rules || "",
  };

  if (t.rules && typeof t.rules === "string") {
    const trimmed = t.rules.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        conditions = { ...conditions, ...parsed };
      } catch {
        // keep defaults
      }
    }
  }

  // Fallback defaults if prize pool wasn't specified
  if (!conditions.prizePoolTotal && t.entry_fee && t.slots) {
    conditions.prizePoolTotal = Math.round(t.entry_fee * t.slots * 0.8);
    if (!conditions.firstPrize) conditions.firstPrize = `₦${Math.round(conditions.prizePoolTotal * 0.7).toLocaleString()}`;
    if (!conditions.secondPrize) conditions.secondPrize = `₦${Math.round(conditions.prizePoolTotal * 0.3).toLocaleString()}`;
  }

  return {
    ...t,
    conditions,
    platform: conditions.platform || "eFootball",
    bannerUrl: conditions.bannerUrl || "/images/3.jpg",
    status: t.status || conditions.status || "open",
    rulesClean: conditions.rulesText || t.rules || "Standard Rival X tournament rules apply.",
  };
}

export function serializeTournamentConditions(formData) {
  const prizePoolTotal = Number(formData.prizePoolTotal) || 
    (formData.entry_fee && formData.slots ? Math.round(Number(formData.entry_fee) * Number(formData.slots) * 0.8) : 0);

  const conditions = {
    prizePoolTotal,
    firstPrize: formData.firstPrize?.trim() || `₦${Math.round(prizePoolTotal * 0.7).toLocaleString()}`,
    secondPrize: formData.secondPrize?.trim() || `₦${Math.round(prizePoolTotal * 0.3).toLocaleString()}`,
    thirdPrize: formData.thirdPrize?.trim() || "",
    platform: formData.platform?.trim() || "eFootball Mobile",
    bannerUrl: formData.bannerUrl || "/images/3.jpg",
    status: formData.status || "open",
    matchDuration: formData.matchDuration?.trim() || "10 mins",
    extraTime: formData.extraTime || "ON",
    penalties: formData.penalties || "ON",
    squadType: formData.squadType?.trim() || "Dream Team (Max 3100)",
    connectionReq: formData.connectionReq?.trim() || "Stable 4G / Wi-Fi (Min 3-4 bars)",
    gracePeriod: formData.gracePeriod?.trim() || "15 minutes",
    rulesText: formData.rulesText?.trim() || formData.rules?.trim() || "Single elimination knockout. Home and away or single leg as specified. Results submitted with screenshot proof within 15 minutes of match conclusion.",
  };

  return {
    name: formData.name.trim(),
    game: formData.game?.trim() || "eFootball",
    entry_fee: Number(formData.entry_fee) || 0,
    format: formData.format?.trim() || "1v1 knockout",
    slots: Number(formData.slots),
    start_date: formData.start_date || null,
    registration_deadline: formData.registration_deadline || null,
    registration_start: formData.registration_start || null,
    tournament_days: Number(formData.tournament_days) || 1,
    status: formData.status || "open",
    rules: JSON.stringify(conditions),
  };
}

// Fetches every tournament plus how many PAID entries each one has
export async function fetchTournaments() {
  if (!supabase) return [];

  const { data: tournamentRows, error: tournamentsError } = await supabase
    .from("tournaments")
    .select("*")
    .order("start_date", { ascending: true });
  if (tournamentsError) throw tournamentsError;

  const { data: paidEntries, error: entriesError } = await supabase
    .from("entries")
    .select("tournament_id")
    .eq("payment_status", "paid");
  if (entriesError) throw entriesError;

  const filledCounts = {};
  for (const entry of paidEntries) {
    filledCounts[entry.tournament_id] = (filledCounts[entry.tournament_id] || 0) + 1;
  }

  return tournamentRows.map((t) =>
    parseTournamentConditions({ ...t, slotsFilled: filledCounts[t.id] || 0 })
  );
}

export async function fetchTournament(id) {
  if (!supabase) return null;

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { count, error: countError } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", id)
    .eq("payment_status", "paid");
  if (countError) throw countError;

  return parseTournamentConditions({ ...tournament, slotsFilled: count || 0 });
}

// Admin-only — creates tournament with serialized conditions
export async function createTournament(payload) {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const rowPayload = payload.rules && typeof payload.rules === "object"
    ? serializeTournamentConditions(payload)
    : payload;

  const { data, error } = await supabase.from("tournaments").insert(rowPayload).select().single();
  if (error) throw error;
  return parseTournamentConditions(data);
}

export async function updateTournament(id, payload) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.from("tournaments").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return parseTournamentConditions(data);
}

export async function deleteTournament(id) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// Live slot counts: fires `onChange` whenever any entry is inserted or
// its payment_status changes, so every open tab updates without a
// page refresh. Call the returned function to unsubscribe.
export function subscribeToEntryChanges(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("entries-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Entries (a player joining a tournament) ─────────────────

// Creates the "pending" record before Paystack checkout opens. The
// paystack-webhook Edge Function is the only thing that ever flips
// this to "paid", using the same reference.
export async function createPendingEntry({ tournamentId, playerId, paystackRef }) {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const { data, error } = await supabase
    .from("entries")
    .insert({
      tournament_id: tournamentId,
      player_id: playerId,
      paystack_ref: paystackRef,
      payment_status: "pending",
      application_status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchEntryStatus(paystackRef) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("entries")
    .select("payment_status, application_status")
    .eq("paystack_ref", paystackRef)
    .single();
  if (error) return null;
  return data;
}

// Admin: fetch all entries for a tournament with player info
export async function fetchTournamentEntries(tournamentId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("entries")
    .select("*, players(tag, avatar_url, squad_photo_url)")
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data;
}

// Admin: confirm or reject a player's application
export async function updateEntryApplication(entryId, applicationStatus) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase
    .from("entries")
    .update({ application_status: applicationStatus })
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Matches ─────────────────────────────────────────────────

// Admin: post a match result
export async function createMatch(matchData) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase
    .from("matches")
    .insert(matchData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Fetch all matches for a tournament (for bracket display)
export async function fetchTournamentMatches(tournamentId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("played_at", { ascending: true });
  if (error) throw error;
  return data;
}

// ── Leaderboard ──────────────────────────────────────────────

export async function fetchLeaderboard() {
  if (!supabase) return [];

  // Fetch all players so even new users with 0 matches appear
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, tag, avatar_url, win_streak, created_at");
  if (playersError) throw playersError;

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("player_id, result, winner_id, eliminated_id");
  if (matchesError) throw matchesError;

  const byPlayer = {};
  for (const p of players) {
    byPlayer[p.id] = {
      id: p.id,
      tag: p.tag,
      avatar_url: p.avatar_url,
      win_streak: p.win_streak || 0,
      wins: 0,
      losses: 0,
      tournamentsWon: 0,
      created_at: p.created_at,
    };
  }

  for (const m of matches) {
    if (m.winner_id && byPlayer[m.winner_id]) {
      byPlayer[m.winner_id].wins += 1;
      byPlayer[m.winner_id].tournamentsWon += 1;
    }
    if (m.eliminated_id && byPlayer[m.eliminated_id]) {
      byPlayer[m.eliminated_id].losses += 1;
    }
    if (m.player_id && byPlayer[m.player_id] && m.result === "W") {
      byPlayer[m.player_id].wins += 1;
    }
    if (m.player_id && byPlayer[m.player_id] && m.result === "L") {
      byPlayer[m.player_id].losses += 1;
    }
  }

  return Object.values(byPlayer)
    .map((p) => ({ ...p, points: p.wins * 3 + p.tournamentsWon * 5 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Player profile ───────────────────────────────────────────

export async function fetchPlayerStats(userId) {
  const empty = {
    stats: [
      { label: "Matches", value: "0" },
      { label: "Wins", value: "0" },
      { label: "Win rate", value: "0%" },
      { label: "Tournaments", value: "0" },
    ],
    matches: [],
    winStreak: 0,
  };
  if (!supabase || !userId) return empty;

  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .or(`player_id.eq.${userId},winner_id.eq.${userId},eliminated_id.eq.${userId}`)
    .order("played_at", { ascending: false });
  if (error) throw error;

  const { count: tournamentsEntered } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("player_id", userId)
    .eq("payment_status", "paid");

  const { data: playerRow } = await supabase
    .from("players")
    .select("tag, avatar_url, squad_photo_url, win_streak, created_at")
    .eq("id", userId)
    .single();

  const wins = matches.filter((m) => m.winner_id === userId || (m.player_id === userId && m.result === "W")).length;
  const losses = matches.filter((m) => m.eliminated_id === userId || (m.player_id === userId && m.result === "L")).length;
  const total = wins + losses;
  const winRate = total ? Math.round((wins / total) * 100) : 0;

  return {
    player: playerRow || null,
    stats: [
      { label: "Matches", value: String(total) },
      { label: "Wins", value: String(wins) },
      { label: "Win rate", value: `${winRate}%` },
      { label: "Tournaments", value: String(tournamentsEntered || 0) },
    ],
    matches: matches.slice(0, 10).map((m) => ({
      opp: m.opponent_tag || "Unknown",
      result: m.winner_id === userId ? "W" : m.eliminated_id === userId ? "L" : m.result,
      score: m.score || "—",
      date: m.played_at
        ? new Date(m.played_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "",
    })),
    winStreak: playerRow?.win_streak || 0,
  };
}

// ── MVP Moments ──────────────────────────────────────────────

export async function fetchMvpMoments() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mvp_moments")
    .select("*, players(tag, avatar_url)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMvpMoment(payload) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase
    .from("mvp_moments")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMvpMoment(id) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.from("mvp_moments").delete().eq("id", id);
  if (error) throw error;
  return true;
}