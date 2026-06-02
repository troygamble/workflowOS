"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { PSFAnalysisResponse, PSFDomain, PSFRating } from "@/app/api/psf-analyze/route";
import { studioAiFetch } from "@/lib/studio/openai-key-client";

// ─── Styles ──────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 180,
  width: 420, maxWidth: "92vw",
  background: "#0b1120",
  borderLeft: "1px solid #1e2d3a",
  display: "flex", flexDirection: "column",
  boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
};

const HEADER: React.CSSProperties = {
  padding: "14px 18px", borderBottom: "1px solid #1e2d3a",
  display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
};

const BODY: React.CSSProperties = {
  flex: 1, overflowY: "auto", padding: "16px 18px",
  display: "flex", flexDirection: "column", gap: 14,
};

const FOOTER: React.CSSProperties = {
  padding: "12px 18px", borderTop: "1px solid #1e2d3a",
  display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
};

// ─── Rating helpers ───────────────────────────────────────────────────────────

const RATING_COLOR: Record<PSFRating, string> = {
  Strong: "#22c55e",
  Partial: "#f59e0b",
  Gap:     "#ef4444",
  "N/A":   "#475569",
};

const RATING_BG: Record<PSFRating, string> = {
  Strong: "rgba(34,197,94,0.12)",
  Partial: "rgba(245,158,11,0.12)",
  Gap:    "rgba(239,68,68,0.12)",
  "N/A":  "rgba(71,85,105,0.12)",
};

