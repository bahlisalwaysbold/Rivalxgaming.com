import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { signOut, supabase, isAdmin } from "../lib/supabase.js";

const links = [
  { to: "/", label: "Home" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/mvp", label: "MVP Moments" },
  { to: "/profile", label: "Profile" },
];

const WHATSAPP_NUMBER = "2348025085143";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [logoutError, setLogoutError] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        if (active) {
          setUser(currentUser);
          setAvatar(currentUser ? localStorage.getItem(`rivalx_avatar_${currentUser.id}`) : null);
        }
      } else {
        const demoSession = localStorage.getItem("rivalx_demo_session");
        const currentUser = demoSession ? JSON.parse(demoSession) : null;
        if (active) {
          setUser(currentUser);
          setAvatar(localStorage.getItem("rivalx_avatar") || null);
        }
      }
    }

    loadUser();
    const handleDemoAuthChange = () => loadUser();
    window.addEventListener("rivalx-auth-change", handleDemoAuthChange);

    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active) {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setAvatar(currentUser ? localStorage.getItem(`rivalx_avatar_${currentUser.id}`) : null);
      }
    });

    return () => {
      active = false;
      window.removeEventListener("rivalx-auth-change", handleDemoAuthChange);
      authSubscription?.data.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      setLogoutError(null);
      await signOut();
      setMenuOpen(false);
      setAccountOpen(false);
    } catch (error) {
      setLogoutError(error.message || "Unable to log out.");
    }
  }

  const authActions = user ? (
    <div className="rx-account-menu">
      <button
        type="button"
        className="rx-avatar-toggle"
        aria-label="Open profile menu"
        aria-expanded={accountOpen}
        onClick={() => setAccountOpen((open) => !open)}
      >
        {avatar ? <img src={avatar} alt="Your profile" /> : <span className="rx-avatar-placeholder">{(user.email || "R")[0].toUpperCase()}</span>}
        <span className="rx-avatar-camera" aria-hidden="true">+</span>
      </button>
      {accountOpen && (
        <div className="rx-account-dropdown">
          <Link to="/profile" onClick={() => setAccountOpen(false)}>Profile settings</Link>
          {isAdmin(user) && (
            <Link to="/admin" onClick={() => setAccountOpen(false)}>Admin Portal</Link>
          )}
          <button type="button" onClick={handleLogout}>Log out</button>
        </div>
      )}
    </div>
  ) : (
    <>
      <Link to="/login" className="rx-btn-outline" style={{ display: "inline-block" }}>
        Log in
      </Link>
      <Link to="/register" className="rx-btn" style={{ display: "inline-block" }}>
        Register
      </Link>
    </>
  );

  return (
    <header
      className="rx-header"
      style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        background: "rgba(10,10,12,0.9)",
        backdropFilter: "blur(6px)",
        zIndex: 10,
      }}
    >
      <div className="rx-container rx-header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 68 }}>
        <div className="rx-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/" aria-label="Rival X home">
            <img src="/images/logo-mark.png" alt="Rival X icon" className="rx-brand-lockup" />
          </Link>
        </div>

        <nav className="rx-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `rx-nav-link${isActive ? " active" : ""}`}
              style={({ isActive }) => ({
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? "var(--silver-bright)" : "var(--muted)",
              })}
            >
              {l.label}
            </NavLink>
          ))}
          {isAdmin(user) && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `rx-nav-link${isActive ? " active" : ""}`}
              style={({ isActive }) => ({
                fontSize: 14,
                fontWeight: 700,
                color: isActive ? "var(--red)" : "#ff6666",
              })}
            >
              Admin Portal
            </NavLink>
          )}
        </nav>

        <div className="rx-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* WhatsApp support icon */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat with support on WhatsApp"
            title="Support"
            style={{
              width: 40,
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              borderRadius: "50%",
              color: "#4ade80",
              fontSize: 20,
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#4ade80";
              e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.83 14.12c-.25.7-1.45 1.34-2.02 1.39-.52.05-1.02.24-3.43-.72-2.89-1.15-4.72-3.82-4.86-4-.14-.18-1.16-1.55-1.16-2.95 0-1.4.73-2.09 1-2.38.25-.29.55-.36.73-.36l.53.01c.17.01.4-.07.63.48.25.58.83 2 .9 2.15.07.14.12.31.02.5-.09.18-.14.29-.28.45-.14.16-.3.36-.42.48-.14.14-.29.29-.12.58.16.29.73 1.2 1.57 1.95 1.08.96 1.99 1.26 2.27 1.4.28.14.45.12.61-.07.16-.18.7-.82.89-1.1.18-.29.37-.24.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.16 1.4z"/>
            </svg>
          </a>
          {authActions}
        </div>

        <button
          type="button"
          className="rx-menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`rx-mobile-menu${menuOpen ? " open" : ""}`}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `rx-mobile-link${isActive ? " active" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </NavLink>
        ))}

        <div className="rx-mobile-actions">
          {user ? (
            <>
              <Link to="/profile" className="rx-btn-outline" onClick={() => setMenuOpen(false)}>
                Profile settings
              </Link>
              {isAdmin(user) && (
                <Link to="/admin" className="rx-btn-outline" onClick={() => setMenuOpen(false)}>
                  Admin Portal
                </Link>
              )}
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className="rx-btn-outline"
                onClick={() => setMenuOpen(false)}
              >
                Support (WhatsApp)
              </a>
              <button type="button" className="rx-btn" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rx-btn-outline" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
              <Link to="/register" className="rx-btn" onClick={() => setMenuOpen(false)}>
                Register
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className="rx-btn-outline"
                onClick={() => setMenuOpen(false)}
              >
                Support (WhatsApp)
              </a>
            </>
          )}
        </div>
      </div>
      {logoutError && <span className="rx-auth-error">{logoutError}</span>}
    </header>
  );
}