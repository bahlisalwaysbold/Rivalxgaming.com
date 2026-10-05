import React from "react";

const BADGE_META = {
  blue: { title: "Rival X Verified", color: "#3b82f6" },
  red: { title: "Rival X Elite Verified — unbeaten for 6+ years", color: "#ef4444" },
  gold: { title: "Rival X Legend Verified — unbeaten for 3+ years", color: "#f59e0b" },
};

export default function VerificationBadge({ badge, size = "sm" }) {
  const meta = BADGE_META[badge];
  if (!meta) return null;

  const dimension = size === "lg" ? 22 : 16;
  const strokeWidth = size === "lg" ? 3.4 : 3;

  return (
    <span
      title={meta.title}
      aria-label={meta.title}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dimension,
        height: dimension,
        color: meta.color,
        flex: "0 0 auto",
        verticalAlign: "middle",
        filter: `drop-shadow(0 1px 2px ${meta.color}33)`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M5 12.5 9.4 17 19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
