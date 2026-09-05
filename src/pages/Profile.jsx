import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PlaceholderImage from "../components/PlaceholderImage.jsx";
import { supabase, ensurePlayerRow } from "../lib/supabase.js";
import { fetchPlayerStats } from "../lib/tournaments.js";

const emptyStats = [
  { label: "Matches", value: "0" },
  { label: "Wins", value: "0" },
  { label: "Win rate", value: "0%" },
  { label: "Tournaments", value: "0" },
];

export default function Profile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("Player");
  const [avatar, setAvatar] = useState(null);
  const [squadPhoto, setSquadPhoto] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [message, setMessage] = useState(null);
  const [profileStats, setProfileStats] = useState(emptyStats);
  const [profileMatches, setProfileMatches] = useState([]);
  const [winStreak, setWinStreak] = useState(0);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        const currentUser = data.user;
        setUser(currentUser);

        // Determine if we're viewing our own profile or someone else's
        const targetId = id || currentUser?.id;
        const isOwn = !id || (currentUser && id === currentUser.id);
        setIsOwnProfile(isOwn);

        if (isOwn) {
          setUsername(currentUser?.user_metadata?.username || currentUser?.email?.split("@")[0] || "Player");
          setAvatar(currentUser ? localStorage.getItem(`rivalx_avatar_${currentUser.id}`) : null);
          setSquadPhoto(currentUser ? localStorage.getItem(`rivalx_squad_${currentUser.id}`) : null);

          if (currentUser) {
            await ensurePlayerRow(currentUser);
            const { stats, matches, winStreak: streak, player } = await fetchPlayerStats(currentUser.id);
            setProfileStats(stats);
            setProfileMatches(matches);
            setWinStreak(streak || 0);
            if (player?.squad_photo_url) setSquadPhoto(player.squad_photo_url);
          }
        } else {
          // Viewing another player's profile
          const { data: playerRow } = await supabase
            .from("players")
            .select("id, tag, avatar_url, squad_photo_url, win_streak, created_at")
            .eq("id", targetId)
            .single();
          if (playerRow) {
            setViewingUser(playerRow);
            setUsername(playerRow.tag || "Player");
            setAvatar(playerRow.avatar_url || null);
            setSquadPhoto(playerRow.squad_photo_url || null);
            setWinStreak(playerRow.win_streak || 0);
            const { stats, matches } = await fetchPlayerStats(targetId);
            setProfileStats(stats);
            setProfileMatches(matches);
          }
        }
      } else {
        const demoSession = JSON.parse(localStorage.getItem("rivalx_demo_session") || "null");
        setUser(demoSession);
        setUsername(localStorage.getItem("rivalx_username") || "Player");
        setAvatar(localStorage.getItem("rivalx_avatar") || null);
        setSquadPhoto(localStorage.getItem("rivalx_squad") || null);
      }
    }

    loadProfile();
  }, [id]);

  async function checkUsername(value) {
    const normalized = value.trim();
    if (!normalized || normalized.length < 3) {
      setAvailability(null);
      return;
    }
    if (normalized.toLowerCase() === username.toLowerCase()) {
      setAvailability("available");
      return;
    }
    if (supabase) {
      try {
        const { data } = await supabase
          .from("players")
          .select("id")
          .ilike("tag", normalized)
          .maybeSingle();
        setAvailability(data ? "taken" : "available");
      } catch {
        setAvailability(null);
      }
    } else {
      setAvailability("available");
    }
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  }

  function handleSquadPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSquadPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (availability === "taken") return;

    try {
      if (supabase && user) {
        const { error } = await supabase.auth.updateUser({
          data: { username: username.trim() },
        });
        if (error) throw error;
        if (avatar) localStorage.setItem(`rivalx_avatar_${user.id}`, avatar);
        if (squadPhoto) localStorage.setItem(`rivalx_squad_${user.id}`, squadPhoto);

        // Also update the players table
        const updates = { tag: username.trim() };
        if (avatar && avatar.startsWith("data:")) updates.avatar_url = avatar;
        if (squadPhoto && squadPhoto.startsWith("data:")) updates.squad_photo_url = squadPhoto;
        await supabase.from("players").update(updates).eq("id", user.id);
      } else {
        localStorage.setItem("rivalx_username", username.trim());
        if (avatar) localStorage.setItem("rivalx_avatar", avatar);
        if (squadPhoto) localStorage.setItem("rivalx_squad", squadPhoto);
      }
      setMessage("Profile updated.");
      setSettingsOpen(false);
    } catch (error) {
      setMessage(error.message || "Unable to update your profile.");
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="rx-container rx-profile-hero" style={{ padding: "56px 24px 40px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div className="rx-profile-avatar" style={{ width: 96, flexShrink: 0 }}>
            {avatar ? <img src={avatar} alt="Profile avatar" /> : <PlaceholderImage height={96} src="/images/icon.png" alt="Player avatar" />}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
              {isOwnProfile ? "Player profile" : "Player profile"}
            </div>
            <h1
              className="rx-display"
              style={{
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1,
                margin: 0,
                background: "linear-gradient(135deg, var(--silver-bright), #9ca0a6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {username}
            </h1>
            {winStreak > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#4ade80", fontWeight: 600 }}>
                🔥 {winStreak} win streak
              </div>
            )}
            {isOwnProfile ? (
              <button type="button" className="rx-btn-outline rx-settings-button" onClick={() => setSettingsOpen((open) => !open)}>
                Profile settings
              </button>
            ) : (
              <Link to="/leaderboard" className="rx-btn-outline rx-settings-button" style={{ display: "inline-block" }}>
                ← Back to leaderboard
              </Link>
            )}
          </div>
        </div>

        {isOwnProfile && settingsOpen && (
          <form className="rx-profile-settings" onSubmit={saveSettings}>
            <div>
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                value={username}
                onChange={(event) => { setUsername(event.target.value); checkUsername(event.target.value); }}
                minLength={3}
                maxLength={24}
                required
              />
              {availability === "available" && <small className="rx-available">✓ Username available</small>}
              {availability === "taken" && <small className="rx-unavailable">✕ Username already taken</small>}
            </div>
            <div>
              <label htmlFor="profile-avatar">Profile picture</label>
              <label className="rx-avatar-upload" htmlFor="profile-avatar">
                <span aria-hidden="true">Camera + Choose an image</span>
                <input id="profile-avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <label htmlFor="profile-squad">eFootball Squad Photo *</label>
              <label className="rx-avatar-upload" htmlFor="profile-squad">
                <span aria-hidden="true">📷 Upload your squad photo (required for tournaments)</span>
                <input id="profile-squad" type="file" accept="image/*" onChange={handleSquadPhotoChange} />
              </label>
              {!squadPhoto && (
                <small style={{ display: "block", marginTop: 6, fontSize: 11, color: "#facc15" }}>
                  ⚠️ Required — you can't apply for tournaments without a squad photo.
                </small>
              )}
            </div>
            <button type="submit" className="rx-btn" disabled={availability === "taken"}>Save changes</button>
          </form>
        )}
        {message && <p className="rx-profile-message">{message}</p>}
      </div>

      {/* Squad photo display */}
      {squadPhoto && (
        <div className="rx-container" style={{ padding: "24px 24px 0" }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", padding: 16 }} className="rx-clip">
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              eFootball Squad
            </div>
            <img src={squadPhoto} alt="eFootball squad" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* Stat strip */}
      <div className="rx-container" style={{ padding: 0 }}>
        <div className="rx-profile-stats" style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {profileStats.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                padding: "24px 20px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div className="rx-display" style={{ fontSize: 28, fontWeight: 700 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Match history */}
      <div className="rx-container rx-match-history" style={{ padding: "40px 24px", maxWidth: 640 }}>
        <h2 className="rx-display" style={{ fontSize: 20, fontWeight: 600, margin: "0 0 16px" }}>
          Recent matches
        </h2>
        {profileMatches.length ? profileMatches.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 0",
              borderTop: "1px solid var(--panel-2)",
            }}
          >
            <div
              className="rx-display"
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: m.result === "W" ? "#0a0a0c" : "var(--silver-bright)",
                background: m.result === "W" ? "var(--red)" : "var(--panel-2)",
                flexShrink: 0,
              }}
            >
              {m.result}
            </div>
            <div style={{ flex: 1, fontSize: 14, color: "var(--silver)" }}>vs {m.opp}</div>
            <div className="rx-display" style={{ fontSize: 16, fontWeight: 600 }}>
              {m.score}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", width: 48, textAlign: "right" }}>
              {m.date}
            </div>
          </div>
        )) : (
          <p className="rx-empty-matches">No matches played yet.</p>
        )}
      </div>
    </div>
  );
}