function RatingBadge({ rating }: { rating: PSFRating }) {
  return (
    <span style={{
      display: "inline-block",
      background: RATING_BG[rating],
      color: RATING_COLOR[rating],
      fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 100,
      letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      {rating}
    </span>
  );
}

function ScoreRing({ score, rating }: { score: number; rating: PSFRating }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const col = RATING_COLOR[rating];
  return (
    <svg width={36} height={36} style={{ flexShrink: 0 }}>
      <circle cx={18} cy={18} r={r} fill="none" stroke="#1e2d3a" strokeWidth={3} />
      <circle
        cx={18} cy={18} r={r} fill="none"
        stroke={col} strokeWidth={3}
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text x={18} y={22} textAnchor="middle" fontSize={9} fontWeight={700} fill={col}>{score}</text>
    </svg>
  );
}

// ─── Domain row ───────────────────────────────────────────────────────────────

function DomainRow({ d, expanded, onToggle }: {
  d: PSFDomain;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ background: "#0f1a2e", borderRadius: 8, border: "1px solid #1e2d3a", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
      >
        <ScoreRing score={d.score} rating={d.rating} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.04em" }}>{d.id}</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
        </div>
        <RatingBadge rating={d.rating} />
        <span style={{ color: "#334155", fontSize: 10, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #1e2d3a" }}>
          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: "10px 0 0" }}>{d.evidence}</p>

          {d.gaps.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Gaps</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {d.gaps.map((g, i) => (
                  <li key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.recommendations.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Recommendations</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {d.recommendations.map((r, i) => (
                  <li key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#22c55e", flexShrink: 0 }}>→</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Loading animation ────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Reading workflow nodes…",
  "Checking D1–D2: Data contracts & output validation…",
  "Checking D3–D4: Data protection & observability…",
  "Checking D5–D6: Deployment safety & human oversight…",
  "Checking D7–D8: Security & vendor resilience…",
  "Computing PSF compliance score…",
];

function LoadingState() {
  const [step, setStep] = useState(0);
  // Cycle through steps
  if (typeof window !== "undefined") {
    const interval = setInterval(() => {
      setStep(s => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 900);
    // Cleanup handled by component unmount
    void interval;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      {/* Animated rings */}
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width={64} height={64} style={{ position: "absolute" }}>
          <circle cx={32} cy={32} r={28} fill="none" stroke="#1e2d3a" strokeWidth={3} />
          <circle cx={32} cy={32} r={28} fill="none" stroke="#2563eb" strokeWidth={3}
            strokeDasharray="44 132" strokeLinecap="round" transform="rotate(-90 32 32)"
            style={{ animation: "spin 1.4s linear infinite", transformOrigin: "32px 32px" }}
          />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛡️</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
        {LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)]}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "done" | "error";

export function PSFAnalyzerPanel({ onClose }: { onClose: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);

  const [phase, setPhase]   = useState<Phase>("idle");
  const [result, setResult] = useState<PSFAnalysisResponse | null>(null);
  const [error, setError]   = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isEmpty = workflow.nodes.length === 0;

  async function runAnalysis() {
    setPhase("loading");
    setError("");
    setResult(null);
    try {
      const res = await studioAiFetch("/api/psf-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow }),
      });
      const json = await res.json() as PSFAnalysisResponse | { error: string };
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : "Analysis failed");
        setPhase("error");
        return;
      }
      setResult(json as PSFAnalysisResponse);
      setPhase("done");
      // Auto-expand gaps
      const gapIds = new Set((json as PSFAnalysisResponse).domains.filter(d => d.rating === "Gap").map(d => d.id));
      setExpanded(gapIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }

  function toggleDomain(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const overallColor = result
    ? result.overall_score >= 70 ? "#22c55e"
    : result.overall_score >= 40 ? "#f59e0b"
    : "#ef4444"
    : "#475569";

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <span style={{ fontSize: 16 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>PSF Compliance Analyzer</div>
          <div style={{ fontSize: 10, color: "#475569" }}>Production Safety Framework · 8 domains</div>
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
      </div>

      {/* Body */}
      <div style={BODY}>
        {phase === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              Analyse your workflow against all 8 PSF domains. The analyzer identifies which domains are Strong, Partial, or missing altogether — and recommends what to add.
            </p>
            <div style={{ background: "#0f1a2e", border: "1px solid #1e2d3a", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>8 PSF Domains</div>
              {["D1 Data Contracts & Validation","D2 Output Validation","D3 Data Protection","D4 Observability & Monitoring","D5 Deployment Safety","D6 Human Oversight","D7 Security & Access Control","D8 Vendor Resilience"].map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: "#475569", padding: "3px 0", borderBottom: i < 7 ? "1px solid #1a2535" : "none" }}>
                  <span style={{ color: "#334155", fontFamily: "monospace", marginRight: 8 }}>{d.split(" ")[0]}</span>
                  {d.split(" ").slice(1).join(" ")}
                </div>
              ))}
            </div>
            {isEmpty && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: 10, fontSize: 12, color: "#f59e0b" }}>
                Add some nodes to your workflow first for a meaningful analysis.
              </div>
            )}
          </div>
        )}

        {phase === "loading" && <LoadingState />}

        {phase === "error" && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Analysis failed</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{error}</div>
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Overall score */}
            <div style={{ background: "#0f1a2e", border: `1px solid ${overallColor}33`, borderRadius: 10, padding: "16px 16px 14px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: overallColor, lineHeight: 1 }}>{result.overall_score}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>/ 100</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>PSF Compliance Score</div>
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{result.summary}</p>
              </div>
            </div>

            {/* Domain scores summary bar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Strong","Partial","Gap"].map(r => {
                const count = result.domains.filter(d => d.rating === r).length;
                return count > 0 ? (
                  <div key={r} style={{ background: RATING_BG[r as PSFRating], color: RATING_COLOR[r as PSFRating], fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100 }}>
                    {count} {r}
                  </div>
                ) : null;
              })}
            </div>

            {/* Top gaps */}
            {result.top_gaps.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Critical Gaps</div>
                {result.top_gaps.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }}>✗</span>{g}
                  </div>
                ))}
              </div>
            )}

            {/* Domain rows */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>Domain Breakdown</div>
            {result.domains.map(d => (
              <DomainRow key={d.id} d={d} expanded={expanded.has(d.id)} onToggle={() => toggleDomain(d.id)} />
            ))}

            {/* Top recommendations */}
            {result.top_recommendations.length > 0 && (
              <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Top Recommendations</div>
                {result.top_recommendations.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }}>→</span>{r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={FOOTER}>
        {phase === "done" && (
          <button type="button"
            onClick={() => { setPhase("idle"); setResult(null); }}
            style={{ background: "none", border: "1px solid #1e2d3a", color: "#64748b", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, cursor: "pointer" }}
          >
            Reset
          </button>
        )}
        <button type="button" onClick={onClose}
          style={{ background: "none", border: "1px solid #1e2d3a", color: "#64748b", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, cursor: "pointer" }}
        >
          Close
        </button>
        {(phase === "idle" || phase === "error") && (
          <button type="button"
            onClick={runAnalysis}
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#ffffff", fontSize: 12, fontWeight: 700, padding: "7px 18px", borderRadius: 6, border: "none", cursor: "pointer" }}
          >
            🛡️ Analyse workflow
          </button>
        )}
      </div>
    </div>
  );
}
