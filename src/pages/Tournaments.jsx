import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTournaments, subscribeToEntryChanges } from "../lib/tournaments.js";

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const rows = await fetchTournaments();
        if (active) setTournaments(rows);
      } catch (err) {
        if (active) setError(err.message || "Couldn't load tournaments.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    // Any entry anywhere changing (new sign-up, payment confirmed)
    // re-pulls the counts so slots-filled stays live for every visitor.
    const unsubscribe = subscribeToEntryChanges(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px" }}>
        <p style={{ color: "var(--muted)" }}>Loading tournaments…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px" }}>
        <p style={{ color: "var(--red)" }}>{error}</p>
      </div>
    );
  }

  if (!tournaments.length) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px", maxWidth: 640 }}>
        <div className="rx-eyebrow">RIVAL X COMPETITION HUB</div>
        <h1 className="rx-display" style={{ fontSize: 42, fontWeight: 700, margin: "0 0 16px" }}>
          Tournaments
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6 }}>
          No tournaments are currently open. Check back shortly for the next championship announcement.
        </p>

        <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
          <Link to="/" className="rx-btn-outline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const featured = tournaments[0];
  const totalPlayers = tournaments.reduce((sum, t) => sum + t.slotsFilled, 0);
  const totalPrize = tournaments.reduce((sum, t) => sum + (t.conditions?.prizePoolTotal || t.entry_fee * t.slots * 0.8), 0);

  return (
    <div className="rx-container rx-tournaments-page" style={{ padding: "56px 24px" }}>
      <div className="rx-tournaments-heading">
        <div>
          <div className="rx-eyebrow">RIVAL X COMPETITION HUB</div>
          <h1 className="rx-display" style={{ fontSize: 42, fontWeight: 700, margin: "0 0 8px" }}>
            Tournaments
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Choose your bracket. Check conditions. Compete for the prize pool.
          </p>
        </div>
        <Link to={`/tournaments/${featured.id}`} className="rx-btn">
          Enter featured cup <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {/* Featured Tournament Hero Banner */}
      <Link to={`/tournaments/${featured.id}`} className="rx-featured-tournament rx-clip">
        <img src={featured.bannerUrl || "/images/3.jpg"} alt={featured.name} />
        <div className="rx-featured-shade" />
        <div className="rx-featured-content">
          <span className="rx-featured-label">
            {featured.platform?.toUpperCase() || "EFOOTBALL"} · FEATURED BRACKET
          </span>
          <h2 className="rx-display">{featured.name}</h2>
          <p>
            {featured.format} · Starts {featured.start_date} · ₦{Number(featured.conditions?.prizePoolTotal || 0).toLocaleString()} Prize Pool
          </p>
          <span className="rx-featured-link">
            View &amp; Join <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>

      <div className="rx-tournament-overview">
        <div>
          <strong>{tournaments.length}</strong>
          <span>Open brackets</span>
        </div>
        <div>
          <strong>₦{Math.round(totalPrize).toLocaleString()}</strong>
          <span>Total Prize Pools</span>
        </div>
        <div>
          <strong>{totalPlayers}</strong>
          <span>Players registered</span>
        </div>
      </div>

      <div className="rx-list-heading">
        <div>
          <h2 className="rx-display">Active Tournaments</h2>
          <p>Live brackets accepting player registration.</p>
        </div>
      </div>

      <div className="rx-tournaments-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
        {tournaments.map((t) => (
          <Link
            key={t.id}
            to={`/tournaments/${t.id}`}
            className="rx-clip rx-card-hover rx-tournament-card"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Card Banner */}
            <div style={{ position: "relative", width: "100%", height: 150, overflow: "hidden", marginBottom: 16 }} className="rx-clip-sm">
              <img
                src={t.bannerUrl || "/images/3.jpg"}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  background: "rgba(10,10,12,0.85)",
                  color: "var(--red)",
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
                className="rx-clip-sm"
              >
                {t.platform || "eFootball Mobile"}
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  background: t.slotsFilled >= t.slots ? "rgba(255,60,60,0.9)" : "rgba(34,197,94,0.9)",
                  color: "#0a0a0c",
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
                className="rx-clip-sm"
              >
                {t.slotsFilled >= t.slots ? "FULL" : "OPEN"}
              </div>
            </div>

            <div className="rx-display" style={{ fontSize: 20, fontWeight: 700, minHeight: 48 }}>
              {t.name}
            </div>

            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {t.format} · Starts {t.start_date}
            </div>

            <div className="rx-slot-progress" aria-label={`${t.slotsFilled} of ${t.slots} slots filled`} style={{ marginTop: 16 }}>
              <span style={{ width: `${Math.min((t.slotsFilled / t.slots) * 100, 100)}%` }} />
            </div>

            <div className="rx-tournament-stat-row" style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div>
                <div className="rx-display" style={{ fontSize: 18, fontWeight: 700 }}>
                  ₦{t.entry_fee.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Entry fee</div>
              </div>

              <div>
                <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--red)" }}>
                  ₦{Number(t.conditions?.prizePoolTotal || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Prize Pool</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="rx-display" style={{ fontSize: 18, fontWeight: 700 }}>
                  {t.slotsFilled}/{t.slots}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Slots filled</div>
              </div>
            </div>

            <div className="rx-card-action" style={{ marginTop: 16 }}>
              View conditions &amp; enter <span aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

