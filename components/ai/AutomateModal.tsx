"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { Workflow } from "@/lib/types/workflow";
import { studioAiFetch } from "@/lib/studio/openai-key-client";

type Phase = "confirm" | "loading" | "done" | "error";

// Animation steps shown during the AI generation
const LOADING_STEPS = [
  { icon: "🔍", label: "Analysing process map",          dur: 900  },
  { icon: "🤖", label: "Identifying automation candidates", dur: 1100 },
  { icon: "⚙️",  label: "Generating AI skill contracts",  dur: 1300 },
  { icon: "🛡️",  label: "Applying blast-radius guardrails", dur: 900  },
  { icon: "🔗", label: "Wiring integration nodes",        dur: 1000 },
  { icon: "📋", label: "Writing output contracts",        dur: 1100 },
  { icon: "✨", label: "Finalising future-state workflow", dur: 800  },
];

export function AutomateModal({ onClose }: { onClose: () => void }) {
  const workflow          = useWorkflowStore((s) => s.workflow);
  const setWorkflow       = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout   = useWorkflowStore((s) => s.applyAutoLayout);
  const saveCurrentStateSnapshot = useWorkflowStore((s) => s.saveCurrentStateSnapshot);

  const [phase, setPhase]       = useState<Phase>("confirm");
  const [summary, setSummary]   = useState("");
  const [error, setError]       = useState("");
  const [stepIdx, setStepIdx]   = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const humanCount = workflow.nodes.filter((n) => n.type === "human").length;
  const totalCount = workflow.nodes.length;

  // Drive the step animation while loading
  useEffect(() => {
    if (phase !== "loading") return;
    let idx = 0;
    let prog = 0;
    const totalDur = LOADING_STEPS.reduce((s, x) => s + x.dur, 0);
    let elapsed = 0;

    function tick() {
      if (idx >= LOADING_STEPS.length) return;
      const step = LOADING_STEPS[idx];
      elapsed += step.dur;
      prog = Math.round((elapsed / totalDur) * 90); // cap at 90 — API resolves the last 10%
      setStepIdx(idx);
      setProgress(prog);
      idx++;
      timerRef.current = setTimeout(tick, step.dur);
    }
    timerRef.current = setTimeout(tick, 0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  const run = async () => {
    setPhase("loading");
    setStepIdx(0);
    setProgress(0);
    try {
      const res  = await studioAiFetch("/api/automate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow }),
      });
      const data = await res.json() as
        | { ok: true;  workflow: Workflow; automationSummary: string }
        | { ok: false; error: string };
      if (!data.ok) { setError((data as { ok: false; error: string }).error); setPhase("error"); return; }
      const result = data as { ok: true; workflow: Workflow; automationSummary: string };
      setSummary(result.automationSummary);
      saveCurrentStateSnapshot();
      setWorkflow(result.workflow);
      setProgress(100);
      setStepIdx(LOADING_STEPS.length - 1);
      setTimeout(() => applyAutoLayout(), 80);
      setTimeout(() => setPhase("done"), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0b102099", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 580, maxWidth: "94vw", background: "#0a0f1e", borderRadius: 16, border: "1px solid #1e2d4a", overflow: "hidden", boxShadow: "0 32px 80px #00000099" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "linear-gradient(90deg, #100820, #0d1a35)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>⚡ Generate Automated Version</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>AI will design the future-state workflow from your current process map</div>
          </div>
          {phase !== "loading" && (
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>&times;</button>
          )}
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── CONFIRM ── */}
          {phase === "confirm" && (
            <>
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                  I&apos;ll analyse your current-state workflow ({totalCount} steps, {humanCount} human tasks) and generate an optimised automated version with output contracts, blast-radius guardrails, and retry policies.
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["⚡", "Automate file movement, data entry, and routine communications"],
                    ["👤", "Keep genuine human decisions, approvals, and judgment calls"],
                    ["🔗", "Add integration nodes for Power Automate, SharePoint, Teams, etc."],
                    ["📋", "Every AI skill gets an output contract and escalation policy"],
                  ].map(([icon, text], i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: "#64748b" }}>
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={btn("#334155", "#1e293b")}>Cancel</button>
                <button type="button" onClick={() => void run()} style={{ ...btn("#7c3aed", "#100820"), boxShadow: "0 0 20px #7c3aed44" }}>⚡ Generate Automated Version</button>
              </div>
            </>
          )}

          {/* ── LOADING — animated step-by-step ── */}
          {phase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBlock: 8 }}>

              {/* Progress bar */}
              <div style={{ position: "relative", height: 6, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
                  borderRadius: 99,
                  transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 0 12px #7c3aed88",
                }} />
              </div>

              {/* Steps list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {LOADING_STEPS.map((step, i) => {
                  const done    = i < stepIdx;
                  const active  = i === stepIdx;
                  const pending = i > stepIdx;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 14px",
                        borderRadius: 8,
                        background: active ? "#7c3aed11" : "transparent",
                        border: active ? "1px solid #7c3aed44" : "1px solid transparent",
                        transition: "all 0.3s ease",
                        opacity: pending ? 0.35 : 1,
                      }}
                    >
                      <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                        {done ? "✓" : active ? step.icon : step.icon}
                      </span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: active ? 700 : done ? 500 : 400,
                        color: active ? "#c4b5fd" : done ? "#22c55e" : "#475569",
                        flex: 1,
                      }}>
                        {step.label}
                      </span>
                      {done && <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Done</span>}
                      {active && (
                        <span style={{ display: "flex", gap: 3 }}>
                          {[0, 1, 2].map((d) => (
                            <span key={d} style={{
                              width: 4, height: 4, borderRadius: "50%",
                              background: "#7c3aed",
                              animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                              display: "inline-block",
                            }} />
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
                Calling GPT-4.1 — this usually takes 15–30 seconds&hellip;
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <>
              <div style={{ background: "#0a1a12", border: "1px solid #22c55e44", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>✓ Future State Loaded</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{summary}</div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                The canvas now shows the automated version. Your original process map is preserved — click <strong style={{ color: "#94a3b8" }}>Brief</strong> to generate the executive summary, or <strong style={{ color: "#94a3b8" }}>Proposal</strong> for a client-ready PDF.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={{ ...btn("#22c55e", "#0a1a12"), boxShadow: "0 0 16px #22c55e33" }}>Done — View Canvas</button>
              </div>
            </>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <>
              <div style={{ fontSize: 12, color: "#fca5a5", background: "#7f1d1d22", borderRadius: 8, padding: "10px 14px" }}>{error}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={btn("#334155", "#1e293b")}>Cancel</button>
                <button type="button" onClick={() => void run()} style={btn("#7c3aed", "#100820")}>Retry</button>
              </div>
            </>
          )}

        </div>

        {/* CSS for dot pulse animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    </div>
  );
}

function btn(borderColor: string, bg: string): React.CSSProperties {
  return { padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", background: bg, border: `1px solid ${borderColor}`, color: "#e2e8f0" };
}
