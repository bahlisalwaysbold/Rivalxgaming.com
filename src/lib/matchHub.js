import { supabase } from "./supabase.js";

function enrichRooms(rooms, players, tournaments) {
  const playerMap = Object.fromEntries((players || []).map((p) => [p.id, p]));
  const tournamentMap = Object.fromEntries((tournaments || []).map((t) => [t.id, t]));
  return (rooms || []).map((room) => ({
    ...room,
    player1: playerMap[room.player1_id] || null,
    player2: playerMap[room.player2_id] || null,
    tournament: tournamentMap[room.tournament_id] || null,
  }));
}

export async function fetchPlayerMatchRooms(playerId) {
  if (!supabase || !playerId) return [];
  const { data: rooms, error } = await supabase
    .from("match_rooms")
    .select("*")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const playerIds = [...new Set((rooms || []).flatMap((room) => [room.player1_id, room.player2_id]))];
  const tournamentIds = [...new Set((rooms || []).map((room) => room.tournament_id))];

  const [{ data: players, error: playersError }, { data: tournaments, error: tournamentsError }] = await Promise.all([
    playerIds.length ? supabase.from("players").select("id, tag, avatar_url, verification_badge").in("id", playerIds) : Promise.resolve({ data: [] }),
    tournamentIds.length ? supabase.from("tournaments").select("id, name, game, format, start_date").in("id", tournamentIds) : Promise.resolve({ data: [] }),
  ]);
  if (playersError) throw playersError;
  if (tournamentsError) throw tournamentsError;

  return enrichRooms(rooms, players, tournaments);
}

export async function fetchTournamentMatchRooms(tournamentId) {
  if (!supabase || !tournamentId) return [];
  const { data: rooms, error } = await supabase
    .from("match_rooms")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const playerIds = [...new Set((rooms || []).flatMap((room) => [room.player1_id, room.player2_id]))];
  const [{ data: players, error: playersError }] = await Promise.all([
    playerIds.length ? supabase.from("players").select("id, tag, avatar_url, verification_badge").in("id", playerIds) : Promise.resolve({ data: [] }),
  ]);
  if (playersError) throw playersError;
  return enrichRooms(rooms, players, []);
}

export async function generateMatchRooms(tournamentId, round) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.rpc("generate_match_rooms", {
    p_tournament_id: tournamentId,
    p_round: round,
  });
  if (error) throw error;
  return Number(data || 0);
}

export async function startMatchRoom(matchId) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.rpc("start_match_room", { p_match_id: matchId });
  if (error) throw error;
  return data;
}

export async function submitMatchRoomResult(matchId, player1Score, player2Score) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.rpc("submit_match_room_result", {
    p_match_id: matchId,
    p_player1_score: Number(player1Score),
    p_player2_score: Number(player2Score),
  });
  if (error) throw error;
  return data;
}

export async function resolveMatchRoom(matchId, player1Score, player2Score) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.rpc("resolve_match_room", {
    p_match_id: matchId,
    p_player1_score: Number(player1Score),
    p_player2_score: Number(player2Score),
  });
  if (error) throw error;
  return data;
}

export function subscribeToMatchRoomChanges(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("match-rooms-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "match_rooms" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
