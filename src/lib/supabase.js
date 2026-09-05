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
  if (user.user_metadata?.is_admin === true || user.app_metadata?.role === "admin") return true;
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
  if (existing) return;

  await supabase.from("players").insert({
    id: user.id,
    tag: user.user_metadata?.username || user.email?.split("@")[0] || "Player",
  });
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

export async function signUpWithEmail(email, password, username) {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const result = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });
  if (result.error) throw result.error;
  return result;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured yet — see src/lib/supabase.js");
  const result = await supabase.auth.signInWithOAuth({ provider: "google" });
  if (result.error) throw result.error;
  return result;
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