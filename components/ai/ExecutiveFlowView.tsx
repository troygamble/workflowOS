"use client";

import type {
  ExecutiveBriefResponse,
  ExecPhase,
  ExecHuman,
} from "@/app/api/executive-brief/route";
import type { Workflow, HumanNodeData } from "@/lib/types/workflow";

// ─── ROI helpers ──────────────────────────────────────────────────────────────

const HOURLY_RATE = 80;   // avg knowledge-worker cost, USD
const PS_DAY_RATE = 1500; // professional services day rate, USD

type RoiMetrics = {
  annualSavings: number;
  psCost: number;
  paybackMonths: number;
  threeYearNet: number;
  roiPct: number;
};

function computeRoi(bd: ExecutiveBriefResponse["automationBreakdown"]): RoiMetrics | null {
  if (!bd.weeklySavedHours || !bd.psDaysEstimate) return null;
  const annualSavings = Math.round(bd.weeklySavedHours * 52 * HOURLY_RATE);
  const psCost = Math.round(bd.psDaysEstimate * PS_DAY_RATE);
  const paybackMonths = psCost > 0 ? Math.ceil(psCost / (annualSavings / 12)) : 0;
  const threeYearNet = annualSavings * 3 - psCost;
  const roiPct = psCost > 0 ? Math.round((threeYearNet / psCost) * 100) : 0;
  return { annualSavings, psCost, paybackMonths, threeYearNet, roiPct };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// ─── Flow sequence builder ────────────────────────────────────────────────────

type FlowItem =
  | { type: "trigger"; summary: string }
  | { type: "phase"; phase: ExecPhase; phaseIndex: number }
  | { type: "gate"; human: ExecHuman };

function buildSequence(brief: ExecutiveBriefResponse): FlowItem[] {
  const phases = brief.phases;
  const humans = brief.humanTouchpoints;
  const afterPhase = new Map<number, ExecHuman[]>();

  for (let j = 0; j < humans.length; j++) {
    const human = humans[j];
    const humanWords = human.name
      .toLowerCase()
      .replace(/[_]/g, " ")
      .split(" ")
      .filter((w) => w.length > 3);

    let best = -1;
    for (let i = 0; i < phases.length; i++) {
      const text = (phases[i].name + " " + phases[i].steps.join(" ")).toLowerCase();
      if (humanWords.some((w) => text.includes(w))) { best = i; break; }
    }
    if (best === -1) {
      best = Math.min(phases.length - 1, Math.floor((j / humans.length) * phases.length));
    }
    const arr = afterPhase.get(best) ?? [];
    arr.push(human);
    afterPhase.set(best, arr);
  }

  const triggerHint = brief.summary.split(".")[0] ?? brief.title;
  const items: FlowItem[] = [{ type: "trigger", summary: triggerHint }];
  for (let i = 0; i < phases.length; i++) {
    items.push({ type: "phase", phase: phases[i], phaseIndex: i });
    for (const h of afterPhase.get(i) ?? []) {
      items.push({ type: "gate", human: h });
    }
  }
  return items;
}

// ─── ROI bar ──────────────────────────────────────────────────────────────────

function RoiBar({ roi, hours }: { roi: RoiMetrics; hours: number }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "16px 20px",
        background: "linear-gradient(135deg, #0a1a0a, #061a0c)",
        border: "1.5px solid #166534",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
        Business Case — Automation ROI
      </div>
      <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
        {[
          { label: "Hours saved / week", value: `${hours}h`, color: "#a78bfa" },
          { label: "Annual savings", value: fmt(roi.annualSavings), color: "#22c55e" },
          { label: "PS cost to implement", value: fmt(roi.psCost), color: "#0891b2" },
          { label: "Payback period", value: `${roi.paybackMonths} mo`, color: "#f59e0b" },
          { label: "3-year net benefit", value: fmt(roi.threeYearNet), color: "#22c55e" },
          { label: "3-year ROI", value: `${roi.roiPct}%`, color: "#86efac" },
        ].map(({ label, value, color }, i) => (
          <div
            key={i}
            style={{
              flex: "1 1 30%",
              minWidth: 100,
              padding: "10px 12px",
              borderRight: i % 3 !== 2 ? "1px solid #1a2e1a" : "none",
              borderBottom: i < 3 ? "1px solid #1a2e1a" : "none",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: "#166534", lineHeight: 1.5 }}>
        Assumptions: ${HOURLY_RATE}/hr avg. knowledge-worker cost &middot; ${PS_DAY_RATE.toLocaleString()}/day PS implementation rate &middot; ${hours}h/week freed from manual work
      </div>
    </div>
  );
}

// ─── Trigger block ────────────────────────────────────────────────────────────

function TriggerBlock({ title, summary }: { title: string; summary: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #0c1a2e, #0d2040)",
          border: "1.5px solid #1e3a5f",
          borderRadius: 12,
          padding: "18px 22px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#67e8f9", textTransform: "uppercase", marginBottom: 8 }}>
          ⚡ Workflow Trigger
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{summary}.</div>
      </div>
      <div style={{ width: 2, height: 20, background: "#1e293b", alignSelf: "center", flexShrink: 0 }} />
    </div>
  );
}

// ─── Phase block ──────────────────────────────────────────────────────────────

function PhaseBlock({ phase, index, isLast }: { phase: ExecPhase; index: number; isLast: boolean }) {
  const colors = ["#3b82f6", "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899"];
  const color = colors[index % colors.length];
  const looksAutomated = !phase.steps.some((s) =>
    /human|review|approv|decision|judgment|manual|director|sponsor/i.test(s)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${color}33`,
          borderLeft: `4px solid ${color}`,
          borderRadius: "0 10px 10px 0",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "20", border: `1.5px solid ${color}`, color, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {index + 1}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", flex: 1 }}>{phase.name}</div>
          {looksAutomated && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#052e16", border: "1px solid #166534", color: "#86efac", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
              ⚡ Automated
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>{phase.description}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {phase.steps.slice(0, 4).map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#94a3b8" }}>
              <span style={{ color: color + "99", flexShrink: 0 }}>›</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
      {!isLast && <div style={{ width: 2, height: 20, background: "#1e293b", alignSelf: "center", flexShrink: 0 }} />}
    </div>
  );
}

// ─── Human gate ───────────────────────────────────────────────────────────────

function HumanGate({ human, isLast }: { human: ExecHuman; isLast: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 2, height: 14, background: "#7c3aed44", flexShrink: 0 }} />
      <div style={{ width: "82%", background: "#1a1020", border: "1.5px solid #7c3aed66", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#7c3aed20", border: "1.5px solid #7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#a78bfa", textTransform: "uppercase", marginBottom: 5 }}>Decision Required</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{human.name.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 10, color: "#7c3aed", background: "#7c3aed18", border: "1px solid #7c3aed33", borderRadius: 999, padding: "1px 8px", display: "inline-block", marginBottom: 6 }}>{human.role}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{human.decision}</div>
        </div>
      </div>
      {!isLast && <div style={{ width: 2, height: 14, background: "#7c3aed44", flexShrink: 0 }} />}
    </div>
  );
}

// ─── Outputs bar ──────────────────────────────────────────────────────────────

function OutputsBar({ outputs }: { outputs: ExecutiveBriefResponse["keyOutputs"] }) {
  if (!outputs.length) return null;
  return (
    <div style={{ marginTop: 4, padding: "14px 18px", background: "#0a1a12", border: "1px solid #166534", borderRadius: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
        What this workflow produces
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {outputs.map((o, i) => (
          <div key={i} style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "8px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#86efac" }}>📄 {o.name.replace(/_/g, " ").replace(/\.\w+$/, "")}</div>
            <div style={{ fontSize: 11, color: "#4ade80", marginTop: 2 }}>{o.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Before / After banner ───────────────────────────────────────────────────

function computeCurrentStateStats(snap: Workflow): { steps: number; humanMinutesPerRun: number; humanSteps: number } {
  const humanNodes = snap.nodes.filter((n) => n.type === "human");
  const humanMinutesPerRun = humanNodes.reduce((sum, n) => {
    const d = n.data as HumanNodeData;
    return sum + (d.minutesPerOccurrence ?? 0);
  }, 0);
  return { steps: snap.nodes.length, humanMinutesPerRun, humanSteps: humanNodes.length };
}

function TransformationBanner({ snapshot, brief }: {
  snapshot: Workflow;
  brief: ExecutiveBriefResponse;
}) {
  const curr = computeCurrentStateStats(snapshot);
  const futureSteps = brief.phases.reduce((s, p) => s + p.steps.length, 0);
  const savedHours = brief.automationBreakdown?.weeklySavedHours ?? 0;
  const currHrsPerRun = curr.humanMinutesPerRun > 0 ? (curr.humanMinutesPerRun / 60).toFixed(1) : null;

  return (
    <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
      <div style={{ background: "linear-gradient(90deg, #100820, #0a1a35)", padding: "10px 18px", fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Before → After Transformation
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", background: "#0a0f1e" }}>
        {/* Before */}
        <div style={{ padding: "14px 18px", borderRight: "1px solid #1e293b" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Today (Manual)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Stat label="Total steps" value={`${curr.steps}`} color="#ef4444" />
            <Stat label="Manual steps" value={`${curr.humanSteps}`} color="#ef4444" />
            {currHrsPerRun && <Stat label="Time per run" value={`${currHrsPerRun}h`} color="#ef4444" />}
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px", fontSize: 20, color: "#334155" }}>→</div>

        {/* After */}
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Tomorrow (Automated)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Stat label="Automated steps" value={`${futureSteps}`} color="#22c55e" />
            <Stat label="Human steps" value={`${brief.humanTouchpoints.length}`} color="#22c55e" />
            {savedHours > 0 && <Stat label="Hours saved/wk" value={`${savedHours}h`} color="#22c55e" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ExecutiveFlowView({ brief, currentStateSnapshot }: { brief: ExecutiveBriefResponse; currentStateSnapshot?: Workflow }) {
  const sequence = buildSequence(brief);
  const readinessColor =
    brief.readinessScore >= 75 ? "#22c55e" : brief.readinessScore >= 50 ? "#f59e0b" : "#ef4444";
  const roi = brief.automationBreakdown ? computeRoi(brief.automationBreakdown) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Transformation Banner */}
      {currentStateSnapshot && currentStateSnapshot.nodes.length > 0 && (
        <TransformationBanner snapshot={currentStateSnapshot} brief={brief} />
      )}
      {/* Flow */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {sequence.map((item, i) => {
          const isLast = i === sequence.length - 1;
          if (item.type === "trigger") return <TriggerBlock key="trigger" title={brief.title} summary={item.summary} />;
          if (item.type === "phase") return <PhaseBlock key={i} phase={item.phase} index={item.phaseIndex} isLast={isLast} />;
          return <HumanGate key={i} human={item.human} isLast={isLast} />;
        })}
      </div>

      {/* Outputs */}
      <OutputsBar outputs={brief.keyOutputs} />

      {/* ROI */}
      {roi && brief.automationBreakdown?.weeklySavedHours && (
        <RoiBar roi={roi} hours={brief.automationBreakdown.weeklySavedHours} />
      )}

      {/* Readiness footer */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${readinessColor} ${brief.readinessScore * 3.6}deg, #1e293b 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: readinessColor, lineHeight: 1 }}>{brief.readinessScore}</span>
            <span style={{ fontSize: 7, color: "#475569" }}>/100</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: readinessColor, marginBottom: 4 }}>
            {brief.readinessScore >= 75 ? "Execution Ready" : brief.readinessScore >= 50 ? "Needs Refinement" : "Significant Gaps"}
          </div>
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>{brief.readinessRationale}</div>
        </div>
      </div>
    </div>
  );
}
