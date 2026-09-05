import React, { useState } from "react";

export default function PlaceholderImage({
  src,
  alt = "Rival X esports competition",
  height = 200,
  className = "",
  style = {},
  label = "",
}) {
  const [imgError, setImgError] = useState(false);

  // Pick a real fallback graphic based on context
  let resolvedSrc = src;
  if (!resolvedSrc) {
    const lower = (label || "").toLowerCase();
    if (lower.includes("avatar")) {
      resolvedSrc = "/images/icon.png";
    } else if (lower.includes("detail") || lower.includes("wide")) {
      resolvedSrc = "/images/3.jpg";
    } else {
      resolvedSrc = "/images/1.jpg";
    }
  }

  if (resolvedSrc && !imgError) {
    return (
      <div
        className={`rx-clip ${className}`}
        style={{
          width: "100%",
          height,
          position: "relative",
          overflow: "hidden",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          ...style,
        }}
      >
        <img
          src={resolvedSrc}
          alt={alt}
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(10,10,12,0.85) 0%, rgba(10,10,12,0.15) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`rx-clip ${className}`}
      style={{
        width: "100%",
        height,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #16171b 0%, #1f2127 50%, #16171b 100%)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        textAlign: "center",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--red)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Rival X Arena
      </div>
      <div
        className="rx-display"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--silver-bright)",
          textTransform: "uppercase",
        }}
      >
        eFootball Championship
      </div>
    </div>
  );
}

