import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMvpMoments } from "../lib/tournaments.js";

export default function Mvp() {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMvpMoments()
      .then((rows) => active && setMoments(rows))
      .catch(() => active && setMoments([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rx-container" style={{ padding: "56px 24px", maxWidth: 900 }}>
      <div className="rx-eyebrow">★ RIVAL X HIGHLIGHTS</div>
      <h1 className="rx-display" style={{ fontSize: 42, fontWeight: 700, margin: "0 0 8px" }}>
        MVP Moments
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
        The best goals, saves, and plays from Rival X tournaments. Tap a player to see their profile.
      </p>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading MVP moments…</p>
      ) : !moments.length ? (
        <div
          className="rx-clip"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <h2 className="rx-display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            No MVP moments yet
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Check back soon — the admin will post the best plays from upcoming tournaments here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {moments.map((m) => (
            <div
              key={m.id}
              className="rx-clip"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              {/* Media display */}
              <div style={{ position: "relative", width: "100%", minHeight: 200, background: "var(--bg)" }}>
                {m.media_type === "video" ? (
                  <div style={{ position: "relative", width: "100%", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #16171b, #1f2127)" }}>
                    <a href={m.media_url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 30, color: "var(--silver-bright)" }}>
                      <span style={{ fontSize: 48 }}>▶️</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Watch highlight</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.media_url}</span>
                    </a>
                  </div>
                ) : m.media_type === "image" ? (
                  <img src={m.media_url} alt={m.title} style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, background: "linear-gradient(135deg, #16171b, #1f2127)" }}>
                    <a href={m.media_url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 30, color: "var(--silver-bright)" }}>
                      <span style={{ fontSize: 40 }}>🔗</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>View moment</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
                      {m.title}
                    </h2>
                    {m.description && (
                      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px", lineHeight: 1.6 }}>
                        {m.description}
                      </p>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {m.created_at ? new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                    </div>
                  </div>

                  <Link
                    to={`/profile/${m.player_id}`}
                    className="rx-btn-outline"
                    style={{ fontSize: 13, padding: "10px 18px", whiteSpace: "nowrap" }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--panel-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--red)", marginRight: 6 }}>
                      {m.players?.tag?.[0]?.toUpperCase() || "?"}
                    </span>
                    {m.players?.tag || "View player"}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}