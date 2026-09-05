import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard } from "../lib/tournaments.js";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchLeaderboard()
      .then((rows) => active && setLeaderboard(rows))
      .catch(() => active && setLeaderboard([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rx-container rx-leaderboard-page" style={{ padding: "56px 24px", maxWidth: 760 }}>
      <h1 className="rx-display" style={{ fontSize: 36, fontWeight: 700, margin: "0 0 8px" }}>
        Leaderboard
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
        Every registered player appears here. Win matches and tournaments to climb the ranks.
      </p>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
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

          {leaderboard.map((p) => (
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
                {p.tag}
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