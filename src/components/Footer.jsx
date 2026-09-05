import React from "react";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", marginTop: 80 }}>
      <div
        className="rx-container"
        style={{
          padding: "28px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <img src="/images/logo-mark.png" alt="Rival X" className="rx-footer-mark" />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Compete. Improve. Conquer. · eFootball tournaments
        </span>
      </div>
    </footer>
  );
}
