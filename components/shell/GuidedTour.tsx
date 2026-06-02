"use client";

/**
 * GuidedTour — spotlight-based interactive tour.
 *
 * Shows a real SVG spotlight cutout over a target element, plus a
 * positioned tooltip card. 8 steps walk through the full consultant loop.
 * Auto-loads the Demo Engagement canvas so there's always real content to
 * point at — without opening any modals.
 *
 * Fixes vs original:
 *  - Loads demo canvas (no PDF popup on step 0)
 *  - 500ms startup delay so DOM is settled before first spotlight fires
 *  - Missing targets fall back gracefully to centred card (no jumping)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { loadDemoToCanvas } from "@/lib/demo/demo-engagement";

const TOUR_KEY = "wfos-tour-done";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGuidedTour() {
  const [open, setOpen] = useState(false);
  const start = useCallback(() => setOpen(true), []);
  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
  }, []);
  return { open, start, finish };
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  id: string;
  icon: string;
  title: string;
  body: string;
  tip?: string;
  cta?: string;
  /** CSS selector for the element to spotlight. null = centred card, no spotlight. */
  targetSelector: string | null;
  /** Where to put the tooltip relative to the spotlight. */
  tooltipSide: "center" | "right" | "left" | "bottom" | "top";
  accentColor: string;
  autoAction?: "loadDemo";
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: "◈",
    title: "Map a process. Walk out with a client.",
    body: "A typical engagement starts with mapping a client process on the canvas, running PSF compliance, and presenting a proposal before the meeting ends. This tour shows you how — step by step.",
    cta: "Show me →",
    targetSelector: null,
    tooltipSide: "center",
    accentColor: "#3b82f6",
    autoAction: "loadDemo",
  },
  {
    id: "canvas",
    icon: "⚡",
    title: "Every node is a step in the process",
    body: "<strong style='color:#93c5fd'>Blue</strong> nodes run automatically — AI or scripts. <strong style='color:#fcd34d'>Amber</strong> nodes need a human. <strong style='color:#7dd3fc'>Sky</strong> nodes connect to external apps. A discovery session with the client gives you enough to build the first draft.",
    tip: "The client doesn't need to understand the tech. They just need to see their own process, accurately reflected.",
    targetSelector: ".react-flow",
    tooltipSide: "right",
    accentColor: "#3b82f6",
  },
  {
    id: "inspector",
    icon: "📋",
    title: "Every node has a contract",
    body: "Click any node on the canvas. This panel shows what it needs, what it produces, who owns it, and what the AI is allowed to do. <strong style='color:#e2e8f0'>This is what makes your proposal defensible to a CTO.</strong>",
    tip: "A CFO asking 'can we trust the AI?' gets a very different answer when you show them output contracts and blast radius limits.",
    targetSelector: "#wfos-inspector",
    tooltipSide: "left",
    accentColor: "#8b5cf6",
  },
  {
    id: "palette",
    icon: "🔨",
    title: "Build from scratch or use templates",
    body: "Pre-built templates cover the most common processes — Invoice Approval, Employee Onboarding, Sales Quote, and more. Or drag nodes from here to map any process from scratch.",
    tip: "Best first clients: law firms, accounting practices, finance teams, ops-heavy SMBs. Anyone doing the same thing manually every week.",
    targetSelector: "#wfos-palette",
    tooltipSide: "right",
    accentColor: "#f59e0b",
  },
  {
    id: "brief",
    icon: "📋",
    title: "One click → executive presentation",
    body: "Hit <strong style='color:#e2e8f0'>📋 Brief</strong> and the AI generates a full executive deck — transformation story, ROI breakdown, readiness score, deployment phases. Fully written. <strong style='color:#e2e8f0'>Under 10 seconds.</strong>",
    tip: "Send this before the final meeting. 'Here's the analysis I mentioned.' They read it. They arrive ready to sign.",
    targetSelector: "[data-tour-id='brief-btn']",
    tooltipSide: "bottom",
    accentColor: "#0ea5e9",
  },
  {
    id: "proposal",
    icon: "📄",
    title: "The proposal writes itself",
    body: "<strong style='color:#e2e8f0'>📄 Proposal</strong> generates a print-ready PDF — cover page, executive summary, ROI analysis, risk assessment, and deployment roadmap. Used to take a consultant a week. Now it takes 8 seconds.",
    tip: "Set up your branding first (⋯ → Branding Settings) so proposals show your firm's name, not ours.",
    targetSelector: "[data-tour-id='proposal-btn']",
    tooltipSide: "bottom",
    accentColor: "#22c55e",
  },
  {
    id: "export",
    icon: "⬇",
    title: "Ship the deployment package",
    body: "<strong style='color:#e2e8f0'>⬇ Export</strong> gives the client everything to actually deploy — YAML skill contracts, Python hook scripts, integration specs, and a plain-English getting started guide their IT team can follow. <strong style='color:#e2e8f0'>Hand it over. Invoice.</strong>",
    tip: "Mapping plus proposal is the core consulting deliverable. Some practitioners add a maintenance retainer for ongoing workflow updates and compliance reviews.",
    targetSelector: "[data-tour-id='export-btn']",
    tooltipSide: "bottom",
    accentColor: "#06b6d4",
  },
  {
    id: "done",
    icon: "🚀",
    title: "You know the loop",
    body: "Map a process → auto-generate the automation → write the proposal → ship the deployment package → invoice. <strong style='color:#e2e8f0'>Most consultants close their first engagement within two weeks of starting.</strong>",
    cta: "Let's go →",
    targetSelector: null,
    tooltipSide: "center",
    accentColor: "#3b82f6",
  },
];

