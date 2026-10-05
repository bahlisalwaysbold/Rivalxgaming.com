import { supabase } from "./supabase.js";

export async function fetchMyReferralStats() {
  if (!supabase) {
    return {
      referral_code: "",
      total_referrals: 0,
      active_referrals: 0,
      tournament_players: 0,
      active_play_rate: 0,
      qualifies_for_referral_blue: false,
    };
  }

  const { data, error } = await supabase.rpc("get_my_referral_stats");
  if (error) throw error;
  return data?.[0] || {
    referral_code: "",
    total_referrals: 0,
    active_referrals: 0,
    tournament_players: 0,
    active_play_rate: 0,
    qualifies_for_referral_blue: false,
  };
}

export async function fetchReferralQualifiedPlayerIds() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_referral_qualified_players");
  if (error) throw error;
  return (data || []).map((row) => row.player_id);
}
