"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { ExecutiveFlowView } from "./ExecutiveFlowView";
import { downloadFlowViewHtml } from "@/lib/io/flow-view-html";
import type {
  ExecutiveBriefResponse,
  ExecPhase,
  ExecHuman,
  ExecOutput,
  ExecGap,
  AutomationStep,
} from "@/app/api/executive-brief/route";
import { studioAiFetch } from "@/lib/studio/openai-key-client";

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 200,
  background: "#0b102099", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const panel: React.CSSProperties = {
  width: 800, maxWidth: "96vw", maxHeight: "92vh",
  background: "#0a0f1e",
  borderRadius: 14,
  border: "1px solid #1e2d4a",
  display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 32px 80px #00000088",
};

const scrollBody: React.CSSProperties = {
  flex: 1, overflowY: "auto", padding: "24px 28px",
  display: "flex", flexDirection: "column", gap: 24,
};

const footer: React.CSSProperties = {
  padding: "14px 24px", borderTop: "1px solid #1e293b",
  display: "flex", gap: 10, justifyContent: "flex-end",
  background: "#080e1c",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px", ...style }}>
      {children}
    </div>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Execution Ready" : score >= 50 ? "Needs Refinement" : "Significant Gaps";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
        background: `conic-gradient(${color} ${score * 3.6}deg, #1e293b 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: "50%", background: "#0a0f1e",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column",
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 8, color: "#64748b" }}>/ 100</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Automation readiness score</div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: ExecPhase; index: number }) {
  const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899"];
  const color = colors[index % colors.length];
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: color + "20",
        border: `1.5px solid ${color}44`, color, fontWeight: 700, fontSize: 12,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{phase.name}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 8 }}>{phase.description}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {phase.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#64748b" }}>
              <span style={{ color: color + "88", flexShrink: 0 }}>&rsaquo;</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HumanCard({ h }: { h: ExecHuman }) {
  return (
    <div style={{ background: "#1a1020", border: "1px solid #7c3aed33", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>👤</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>{h.name.replace(/_/g, " ")}</span>
        <span style={{ fontSize: 10, color: "#7c3aed", background: "#7c3aed22", padding: "1px 8px", borderRadius: 999 }}>{h.role}</span>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", paddingLeft: 22 }}>{h.decision}</div>
    </div>
  );
}

function OutputCard({ o }: { o: ExecOutput }) {
  return (
    <div style={{ background: "#0a1a12", border: "1px solid #22c55e22", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#86efac", marginBottom: 3 }}>{o.name.replace(/_/g, " ").replace(/\.\w+$/, "")}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{o.description}</div>
      <div style={{ fontSize: 11, color: "#22c55e", fontStyle: "italic" }}>Value: {o.value}</div>
    </div>
  );
}

function GapCard({ gap }: { gap: ExecGap }) {
  const colors: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#64748b" };
  const bgs: Record<string, string> = { high: "#1a0505", medium: "#1a1005", low: "#0f172a" };
  const color = colors[gap.severity] ?? "#64748b";
  const bg = bgs[gap.severity] ?? "#0f172a";
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color, background: color + "22", padding: "1px 8px", borderRadius: 999 }}>
          {gap.severity}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{gap.title}</span>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{gap.description}</div>
    </div>
  );
}

function AutomationStepRow({ step, canAutomate }: { step: AutomationStep; canAutomate: boolean }) {
  const accentColor = canAutomate ? "#3b82f6" : "#f59e0b";
  const bg = canAutomate ? "#060d1f" : "#0a0a00";
  return (
    <div style={{ background: bg, border: `1px solid ${accentColor}22`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{canAutomate ? "⚡" : "👤"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{step.name.replace(/_/g, " ")}</span>
          <span style={{ fontSize: 10, color: accentColor, background: accentColor + "18", border: `1px solid ${accentColor}44`, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>
            {step.tool}
          </span>
          {canAutomate && (
            <span style={{ fontSize: 10, color: "#64748b" }}>{step.effort}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{step.reason}</div>
      </div>
    </div>
  );
}

function AutomationBreakdownSection({ bd }: { bd: ExecutiveBriefResponse["automationBreakdown"] }) {
  const total = bd.automatedCount + bd.automatableSteps.length + bd.staysHumanSteps.length;
  const automatedPct = total > 0 ? Math.round(((bd.automatedCount + bd.automatableSteps.length) / total) * 100) : 0;
  const alreadyPct = total > 0 ? Math.round((bd.automatedCount / total) * 100) : 0;
  const barBg = `linear-gradient(90deg, #22c55e ${alreadyPct}%, #3b82f6 ${alreadyPct}% ${automatedPct}%, #1e293b ${automatedPct}%)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{bd.automatedCount}</div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Already automated</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>{bd.automatableSteps.length}</div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Can automate</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{bd.staysHumanSteps.length}</div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stays human</div>
          </div>
          {bd.weeklySavedHours != null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>{bd.weeklySavedHours}h</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Saved/week</div>
            </div>
          )}
          {bd.psDaysEstimate != null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0891b2" }}>{bd.psDaysEstimate}d</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>PS to implement</div>
            </div>
          )}
        </div>
        <div style={{ background: "#1e293b", borderRadius: 999, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 999, background: barBg, width: "100%" }} />
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{automatedPct}% automatable (today + with PS work)</div>
      </div>

      {bd.automatableSteps.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Can be automated</div>
          {bd.automatableSteps.map((s, i) => <AutomationStepRow key={i} step={s} canAutomate />)}
        </div>
      )}

      {bd.staysHumanSteps.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Stays human</div>
          {bd.staysHumanSteps.map((s, i) => <AutomationStepRow key={i} step={s} canAutomate={false} />)}
        </div>
      )}
    </div>
  );
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

