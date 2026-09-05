import React, { useState } from "react";
import { signInWithEmail, signInWithGoogle, supabase } from "../lib/supabase.js";

function EmailIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 5.5h18v13H3z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M6.54 13.58a5.86 5.86 0 0 1 0-3.16V7.89H3.3a9.5 9.5 0 0 0 0 8.22l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.49 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.11 9.46 6.39 12 6.39Z" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signInWithEmail(email, password);
      setMessage("Logged in.");
    } catch (err) {
      setMessage(err.message || "Unable to log in.");
    }
  }

  return (
    <main className="rx-auth-screen">
      <div className="rx-container rx-auth-page">
        <div className="rx-auth-panel">
          <h1 className="rx-display" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 28px" }}>
            Log in
          </h1>
          {!supabase && (
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: "-12px 0 24px" }}>
              Demo access: <strong style={{ color: "var(--silver)" }}>demo@rivalx.com</strong> / <strong style={{ color: "var(--silver)" }}>rivalx2026</strong>
            </p>
          )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
          />
        </div>
        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </div>
        <button type="submit" className="rx-btn" style={{ marginTop: 8 }}>
          <EmailIcon />
          Log in
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <button
        className="rx-btn-outline"
        style={{ width: "100%" }}
        onClick={() => signInWithGoogle().catch((err) => setMessage(err.message))}
      >
        <GoogleIcon />
        Continue with Google
      </button>

          {message && (
            <p style={{ fontSize: 13, color: "var(--red)", marginTop: 18 }}>{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}