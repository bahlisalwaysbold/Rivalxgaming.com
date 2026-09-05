import React, { useEffect, useState } from "react";

/**
 * Full-screen splash loader shown once when the app first mounts —
 * the logo draws itself in, then the whole screen fades out into the site.
 * Mirrors the pattern apps like Instagram use for their launch screen.
 */
export default function Loader({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 1100);
    const doneTimer = setTimeout(() => onDone?.(), 1550);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.45s ease",
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <img
        src="/images/logo-mark.png"
        alt="Rival X"
        className="rx-loader-mark"
        style={{ width: 84, height: "auto" }}
      />
    </div>
  );
}
