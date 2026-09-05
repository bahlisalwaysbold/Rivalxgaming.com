import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isAdmin, ADMIN_USER_ID, ADMIN_EMAIL } from "../lib/supabase.js";
import {
  createTournament,
  fetchTournaments,
  deleteTournament,
  updateTournament,
  fetchTournamentEntries,
  updateEntryApplication,
  createMatch,
  fetchTournamentMatches,
  createMvpMoment,
  deleteMvpMoment,
  fetchMvpMoments,
} from "../lib/tournaments.js";

const BANNER_PRESETS = [
  { label: "Stadium Arena", url: "/images/3.jpg" },
  { label: "Ruud Gullit Legend", url: "/images/gulit.jpg" },
  { label: "Matchday Clash", url: "/images/1.jpg" },
  { label: "Night Pitch", url: "/images/2.jpg" },
];

const blankForm = {
  name: "",
  game: "eFootball",
  platform: "eFootball Mobile",
  format: "1v1 Single Elimination Knockout",
  entry_fee: "2000",
  slots: "32",
  start_date: new Date().toISOString().split("T")[0],
  start_time: "18:00 WAT",
  registration_deadline: "",
  registration_start: "",
  tournament_days: "1",
  status: "open",
  prizePoolTotal: "50000",
  firstPrize: "₦35,000",
  secondPrize: "₦15,000",
  thirdPrize: "",
  matchDuration: "10 mins",
  extraTime: "ON",
  penalties: "ON",
  squadType: "Dream Team (Max Rating 3100)",
  connectionReq: "Stable 4G / Wi-Fi (Min 3-4 bars)",
  gracePeriod: "15 minutes",
  rulesText:
    "Single elimination knockout. Both players must capture final match score screenshot. Winner submits score to tournament admin lobby within 15 minutes of match completion.",
  bannerUrl: "/images/3.jpg",
};

const blankMatch = {
  tournament_id: "",
  player_id: "",
  player2_id: "",
  opponent_tag: "",
  result: "W",
  score: "",
  round: "Round of 32",
  stage: "Round of 32",
  winner_id: "",
  eliminated_id: "",
};

