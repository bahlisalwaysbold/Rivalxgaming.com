import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import VerificationBadge from "../components/VerificationBadge.jsx";
import { supabase } from "../lib/supabase.js";
import {
  fetchPlayerMatchRooms,
  startMatchRoom,
  submitMatchRoomResult,
  subscribeToMatchRoomChanges,
} from "../lib/matchHub.js";
import { fetchTournaments } from "../lib/tournaments.js";

function statusLabel(status) {
  return {
    ready: "READY",
    live: "LIVE",
    result_pending: "RESULT PENDING",
    completed: "COMPLETED",
    disputed: "DISPUTED",
    cancelled: "CANCELLED",
  }[status] || String(status || "").toUpperCase();
}

function scoreValue(value) {
  return value === "" ? "" : String(Math.max(0, Math.min(99, Number(value))));
}

export default function MatchHub() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [starting, setStarting] = useState(null);
  const [scoreDrafts, setScoreDrafts] = useState({});

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data.user;
        if (!active) return;
        setUser(currentUser || null);
        if (!currentUser) {
          setLoading(false);
          return;
        }
        const [roomRows, tournamentRows] = await Promise.all([
          fetchPlayerMatchRooms(currentUser.id),
          fetchTournaments(),
        ]);
        if (active) {
          setRooms(roomRows);
          setTournaments(tournamentRows.filter((t) => t.status === "open" || t.status === "live"));
        }
      } catch (err) {
        if (active) setError(err.message || "Could not load your Match Hub.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const unsubscribe = subscribeToMatchRoomChanges(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const activeRooms = useMemo(
    () => rooms.filter((room) => !["completed", "cancelled"].includes(room.status)),
    [rooms]
  );
  const historyRooms = useMemo(
    () => rooms.filter((room) => ["completed", "disputed"].includes(room.status)),
    [rooms]
  );
  const currentRoom = activeRooms[0] || null;

  function roomPlayer(room, id) {
    return room.player1_id === id ? room.player1 : room.player2;
  }

  function draft(room) {
    const saved = scoreDrafts[room.id];
    if (saved) return saved;
    if (room.player1_id === user?.id) {
      return { player1: "", player2: "" };
    }
    return { player1: "", player2: "" };
  }

  async function handleStart(room) {
    setStarting(room.id);
    setError(null);
    try {
      await startMatchRoom(room.id);
      setMessage("Match is LIVE. Play the game, then submit the final score.");
      await reload();
    } catch (err) {
      setError(err.message || "Could not start this match.");
    } finally {
      setStarting(null);
    }
  }

  async function handleSubmit(room) {
    const draftScores = scoreDrafts[room.id] || { player1: "", player2: "" };
    if (draftScores.player1 === "" || draftScores.player2 === "") {
      setError("Enter both players' scores.");
      return;
    }
    if (Number(draftScores.player1) === Number(draftScores.player2)) {
      setError("A knockout match needs a winner. Confirm the final score.");
      return;
    }

    setSubmitting(room.id);
    setError(null);
    setMessage(null);
    try {
      const result = await submitMatchRoomResult(room.id, draftScores.player1, draftScores.player2);
      setMessage(result.status === "completed"
        ? "Result confirmed by both players. Match added to Rival X history."
        : result.status === "disputed"
          ? "The submitted scores don't match. An admin will review the dispute."
          : "Your score is saved. Waiting for your opponent to confirm.");
      await reload();
    } catch (err) {
      setError(err.message || "Could not submit the result.");
    } finally {
      setSubmitting(null);
    }
  }

  async function reload() {
    if (!user?.id) return;
    const rows = await fetchPlayerMatchRooms(user.id);
    setRooms(rows);
  }

  if (loading) {
    return <div className="rx-container" style={{ padding: "56px 24px" }}><p style={{ color: "var(--muted)" }}>Loading Match Hub…</p></div>;
  }

  if (!user) {
    return (
      <div className="rx-container" style={{ padding: "70px 24px", maxWidth: 640 }}>
        <div className="rx-eyebrow">RIVAL X MATCH HUB</div>
        <h1 className="rx-display" style={{ fontSize: 42, marginBottom: 12 }}>Your next match lives here.</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Log in to see your rooms, opponents, live match status, and result history.
        </p>
        <Link to="/login" className="rx-btn" style={{ marginTop: 18 }}>Log in to Match Hub</Link>
      </div>
    );
  }

  return (
    <div className="rx-container rx-match-hub" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <div className="rx-eyebrow">RIVAL X MATCH HUB</div>
          <h1 className="rx-display" style={{ fontSize: 44, margin: "0 0 8px" }}>PLAY.</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No refreshing. No guessing. Your next opponent appears here.
          </p>
        </div>
        <Link to="/tournaments" className="rx-btn-outline">Find a tournament</Link>
      </div>

      {message && <div className="rx-hub-message">{message}</div>}
      {error && <div className="rx-hub-error">{error}</div>}

      {currentRoom ? (
        <section className="rx-hub-hero rx-clip">
          <div className="rx-hub-hero-top">
            <div>
              <div className="rx-hub-kicker">{currentRoom.tournament?.name || "Tournament Match"}</div>
              <div className="rx-hub-round">{currentRoom.round}</div>
            </div>
            <span className={`rx-hub-status rx-hub-status-${currentRoom.status}`}>{statusLabel(currentRoom.status)}</span>
          </div>

          <div className="rx-hub-versus">
            <div className="rx-hub-player">
              <div className="rx-hub-avatar">
                {currentRoom.player1?.avatar_url ? <img src={currentRoom.player1.avatar_url} alt="" /> : (currentRoom.player1?.tag?.[0] || "1").toUpperCase()}
              </div>
              <div className="rx-hub-name">{currentRoom.player1?.tag || "Player"} <VerificationBadge badge={currentRoom.player1?.verification_badge} /></div>
              <div className="rx-hub-side">{currentRoom.player1_id === user.id ? "YOU" : "PLAYER 1"}</div>
            </div>

            <div className="rx-hub-vs">VS</div>

            <div className="rx-hub-player">
              <div className="rx-hub-avatar">
                {currentRoom.player2?.avatar_url ? <img src={currentRoom.player2.avatar_url} alt="" /> : (currentRoom.player2?.tag?.[0] || "2").toUpperCase()}
              </div>
              <div className="rx-hub-name">{currentRoom.player2?.tag || "Opponent"} <VerificationBadge badge={currentRoom.player2?.verification_badge} /></div>
              <div className="rx-hub-side">{currentRoom.player2_id === user.id ? "YOU" : "OPPONENT"}</div>
            </div>
          </div>

          {currentRoom.status === "ready" && (
            <div className="rx-hub-action">
              <button className="rx-btn" type="button" onClick={() => handleStart(currentRoom)} disabled={starting === currentRoom.id}>
                {starting === currentRoom.id ? "Starting…" : "START MATCH →"}
              </button>
              <span>Both players are in the room. Start when you’re ready.</span>
            </div>
          )}

          {["live", "result_pending", "disputed"].includes(currentRoom.status) && (
            <div className="rx-hub-scorebox">
              <div>
                <div className="rx-hub-score-title">FINAL SCORE</div>
                <div className="rx-hub-score-grid">
                  <label>
                    <span>{currentRoom.player1?.tag || "Player 1"}</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      value={scoreDrafts[currentRoom.id]?.player1 || ""}
                      onChange={(e) => setScoreDrafts((prev) => ({ ...prev, [currentRoom.id]: { ...(prev[currentRoom.id] || {}), player1: scoreValue(e.target.value) } }))}
                    />
                  </label>
                  <span className="rx-hub-dash">—</span>
                  <label>
                    <span>{currentRoom.player2?.tag || "Player 2"}</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      value={scoreDrafts[currentRoom.id]?.player2 || ""}
                      onChange={(e) => setScoreDrafts((prev) => ({ ...prev, [currentRoom.id]: { ...(prev[currentRoom.id] || {}), player2: scoreValue(e.target.value) } }))}
                    />
                  </label>
                </div>
                <button className="rx-btn" type="button" style={{ marginTop: 14 }} onClick={() => handleSubmit(currentRoom)} disabled={submitting === currentRoom.id}>
                  {submitting === currentRoom.id ? "Saving result…" : "SUBMIT FINAL SCORE"}
                </button>
              </div>
              <p>
                Both players submit the same final score. Rival X only records the result when both reports agree.
              </p>
            </div>
          )}

          {currentRoom.status === "completed" && <div className="rx-hub-complete">✓ Match completed. See your history below.</div>}
          {currentRoom.status === "disputed" && <div className="rx-hub-dispute">⚠ {currentRoom.dispute_reason || "Admin review required."}</div>}
        </section>
      ) : (
        <section className="rx-hub-empty rx-clip">
          <div className="rx-eyebrow">NO ACTIVE MATCH</div>
          <h2 className="rx-display">You’re clear.</h2>
          <p>Join an open tournament and watch this page for your next room.</p>
          <Link to="/tournaments" className="rx-btn-outline">Browse tournaments</Link>
        </section>
      )}

      <section style={{ marginTop: 34 }}>
        <div className="rx-list-heading">
          <div>
            <div className="rx-eyebrow">RESULTS</div>
            <h2>Match history</h2>
          </div>
        </div>
        {historyRooms.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historyRooms.map((room) => (
              <div key={room.id} className="rx-hub-history rx-clip-sm">
                <div>
                  <strong>{room.player1?.tag || "Player"} <VerificationBadge badge={room.player1?.verification_badge} /> vs {room.player2?.tag || "Opponent"} <VerificationBadge badge={room.player2?.verification_badge} /></strong>
                  <span>{room.tournament?.name || "Tournament"} · {room.round}</span>
                </div>
                <div className="rx-hub-history-score">
                  {room.player1_score ?? "—"} — {room.player2_score ?? "—"}
                  <small>{statusLabel(room.status)}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Your completed matches will appear here.</p>
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <div className="rx-list-heading">
          <div>
            <div className="rx-eyebrow">OPEN COMPETITION</div>
            <h2>Jump into a tournament</h2>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tournaments.slice(0, 4).map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="rx-hub-tournament rx-clip-sm">
              <div>
                <strong>{t.name}</strong>
                <span>{t.game} · {t.slotsFilled}/{t.slots} players · {t.entry_fee === 0 ? "FREE" : `₦${Number(t.entry_fee).toLocaleString()}`}</span>
              </div>
              <span>JOIN →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
