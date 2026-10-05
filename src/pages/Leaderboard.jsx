import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ensurePlayerRow, supabase } from "../lib/supabase.js";
import { fetchLeaderboard } from "../lib/tournaments.js";
import VerificationBadge from "../components/VerificationBadge.jsx";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadForUser(currentUser) {
      setUser(currentUser);
      setAuthChecked(true);
      setError(null);

      if (!currentUser) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await ensurePlayerRow(currentUser);
        const rows = await fetchLeaderboard();
        if (active) setLeaderboard(rows);
      } catch (loadError) {
        console.error("Unable to load the Rival X leaderboard:", loadError);
        if (active) {
          setLeaderboard([]);
          setError(loadError.message || "Unable to load the leaderboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    async function checkAuthAndLoad() {
      if (!supabase) {
        if (active) {
          setUser(null);
          setAuthChecked(true);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (active) await loadForUser(data.session?.user ?? null);
      } catch (loadError) {
        console.error("Unable to check authentication for the leaderboard:", loadError);
        if (active) {
          setError(loadError.message || "Unable to verify your session.");
          setAuthChecked(true);
          setLoading(false);
        }
      }
    }

    checkAuthAndLoad();

    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active) void loadForUser(session?.user ?? null);
    });

    return () => {
      active = false;
      authSubscription?.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="rx-container rx-leaderboard-page" style={{ padding: "56px 24px", maxWidth: 760 }}>
      <h1 className="rx-display" style={{ fontSize: 36, fontWeight: 700, margin: "0 0 8px" }}>
        Leaderboard
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
        The top 10 Rival X players. Win matches and tournaments to climb the ranks.
      </p>

      {!authChecked || loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : error ? (
        <p role="alert" style={{ color: "var(--red)" }}>{error}</p>
      ) : !user ? (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: 28,
            marginTop: 8,
          }}
          className="rx-clip"
        >
          <div className="rx-eyebrow" style={{ color: "var(--red)", marginBottom: 8 }}>
            RIVAL X MEMBERS ONLY
          </div>
          <h2 className="rx-display" style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px" }}>
            The rankings are waiting.
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: "0 0 20px" }}>
            See who is dominating Rival X, track your position, and compete for the top spot.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/login" className="rx-btn">Log in to view rankings</Link>
            <Link to="/register" className="rx-btn-outline">Join Rival X</Link>
          </div>
        </div>
      ) : !leaderboard.length ? (
        <p style={{ color: "var(--muted)" }}>No players registered yet.</p>
      ) : (
        <div>
          <div
            className="rx-leaderboard-row rx-leaderboard-heading"
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 70px 70px 70px 70px",
              fontSize: 12,
              color: "var(--muted)",
              padding: "0 16px 10px",
            }}
          >
            <span>#</span>
            <span>Player</span>
            <span>W</span>
            <span>L</span>
            <span>Streak</span>
            <span>Pts</span>
          </div>

          {leaderboard.slice(0, 10).map((p) => (
            <Link
              to={`/profile/${p.id}`}
              key={p.id}
              className="rx-leaderboard-row"
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 70px 70px 70px 70px",
                alignItems: "center",
                padding: "14px 16px",
                borderTop: "1px solid var(--border)",
                background: p.rank === 1 ? "var(--panel)" : "transparent",
                textDecoration: "none",
                color: "inherit",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = p.rank === 1 ? "var(--panel)" : "transparent")}
            >
              <span
                className="rx-display"
                style={{
                  fontWeight: 700,
                  color: p.rank <= 3 ? "var(--red)" : "var(--silver)",
                }}
              >
                {p.rank}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {p.tag} <VerificationBadge badge={p.verification_badge} />
                {p.wins === 0 && p.losses === 0 && (
                  <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6, fontWeight: 400 }}>
                    (new)
                  </span>
                )}
              </span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{p.wins}</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{p.losses}</span>
              <span style={{ fontSize: 14, color: p.win_streak > 0 ? "#4ade80" : "var(--muted)" }}>
                {p.win_streak > 0 ? `🔥${p.win_streak}` : "—"}
              </span>
              <span className="rx-display" style={{ fontWeight: 600 }}>
                {p.points}
              </span>
            </Link>
          ))}

        </div>
      )}
    </div>
  );
}
