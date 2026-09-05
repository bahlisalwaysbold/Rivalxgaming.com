import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PlaceholderImage from "../components/PlaceholderImage.jsx";
import { supabase } from "../lib/supabase.js";
import {
  fetchTournament,
  createPendingEntry,
  subscribeToEntryChanges,
  fetchTournamentEntries,
  fetchTournamentMatches,
} from "../lib/tournaments.js";
import { payTournamentEntry, generatePaystackRef } from "../lib/paystack.js";

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [entering, setEntering] = useState(false);
  const [entries, setEntries] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [userEntry, setUserEntry] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const row = await fetchTournament(id);
        if (active) setTournament(row);
      } catch {
        if (active) setTournament(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    async function loadUser() {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (active) setUser(data.session?.user ?? null);
      } else {
        const demoSession = localStorage.getItem("rivalx_demo_session");
        if (active) setUser(demoSession ? JSON.parse(demoSession) : null);
      }
    }

    async function loadEntries() {
      try {
        const rows = await fetchTournamentEntries(id);
        if (active) setEntries(rows);
      } catch {
        if (active) setEntries([]);
      }
    }

    async function loadMatches() {
      try {
        const rows = await fetchTournamentMatches(id);
        if (active) setMatches(rows);
      } catch {
        if (active) setMatches([]);
      }
    }

    load();
    loadUser();
    loadEntries();
    loadMatches();
    // Live slot count: refetches whenever any entry changes anywhere,
    // so this exact page updates without a refresh.
    const unsubscribe = subscribeToEntryChanges(() => {
      load();
      loadEntries();
      loadMatches();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  // Check if current user has an entry in this tournament
  useEffect(() => {
    if (!user || !entries.length) {
      setUserEntry(null);
      return;
    }
    const myEntry = entries.find((e) => e.player_id === user.id);
    setUserEntry(myEntry || null);
  }, [user, entries]);

  if (loading) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px" }}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px" }}>
        <p>Tournament not found.</p>
        <Link to="/tournaments" style={{ color: "var(--red)" }}>
          Back to tournaments
        </Link>
      </div>
    );
  }

  const full = tournament.slotsFilled >= tournament.slots;
  const cond = tournament.conditions || {};

  // Registration deadline check
  const now = new Date();
  const regDeadline = tournament.registration_deadline ? new Date(tournament.registration_deadline) : null;
  const regOpen = tournament.registration_start ? new Date(tournament.registration_start) : null;
  const registrationClosed = regDeadline ? now > regDeadline : false;
  const registrationNotOpen = regOpen ? now < regOpen : false;
  const isLive = tournament.status === "live";
  const isCompleted = tournament.status === "completed";

  // Determine bracket stage progress
  const confirmedEntries = entries.filter((e) => e.application_status === "confirmed" && e.payment_status === "paid");
  const totalSlots = tournament.slots || 32;
  const bracketProgress = Math.min((confirmedEntries.length / totalSlots) * 100, 100);

  // Calculate stage percentage based on matches posted
  const stageOrder = ["Round of 64", "Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Final"];
  const postedStages = new Set(matches.map((m) => m.round || m.stage));
  let currentStageIndex = 0;
  for (let i = 0; i < stageOrder.length; i++) {
    if (postedStages.has(stageOrder[i])) currentStageIndex = i + 1;
  }
  const stagePercent = Math.round((currentStageIndex / stageOrder.length) * 100);

  // Group matches by round for display
  const matchesByRound = {};
  for (const m of matches) {
    const round = m.round || m.stage || "Match";
    if (!matchesByRound[round]) matchesByRound[round] = [];
    matchesByRound[round].push(m);
  }

  async function handleEnter() {
    if (!user) {
      navigate("/login");
      return;
    }

    // Check registration window
    if (registrationClosed) {
      setStatus("Registration for this tournament has closed.");
      return;
    }
    if (registrationNotOpen) {
      setStatus("Registration hasn't opened yet. Please check back later.");
      return;
    }
    if (isLive) {
      setStatus("This tournament is already live. Registration is closed.");
      return;
    }
    if (isCompleted) {
      setStatus("This tournament has been completed.");
      return;
    }

    setEntering(true);
    setStatus(null);
    try {
      const ref = generatePaystackRef();
      await createPendingEntry({ tournamentId: id, playerId: user.id, paystackRef: ref });
      await payTournamentEntry({
        email: user.email,
        amountNaira: tournament.entry_fee,
        reference: ref,
        onSuccess: () => setStatus("paid"),
        onClose: () => setStatus("cancelled"),
      });
    } catch (err) {
      setStatus(err.message || "Unable to start registration.");
    } finally {
      setEntering(false);
    }
  }

  return (
    <div className="rx-container rx-tournament-detail" style={{ padding: "48px 24px", maxWidth: 900 }}>
      {/* Real Banner Artwork */}
      <PlaceholderImage
        height={260}
        src={tournament.bannerUrl}
        alt={tournament.name}
        className="rx-clip"
      />

      {/* Header & Badges */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span
            style={{
              background: "rgba(216, 30, 39, 0.2)",
              color: "var(--red)",
              border: "1px solid var(--red)",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
            className="rx-clip-sm"
          >
            {tournament.platform || "eFootball Mobile"}
          </span>

          <span
            style={{
              background: "var(--panel-2)",
              color: "var(--silver-bright)",
              border: "1px solid var(--border)",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
            className="rx-clip-sm"
          >
            {tournament.format}
          </span>

          <span
            style={{
              background: isLive ? "rgba(34, 197, 94, 0.15)" : full ? "rgba(255, 60, 60, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: isLive ? "#4ade80" : full ? "#ff6666" : "#4ade80",
              border: isLive ? "1px solid #22c55e" : full ? "1px solid #ff4444" : "1px solid #22c55e",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
            className="rx-clip-sm"
          >
            {isLive ? "● LIVE NOW" : isCompleted ? "COMPLETED" : full ? "BRACKET FULL" : registrationClosed ? "REGISTRATION CLOSED" : "REGISTRATION OPEN"}
          </span>
        </div>

        <h1 className="rx-display" style={{ fontSize: 38, fontWeight: 700, margin: "0 0 8px" }}>
          {tournament.name}
        </h1>

        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          {tournament.game} · Starts {tournament.start_date} {cond.start_time ? `at ${cond.start_time}` : ""}
          {tournament.tournament_days ? ` · Lasts ${tournament.tournament_days} day${tournament.tournament_days > 1 ? "s" : ""}` : ""}
        </p>

        {/* Registration timing info */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          {tournament.registration_start && (
            <span>📅 Registration opens: {new Date(tournament.registration_start).toLocaleString()}</span>
          )}
          {tournament.registration_deadline && (
            <span style={{ color: registrationClosed ? "#ff6666" : "var(--muted)" }}>
              ⏰ Registration deadline: {new Date(tournament.registration_deadline).toLocaleString()}
              {registrationClosed && " (Closed)"}
            </span>
          )}
        </div>
      </div>

      {/* Prize Pool & Entry Strip */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          padding: 24,
          margin: "24px 0",
        }}
        className="rx-clip"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Guaranteed Prize Pool
            </div>
            <div className="rx-display" style={{ fontSize: 32, fontWeight: 700, color: "var(--silver-bright)" }}>
              ₦{Number(cond.prizePoolTotal || 0).toLocaleString()}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>
              Entry Fee
            </div>
            <div className="rx-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--red)" }}>
              ₦{tournament.entry_fee.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              padding: "12px 16px",
            }}
            className="rx-clip-sm"
          >
            <div style={{ fontSize: 12, color: "#facc15", fontWeight: 700 }}>🥇 1ST PLACE (CHAMPION)</div>
            <div className="rx-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {cond.firstPrize || `₦${Math.round((cond.prizePoolTotal || 0) * 0.7).toLocaleString()}`}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              padding: "12px 16px",
            }}
            className="rx-clip-sm"
          >
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>🥈 2ND PLACE (RUNNER-UP)</div>
            <div className="rx-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {cond.secondPrize || `₦${Math.round((cond.prizePoolTotal || 0) * 0.3).toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* Slot Progress */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            <span>Confirmed Bracket Slots</span>
            <span style={{ fontWeight: 600, color: "var(--silver-bright)" }}>
              {confirmedEntries.length} / {tournament.slots} players
            </span>
          </div>
          <div className="rx-slot-progress" style={{ margin: 0 }}>
            <span style={{ width: `${bracketProgress}%` }} />
          </div>
        </div>
      </div>

      {/* ── LIVE BRACKET / MATCH TABLE ─────────────────────── */}
      {(isLive || isCompleted || matches.length > 0) && (
        <div style={{ margin: "32px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <h2 className="rx-display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              {isLive ? "● Live Bracket & Matchups" : "Tournament Bracket & Results"}
            </h2>
            {isLive && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Tournament progress:</div>
                <div style={{ width: 120, height: 6, background: "var(--panel-2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${stagePercent}%`, height: "100%", background: "var(--red)", transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)" }}>{stagePercent}%</span>
              </div>
            )}
          </div>

          {/* Stage progress indicator */}
          {isLive && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {stageOrder.map((stage, i) => {
                const isReached = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
                return (
                  <span
                    key={stage}
                    className="rx-clip-sm"
                    style={{
                      padding: "4px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      background: isReached ? "rgba(34,197,94,0.15)" : isCurrent ? "rgba(216,30,39,0.2)" : "var(--panel-2)",
                      color: isReached ? "#4ade80" : isCurrent ? "var(--red)" : "var(--muted)",
                      border: `1px solid ${isReached ? "#22c55e" : isCurrent ? "var(--red)" : "var(--border)"}`,
                    }}
                  >
                    {isReached ? "✓ " : ""}{stage}
                  </span>
                );
              })}
            </div>
          )}

          {/* Players in tournament */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 20, marginBottom: 20 }} className="rx-clip">
            <h3 className="rx-display" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>
              Players in this tournament ({confirmedEntries.length})
            </h3>
            {confirmedEntries.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {confirmedEntries.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--panel-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--red)", flexShrink: 0 }}>
                      {entry.players?.tag?.[0]?.toUpperCase() || "?"}
                    </span>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.players?.tag || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No confirmed players yet.</p>
            )}
          </div>

          {/* Matchups by round */}
          {Object.keys(matchesByRound).length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(matchesByRound).map(([round, roundMatches]) => (
                <div key={round} style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 20 }} className="rx-clip">
                  <h3 className="rx-display" style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--red)" }}>
                    {round}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {roundMatches.map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>{m.opponent_tag || "Match"}</span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>vs</span>
                          <span>{m.player2_id ? "Opponent" : "TBD"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="rx-display" style={{ fontSize: 15, fontWeight: 700 }}>{m.score || "—"}</span>
                          <span
                            className="rx-clip-sm"
                            style={{
                              padding: "2px 8px",
                              fontSize: 10,
                              fontWeight: 700,
                              background: m.result === "W" ? "rgba(34,197,94,0.15)" : "rgba(255,60,60,0.15)",
                              color: m.result === "W" ? "#4ade80" : "#ff6666",
                              border: `1px solid ${m.result === "W" ? "#22c55e" : "#ff4444"}`,
                            }}
                          >
                            {m.result === "W" ? "WINNER" : "RESULT"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 20 }} className="rx-clip">
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                {isLive ? "Matches are being played. Results will appear here as the tournament progresses." : "No match results posted yet."}
              </p>
            </div>
          )}

          {/* Eliminated players */}
          {matches.some((m) => m.eliminated_id) && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 20, marginTop: 20 }} className="rx-clip">
              <h3 className="rx-display" style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "#ff6666" }}>
                Eliminated Players
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {matches.filter((m) => m.eliminated_id).map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                    <span>✕</span>
                    <span>{m.opponent_tag || "Player"}</span>
                    <span style={{ fontSize: 11 }}>eliminated in {m.round || m.stage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Conditions & Specifications Grid */}
      <div style={{ margin: "32px 0" }}>
        <h2 className="rx-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
          Match Conditions & Gameplay Settings
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Match Length</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {cond.matchDuration || "10 mins"}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Extra Time & PK</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              ET: {cond.extraTime || "ON"} | PK: {cond.penalties || "ON"}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Squad Restrictions</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {cond.squadType || "Dream Team (Max 3100)"}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Connection Requirement</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {cond.connectionReq || "Stable 4G / Wi-Fi"}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Walkover Grace Period</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {cond.gracePeriod || "15 minutes"}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Target Platform</div>
            <div className="rx-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "var(--red)" }}>
              {tournament.platform || "eFootball Mobile"}
            </div>
          </div>
        </div>
      </div>

      {/* Rules & Result Verification */}
      <div style={{ margin: "32px 0" }}>
        <h2 className="rx-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Official Rules & Verification
        </h2>
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: 20,
            color: "var(--silver)",
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
          className="rx-clip"
        >
          {tournament.rulesClean || "Standard Rival X rules apply. Respect opponents and submit screenshots on time."}
        </div>
      </div>

      {/* Entry Action */}
      <div style={{ marginTop: 32, padding: "24px 0", borderTop: "1px solid var(--border)" }}>
        {userEntry ? (
          <div
            style={{
              background: userEntry.application_status === "confirmed" ? "rgba(34, 197, 94, 0.15)" : userEntry.application_status === "rejected" ? "rgba(255, 60, 60, 0.15)" : "rgba(250, 204, 21, 0.15)",
              border: `1px solid ${userEntry.application_status === "confirmed" ? "#22c55e" : userEntry.application_status === "rejected" ? "#ff4444" : "#facc15"}`,
              color: userEntry.application_status === "confirmed" ? "#4ade80" : userEntry.application_status === "rejected" ? "#ff6666" : "#facc15",
              padding: "16px 20px",
              fontSize: 14,
              fontWeight: 600,
            }}
            className="rx-clip"
          >
            {userEntry.application_status === "confirmed"
              ? "✓ You're confirmed for this tournament!"
              : userEntry.application_status === "rejected"
              ? "✕ Your application was rejected."
              : "⏳ Your application is pending admin confirmation."}
          </div>
        ) : (
          <button
            className="rx-btn"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "16px 24px",
              fontSize: 16,
              fontWeight: 700,
              opacity: full || entering || registrationClosed || isLive || isCompleted ? 0.6 : 1,
            }}
            onClick={handleEnter}
            disabled={full || entering || registrationClosed || isLive || isCompleted}
          >
            <i className="ti ti-lock" aria-hidden="true" style={{ fontSize: 18 }} />
            {full
              ? "Tournament Bracket Full"
              : registrationClosed
              ? "Registration Closed"
              : registrationNotOpen
              ? "Registration Not Open Yet"
              : isLive
              ? "Tournament Already Live"
              : isCompleted
              ? "Tournament Completed"
              : entering
              ? "Opening Paystack Checkout…"
              : `Pay Entry Fee & Join (₦${tournament.entry_fee.toLocaleString()})`}
          </button>
        )}

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          Secured by Paystack — card, bank transfer, and USSD accepted. Your payment is verified server-side.
        </p>

        {status === "paid" && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid #22c55e",
              color: "#4ade80",
              padding: "14px 18px",
              marginTop: 16,
              fontSize: 14,
            }}
            className="rx-clip"
          >
            ✓ Payment received — your application is now pending admin confirmation. Check your profile for status.
          </div>
        )}

        {status === "cancelled" && (
          <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 13 }}>
            Checkout closed before completing payment.
          </p>
        )}

        {status && status !== "paid" && status !== "cancelled" && (
          <div
            style={{
              background: "rgba(255, 60, 60, 0.15)",
              border: "1px solid var(--red)",
              color: "#ff8888",
              padding: "14px 18px",
              marginTop: 16,
              fontSize: 14,
            }}
            className="rx-clip"
          >
            ✕ {status}
          </div>
        )}
      </div>
    </div>
  );
}