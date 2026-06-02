"use client";

import { useState } from "react";
import { WORKFLOW_TEMPLATES } from "@/lib/templates";
import { useWorkflowStore } from "@/store/workflow-store";

const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#3b82f6", HR: "#8b5cf6", PMO: "#06b6d4",
  Legal: "#f59e0b", IT: "#22c55e", Sales: "#ec4899", Knowledge: "#a78bfa",
};

export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);
  const workflow = useWorkflowStore((s) => s.workflow);
  const [tab, setTab] = useState<"current" | "future">("current");

  const load = (id: string) => {
    const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (workflow.nodes.length > 0 && !window.confirm(`Load "${tpl.name}"? This will replace the current canvas.`)) return;
    const w = tpl.build();
    setWorkflow(w);
    setTimeout(() => applyAutoLayout(), 80);
    onClose();
  };

  const currentTemplates = WORKFLOW_TEMPLATES.filter((t) => !t.id.endsWith("-fs") && t.id !== "pdf-to-obsidian");
  const futureTemplates = WORKFLOW_TEMPLATES.filter((t) => t.id.endsWith("-fs") || t.id === "pdf-to-obsidian");
  const shown = tab === "current" ? currentTemplates : futureTemplates;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0b102099", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 880, maxWidth: "96vw", maxHeight: "90vh", background: "#0a0f1e", borderRadius: 14, border: "1px solid #1e2d4a", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px #00000088" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "linear-gradient(90deg, #080e1c, #0d1a35)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>
              {tab === "current" ? "\u{1F4C1} Process Templates" : "\u26A1 Contract Map Templates"}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              {tab === "current"
                ? "Real manual processes \u2014 load one, then hit Automate This to generate the AI-automated version"
                : "AI-automated workflows with output contracts, blast radius, and autonomy levels. Export to run with Claude Code."}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>&times;</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, padding: "0 24px", borderBottom: "1px solid #1e293b", background: "#080c18" }}>
          <TabBtn
            label="Current State"
            sublabel={currentTemplates.length + " process maps"}
            active={tab === "current"}
            onClick={() => setTab("current")}
          />
          <TabBtn
            label="Future State (AI)"
            sublabel={futureTemplates.length + " contract-ready workflows"}
            active={tab === "future"}
            onClick={() => setTab("future")}
            accent={true}
          />
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16, alignContent: "start" }}>
          {shown.map((tpl) => {
            const catColor = CATEGORY_COLORS[tpl.category] ?? "#64748b";
            const isFuture = tab === "future";
            return (
              <div
                key={tpl.id}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 12, padding: "18px 20px",
                  display: "flex", flexDirection: "column", gap: 12,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onClick={() => load(tpl.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = catColor + "88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e293b"; }}
              >
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>
                    {isFuture ? "\u26A1" : tpl.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{tpl.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: catColor, background: catColor + "18", border: "1px solid " + catColor + "44", borderRadius: 999, padding: "1px 8px" }}>
                        {tpl.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{tpl.description}</div>
                  </div>
                </div>

                {/* Body */}
                {isFuture ? (
                  <FutureStateCardBody tpl={tpl} />
                ) : (
                  <CurrentStateCardBody tpl={tpl} />
                )}

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); load(tpl.id); }}
                    style={{
                      fontSize: 11, fontWeight: 700,
                      color: isFuture ? "#a78bfa" : catColor,
                      background: isFuture ? "#7c3aed18" : catColor + "18",
                      border: "1px solid " + (isFuture ? "#7c3aed44" : catColor + "44"),
                      borderRadius: 6, padding: "4px 14px", cursor: "pointer",
                    }}
                  >
                    {isFuture ? "Load contract map \u2192" : "Load \u2192"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #1e293b", background: "#080e1c", fontSize: 11, color: "#334155", textAlign: "center" }}>
          {tab === "current"
            ? "Current-state templates capture manual processes. Load one, then use Automate This to generate the AI-automated future-state workflow."
            : "Future-state templates have full output contracts and blast radius. Export to ZIP to get a runnable Claude Code project with hook enforcement."}
        </div>
      </div>
    </div>
  );
}

type TabBtnProps = { label: string; sublabel: string; active: boolean; onClick: () => void; accent?: boolean };

function TabBtn({ label, sublabel, active, onClick, accent }: TabBtnProps) {
  const accentColor = accent ? "#7c3aed" : "#3b82f6";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: "10px 20px",
        borderBottom: active ? "2px solid " + accentColor : "2px solid transparent",
        color: active ? "#e2e8f0" : "#475569",
        transition: "all 0.15s",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 10, color: active ? (accent ? "#a78bfa" : "#64748b") : "#334155", marginTop: 1 }}>{sublabel}</div>
    </button>
  );
}

type TplType = typeof WORKFLOW_TEMPLATES[number];

function CurrentStateCardBody({ tpl }: { tpl: TplType }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Current pain points</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {tpl.painPoints.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "#64748b" }}>
            <span style={{ color: "#ef4444", flexShrink: 0 }}>\u2717</span>
            <span>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FutureStateCardBody({ tpl }: { tpl: TplType }) {
  let skillCount = 0, contractCount = 0, hasBlastRadius = false;
  try {
    const w = tpl.build();
    skillCount = w.nodes.filter((n) => n.type === "skill").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contractCount = w.nodes.filter((n) => n.type === "artifact" && (n.data as any).outputContract).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasBlastRadius = w.nodes.some((n) => n.type === "skill" && (n.data as any).blastRadius);
  } catch {
    // build may fail in SSR context — degrade gracefully
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {skillCount > 0 && <ContractBadge label={skillCount + " AI skills"} color="#818cf8" />}
      {contractCount > 0 && <ContractBadge label={contractCount + " output contracts"} color="#22c55e" />}
      {hasBlastRadius && <ContractBadge label="blast radius set" color="#f59e0b" />}
      <ContractBadge label="export-ready" color="#3b82f6" />
    </div>
  );
}

function ContractBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color, background: color + "15",
      border: "1px solid " + color + "30",
      borderRadius: 4, padding: "2px 7px",
    }}>
      {label}
    </span>
  );
}