// ─── Spotlight geometry ───────────────────────────────────────────────────────

interface SpotRect { x: number; y: number; w: number; h: number; }

function getSpotRect(selector: string, pad = 12): SpotRect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Sanity-check: ignore elements that have no visible area
    if (r.width < 4 || r.height < 4) return null;
    return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  } catch {
    return null;
  }
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────

const CARD_W = 380;
const CARD_GAP = 18;

function cardStyle(
  side: TourStep["tooltipSide"],
  spot: SpotRect | null,
  vw: number,
  vh: number,
): React.CSSProperties {
  // If no spotlight found (target missing / not visible), always centre the card
  if (side === "center" || !spot) {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_W,
      maxWidth: "calc(100vw - 32px)",
    };
  }

  let top: number | undefined;
  let left: number | undefined;
  let bottom: number | undefined;
  let right: number | undefined;

  if (side === "right") {
    left = Math.min(spot.x + spot.w + CARD_GAP, vw - CARD_W - 16);
    top = Math.max(8, Math.min(spot.y + spot.h / 2 - 180, vh - 400));
  } else if (side === "left") {
    left = Math.max(8, spot.x - CARD_W - CARD_GAP);
    top = Math.max(8, Math.min(spot.y + spot.h / 2 - 180, vh - 400));
  } else if (side === "bottom") {
    top = Math.min(spot.y + spot.h + CARD_GAP, vh - 350);
    left = Math.max(8, Math.min(spot.x + spot.w / 2 - CARD_W / 2, vw - CARD_W - 16));
  } else if (side === "top") {
    bottom = vh - spot.y + CARD_GAP;
    left = Math.max(8, Math.min(spot.x + spot.w / 2 - CARD_W / 2, vw - CARD_W - 16));
  }

  return {
    position: "fixed",
    top: top !== undefined ? top : undefined,
    bottom: bottom !== undefined ? bottom : undefined,
    left: left !== undefined ? left : undefined,
    right: right !== undefined ? right : undefined,
    width: CARD_W,
    maxWidth: "calc(100vw - 32px)",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GuidedTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);
  const [ready, setReady] = useState(false);       // gates render until DOM has settled
  const [vsize, setVsize] = useState({ w: 1440, h: 900 });
  const demoLoaded = useRef(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const accent = current.accentColor;

  // 500ms startup delay — let the canvas & toolbar fully mount before we start
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Load demo content into the canvas on step 0 (no PDF modal)
  useEffect(() => {
    if (!ready) return;
    if (current.autoAction === "loadDemo" && !demoLoaded.current) {
      demoLoaded.current = true;
      loadDemoToCanvas();
    }
  }, [ready, current.autoAction]);

  // Compute spotlight rect — retry a few times in case layout isn't settled
  useEffect(() => {
    if (!ready) return;
    const compute = () => {
      setVsize({ w: window.innerWidth, h: window.innerHeight });
      if (current.targetSelector) {
        setSpot(getSpotRect(current.targetSelector));
      } else {
        setSpot(null);
      }
    };
    compute();
    const t1 = setTimeout(compute, 200);
    const t2 = setTimeout(compute, 600);
    window.addEventListener("resize", compute);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", compute);
    };
  }, [step, current.targetSelector, ready]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isLast) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isLast, step]);

  const next = () => { if (isLast) { onClose(); } else { setStep((s) => s + 1); } };

  // Don't render anything during the startup delay
  if (!ready) return null;

  return (
    <>
      {/* SVG spotlight overlay */}
      <svg
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 8000, pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x} y={spot.y} width={spot.w} height={spot.h}
                rx={12} ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill={spot ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.72)"}
          mask="url(#tour-mask)"
        />
        {/* Spotlight border glow */}
        {spot && (
          <rect
            x={spot.x} y={spot.y} width={spot.w} height={spot.h}
            rx={12} ry={12}
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
        )}
      </svg>

      {/* Click-through backdrop to advance */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 8001, cursor: "default" }}
        onClick={next}
      />

      {/* Tooltip card */}
      <div
        style={{
          ...cardStyle(current.tooltipSide, spot, vsize.w, vsize.h),
          zIndex: 8002,
          background: "linear-gradient(160deg, #0e1628 0%, #080e1c 100%)",
          border: `1px solid ${accent}33`,
          borderRadius: 18,
          boxShadow: `0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.04)`,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div style={{ height: 2, background: "#0f172a" }}>
          <div style={{
            height: "100%",
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
            transition: "width 0.35s ease",
          }} />
        </div>

        <div style={{ padding: "22px 24px 20px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 42, height: 42, flexShrink: 0,
              background: `${accent}18`,
              border: `1px solid ${accent}33`,
              borderRadius: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
              filter: `drop-shadow(0 0 8px ${accent}44)`,
            }}>
              {current.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: accent, marginBottom: 5, opacity: 0.9 }}>
                Step {step + 1} of {STEPS.length}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                {current.title}
              </div>
            </div>
            <button
              type="button" onClick={onClose}
              style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2, flexShrink: 0, marginTop: -2 }}
              title="Close tour"
            >×</button>
          </div>

          {/* Body */}
          <div
            style={{ fontSize: 13, color: "#7a8fa8", lineHeight: 1.75, marginBottom: current.tip ? 12 : 18 }}
            dangerouslySetInnerHTML={{ __html: current.body }}
          />

          {/* Tip */}
          {current.tip && (
            <div style={{
              background: `${accent}0c`,
              border: `1px solid ${accent}22`,
              borderRadius: 9,
              padding: "9px 13px",
              fontSize: 11, color: "#475569", lineHeight: 1.65,
              marginBottom: 18,
            }}>
              <span style={{ color: accent, fontWeight: 700, marginRight: 5 }}>💡</span>
              {current.tip}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            {/* Dot progress */}
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {STEPS.map((_, i) => (
                <button
                  key={i} type="button"
                  onClick={(e) => { e.stopPropagation(); setStep(i); }}
                  style={{
                    width: i === step ? 18 : 5, height: 5,
                    borderRadius: 3,
                    background: i === step ? accent : i < step ? `${accent}55` : "#1e2d4a",
                    border: "none", cursor: "pointer", padding: 0,
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 7 }}>
              {step > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setStep((s) => s - 1); }}
                  style={{ background: "none", border: "1px solid #1a2540", borderRadius: 8, padding: "8px 14px", color: "#475569", fontSize: 12, cursor: "pointer" }}
                >
                  ←
                </button>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); next(); }}
                style={{
                  background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                  border: "none", borderRadius: 9,
                  padding: "9px 20px",
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: "pointer",
                  boxShadow: `0 4px 16px ${accent}44`,
                  letterSpacing: "-0.01em",
                }}
              >
                {current.cta ?? (isLast ? "Done ✓" : "Next →")}
              </button>
            </div>
          </div>

          {/* Skip link */}
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ background: "none", border: "none", color: "#1e2d4a", fontSize: 10, cursor: "pointer", letterSpacing: "0.05em" }}
            >
              SKIP TOUR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