const blankMvp = {
  player_id: "",
  title: "",
  description: "",
  media_url: "",
  media_type: "video",
  tournament_id: "",
};

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [activeTab, setActiveTab] = useState("create");

  // Match posting state
  const [matchForm, setMatchForm] = useState(blankMatch);
  const [postingMatch, setPostingMatch] = useState(false);
  const [matchMessage, setMatchMessage] = useState(null);
  const [matchError, setMatchError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedTournamentEntries, setSelectedTournamentEntries] = useState([]);
  const [tournamentMatches, setTournamentMatches] = useState([]);

  // Application management state
  const [entriesByTournament, setEntriesByTournament] = useState({});
  const [updatingEntry, setUpdatingEntry] = useState(null);

  // MVP state
  const [mvpForm, setMvpForm] = useState(blankMvp);
  const [mvpMoments, setMvpMoments] = useState([]);
  const [postingMvp, setPostingMvp] = useState(false);
  const [mvpMessage, setMvpMessage] = useState(null);
  const [mvpError, setMvpError] = useState(null);

  useEffect(() => {
    async function check() {
      let user = null;
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
      }
      setCurrentUser(user);
      setAuthorized(isAdmin(user));
      setChecking(false);
    }
    check();
  }, []);

  const loadTournaments = async () => {
    try {
      const data = await fetchTournaments();
      setTournaments(data);
    } catch {
      setTournaments([]);
    }
  };

  const loadAllPlayers = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from("players").select("id, tag, avatar_url");
      setPlayers(data || []);
    } catch {
      setPlayers([]);
    }
  };

  const loadMvpMoments = async () => {
    try {
      const data = await fetchMvpMoments();
      setMvpMoments(data);
    } catch {
      setMvpMoments([]);
    }
  };

  useEffect(() => {
    if (authorized) {
      loadTournaments();
      loadAllPlayers();
      loadMvpMoments();
    }
  }, [authorized]);

  // Load entries for all tournaments when tournaments change
  useEffect(() => {
    if (!authorized || !tournaments.length) return;
    async function loadAllEntries() {
      const entriesMap = {};
      for (const t of tournaments) {
        try {
          const entries = await fetchTournamentEntries(t.id);
          entriesMap[t.id] = entries;
        } catch {
          entriesMap[t.id] = [];
        }
      }
      setEntriesByTournament(entriesMap);
    }
    loadAllEntries();
  }, [authorized, tournaments]);

  // When match tournament changes, load its entries and matches
  useEffect(() => {
    if (!matchForm.tournament_id) {
      setSelectedTournamentEntries([]);
      setTournamentMatches([]);
      return;
    }
    async function loadForMatch() {
      try {
        const entries = await fetchTournamentEntries(matchForm.tournament_id);
        setSelectedTournamentEntries(entries);
        const matches = await fetchTournamentMatches(matchForm.tournament_id);
        setTournamentMatches(matches);
      } catch {
        setSelectedTournamentEntries([]);
        setTournamentMatches([]);
      }
    }
    loadForMatch();
  }, [matchForm.tournament_id]);

  function updateField(field, value) {
    setForm((f) => {
      const updated = { ...f, [field]: value };
      if (field === "entry_fee" || field === "slots") {
        const fee = Number(field === "entry_fee" ? value : updated.entry_fee) || 0;
        const slots = Number(field === "slots" ? value : updated.slots) || 0;
        if (fee && slots) {
          const total = Math.round(fee * slots * 0.8);
          updated.prizePoolTotal = String(total);
          updated.firstPrize = `₦${Math.round(total * 0.7).toLocaleString()}`;
          updated.secondPrize = `₦${Math.round(total * 0.3).toLocaleString()}`;
        }
      }
      return updated;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      const created = await createTournament(form);
      setTournaments((prev) => [created, ...prev]);
      setMessage(`Tournament "${form.name}" posted successfully! Live on site.`);
      setForm((f) => ({ ...f, name: "" }));
    } catch (err) {
      setErrorMsg(err.message || "Failed to post tournament to Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete tournament "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteTournament(id);
      setTournaments((prev) => prev.filter((t) => t.id !== id));
      setMessage(`Tournament "${name}" deleted.`);
    } catch (err) {
      setErrorMsg(err.message || "Could not delete tournament.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleStatusChange(t, newStatus) {
    try {
      await updateTournament(t.id, { status: newStatus });
      setMessage(`Tournament "${t.name}" status changed to ${newStatus}.`);
      loadTournaments();
    } catch (err) {
      setErrorMsg(err.message || "Could not update tournament status.");
    }
  }

  // ── Match posting ──────────────────────────────────────────
  function updateMatchField(field, value) {
    setMatchForm((f) => {
      const updated = { ...f, [field]: value };
      // Auto-fill winner/eliminated based on result
      if (field === "player_id" && value) {
        const player = players.find((p) => p.id === value);
        if (player) updated.opponent_tag = player.tag;
      }
      if (field === "player2_id" && value) {
        const player = players.find((p) => p.id === value);
        if (player) updated.opponent_tag = player.tag;
      }
      if (field === "result" && updated.player_id && updated.player2_id) {
        if (value === "W") {
          updated.winner_id = updated.player_id;
          updated.eliminated_id = updated.player2_id;
        } else {
          updated.winner_id = updated.player2_id;
          updated.eliminated_id = updated.player_id;
        }
      }
      return updated;
    });
  }

  async function handlePostMatch(e) {
    e.preventDefault();
    setPostingMatch(true);
    setMatchMessage(null);
    setMatchError(null);

    try {
      if (!matchForm.tournament_id) throw new Error("Select a tournament.");
      if (!matchForm.player_id || !matchForm.player2_id) throw new Error("Select both players.");
      if (!matchForm.score) throw new Error("Enter the final score.");

      const matchData = {
        tournament_id: matchForm.tournament_id,
        player_id: matchForm.player_id,
        player2_id: matchForm.player2_id,
        opponent_tag: matchForm.opponent_tag,
        result: matchForm.result,
        score: matchForm.score,
        round: matchForm.round,
        stage: matchForm.stage,
        winner_id: matchForm.winner_id,
        eliminated_id: matchForm.eliminated_id,
      };

      await createMatch(matchData);
      setMatchMessage("Match result posted successfully! It's now live on the site.");
      setMatchForm((f) => ({ ...f, score: "", result: "W", winner_id: "", eliminated_id: "" }));
      // Reload matches for this tournament
      const matches = await fetchTournamentMatches(matchForm.tournament_id);
      setTournamentMatches(matches);
    } catch (err) {
      setMatchError(err.message || "Failed to post match result.");
    } finally {
      setPostingMatch(false);
    }
  }

  // ── Application management ─────────────────────────────────
  async function handleApplication(entryId, status) {
    setUpdatingEntry(entryId);
    try {
      await updateEntryApplication(entryId, status);
      setMessage(`Application ${status === "confirmed" ? "confirmed" : "rejected"}.`);
      // Refresh entries
      const entriesMap = {};
      for (const t of tournaments) {
        try {
          const entries = await fetchTournamentEntries(t.id);
          entriesMap[t.id] = entries;
        } catch {
          entriesMap[t.id] = [];
        }
      }
      setEntriesByTournament(entriesMap);
    } catch (err) {
      setErrorMsg(err.message || "Could not update application.");
    } finally {
      setUpdatingEntry(null);
    }
  }

  // ── MVP moments ────────────────────────────────────────────
  function updateMvpField(field, value) {
    setMvpForm((f) => ({ ...f, [field]: value }));
  }

  async function handlePostMvp(e) {
    e.preventDefault();
    setPostingMvp(true);
    setMvpMessage(null);
    setMvpError(null);

    try {
      if (!mvpForm.player_id) throw new Error("Select the player for this MVP moment.");
      if (!mvpForm.title) throw new Error("Enter a title for the MVP moment.");
      if (!mvpForm.media_url) throw new Error("Enter the media URL (video/image/link).");

      const payload = {
        player_id: mvpForm.player_id,
        title: mvpForm.title,
        description: mvpForm.description,
        media_url: mvpForm.media_url,
        media_type: mvpForm.media_type,
        tournament_id: mvpForm.tournament_id || null,
        created_by: currentUser?.id,
      };

      await createMvpMoment(payload);
      setMvpMessage("MVP moment posted successfully!");
      setMvpForm(blankMvp);
      loadMvpMoments();
    } catch (err) {
      setMvpError(err.message || "Failed to post MVP moment.");
    } finally {
      setPostingMvp(false);
    }
  }

  async function handleDeleteMvp(id) {
    if (!window.confirm("Delete this MVP moment?")) return;
    try {
      await deleteMvpMoment(id);
      setMvpMessage("MVP moment deleted.");
      loadMvpMoments();
    } catch (err) {
      setMvpError(err.message || "Could not delete MVP moment.");
    }
  }

  if (checking) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px" }}>
        <p style={{ color: "var(--muted)" }}>Verifying administrator credentials…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px", maxWidth: 540 }}>
        <div className="rx-eyebrow">RIVAL X SECURITY</div>
        <h1 className="rx-display" style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 16px" }}>
          Admin Authentication Required
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          Only the Rival X administrator can add, remove, and state tournament conditions. Please log in with your administrator account to continue.
        </p>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <Link to="/login" className="rx-btn">
            Log in to Admin Account
          </Link>
          <Link to="/" className="rx-btn-outline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="rx-container" style={{ padding: "56px 24px", maxWidth: 640 }}>
        <div className="rx-eyebrow" style={{ color: "var(--red)" }}>ACCESS RESTRICTED</div>
        <h1 className="rx-display" style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 16px" }}>
          Unauthorized Account
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          You are currently logged in as <strong style={{ color: "var(--silver-bright)" }}>{currentUser.email}</strong> (User ID: <code style={{ color: "var(--red)" }}>{currentUser.id}</code>).
        </p>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          This account is not designated as the sole administrator. Only the authorized administrator account can create, delete, or manage tournaments on the live database.
        </p>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            padding: 20,
            marginTop: 20,
          }}
          className="rx-clip"
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--silver-bright)", marginBottom: 8 }}>
            Setting This Account as Sole Administrator:
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            If <strong style={{ color: "var(--silver)" }}>{currentUser.email}</strong> is your admin account, set your user ID in your environment variables:
          </p>
          <pre
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              padding: 12,
              fontSize: 12,
              color: "var(--silver-bright)",
              marginTop: 10,
              overflowX: "auto",
            }}
          >
            VITE_ADMIN_USER_ID={currentUser.id}{"\n"}
            VITE_ADMIN_EMAIL={currentUser.email}
          </pre>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <Link to="/login" className="rx-btn-outline">
            Switch Account
          </Link>
          <Link to="/" className="rx-btn">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "create", label: "Create Tournament" },
    { id: "matches", label: "Post Match" },
    { id: "applications", label: "Applications" },
    { id: "mvp", label: "MVP Moments" },
    { id: "manage", label: "Manage Tournaments" },
  ];

  return (
    <div className="rx-container" style={{ padding: "48px 24px", maxWidth: 960 }}>
      {/* Header & Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
          paddingBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="rx-eyebrow" style={{ color: "var(--red)" }}>
            ● ADMIN PORTAL (LIVE DATABASE)
          </div>
          <h1 className="rx-display" style={{ fontSize: 36, fontWeight: 700, margin: "6px 0 0" }}>
            Rival X Admin Control Center
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Create tournaments, post match results, confirm applications, and share MVP moments.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--silver)", background: "var(--panel-2)", padding: "6px 12px", border: "1px solid var(--border)" }} className="rx-clip-sm">
            Administrator: <strong>{currentUser.email}</strong>
          </span>
          <Link to="/profile" className="rx-btn-outline" style={{ fontSize: 12, padding: "8px 14px" }}>
            Profile
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="rx-clip-sm"
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "Rajdhani, sans-serif",
              letterSpacing: "0.03em",
              border: activeTab === tab.id ? "1px solid var(--red)" : "1px solid var(--border)",
              background: activeTab === tab.id ? "rgba(216, 30, 39, 0.15)" : "var(--panel)",
              color: activeTab === tab.id ? "var(--red)" : "var(--silver)",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          style={{
            background: "rgba(216, 30, 39, 0.15)",
            border: "1px solid var(--red)",
            color: "var(--silver-bright)",
            padding: "14px 18px",
            marginBottom: 24,
            fontSize: 14,
          }}
          className="rx-clip"
        >
          ✓ {message}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: "rgba(255, 60, 60, 0.2)",
            border: "1px solid #ff4444",
            color: "#ff8888",
            padding: "14px 18px",
            marginBottom: 24,
            fontSize: 14,
          }}
          className="rx-clip"
        >
          ✕ {errorMsg}
        </div>
      )}

      {/* ── TAB: CREATE TOURNAMENT ─────────────────────────── */}
      {activeTab === "create" && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* SECTION 1: Basic Information */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              1. Tournament Identification
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label>Tournament Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. Rival X Lagos eFootball Super Cup"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label>Game</label>
                  <input
                    value={form.game}
                    onChange={(e) => updateField("game", e.target.value)}
                    placeholder="eFootball"
                    required
                  />
                </div>

                <div>
                  <label>Platform *</label>
                  <select
                    value={form.platform}
                    onChange={(e) => updateField("platform", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="eFootball Mobile">eFootball Mobile (iOS / Android)</option>
                    <option value="PlayStation 5">PlayStation 5</option>
                    <option value="PlayStation 4">PlayStation 4</option>
                    <option value="PC (Steam)">PC (Steam)</option>
                    <option value="Cross-Platform">Cross-Platform</option>
                  </select>
                </div>

                <div>
                  <label>Tournament Format *</label>
                  <select
                    value={form.format}
                    onChange={(e) => updateField("format", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="1v1 Single Elimination Knockout">1v1 Single Elimination Knockout</option>
                    <option value="1v1 Double Elimination">1v1 Double Elimination</option>
                    <option value="Group Stage + Knockout">Group Stage (Round Robin) + Knockout</option>
                    <option value="Best of 3 Series">Best of 3 Knockout</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Slots, Schedule, Registration Timing & Entry Fee */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              2. Slots, Registration Timing, Schedule & Entry Fee
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label>Total Slots * (2–64)</label>
                <input
                  type="number"
                  min="2"
                  max="64"
                  value={form.slots}
                  onChange={(e) => updateField("slots", e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Entry Fee (₦) *</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={form.entry_fee}
                  onChange={(e) => updateField("entry_fee", e.target.value)}
                  placeholder="2000"
                  required
                />
              </div>

              <div>
                <label>Start Date *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => updateField("start_date", e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Kick-off Time</label>
                <input
                  type="text"
                  value={form.start_time}
                  onChange={(e) => updateField("start_time", e.target.value)}
                  placeholder="18:00 WAT"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label>Registration Opens (Date & Time)</label>
                <input
                  type="datetime-local"
                  value={form.registration_start}
                  onChange={(e) => updateField("registration_start", e.target.value)}
                />
              </div>

              <div>
                <label>Registration Deadline (Date & Time) *</label>
                <input
                  type="datetime-local"
                  value={form.registration_deadline}
                  onChange={(e) => updateField("registration_deadline", e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Tournament Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={form.tournament_days}
                  onChange={(e) => updateField("tournament_days", e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label>Tournament Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
              >
                <option value="open">Open (Registration Open)</option>
                <option value="live">Live (Tournament In Progress)</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* SECTION 3: Prize Pool Breakdown */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              3. Prize Pool Breakdown
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label>Total Prize Pool (₦)</label>
                <input type="number" value={form.prizePoolTotal} onChange={(e) => updateField("prizePoolTotal", e.target.value)} placeholder="50000" />
              </div>
              <div>
                <label>1st Place (Winner)</label>
                <input type="text" value={form.firstPrize} onChange={(e) => updateField("firstPrize", e.target.value)} placeholder="₦35,000 + Trophy" />
              </div>
              <div>
                <label>2nd Place (Runner-up)</label>
                <input type="text" value={form.secondPrize} onChange={(e) => updateField("secondPrize", e.target.value)} placeholder="₦15,000" />
              </div>
              <div>
                <label>3rd Place (Optional)</label>
                <input type="text" value={form.thirdPrize} onChange={(e) => updateField("thirdPrize", e.target.value)} placeholder="₦5,000" />
              </div>
            </div>
          </div>

          {/* SECTION 4: Match Conditions & In-Game Regulations */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              4. Match Conditions & Gameplay Rules
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label>Match Duration</label>
                <input type="text" value={form.matchDuration} onChange={(e) => updateField("matchDuration", e.target.value)} placeholder="10 mins" />
              </div>
              <div>
                <label>Extra Time</label>
                <select value={form.extraTime} onChange={(e) => updateField("extraTime", e.target.value)} style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit" }}>
                  <option value="ON">ON (Active)</option>
                  <option value="OFF">OFF</option>
                </select>
              </div>
              <div>
                <label>Penalties (PK)</label>
                <select value={form.penalties} onChange={(e) => updateField("penalties", e.target.value)} style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit" }}>
                  <option value="ON">ON (Active)</option>
                  <option value="OFF">OFF</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label>Squad Restrictions</label>
                <input type="text" value={form.squadType} onChange={(e) => updateField("squadType", e.target.value)} placeholder="Dream Team (Max 3100) or Authentic Team" />
              </div>
              <div>
                <label>Network / Connection</label>
                <input type="text" value={form.connectionReq} onChange={(e) => updateField("connectionReq", e.target.value)} placeholder="Stable 4G / Wi-Fi (Min 3-4 bars)" />
              </div>
              <div>
                <label>Walkover Grace Period</label>
                <input type="text" value={form.gracePeriod} onChange={(e) => updateField("gracePeriod", e.target.value)} placeholder="15 minutes" />
              </div>
            </div>

            <div>
              <label>General Rules & Dispute / Verification Guidelines</label>
              <textarea
                rows={4}
                value={form.rulesText}
                onChange={(e) => updateField("rulesText", e.target.value)}
                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: 12, fontFamily: "inherit", fontSize: 14, resize: "vertical" }}
                required
              />
            </div>
          </div>

          {/* SECTION 5: Banner Artwork Preset */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              5. Tournament Banner Artwork
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
              {BANNER_PRESETS.map((p) => {
                const selected = form.bannerUrl === p.url;
                return (
                  <div
                    key={p.url}
                    onClick={() => updateField("bannerUrl", p.url)}
                    className="rx-clip"
                    style={{ cursor: "pointer", border: selected ? "2px solid var(--red)" : "1px solid var(--border)", background: "var(--bg)", overflow: "hidden", position: "relative" }}
                  >
                    <img src={p.url} alt={p.label} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 600, color: selected ? "var(--red)" : "var(--silver)", textAlign: "center" }}>
                      {p.label} {selected && "✓"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label>Or Custom Banner Image URL</label>
              <input type="text" value={form.bannerUrl} onChange={(e) => updateField("bannerUrl", e.target.value)} placeholder="/images/3.jpg or https://..." />
            </div>
          </div>

          <button type="submit" className="rx-btn" disabled={saving} style={{ padding: "16px 24px", fontSize: 16, fontWeight: 700 }}>
            {saving ? "Posting tournament to Supabase…" : "Publish Tournament to Live Site"}
          </button>
        </form>
      )}

      {/* ── TAB: POST MATCH ─────────────────────────────────── */}
      {activeTab === "matches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px" }}>
              Post Match Result
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
              Select a tournament, choose the two players, enter the score, and the result will be live on the site immediately.
            </p>

            {matchMessage && (
              <div style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#4ade80", padding: "12px 16px", marginBottom: 16, fontSize: 13 }} className="rx-clip">
                ✓ {matchMessage}
              </div>
            )}
            {matchError && (
              <div style={{ background: "rgba(255, 60, 60, 0.2)", border: "1px solid #ff4444", color: "#ff8888", padding: "12px 16px", marginBottom: 16, fontSize: 13 }} className="rx-clip">
                ✕ {matchError}
              </div>
            )}

            <form onSubmit={handlePostMatch} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label>Tournament *</label>
                  <select
                    value={matchForm.tournament_id}
                    onChange={(e) => updateMatchField("tournament_id", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="">Select tournament…</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Round / Stage *</label>
                  <select
                    value={matchForm.round}
                    onChange={(e) => updateMatchField("round", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                  >
                    <option value="Round of 64">Round of 64</option>
                    <option value="Round of 32">Round of 32</option>
                    <option value="Round of 16">Round of 16</option>
                    <option value="Quarter Finals">Quarter Finals</option>
                    <option value="Semi Finals">Semi Finals</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label>Player 1 (Home) *</label>
                  <select
                    value={matchForm.player_id}
                    onChange={(e) => updateMatchField("player_id", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="">Select player…</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.tag}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Player 2 (Away) *</label>
                  <select
                    value={matchForm.player2_id}
                    onChange={(e) => updateMatchField("player2_id", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="">Select player…</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label>Winner *</label>
                  <select
                    value={matchForm.result}
                    onChange={(e) => updateMatchField("result", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                  >
                    <option value="W">Player 1 Wins</option>
                    <option value="L">Player 2 Wins</option>
                  </select>
                </div>

                <div>
                  <label>Final Score *</label>
                  <input
                    type="text"
                    value={matchForm.score}
                    onChange={(e) => updateMatchField("score", e.target.value)}
                    placeholder="e.g. 3 – 1"
                    required
                  />
                </div>

                <div>
                  <label>Opponent Tag (auto)</label>
                  <input type="text" value={matchForm.opponent_tag} onChange={(e) => updateMatchField("opponent_tag", e.target.value)} placeholder="Auto-filled" />
                </div>
              </div>

              <button type="submit" className="rx-btn" disabled={postingMatch} style={{ padding: "14px 20px", fontSize: 15, fontWeight: 700 }}>
                {postingMatch ? "Posting match result…" : "Post Match Result to Live Site"}
              </button>
            </form>
          </div>

          {/* Recent matches for selected tournament */}
          {matchForm.tournament_id && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
              <h2 className="rx-display" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>
                Posted Matches for This Tournament ({tournamentMatches.length})
              </h2>
              {tournamentMatches.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tournamentMatches.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13 }}>
                      <span>{m.round || m.stage}: {m.opponent_tag || "Match"}</span>
                      <span style={{ fontWeight: 700 }}>{m.score}</span>
                      <span style={{ color: m.result === "W" ? "#4ade80" : "#ff6666" }}>{m.result === "W" ? "Player 1 Won" : "Player 2 Won"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No matches posted yet for this tournament.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: APPLICATIONS ───────────────────────────────── */}
      {activeTab === "applications" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
              Tournament Applications
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
              Review player applications. Confirm players who are eligible, or reject those who aren't. Applications stay "pending" until you decide.
            </p>

            {!tournaments.length ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No tournaments yet. Create one first.</p>
            ) : (
              tournaments.map((t) => {
                const entries = entriesByTournament[t.id] || [];
                const pending = entries.filter((e) => e.application_status === "pending");
                const confirmed = entries.filter((e) => e.application_status === "confirmed");
                const rejected = entries.filter((e) => e.application_status === "rejected");
                return (
                  <div key={t.id} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <div className="rx-display" style={{ fontSize: 17, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "#facc15" }}>{pending.length} pending</span>
                        <span style={{ color: "#4ade80" }}>{confirmed.length} confirmed</span>
                        <span style={{ color: "#ff6666" }}>{rejected.length} rejected</span>
                      </div>
                    </div>

                    {!entries.length ? (
                      <p style={{ color: "var(--muted)", fontSize: 12 }}>No applications yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {entries.map((entry) => (
                          <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontWeight: 700 }}>{entry.players?.tag || "Unknown"}</span>
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                {entry.payment_status === "paid" ? "Paid" : "Payment pending"}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                className="rx-clip-sm"
                                style={{
                                  padding: "3px 10px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: entry.application_status === "confirmed" ? "rgba(34,197,94,0.15)" : entry.application_status === "rejected" ? "rgba(255,60,60,0.15)" : "rgba(250,204,21,0.15)",
                                  color: entry.application_status === "confirmed" ? "#4ade80" : entry.application_status === "rejected" ? "#ff6666" : "#facc15",
                                  border: `1px solid ${entry.application_status === "confirmed" ? "#22c55e" : entry.application_status === "rejected" ? "#ff4444" : "#facc15"}`,
                                }}
                              >
                                {entry.application_status.toUpperCase()}
                              </span>
                              {entry.application_status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="rx-btn"
                                    style={{ fontSize: 11, padding: "6px 12px", background: "#14532d", border: "1px solid #22c55e", color: "#4ade80" }}
                                    onClick={() => handleApplication(entry.id, "confirmed")}
                                    disabled={updatingEntry === entry.id}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    className="rx-btn"
                                    style={{ fontSize: 11, padding: "6px 12px", background: "#2a1215", border: "1px solid var(--red)", color: "#ff6666" }}
                                    onClick={() => handleApplication(entry.id, "rejected")}
                                    disabled={updatingEntry === entry.id}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── TAB: MVP MOMENTS ────────────────────────────────── */}
      {activeTab === "mvp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
              Post MVP Moment
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
              Share a highlight moment (goal, save, skill) from any player. Other users can view it and tap through to the player's profile.
            </p>

            {mvpMessage && (
              <div style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#4ade80", padding: "12px 16px", marginBottom: 16, fontSize: 13 }} className="rx-clip">
                ✓ {mvpMessage}
              </div>
            )}
            {mvpError && (
              <div style={{ background: "rgba(255, 60, 60, 0.2)", border: "1px solid #ff4444", color: "#ff8888", padding: "12px 16px", marginBottom: 16, fontSize: 13 }} className="rx-clip">
                ✕ {mvpError}
              </div>
            )}

            <form onSubmit={handlePostMvp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label>Player *</label>
                  <select
                    value={mvpForm.player_id}
                    onChange={(e) => updateMvpField("player_id", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                    required
                  >
                    <option value="">Select player…</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.tag}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Media Type</label>
                  <select
                    value={mvpForm.media_type}
                    onChange={(e) => updateMvpField("media_type", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                  >
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Title *</label>
                <input
                  type="text"
                  value={mvpForm.title}
                  onChange={(e) => updateMvpField("title", e.target.value)}
                  placeholder="e.g. Stunning 30-yard screamer by Shadowstrike!"
                  required
                />
              </div>

              <div>
                <label>Description</label>
                <textarea
                  rows={3}
                  value={mvpForm.description}
                  onChange={(e) => updateMvpField("description", e.target.value)}
                  placeholder="Describe the moment…"
                  style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: 12, fontFamily: "inherit", fontSize: 14, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label>Media URL *</label>
                  <input
                    type="text"
                    value={mvpForm.media_url}
                    onChange={(e) => updateMvpField("media_url", e.target.value)}
                    placeholder="https://youtube.com/... or /images/..."
                    required
                  />
                </div>

                <div>
                  <label>Tournament (optional)</label>
                  <select
                    value={mvpForm.tournament_id}
                    onChange={(e) => updateMvpField("tournament_id", e.target.value)}
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "10px 12px", fontFamily: "inherit", fontSize: 14 }}
                  >
                    <option value="">None</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="rx-btn" disabled={postingMvp} style={{ padding: "14px 20px", fontSize: 15, fontWeight: 700 }}>
                {postingMvp ? "Posting MVP moment…" : "Post MVP Moment"}
              </button>
            </form>
          </div>

          {/* Existing MVP moments */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 24 }} className="rx-clip">
            <h2 className="rx-display" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>
              Posted MVP Moments ({mvpMoments.length})
            </h2>
            {mvpMoments.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {mvpMoments.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>{m.title}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>by {m.players?.tag || "Unknown"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <a href={m.media_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--red)" }}>View →</a>
                      <button
                        type="button"
                        className="rx-btn"
                        style={{ fontSize: 11, padding: "6px 12px", background: "#2a1215", border: "1px solid var(--red)", color: "#ff6666" }}
                        onClick={() => handleDeleteMvp(m.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No MVP moments posted yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: MANAGE TOURNAMENTS ─────────────────────────── */}
      {activeTab === "manage" && (
        <div style={{ marginTop: 0 }}>
          <h2 className="rx-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>
            Live Tournaments on Rival X ({tournaments.length})
          </h2>

          {!tournaments.length ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              No tournaments posted yet. Use the "Create Tournament" tab to publish your first tournament!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="rx-clip"
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <img src={t.bannerUrl || "/images/3.jpg"} alt="" style={{ width: 64, height: 48, objectFit: "cover" }} className="rx-clip" />
                    <div>
                      <div className="rx-display" style={{ fontSize: 18, fontWeight: 700 }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {t.platform} · {t.format} · Starts {t.start_date}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span
                          className="rx-clip-sm"
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            background: t.status === "live" ? "rgba(34,197,94,0.15)" : t.status === "completed" ? "rgba(148,163,184,0.15)" : "rgba(216,30,39,0.15)",
                            color: t.status === "live" ? "#4ade80" : t.status === "completed" ? "#94a3b8" : "var(--red)",
                            border: `1px solid ${t.status === "live" ? "#22c55e" : t.status === "completed" ? "#64748b" : "var(--red)"}`,
                          }}
                        >
                          {t.status?.toUpperCase() || "OPEN"}
                        </span>
                        {t.registration_deadline && (
                          <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                            Reg deadline: {new Date(t.registration_deadline).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right", marginRight: 8 }}>
                      <div className="rx-display" style={{ fontSize: 16, fontWeight: 700 }}>
                        ₦{t.entry_fee.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {t.slotsFilled}/{t.slots} slots filled
                      </div>
                    </div>

                    <select
                      value={t.status || "open"}
                      onChange={(e) => handleStatusChange(t, e.target.value)}
                      style={{ width: "auto", minWidth: 120, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--silver)", padding: "8px 10px", fontFamily: "inherit", fontSize: 12 }}
                    >
                      <option value="open">Open</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <Link to={`/tournaments/${t.id}`} className="rx-btn-outline" style={{ fontSize: 13, padding: "8px 14px" }}>
                      View Page
                    </Link>

                    <button
                      type="button"
                      className="rx-btn"
                      style={{ background: "#2a1215", border: "1px solid var(--red)", color: "#ff6666", fontSize: 13, padding: "8px 14px" }}
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deletingId === t.id}
                    >
                      {deletingId === t.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}