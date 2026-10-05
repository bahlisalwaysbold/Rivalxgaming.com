import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PlaceholderImage from "../components/PlaceholderImage.jsx";
import { supabase, ensurePlayerRow, deleteMyAccount } from "../lib/supabase.js";
import { fetchLeaderboard, fetchPlayerStats } from "../lib/tournaments.js";
import { getEffectiveVerification } from "../lib/verification.js";
import VerificationBadge from "../components/VerificationBadge.jsx";

import { fetchMyReferralStats, fetchReferralQualifiedPlayerIds } from "../lib/referrals.js";

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
  const [bannerPhoto, setBannerPhoto] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [message, setMessage] = useState(null);
  const [profileStats, setProfileStats] = useState(emptyStats);
  const [profileMatches, setProfileMatches] = useState([]);
  const [winStreak, setWinStreak] = useState(0);
  const [verificationBadge, setVerificationBadge] = useState("none");
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [profileRank, setProfileRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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
        setProfileRank(null);

        if (isOwn) {
          setUsername(currentUser?.user_metadata?.username || currentUser?.email?.split("@")[0] || "Player");
          setAvatar(currentUser ? localStorage.getItem(`rivalx_avatar_${currentUser.id}`) : null);
          setSquadPhoto(currentUser ? localStorage.getItem(`rivalx_squad_${currentUser.id}`) : null);
          setBannerPhoto(currentUser ? localStorage.getItem(`rivalx_banner_${currentUser.id}`) : null);

          if (currentUser) {
            await ensurePlayerRow(currentUser);
            const [{ stats, matches, winStreak: streak, player }, myReferralStats, leaderboardRows] = await Promise.all([
              fetchPlayerStats(currentUser.id),
              fetchMyReferralStats().catch(() => null),
              fetchLeaderboard().catch(() => []),
            ]);
            setProfileStats(stats);
            setProfileMatches(matches);
            setWinStreak(streak || 0);
            if (player?.squad_photo_url) setSquadPhoto(player.squad_photo_url);
            setReferralStats(myReferralStats);
            setProfileRank(leaderboardRows.find((row) => row.id === currentUser.id)?.rank || null);

            const { data: ownPlayerRow } = await supabase
              .from("players")
              .select("id, tag, avatar_url, squad_photo_url, win_streak, created_at, verification_badge, referral_code")

              .eq("id", currentUser.id)
              .maybeSingle();

            if (ownPlayerRow) {
              const [{ data: allPlayers }, { data: allMatches }, qualifiedIds] = await Promise.all([
                supabase.from("players").select("id, tag, avatar_url, created_at, verification_badge"),
                supabase.from("matches").select("id, player_id, player2_id, result, winner_id, eliminated_id, round, stage, played_at"),
                fetchReferralQualifiedPlayerIds().catch(() => []),
              ]);
              setVerificationBadge(
                getEffectiveVerification(
                  ownPlayerRow,
                  allPlayers || [],
                  allMatches || [],
                  new Date(),
                  (qualifiedIds || []).includes(currentUser.id)
                )
              );
            }
          }
        } else {
          // Viewing another player's profile
          const { data: playerRow } = await supabase
            .from("players")
            .select("id, tag, avatar_url, squad_photo_url, win_streak, created_at, verification_badge")
            .eq("id", targetId)
            .single();
          if (playerRow) {
            setViewingUser(playerRow);
            setUsername(playerRow.tag || "Player");
            setAvatar(playerRow.avatar_url || null);
            setSquadPhoto(playerRow.squad_photo_url || null);
            setWinStreak(playerRow.win_streak || 0);
            const [{ data: allPlayers }, { data: allMatches }, qualifiedIds] = await Promise.all([
              supabase.from("players").select("id, tag, avatar_url, created_at, verification_badge"),
              supabase.from("matches").select("id, player_id, player2_id, result, winner_id, eliminated_id, round, stage, played_at"),
              fetchReferralQualifiedPlayerIds().catch(() => []),
            ]);
            setVerificationBadge(
              getEffectiveVerification(
                playerRow,
                allPlayers || [],
                allMatches || [],
                new Date(),
                (qualifiedIds || []).includes(targetId)
              )
            );
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
        setBannerPhoto(localStorage.getItem("rivalx_banner") || null);
      }
    }

    loadProfile().finally(() => setLoading(false));
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

  function handleBannerChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBannerPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function copyReferralLink() {
    const code = referralStats?.referral_code;
    if (!code) return;
    const link = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setMessage("Referral link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(link);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you sure you want to delete your Rival X account? This cannot be undone.")) return;

    setDeletingAccount(true);
    setMessage(null);
    try {
      await deleteMyAccount();
      window.location.assign("/");
    } catch (error) {
      setMessage(error.message || "Unable to delete your account.");
      setDeletingAccount(false);
    }
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
        if (bannerPhoto) localStorage.setItem(`rivalx_banner_${user.id}`, bannerPhoto);

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

  const tier = verificationBadge === "gold" ? "legend" : verificationBadge === "blue" ? "blue" : "standard";
  const matchesPlayed = Number(profileStats.find((s) => s.label === "Matches")?.value || 0);
  const wins = Number(profileStats.find((s) => s.label === "Wins")?.value || 0);
  const tournaments = Number(profileStats.find((s) => s.label === "Tournaments")?.value || 0);
  const losses = Math.max(matchesPlayed - wins, 0);
  const winRate = matchesPlayed >= 5 ? Math.round((wins / matchesPlayed) * 100) : null;
  const rankLabel = matchesPlayed === 0 ? "Unranked" : profileRank ? "#" + profileRank : "—";
  const accentBadge = tier === "legend" ? "LEGEND VERIFIED" : tier === "blue" ? "BLUE VERIFIED" : null;
  const referralActive = Math.min(Number(referralStats?.active_referrals || 0), 100);
  const referralPlay = Math.min(Number(referralStats?.active_play_rate || 0), 100);
  const referralPlayers = Number(referralStats?.tournament_players || 0);
  const referralTarget = Math.max(60, Math.ceil(Number(referralStats?.active_referrals || 0) * 0.6));

  const scrollToSection = (tab, selector) => {
    setActiveTab(tab);
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main data-tier={tier} className="rx-player-profile-page">
      <div className="rx-profile-shell">
        <section className="rx-profile-hero-new">
          <div className="rx-profile-banner" aria-label="Profile banner" style={bannerPhoto ? { backgroundImage: `linear-gradient(rgba(10,10,12,.42), rgba(10,10,12,.72)), url("${bannerPhoto}")` } : undefined}>
            <div className="rx-profile-banner-lines" aria-hidden="true" />
            {isOwnProfile && (
              <>
                <button type="button" className="rx-banner-change" aria-label="Change banner" onClick={() => document.getElementById("profile-banner-upload")?.click()}>
                  <span aria-hidden="true">↗</span>
                </button>
                <input id="profile-banner-upload" className="rx-banner-upload-input" type="file" accept="image/*" onChange={handleBannerChange} />
              </>
            )}
          </div>

          <div className="rx-profile-identity-row">
            <div className="rx-profile-avatar-new">
              {avatar ? <img src={avatar} alt="" /> : <PlaceholderImage height={120} src="/images/icon.png" alt="" />}
            </div>

            <div className="rx-profile-identity">
              <span className="rx-profile-kicker">RIVAL X PLAYER</span>
              <h1>{username}</h1>
              {accentBadge && (
                <div className="rx-tier-badge">
                  <VerificationBadge badge={verificationBadge} size="sm" />
                  <span>{accentBadge}</span>
                </div>
              )}
              {tier === "standard" && isOwnProfile && (
                <a className="rx-get-verified" href="#referrals" onClick={(e) => { e.preventDefault(); scrollToSection("referrals", "#referrals"); }}>
                  Get verified →
                </a>
              )}
              <div className="rx-profile-chips" aria-label="Player summary">
                <span>{matchesPlayed} matches</span>
                <span>{wins} wins</span>
                <span>{losses} losses</span>
                {winStreak > 0 && <span>{winStreak} win streak</span>}
              </div>
              <p className="rx-profile-bio">
                {matchesPlayed ? wins + " wins across " + matchesPlayed + " official matches on Rival X." : "New to Rival X. Your competitive record starts with your first official match."}
              </p>
              {message && <div className="rx-profile-message-new" role="status">{message}</div>}
            </div>

            <aside className="rx-profile-rank-card">
              <div className="rx-profile-rank-top">
                <span>RIVAL X RANK</span>
                <strong>{rankLabel}</strong>
              </div>
              <div className="rx-rank-meta">
                <span className={winStreak > 0 ? "rx-rank-movement rx-rank-up" : losses > 0 ? "rx-rank-movement rx-rank-down" : "rx-rank-movement rx-rank-flat"} aria-label={winStreak > 0 ? "Positive movement" : losses > 0 ? "Negative movement" : "No recent movement"}>
                  <span aria-hidden="true">{winStreak > 0 ? "↑" : losses > 0 ? "↓" : "→"}</span> {winStreak > 0 ? winStreak + " streak" : losses > 0 ? losses + " loss" + (losses === 1 ? "" : "es") : "No movement"}
                </span>
                <span>{wins * 3} pts</span>
              </div>
              <div className="rx-rank-actions">
                <Link to="/leaderboard" className="rx-tier-primary">Full rankings</Link>
                {isOwnProfile && <button type="button" className="rx-tier-outline" onClick={() => setSettingsOpen((open) => !open)}>Edit profile</button>}
              </div>
            </aside>
          </div>

          {isOwnProfile && settingsOpen && (
            <form className="rx-profile-settings-new" onSubmit={saveSettings}>
              <div><label htmlFor="profile-username">Username</label><input id="profile-username" value={username} onChange={(event) => { setUsername(event.target.value); checkUsername(event.target.value); }} minLength={3} maxLength={24} required /></div>
              <div><label htmlFor="profile-avatar">Profile picture</label><label className="rx-avatar-upload" htmlFor="profile-avatar"><span>Choose an image</span><input id="profile-avatar" type="file" accept="image/*" onChange={handleAvatarChange} /></label></div>
              <div><label htmlFor="profile-squad">eFootball Squad Photo</label><label className="rx-avatar-upload" htmlFor="profile-squad"><span>Upload squad photo</span><input id="profile-squad" type="file" accept="image/*" onChange={handleSquadPhotoChange} /></label></div>
              <button type="submit" className="rx-tier-primary" disabled={availability === "taken"}>Save changes</button>
              <button type="button" className="rx-danger-link" onClick={handleDeleteAccount} disabled={deletingAccount}>{deletingAccount ? "Deleting…" : "Delete account"}</button>
            </form>
          )}
        </section>

        <nav className="rx-profile-tabs" aria-label="Profile sections">
          <button className={activeTab === "overview" ? "is-active" : ""} onClick={() => scrollToSection("overview", "#overview")}>Overview</button>
          <button className={activeTab === "matches" ? "is-active" : ""} onClick={() => scrollToSection("matches", "#matches")}>Matches</button>
          <button className={activeTab === "achievements" ? "is-active" : ""} onClick={() => scrollToSection("achievements", "#achievements")}>Achievements</button>
          {isOwnProfile && <button className={activeTab === "referrals" ? "is-active" : ""} onClick={() => scrollToSection("referrals", "#referrals")}>Referrals</button>}
        </nav>

        {loading ? (
          <section className="rx-profile-loading" aria-label="Loading player profile">
            <div className="rx-skeleton rx-skeleton-stat" /><div className="rx-skeleton rx-skeleton-stat" /><div className="rx-skeleton rx-skeleton-stat" /><div className="rx-skeleton rx-skeleton-stat" />
            <div className="rx-skeleton rx-skeleton-panel" />
          </section>
        ) : (
          <>
            <section id="overview" className="rx-profile-section">
              <div className="rx-profile-section-heading"><span className="rx-eyebrow">PLAYER RECORD</span><h2>Performance</h2></div>
              <div className="rx-profile-stats-new">
                <article><span>MATCHES</span><strong>{matchesPlayed}</strong><small>{matchesPlayed ? "Official matches" : "Play your first match"}</small></article>
                <article><span>WINS</span><strong>{wins}</strong><small>{wins ? "Victories recorded" : "Your first win is waiting"}</small></article>
                <article><span>WIN RATE</span><strong>{winRate === null ? "—" : winRate + "%"}</strong><small>{winRate === null ? "Shows after 5 matches" : "Across official matches"}</small></article>
                <article><span>TOURNAMENTS</span><strong>{tournaments}</strong><small>{tournaments ? "Tournament entries" : "Enter a tournament"}</small></article>
              </div>
            </section>

            <section id="matches" className="rx-profile-section">
              <div className="rx-profile-section-heading"><span className="rx-eyebrow">RECENT FORM</span><h2>Matches</h2></div>
              <div className="rx-profile-panel">
                {profileMatches.length ? profileMatches.map((m, i) => (
                  <div className="rx-match-row-new" key={i}>
                    <span className={m.result === "W" ? "rx-result rx-win" : "rx-result rx-loss"}>{m.result}</span>
                    <div><strong>vs {m.opp}</strong><small>{m.date}</small></div>
                    <strong className="rx-match-score">{m.score}</strong>
                  </div>
                )) : (
                  <div className="rx-empty-state"><strong>Your competitive record starts here.</strong><span>Play an official Rival X match to build your history.</span><Link to="/play" className="rx-tier-primary">Open Match Hub</Link></div>
                )}
              </div>
            </section>

            <section id="achievements" className="rx-profile-section">
              <div className="rx-profile-section-heading"><span className="rx-eyebrow">MILESTONES</span><h2>Achievements</h2></div>
              <div className="rx-achievements-grid">
                <article className={wins > 0 ? "is-earned" : ""}><span>01</span><strong>First Win</strong><small>{wins > 0 ? "Unlocked" : "Win your first official match"}</small></article>
                <article className={winStreak >= 3 ? "is-earned" : ""}><span>03</span><strong>Three in a Row</strong><small>{winStreak >= 3 ? "Unlocked" : "Reach a 3-win streak"}</small></article>
                <article className={tournaments > 0 ? "is-earned" : ""}><span>RX</span><strong>Tournament Ready</strong><small>{tournaments > 0 ? "Unlocked" : "Enter your first tournament"}</small></article>
              </div>
            </section>

            {isOwnProfile && referralStats?.referral_code && (
              <section id="referrals" className="rx-profile-section">
                <div className="rx-profile-section-heading"><span className="rx-eyebrow">VERIFICATION PATH</span><h2>Build your Blue Check</h2></div>
                <div className="rx-referral-layout-new">
                  <div className="rx-referral-progress-card">
                    <div className="rx-progress-line"><span>Active referrals</span><strong>{referralActive} / 100</strong></div>
                    <div className="rx-progress-track"><span style={{ width: (referralActive ? Math.max(2, referralActive) : 0) + "%" }} /></div>
                    <div className="rx-progress-line"><span>Tournament players</span><strong>{referralPlayers} / {referralTarget}</strong></div>
                    <div className="rx-progress-track rx-progress-blue"><span style={{ width: (referralPlay ? Math.max(2, referralPlay) : 0) + "%" }} /></div>
                    <p>{referralStats.qualifies_for_referral_blue ? "Blue verification unlocked." : "Refer active players and get them playing to unlock Blue verification."}</p>
                  </div>
                  <div className="rx-referral-id-card">
                    <span className="rx-eyebrow">YOUR REFERRAL ID</span>
                    <strong>{referralStats.referral_code}</strong>
                    <button type="button" className="rx-tier-primary" onClick={copyReferralLink} aria-live="polite">{copied ? "Copied" : "Copy invite link"}</button>
                    <a className="rx-tier-outline" href={"https://wa.me/?text=" + encodeURIComponent("Join me on Rival X: " + window.location.origin + "/register?ref=" + referralStats.referral_code)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
                  </div>
                </div>
              </section>
            )}

            {squadPhoto && (
              <section className="rx-profile-section rx-squad-section">
                <div className="rx-profile-section-heading"><span className="rx-eyebrow">GAME PROFILE</span><h2>eFootball Squad</h2></div>
                <img src={squadPhoto} alt={username + "'s eFootball squad"} />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}