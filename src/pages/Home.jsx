import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlaceholderImage from "../components/PlaceholderImage.jsx";
import { supabase, isAdmin } from "../lib/supabase.js";
import { fetchTournaments, subscribeToEntryChanges } from "../lib/tournaments.js";


export default function Home() {
  const [nextTournament, setNextTournament] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadTournament() {
      try {
        const rows = await fetchTournaments();
        if (active) setNextTournament(rows[0] || null);
      } catch {
        if (active) setNextTournament(null);
      }
    }

    loadTournament();
    const unsubscribe = subscribeToEntryChanges(loadTournament);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadUser() {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      } else {
        setUser(localStorage.getItem("rivalx_demo_session") ? { email: "demo" } : null);
      }
    }

    loadUser();
    window.addEventListener("rivalx-auth-change", loadUser);
    return () => window.removeEventListener("rivalx-auth-change", loadUser);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="rx-hero-section" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="rx-container rx-hero"
          style={{
            padding: "72px 24px 56px",
            display: "flex",
            gap: 48,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="rx-hero-copy" style={{ flex: 1, minWidth: 320 }}>
            <div
              className="rx-reveal"
              style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.02em" }}
            >
              eFootball tournaments · entry fees in ₦
            </div>
            <h1
              className="rx-display rx-reveal rx-reveal-delay-1"
              style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.02, margin: 0 }}
            >
              Compete.{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, var(--silver-bright), #9ca0a6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Improve.
              </span>{" "}
              <span style={{ color: "var(--red)" }}>Conquer.</span>
            </h1>
            <p
              className="rx-reveal rx-reveal-delay-1"
              style={{ color: "var(--muted)", fontSize: 16, maxWidth: 440, marginTop: 20 }}
            >
              Enter eFootball tournaments, pay your way in securely, and climb the
              Rival X leaderboard one match at a time.
            </p>
            <div className="rx-cta-group rx-reveal rx-reveal-delay-2" style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link to="/tournaments" className="rx-btn">
                Browse tournaments <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 16 }} />
              </Link>
              {!user && (
                <Link to="/register" className="rx-btn-outline">
                  Create account
                </Link>
              )}
            </div>
          </div>

          <div className="rx-hero-visual rx-reveal rx-reveal-delay-1" style={{ flex: 1, minWidth: 320 }}>
            <img
              src="/images/gulit1.jpg"
              alt="Rival X — Compete. Improve. Conquer."
              className="rx-clip rx-hero-logo"
            />
          </div>
        </div>
      </section>

      {/* Next tournament strip */}
      {nextTournament ? (
        <section className="rx-container rx-nextup" style={{ padding: "48px 24px" }}>
          <div
            className="rx-nextup-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 className="rx-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
                Next up
              </h2>
              <span
                style={{
                  background: "rgba(216, 30, 39, 0.15)",
                  color: "var(--red)",
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
                className="rx-clip-sm"
              >
                {nextTournament.platform || "eFootball Mobile"}
              </span>
            </div>
            <Link to="/tournaments" style={{ fontSize: 13, color: "var(--muted)" }}>
              All tournaments →
            </Link>
          </div>

          <div
            className="rx-clip rx-card-hover rx-nextup-card"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              display: "flex",
              flexWrap: "wrap",
              gap: 32,
              padding: 28,
            }}
          >
            <div className="rx-nextup-art" style={{ flex: "0 0 220px" }}>
              <PlaceholderImage
                height={140}
                src={nextTournament.bannerUrl}
                alt={nextTournament.name}
              />
            </div>
            <div className="rx-nextup-meta" style={{ flex: 1, minWidth: 260 }}>
              <div className="rx-display" style={{ fontSize: 22, fontWeight: 700 }}>
                {nextTournament.name}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                {nextTournament.format} · Starts {nextTournament.start_date}
              </div>
              <div className="rx-nextup-stat-row" style={{ display: "flex", gap: 24, marginTop: 18, flexWrap: "wrap" }}>
                <div>
                  <div className="rx-display" style={{ fontSize: 20, fontWeight: 700 }}>
                    ₦{nextTournament.entry_fee.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Entry fee</div>
                </div>
                <div>
                  <div className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>
                    ₦{Number(nextTournament.conditions?.prizePoolTotal || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Prize Pool</div>
                </div>
                <div>
                  <div className="rx-display" style={{ fontSize: 20, fontWeight: 700 }}>
                    {nextTournament.slotsFilled}/{nextTournament.slots}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Slots filled</div>
                </div>
              </div>
            </div>
            <div className="rx-nextup-action" style={{ display: "flex", alignItems: "center" }}>
              <Link to={`/tournaments/${nextTournament.id}`} className="rx-btn">
                View & enter <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 16 }} />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="rx-container rx-nextup" style={{ padding: "48px 24px" }}>
          <div
            className="rx-clip"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              padding: "36px 28px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Official Competition
              </div>
              <h3 className="rx-display" style={{ fontSize: 26, fontWeight: 700, margin: "6px 0" }}>
                New eFootball Championship Brackets Launching
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 500 }}>
                Prepare your squad for upcoming eFootball tournaments with guaranteed Naira cash prize pools.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Link to="/tournaments" className="rx-btn">
                Browse tournaments
              </Link>
              {isAdmin(user) && (
                <Link to="/admin" className="rx-btn-outline">
                  Post tournament
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* MVP Moments Section */}
      <section className="rx-container" style={{ padding: "48px 24px" }}>
        <div
          className="rx-clip"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "36px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ★ MVP Moments
            </div>
            <h3 className="rx-display" style={{ fontSize: 26, fontWeight: 700, margin: "6px 0" }}>
              Watch the Best Plays on Rival X
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 500 }}>
              Check out the most incredible goals, saves, and moments from tournaments. Tap through to see the player's profile.
            </p>
          </div>
          <Link to="/mvp" className="rx-btn">
            View MVP moments <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Featured image strip */}
      <section className="rx-container" style={{ padding: "24px 24px 48px" }}>
        <div
          className="rx-clip"
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 280,
            border: "1px solid var(--border)",
          }}
        >
          <img
            src="/images/rijkad1.jpg"
            alt="Rival X tournament action"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 40%",
              filter: "saturate(0.9) brightness(1.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(7,9,12,0.9) 0%, rgba(7,9,12,0.4) 50%, transparent 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, padding: "40px 32px", maxWidth: 420 }}>
            <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Rival X Arena
            </div>
            <h3 className="rx-display" style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 10px", color: "#fff" }}>
              The Ultimate eFootball Battleground
            </h3>
            <p style={{ color: "rgba(242,243,245,0.85)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              From Round of 64 to the Grand Final — every match matters. Climb the leaderboard, build your win streak, and claim the prize pool.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}