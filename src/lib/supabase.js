import { createClient } from "@supabase/supabase-js";

// 1. Create a free project at https://supabase.com
// 2. Project Settings → API → copy the Project URL and anon public key
// 3. Create a file named `.env.local` in the project root with:
//      VITE_SUPABASE_URL=your-project-url
//      VITE_SUPABASE_ANON_KEY=your-anon-key
// 4. Enable Email and Google providers under Authentication → Providers
//    (Google login needs an OAuth client from Google Cloud Console)

const env = typeof import.meta !== "undefined" ? import.meta.env || {} : {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const ADMIN_USER_ID = env.VITE_ADMIN_USER_ID;
export const ADMIN_EMAIL = env.VITE_ADMIN_EMAIL;

export function isAdmin(user) {
  if (!user) return false;
  // Strictly verifies against the admin UID or admin email
  if (ADMIN_USER_ID && user.id === ADMIN_USER_ID) return true;
  if (ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  // Only app_metadata is trusted as a role claim. user_metadata is user-editable.
  if (user.app_metadata?.role === "admin") return true;
  return false;
}


// Creates this player's row in `players` the first time we see them,
// so their tag/avatar show up on the leaderboard and in tournament
// entries. Safe to call on every login — it's a no-op if the row
// already exists.
export async function ensurePlayerRow(user) {
  if (!supabase || !user) return;

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("players").insert({
      id: user.id,
      tag: user.user_metadata?.username || user.email?.split("@")[0] || "Player",
    });
  }

  // Keep server-side activity fresh for referral qualification.
  try {
    await supabase.rpc("touch_player_activity");
  } catch {
    // The RPC is added by the referral migration; don't block login if it
    // hasn't been run yet.
  }

  // A referral may arrive from email signup metadata or from a Google
  // signup where we temporarily keep it in localStorage until the OAuth
  // callback returns.
  const pendingReferral =
    user.user_metadata?.referred_by ||
    (typeof window !== "undefined" ? localStorage.getItem("rivalx_referral_pending") : "");

  if (pendingReferral) {
    try {
      const { error } = await supabase.rpc("record_referral", {
        p_referral_code: pendingReferral,
      });
      if (!error && typeof window !== "undefined") {
        localStorage.removeItem("rivalx_referral_pending");
      }
    } catch {
      // Referral processing should never prevent a player from signing in.
    }
  }
}

// Checks whether a username/tag is already taken by another player.
// Returns true if available, false if taken.
export async function checkUsernameAvailable(username) {
  if (!supabase) return true;
  const normalized = (username || "").trim();
  if (!normalized) return false;
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .ilike("tag", normalized)
    .maybeSingle();
  if (error) return true;
  return !data;
}

export async function signUpWithEmail(email, password, username, referralCode = "") {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const normalizedReferral = referralCode.trim().toUpperCase();

  if (normalizedReferral && typeof window !== "undefined") {
    localStorage.setItem("rivalx_referral_pending", normalizedReferral);
  }

  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
        ...(normalizedReferral ? { referred_by: normalizedReferral } : {}),
      },
    },
  });
  if (result.error) throw result.error;
  return result;
}

export async function signInWithGoogle(referralCode = "") {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const normalizedReferral = referralCode.trim().toUpperCase();
  if (normalizedReferral && typeof window !== "undefined") {
    localStorage.setItem("rivalx_referral_pending", normalizedReferral);
  }
  const result = await supabase.auth.signInWithOAuth({ provider: "google" });
  if (result.error) throw result.error;
  return result;
}

export async function touchPlayerActivity() {
  if (!supabase) return;
  const { error } = await supabase.rpc("touch_player_activity");
  if (error) throw error;
}

export async function deleteMyAccount() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });
  if (error) throw error;

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (typeof window !== "undefined") {
    if (userId) {
      localStorage.removeItem(`rivalx_avatar_${userId}`);
      localStorage.removeItem(`rivalx_squad_${userId}`);
    }
    localStorage.removeItem("rivalx_referral_pending");
    localStorage.removeItem("rivalx_demo_session");
  }

  await supabase.auth.signOut({ scope: "local" });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rivalx-auth-change"));
  }
}

export async function signInWithEmail(email, password) {
  if (!supabase) {
    if (email.trim().toLowerCase() !== "demo@rivalx.com" || password !== "rivalx2026") {
      throw new Error("Demo login: use demo@rivalx.com and password rivalx2026, or configure Supabase.");
    }

    localStorage.setItem("rivalx_demo_session", JSON.stringify({ email, provider: "email" }));
    window.dispatchEvent(new Event("rivalx-auth-change"));
    return { data: { user: { email } }, error: null };
  }

  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  window.dispatchEvent(new Event("rivalx-auth-change"));
  return result;
}

export async function signOut() {
  localStorage.removeItem("rivalx_demo_session");
  if (supabase) {
    const result = await supabase.auth.signOut();
    if (result.error) throw result.error;
  }
  window.dispatchEvent(new Event("rivalx-auth-change"));
}