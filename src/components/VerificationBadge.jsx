import React from "react";

const BADGE_META = {
  blue: { title: "Rival X Verified", color: "#3b82f6" },
  red: { title: "Rival X Elite Verified — unbeaten for 6+ years", color: "#ef4444" },
  gold: { title: "Rival X Legend Verified — unbeaten for 3+ years", color: "#f59e0b" },
};

export default function VerificationBadge({ badge, size = "sm" }) {
  const meta = BADGE_META[badge];
  if (!meta) return null;
  const dimension = size === "lg" ? 24 : 17;
  const checkSize = size === "lg" ? 13 : 9;
  return (
    <span
      title={meta.title}
      aria-label={meta.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dimension,
        height: dimension,
        borderRadius: "50%",
        background: meta.color,
        color: "#fff",
        fontWeight: 900,
        fontSize: checkSize,
        lineHeight: 1,
        flex: "0 0 auto",
        boxShadow: `0 0 8px ${meta.color}44`,
        verticalAlign: "middle",
      }}
    >
      ✓
    </span>
  );
}
