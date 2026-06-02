"use client";

import { isElectron } from "@/lib/platform";

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  const desktop = isElectron();

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #0c1526 0%, #080e1c 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          padding: "36px 32px 28px",
          maxWidth: 400,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(59,130,246,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div style={{ fontSize: 44, marginBottom: 10, filter: "drop-shadow(0 0 16px #3b82f666)" }}>◈</div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px", letterSpacing: "-0.02em" }}>PAI Studio</h2>
        <p style={{ fontSize: 13, color: "#3b82f6", margin: "0 0 18px", fontWeight: 500, opacity: 0.8 }}>
          Build automation packages for the real world.
        </p>

        {/* Version + platform badges */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", background: "#3b82f618", border: "1px solid #3b82f644", borderRadius: 999, padding: "3px 10px" }}>
            v1.0.0
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: desktop ? "#22c55e" : "#64748b",
            background: desktop ? "#22c55e18" : "#64748b18",
            border: `1px solid ${desktop ? "#22c55e44" : "#64748b44"}`,
            borderRadius: 999, padding: "3px 10px",
          }}>
            {desktop ? "Desktop" : "Web"}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", marginBottom: 20 }} />

        {/* Description */}
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, margin: "0 0 24px" }}>
          Design, document, and ship AI-powered workflow automation packages.
          Every export includes skill contracts, deployment guides, and client-ready proposals.
        </p>

        {/* Links */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 28 }}>
          <a href="/privacy" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>Privacy</a>
          <a href="/terms" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>Terms</a>
          <a href="/" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>Website</a>
        </div>

        {/* Copyright */}
        <p style={{ fontSize: 11, color: "#1e2d4a", margin: "0 0 20px" }}>
          © {new Date().getFullYear()} Production AI Institute. All rights reserved.
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid #1e2d4a",
            borderRadius: 9,
            background: "rgba(255,255,255,0.03)",
            color: "#64748b",
            padding: "8px 28px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