type ViewMode = "flow" | "brief";

function TabSwitcher({ active, onChange }: { active: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
      {(["flow", "brief"] as ViewMode[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            border: "none", borderRadius: 0, padding: "5px 14px",
            background: active === v ? (v === "flow" ? "#0891b233" : "#3b82f633") : "transparent",
            color: active === v ? (v === "flow" ? "#67e8f9" : "#93c5fd") : "#475569",
            borderBottom: active === v ? `2px solid ${v === "flow" ? "#0891b2" : "#3b82f6"}` : "2px solid transparent",
            fontWeight: active === v ? 700 : 400,
            fontSize: 12, cursor: "pointer",
          }}
        >
          {v === "flow" ? "▶ Flow View" : "≡ Full Brief"}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "ready";

export function ExecutiveBriefModal({ onClose }: { onClose: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const currentStateSnapshot = useWorkflowStore((s) => s.currentStateSnapshot);
  const [phase, setPhase] = useState<Phase>("idle");
  const [brief, setBrief] = useState<ExecutiveBriefResponse | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("flow");

  const generate = async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await studioAiFetch("/api/executive-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow }),
      });
      const data = await res.json() as ({ ok: true } & ExecutiveBriefResponse) | { ok: false; error: string };
      if (!data.ok) { setError((data as { ok: false; error: string }).error); setPhase("idle"); return; }
      setBrief(data as ExecutiveBriefResponse);
      setPhase("ready");
      setViewMode("flow");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("idle");
    }
  };

  return (
    <div style={overlay}>
      <div style={panel}>

        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #1e293b",
          background: "linear-gradient(90deg, #080e1c, #0d1a35)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              Executive Brief
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Plain-English summary for stakeholders and leadership
            </div>
          </div>
          {phase === "ready" && brief && (
            <TabSwitcher active={viewMode} onChange={setViewMode} />
          )}
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4, lineHeight: 1 }}>&times;</button>
        </div>

        {/* Body */}
        <div style={scrollBody}>

          {phase === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBlock: 8 }}>
              <Card>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
                  Generate a board-ready summary of this workflow in plain English. The brief will cover:
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    ["📌", "What this workflow is trying to accomplish"],
                    ["🔄", "How it works, broken into plain-English phases"],
                    ["👤", "Where humans are involved and what decisions they make"],
                    ["📄", "What documents and reports it produces"],
                    ["⚠️", "Gaps, missing steps, or unclear ownership"],
                    ["🎯", "An overall automation readiness score"],
                  ] as [string, string][]).map(([icon, text], idx) => (
                    <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12, color: "#64748b" }}>
                      <span style={{ flexShrink: 0 }}>{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </Card>
              {error && (
                <div style={{ fontSize: 12, color: "#fca5a5", background: "#7f1d1d22", borderRadius: 8, padding: "10px 14px" }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {phase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, flex: 1, paddingBlock: 60 }}>
              <div style={{ fontSize: 36 }}>📋</div>
              <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Writing executive brief&hellip;</div>
              <div style={{ fontSize: 12, color: "#334155" }}>Analyzing workflow structure and business logic</div>
            </div>
          )}

          {phase === "ready" && brief && viewMode === "flow" && (
            <ExecutiveFlowView brief={brief} currentStateSnapshot={currentStateSnapshot} />
          )}

          {phase === "ready" && brief && viewMode === "brief" && (
            <>
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3, marginBottom: 10 }}>
                    {brief.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{brief.summary}</div>
                </div>
                <ReadinessRing score={brief.readinessScore} />
              </div>

              <Card style={{ borderColor: "#1e3a5f", background: "#060d1f" }}>
                <SectionHead>Problem Being Solved</SectionHead>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{brief.problem}</div>
              </Card>

              <div>
                <SectionHead>How It Works &mdash; Step by Step</SectionHead>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {brief.phases.map((p, i) => (
                    <Card key={i}>
                      <PhaseCard phase={p} index={i} />
                    </Card>
                  ))}
                </div>
              </div>

              {brief.humanTouchpoints.length > 0 && (
                <div>
                  <SectionHead>Human Decision Points ({brief.humanTouchpoints.length})</SectionHead>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {brief.humanTouchpoints.map((h, i) => <HumanCard key={i} h={h} />)}
                  </div>
                </div>
              )}

              {brief.keyOutputs.length > 0 && (
                <div>
                  <SectionHead>What This Workflow Produces</SectionHead>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {brief.keyOutputs.map((o, i) => <OutputCard key={i} o={o} />)}
                  </div>
                </div>
              )}

              {brief.automationBreakdown && (
                <div>
                  <SectionHead>Automation Breakdown</SectionHead>
                  <AutomationBreakdownSection bd={brief.automationBreakdown} />
                </div>
              )}

              {brief.gaps.length > 0 && (
                <div>
                  <SectionHead>Gaps &amp; Recommendations ({brief.gaps.length})</SectionHead>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {brief.gaps.map((g, i) => <GapCard key={i} gap={g} />)}
                  </div>
                </div>
              )}

              <Card style={{ borderColor: "#1e293b" }}>
                <SectionHead>Readiness Assessment</SectionHead>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{brief.readinessRationale}</div>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footer}>
          {phase === "idle" && (
            <>
              <button type="button" onClick={onClose} style={btnStyle("#334155", "#1e293b")}>Cancel</button>
              <button type="button" onClick={() => void generate()} style={btnStyle("#3b82f6", "#0d1a35")}>
                Generate Brief
              </button>
            </>
          )}
          {phase === "ready" && brief && (
            <>
              <button type="button" onClick={() => { setBrief(null); setPhase("idle"); }} style={btnStyle("#334155", "#1e293b")}>Regenerate</button>
              <button
                type="button"
                onClick={() => downloadFlowViewHtml(brief)}
                style={btnStyle("#0891b2", "#061a24")}
                title="Download as standalone HTML to share with stakeholders"
              >
                ⬇ Export HTML
              </button>
              <button type="button" onClick={onClose} style={btnStyle("#22c55e", "#0a1a12")}>Done</button>
            </>
          )}
          {phase === "loading" && (
            <button type="button" onClick={onClose} style={btnStyle("#334155", "#1e293b")}>Cancel</button>
          )}
        </div>

      </div>
    </div>
  );
}

function btnStyle(borderColor: string, bg: string): React.CSSProperties {
  return {
    padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13,
    cursor: "pointer", background: bg,
    border: `1px solid ${borderColor}`,
    color: "#e2e8f0",
  };
}
