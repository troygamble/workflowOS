"use client";

import { useMemo, useRef, useState } from "react";
import { deriveState } from "@/lib/state/state-engine";
import { explainNode } from "@/lib/state/why-engine";
import { useRuntimeStore } from "@/store/runtime-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type {
  ArtifactNodeData,
  ConditionalNodeData,
  AutonomyLevel,
  BlastRadius,
  EscalationPolicy,
  HumanNodeData,
  HumanSubtype,
  IntegrationNodeData,
  OutputContract,
  ProposalNodeData,
  RetryPolicy,
  RiskCategory,
  SkillNodeData,
  SystemNodeData,
  Workflow,
  WorkflowNode,
} from "@/lib/types/workflow";

// ── Palette ──────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  skill:       "#3b82f6",
  artifact:    "#8b5cf6",
  human:       "#f59e0b",
  integration: "#0ea5e9",
  proposal:    "#ec4899",
  system:      "#64748b",
  conditional: "#f97316",
};

// ── Style constants ───────────────────────────────────────────────────────────

const panelCss: React.CSSProperties = {
  borderLeft: "1px solid rgba(148,163,184,0.16)",
  display: "grid",
  gap: 0,
  alignContent: "start",
  overflow: "auto",
  background: "linear-gradient(180deg, rgba(8,15,30,0.96) 0%, rgba(5,10,20,0.98) 100%)",
  position: "relative",
  zIndex: 10,
  transform: "translateZ(0)",
  willChange: "transform",
  boxShadow: "inset 1px 0 0 rgba(255,255,255,0.025), -12px 0 36px rgba(0,0,0,0.18)",
};

const fieldCss: React.CSSProperties = { display: "grid", gap: 4 };

const labelCss: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.18)",
  color: "#e2e8f0",
  borderRadius: 7,
  padding: "5px 8px",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

const smallBtn: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 7,
  background: "rgba(15,23,42,0.38)",
  color: "#94a3b8",
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const dangerBtn: React.CSSProperties = {
  ...smallBtn,
  borderColor: "#ef444444",
  color: "#ef4444",
};

// ── Primitive inputs ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span style={labelCss}>{children}</span>;
}

function TextInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      style={inputStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextAreaInput({
  rows, value, onChange, placeholder,
}: { rows: number; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      style={textareaStyle}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SelectInput<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function linesToList(s: string): string[] {
  return s.split("\n").map((l) => l.trim()).filter(Boolean);
}

// ── Accordion ─────────────────────────────────────────────────────────────────

function Accordion({
  title, badge, accent, defaultOpen = false, children,
}: {
  title: string;
  badge?: number | string | null;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid #1a2540" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        {accent && (
          <div style={{ width: 2, height: 12, borderRadius: 1, background: accent, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: open ? "#cbd5e1" : "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>
          {title}
        </span>
        {badge != null && (
          <span style={{ fontSize: 9, fontWeight: 700, color: accent ?? "#94a3b8", background: (accent ?? "#94a3b8") + "22", border: `1px solid ${accent ?? "#94a3b8"}44`, borderRadius: 999, padding: "1px 6px" }}>
            {badge}
          </span>
        )}
        <span style={{ fontSize: 9, color: "#334155" }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Workflow summary ──────────────────────────────────────────────────────────

function generateSummary(workflow: Workflow): string {
  const skills = workflow.nodes.filter((n) => n.type === "skill");
  const artifacts = workflow.nodes.filter((n) => n.type === "artifact");
  const humans = workflow.nodes.filter((n) => n.type === "human");
  const proposals = workflow.nodes.filter((n) => n.type === "proposal" && (n.data as ProposalNodeData).status === "pending");
  if (skills.length === 0 && artifacts.length === 0) return "";
  const hasIncoming = new Set(workflow.edges.filter((e) => !e.derived).map((e) => e.target));
  const hasOutgoing = new Set(workflow.edges.filter((e) => !e.derived).map((e) => e.source));
  const entryArtifacts = artifacts.filter((n) => !hasIncoming.has(n.id));
  const terminalArtifacts = artifacts.filter((n) => !hasOutgoing.has(n.id));
  const integrations = workflow.nodes.filter((n) => n.type === "integration");
  const parts: string[] = [];
  if (entryArtifacts.length) {
    const names = entryArtifacts.length <= 2 ? entryArtifacts.map((n) => (n.data as ArtifactNodeData).fileName).join(", ") : null;
    parts.push(`${entryArtifacts.length} input${entryArtifacts.length !== 1 ? "s" : ""}${names ? ` (${names})` : ""}`);
  }
  if (skills.length) parts.push(`${skills.length} automated step${skills.length !== 1 ? "s" : ""}`);
  if (integrations.length) parts.push(`${integrations.length} integration${integrations.length !== 1 ? "s" : ""}`);
  if (humans.length) parts.push(`${humans.length} human checkpoint${humans.length !== 1 ? "s" : ""}`);
  if (terminalArtifacts.length) {
    const names = terminalArtifacts.length <= 2 ? terminalArtifacts.map((n) => (n.data as ArtifactNodeData).fileName).join(", ") : null;
    parts.push(`${terminalArtifacts.length} output${terminalArtifacts.length !== 1 ? "s" : ""}${names ? ` (${names})` : ""}`);
  }
  if (proposals.length) parts.push(`${proposals.length} pending proposal${proposals.length !== 1 ? "s" : ""}`);
  return parts.join(" · ");
}

// ── Autonomy & risk constants ─────────────────────────────────────────────────

const AUTONOMY_LEVELS: { level: AutonomyLevel; label: string; color: string; desc: string }[] = [
  { level: 0, label: "Suggest",    color: "#64748b", desc: "AI drafts — human executes" },
  { level: 1, label: "Approval",   color: "#f59e0b", desc: "Execute after human sign-off" },
  { level: 2, label: "Logged",     color: "#3b82f6", desc: "Execute + log + rollback available" },
  { level: 3, label: "Autonomous", color: "#22c55e", desc: "Fully autonomous within blast radius" },
];

const RISK_CATEGORIES: { value: RiskCategory; label: string; color: string }[] = [
  { value: "standard",        label: "Standard",        color: "#64748b" },
  { value: "customer_facing", label: "Customer-facing", color: "#f59e0b" },
  { value: "financial",       label: "Financial",       color: "#f97316" },
  { value: "legal",           label: "Legal",           color: "#ef4444" },
  { value: "critical",        label: "Critical",        color: "#dc2626" },
];

const HUMAN_SUBTYPES: { value: HumanSubtype; icon: string; label: string; color: string; potential: string }[] = [
  { value: "file_movement", icon: "📁", label: "File Movement", color: "#22c55e", potential: "Very High" },
  { value: "communication", icon: "💬", label: "Communication", color: "#3b82f6", potential: "High" },
  { value: "data_entry",    icon: "⌨",  label: "Data Entry",    color: "#3b82f6", potential: "High" },
  { value: "approval",      icon: "✓",  label: "Approval",      color: "#f59e0b", potential: "Medium" },
  { value: "judgment",      icon: "◉",  label: "Judgment",      color: "#f97316", potential: "Low" },
  { value: "physical",      icon: "◻",  label: "Physical",      color: "#ef4444", potential: "None" },
];

// ── Skill editor ──────────────────────────────────────────────────────────────

function SkillEditor({
  data, onChange,
}: { data: SkillNodeData; onChange: (patch: Record<string, unknown>) => void }) {
  const br = data.blastRadius ?? {} as BlastRadius;
  const setBR = (patch: Partial<BlastRadius>) => onChange({ blastRadius: { ...br, ...patch } });
  const rp = data.retryPolicy ?? {} as RetryPolicy;
  const setRP = (patch: Partial<RetryPolicy>) => onChange({ retryPolicy: { ...rp, ...patch } });
  const ep = data.escalationPolicy ?? {} as EscalationPolicy;
  const setEP = (patch: Partial<EscalationPolicy>) => onChange({ escalationPolicy: { ...ep, ...patch } });
  const currentLevel = data.autonomyLevel ?? 3;
  const currentRisk = data.riskCategory ?? "standard";
  const levelMeta = AUTONOMY_LEVELS.find((l) => l.level === currentLevel)!;
  const riskMeta = RISK_CATEGORIES.find((r) => r.value === currentRisk)!;
  const ioCount = (data.inputs?.length ?? 0) + (data.outputs?.length ?? 0);

  return (
    <>
      {/* Core fields — always visible */}
      <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1a2540" }}>
        <div style={fieldCss}>
          <FieldLabel>Name</FieldLabel>
          <TextInput value={data.name} onChange={(v) => onChange({ name: v })} />
        </div>
        <div style={fieldCss}>
          <FieldLabel>What does this step do?</FieldLabel>
          <TextAreaInput rows={2} value={data.description ?? ""} onChange={(v) => onChange({ description: v })} placeholder="Plain English description of this automated step." />
        </div>
        {/* Status chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: levelMeta.color, background: levelMeta.color + "18", border: `1px solid ${levelMeta.color}44`, borderRadius: 999, padding: "2px 8px" }}>
            {levelMeta.label}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: riskMeta.color, background: riskMeta.color + "18", border: `1px solid ${riskMeta.color}44`, borderRadius: 999, padding: "2px 8px" }}>
            {riskMeta.label} risk
          </span>
          {data.enabled === false && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#ef444418", border: "1px solid #ef444444", borderRadius: 999, padding: "2px 8px" }}>Disabled</span>
          )}
        </div>
      </div>

      {/* Autonomy & Risk */}
      <Accordion title="Autonomy & Risk" accent="#22c55e" badge={`L${currentLevel} · ${riskMeta.label}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {AUTONOMY_LEVELS.map(({ level, label, color, desc }) => (
            <button key={level} type="button" onClick={() => onChange({ autonomyLevel: level })}
              style={{ background: currentLevel === level ? color + "18" : "#0a0f1e", border: `1px solid ${currentLevel === level ? color : "#1e293b"}`, borderRadius: 6, padding: "6px 8px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: currentLevel === level ? color : "#475569" }}>{level} — {label}</span>
              <span style={{ fontSize: 9, color: "#334155", lineHeight: 1.4 }}>{desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
          {RISK_CATEGORIES.map(({ value, label, color }) => (
            <button key={value} type="button" onClick={() => onChange({ riskCategory: value })}
              style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999, border: `1px solid ${currentRisk === value ? color : "#1e293b"}`, background: currentRisk === value ? color + "18" : "transparent", color: currentRisk === value ? color : "#475569", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
        {(currentRisk === "financial" || currentRisk === "legal" || currentRisk === "critical") && (
          <div style={{ fontSize: 10, color: "#f97316", background: "#f9731608", border: "1px solid #f9731622", borderRadius: 6, padding: "4px 8px" }}>
            ⚠ High-risk steps should use Autonomy Level ≤ 1 or define an escalation path.
          </div>
        )}
      </Accordion>

      {/* I/O Contract */}
      <Accordion title="I/O Contract" accent="#3b82f6" badge={ioCount > 0 ? ioCount : null}>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          Define what this step consumes and produces. These names must match artifact file names.
        </p>
        <div style={fieldCss}><FieldLabel>Inputs (one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.inputs ?? []).join("\n")} onChange={(v) => onChange({ inputs: linesToList(v) })} placeholder="tasks.md" /></div>
        <div style={fieldCss}><FieldLabel>Outputs (one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.outputs ?? []).join("\n")} onChange={(v) => onChange({ outputs: linesToList(v) })} placeholder="schedule.md" /></div>
        <div style={fieldCss}><FieldLabel>Preconditions (one per line)</FieldLabel>
          <TextAreaInput rows={2} value={(data.requires ?? []).join("\n")} onChange={(v) => onChange({ requires: linesToList(v) })} placeholder="tasks.exists" /></div>
        <div style={fieldCss}><FieldLabel>Postconditions (one per line)</FieldLabel>
          <TextAreaInput rows={2} value={(data.produces ?? []).join("\n")} onChange={(v) => onChange({ produces: linesToList(v) })} placeholder="schedule.exists" /></div>
        <div style={fieldCss}><FieldLabel>Quality checks (one per line)</FieldLabel>
          <TextAreaInput rows={2} value={(data.validations ?? []).join("\n")} onChange={(v) => onChange({ validations: linesToList(v) })} placeholder="all tasks scheduled" /></div>
        <div style={fieldCss}><FieldLabel>Tags (comma-separated)</FieldLabel>
          <TextInput value={(data.tags ?? []).join(", ")} onChange={(v) => onChange({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="reporting, finance" /></div>
      </Accordion>

      {/* Blast Radius */}
      <Accordion title="Blast Radius" accent="#f97316">
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          Constrain what this step is allowed to affect.
        </p>
        <div style={fieldCss}><FieldLabel>Can write to (one path per line)</FieldLabel>
          <TextAreaInput rows={2} value={(br.allowedPaths ?? []).join("\n")} onChange={(v) => setBR({ allowedPaths: linesToList(v) })} placeholder="./output/" /></div>
        <div style={fieldCss}><FieldLabel>Must NOT write to (one path per line)</FieldLabel>
          <TextAreaInput rows={2} value={(br.blockedPaths ?? []).join("\n")} onChange={(v) => setBR({ blockedPaths: linesToList(v) })} placeholder=".env" /></div>
        <div style={fieldCss}><FieldLabel>Allowed APIs / services (one per line)</FieldLabel>
          <TextAreaInput rows={2} value={(br.allowedApis ?? []).join("\n")} onChange={(v) => setBR({ allowedApis: linesToList(v) })} placeholder="openai" /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Max runtime (s)</FieldLabel>
            <TextInput value={br.maxRuntimeSeconds != null ? String(br.maxRuntimeSeconds) : ""} onChange={(v) => setBR({ maxRuntimeSeconds: v === "" ? undefined : Number(v) })} placeholder="300" /></div>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Max cost (USD)</FieldLabel>
            <TextInput value={br.maxCostUsd != null ? String(br.maxCostUsd) : ""} onChange={(v) => setBR({ maxCostUsd: v === "" ? undefined : Number(v) })} placeholder="0.50" /></div>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, cursor: "pointer", color: "#e2e8f0" }}>
          <input type="checkbox" checked={br.noNetworkAccess ?? false} onChange={(e) => setBR({ noNetworkAccess: e.target.checked })} />
          No network access (air-gapped)
        </label>
      </Accordion>

      {/* Retry & Escalation */}
      <Accordion title="Retry & Escalation" accent="#8b5cf6">
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Max attempts</FieldLabel>
            <TextInput value={rp.maxAttempts != null ? String(rp.maxAttempts) : ""} onChange={(v) => setRP({ maxAttempts: v === "" ? undefined : Number(v) })} placeholder="3" /></div>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Backoff (s)</FieldLabel>
            <TextInput value={rp.backoffSeconds != null ? String(rp.backoffSeconds) : ""} onChange={(v) => setRP({ backoffSeconds: v === "" ? undefined : Number(v) })} placeholder="30" /></div>
        </div>
        <div style={fieldCss}><FieldLabel>Corrective prompt (injected on retry)</FieldLabel>
          <TextAreaInput rows={2} value={rp.correctivePrompt ?? ""} onChange={(v) => setRP({ correctivePrompt: v || undefined })} placeholder="Check that all frontmatter fields are present before writing." /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Escalate after N failures</FieldLabel>
            <TextInput value={ep.afterFailures != null ? String(ep.afterFailures) : ""} onChange={(v) => setEP({ afterFailures: v === "" ? undefined : Number(v) })} placeholder="3" /></div>
          <div style={{ ...fieldCss, flex: 2 }}><FieldLabel>Escalate to (node ID or role)</FieldLabel>
            <TextInput value={ep.escalateTo ?? ""} onChange={(v) => setEP({ escalateTo: v || undefined })} placeholder="finance-reviewer" /></div>
        </div>
        <div style={fieldCss}><FieldLabel>Escalation message</FieldLabel>
          <TextAreaInput rows={2} value={ep.escalationNote ?? ""} onChange={(v) => setEP({ escalationNote: v || undefined })} placeholder="This step failed repeatedly. Please review manually." /></div>
      </Accordion>

      {/* Runtime Target */}
      <Accordion title="Runtime" accent="#06b6d4" badge={data.runtimeTarget ?? null}>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          Choose which AI runtime executes this step. Defaults to the project-level runtime.
        </p>
        <div style={fieldCss}><FieldLabel>Runtime</FieldLabel>
          <SelectInput
            value={data.runtimeTarget ?? ""}
            options={[
              { value: "",            label: "— inherit project default —" },
              { value: "claude",      label: "☁  Claude (Anthropic API)" },
              { value: "openai",      label: "☁  OpenAI (GPT-4o, etc.)" },
              { value: "ollama_local",label: "🖥  Ollama (local — Hermes, Llama, Mistral…)" },
              { value: "azure_openai",label: "☁  Azure OpenAI" },
              { value: "bedrock",     label: "☁  AWS Bedrock" },
              { value: "custom",      label: "⚙  Custom endpoint" },
            ]}
            onChange={(v) => onChange({ runtimeTarget: v || undefined })}
          />
        </div>
        <div style={fieldCss}><FieldLabel>Model name</FieldLabel>
          <TextInput
            value={data.modelName ?? ""}
            onChange={(v) => onChange({ modelName: v || undefined })}
            placeholder={
              data.runtimeTarget === "ollama_local"  ? "e.g. hermes3, llama3.1:8b, mistral" :
              data.runtimeTarget === "openai"         ? "e.g. gpt-4o, gpt-4o-mini" :
              data.runtimeTarget === "claude"         ? "e.g. claude-sonnet-4-6" :
              "model identifier"
            }
          />
        </div>
        <div style={fieldCss}><FieldLabel>System prompt override</FieldLabel>
          <TextAreaInput rows={3} value={data.systemPromptOverride ?? ""} onChange={(v) => onChange({ systemPromptOverride: v || undefined })} placeholder="Override the global system prompt for this step only." /></div>
        <div style={fieldCss}><FieldLabel>Est. tokens / run</FieldLabel>
          <TextInput value={data.estimatedTokensPerRun != null ? String(data.estimatedTokensPerRun) : ""} onChange={(v) => onChange({ estimatedTokensPerRun: v === "" ? undefined : Number(v) })} placeholder="2000" /></div>
        {data.runtimeTarget === "ollama_local" && (
          <div style={{ padding: "8px 10px", background: "#0f2a1a", border: "1px solid #22c55e22", borderRadius: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>🖥 Local deployment:</span> This step runs on your own machine. No cloud API calls, no token costs, full data privacy. Ensure Ollama is running with the selected model pulled.
          </div>
        )}
        {(data.runtimeTarget === "claude" || data.runtimeTarget === "openai" || data.runtimeTarget === "bedrock" || data.runtimeTarget === "azure_openai") && (
          <div style={{ padding: "8px 10px", background: "#0f1a2e", border: "1px solid #06b6d422", borderRadius: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
            <span style={{ color: "#06b6d4", fontWeight: 700 }}>☁ Cloud deployment:</span> This step calls an external API. Set your API key in the deployment environment&apos;s <code style={{ color: "#e2e8f0" }}>.env</code> file before running.
          </div>
        )}
      </Accordion>

      {/* Advanced */}
      <Accordion title="Advanced">
        <div style={fieldCss}><FieldLabel>File name</FieldLabel>
          <TextInput value={data.fileName} onChange={(v) => onChange({ fileName: v })} placeholder="my_skill.yaml" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={fieldCss}><FieldLabel>Owner</FieldLabel>
            <TextInput value={data.owner ?? ""} onChange={(v) => onChange({ owner: v })} placeholder="Jane Smith" /></div>
          <div style={fieldCss}><FieldLabel>Team</FieldLabel>
            <TextInput value={data.team ?? ""} onChange={(v) => onChange({ team: v })} placeholder="Operations" /></div>
        </div>
        <div style={fieldCss}><FieldLabel>Category</FieldLabel>
          <TextInput value={data.category ?? ""} onChange={(v) => onChange({ category: v })} placeholder="e.g. reporting" /></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={data.enabled ?? true} onChange={(e) => onChange({ enabled: e.target.checked })} />
            Enabled
          </label>
          <span style={{ fontSize: 11, color: "#475569" }}>v{data.version ?? 1}</span>
        </div>
        <div style={fieldCss}><FieldLabel>Notes</FieldLabel>
          <TextAreaInput rows={2} value={data.notes ?? ""} onChange={(v) => onChange({ notes: v })} /></div>
        <div style={fieldCss}><FieldLabel>Presenter note</FieldLabel>
          <TextAreaInput rows={2} value={data.presenterNote ?? ""} onChange={(v) => onChange({ presenterNote: v })} placeholder="Talking point for presentation mode." /></div>
      </Accordion>
    </>
  );
}

// ── Human editor ──────────────────────────────────────────────────────────────

function HumanEditor({
  data, onChange,
}: { data: HumanNodeData; onChange: (patch: Record<string, unknown>) => void }) {
  const currentSubtype = data.subtype ?? "judgment";
  const currentMeta = HUMAN_SUBTYPES.find((s) => s.value === currentSubtype) ?? HUMAN_SUBTYPES[4];
  const hasTimeData = data.minutesPerOccurrence != null || data.occurrencesPerWeek != null;

  return (
    <>
      {/* Core */}
      <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1a2540" }}>
        {/* Subtype — prominent */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {HUMAN_SUBTYPES.map((s) => (
            <button key={s.value} type="button" onClick={() => onChange({ subtype: s.value })}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6, cursor: "pointer", background: currentSubtype === s.value ? s.color + "22" : "transparent", border: `1px solid ${currentSubtype === s.value ? s.color : "#1e293b"}`, color: currentSubtype === s.value ? s.color : "#64748b", fontSize: 11, fontWeight: currentSubtype === s.value ? 700 : 400, textAlign: "left" }}>
              <span style={{ fontSize: 12 }}>{s.icon}</span><span>{s.label}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, padding: "5px 10px", borderRadius: 6, background: currentMeta.color + "12", border: `1px solid ${currentMeta.color}33`, color: currentMeta.color, fontWeight: 600 }}>
          {currentMeta.potential} automation potential
        </div>
        <div style={fieldCss}><FieldLabel>Name</FieldLabel>
          <TextInput value={data.name} onChange={(v) => onChange({ name: v })} /></div>
        <div style={fieldCss}><FieldLabel>Description</FieldLabel>
          <TextAreaInput rows={2} value={data.description ?? ""} onChange={(v) => onChange({ description: v })} placeholder="What does this person do at this checkpoint?" /></div>
      </div>

      {/* Time Tracking */}
      <Accordion title="Time Tracking" accent="#f59e0b" badge={hasTimeData ? "✓" : null}>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          Used to calculate automation ROI in the executive brief.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Minutes per occurrence</FieldLabel>
            <TextInput value={data.minutesPerOccurrence != null ? String(data.minutesPerOccurrence) : ""} onChange={(v) => onChange({ minutesPerOccurrence: v === "" ? undefined : Number(v) })} placeholder="30" /></div>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Occurrences per week</FieldLabel>
            <TextInput value={data.occurrencesPerWeek != null ? String(data.occurrencesPerWeek) : ""} onChange={(v) => onChange({ occurrencesPerWeek: v === "" ? undefined : Number(v) })} placeholder="5" /></div>
        </div>
        {data.minutesPerOccurrence != null && data.occurrencesPerWeek != null && (
          <div style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b0a", border: "1px solid #f59e0b22", borderRadius: 6, padding: "5px 8px" }}>
            ≈ {Math.round(data.minutesPerOccurrence * data.occurrencesPerWeek / 60 * 10) / 10} hrs/week · {Math.round(data.minutesPerOccurrence * data.occurrencesPerWeek * 52 / 60)} hrs/year
          </div>
        )}
      </Accordion>

      {/* Instructions */}
      <Accordion title="Instructions & Artifacts">
        <div style={fieldCss}><FieldLabel>Instructions for this person</FieldLabel>
          <TextAreaInput rows={3} value={data.instructions ?? ""} onChange={(v) => onChange({ instructions: v })} placeholder="What should the human do at this checkpoint?" /></div>
        <div style={fieldCss}><FieldLabel>Required inputs (one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.requiredInputs ?? []).join("\n")} onChange={(v) => onChange({ requiredInputs: linesToList(v) })} placeholder="tasks.md" /></div>
        <div style={fieldCss}><FieldLabel>Produced artifacts (one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.producedArtifacts ?? []).join("\n")} onChange={(v) => onChange({ producedArtifacts: linesToList(v) })} placeholder="approved_tasks.md" /></div>
        <div style={fieldCss}><FieldLabel>Approver role</FieldLabel>
          <TextInput value={data.approverRole ?? ""} onChange={(v) => onChange({ approverRole: v })} placeholder="Project Manager" /></div>
      </Accordion>

      {/* Advanced */}
      <Accordion title="Advanced">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={fieldCss}><FieldLabel>Owner</FieldLabel>
            <TextInput value={data.owner ?? ""} onChange={(v) => onChange({ owner: v })} /></div>
          <div style={fieldCss}><FieldLabel>Team</FieldLabel>
            <TextInput value={data.team ?? ""} onChange={(v) => onChange({ team: v })} /></div>
        </div>
        <div style={fieldCss}><FieldLabel>Notes</FieldLabel>
          <TextAreaInput rows={2} value={data.notes ?? ""} onChange={(v) => onChange({ notes: v })} /></div>
        <div style={fieldCss}><FieldLabel>Presenter note</FieldLabel>
          <TextAreaInput rows={2} value={data.presenterNote ?? ""} onChange={(v) => onChange({ presenterNote: v })} placeholder="Talking point for presentation mode." /></div>
      </Accordion>
    </>
  );
}

// ── Artifact editor ───────────────────────────────────────────────────────────

function ArtifactEditor({
  data, onChange, onSimulateChange,
}: { data: ArtifactNodeData; onChange: (patch: Record<string, unknown>) => void; onSimulateChange: () => void }) {
  const oc = data.outputContract ?? {} as OutputContract;
  const setOC = (patch: Partial<OutputContract>) => onChange({ outputContract: { ...oc, ...patch } });
  const contractDefined = !!(oc.validationNote || (oc.requiredFields && oc.requiredFields.length > 0));
  const statusColor: Record<string, string> = { updated: "#22c55e", stale: "#f59e0b", missing: "#ef4444", unknown: "#64748b" };
  const sc = statusColor[data.status ?? "unknown"] ?? "#64748b";

  return (
    <>
      {/* Core */}
      <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1a2540" }}>
        <div style={fieldCss}><FieldLabel>Name</FieldLabel>
          <TextInput value={data.name} onChange={(v) => onChange({ name: v })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={fieldCss}><FieldLabel>Type</FieldLabel>
            <SelectInput value={data.artifactType} options={[
              { value: "md", label: "Markdown" }, { value: "json", label: "JSON" },
              { value: "yaml", label: "YAML" }, { value: "csv", label: "CSV" },
              { value: "xlsx", label: "Excel" }, { value: "txt", label: "Text" }, { value: "other", label: "Other" },
            ]} onChange={(v) => onChange({ artifactType: v })} /></div>
          <div style={fieldCss}><FieldLabel>Status</FieldLabel>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["updated", "stale", "missing", "unknown"] as const).map((s) => (
                <button key={s} type="button" onClick={() => onChange({ status: s })}
                  style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999, border: `1px solid ${(data.status ?? "unknown") === s ? statusColor[s] : "#1e293b"}`, background: (data.status ?? "unknown") === s ? statusColor[s] + "22" : "transparent", color: (data.status ?? "unknown") === s ? statusColor[s] : "#475569", cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={fieldCss}><FieldLabel>Description</FieldLabel>
          <TextAreaInput rows={2} value={data.description ?? ""} onChange={(v) => onChange({ description: v })} /></div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 10, color: sc, background: sc + "18", border: `1px solid ${sc}44`, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>{data.status ?? "unknown"}</span>
          {contractDefined && <span style={{ fontSize: 10, color: "#22c55e", background: "#22c55e18", border: "1px solid #22c55e44", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>✓ contract defined</span>}
        </div>
      </div>

      {/* Output Contract */}
      <Accordion title="Output Contract" accent="#8b5cf6" badge={contractDefined ? "✓" : null}>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          AI treats this as an obligation — the run isn&apos;t done until this contract is satisfied.
        </p>
        <div style={fieldCss}><FieldLabel>What must this file contain?</FieldLabel>
          <TextAreaInput rows={3} value={oc.validationNote ?? ""} onChange={(v) => setOC({ validationNote: v || undefined })} placeholder="Must include frontmatter with source_sha256, page_count, and extractor_used." /></div>
        <div style={fieldCss}><FieldLabel>Required fields (comma-separated)</FieldLabel>
          <TextInput value={(oc.requiredFields ?? []).join(", ")} onChange={(v) => setOC({ requiredFields: v.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="source_sha256, page_count" /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...fieldCss, flex: 2 }}><FieldLabel>Format</FieldLabel>
            <SelectInput value={oc.format ?? "any"} options={[
              { value: "any", label: "Any" }, { value: "markdown", label: "Markdown" },
              { value: "json", label: "JSON" }, { value: "csv", label: "CSV" },
            ]} onChange={(v) => setOC({ format: v as OutputContract["format"] })} /></div>
          <div style={{ ...fieldCss, flex: 1 }}><FieldLabel>Max size (KB)</FieldLabel>
            <TextInput value={oc.maxSizeKb != null ? String(oc.maxSizeKb) : ""} onChange={(v) => setOC({ maxSizeKb: v === "" ? undefined : Number(v) })} placeholder="2048" /></div>
        </div>
      </Accordion>

      {/* Advanced */}
      <Accordion title="Advanced">
        <div style={fieldCss}><FieldLabel>File name</FieldLabel>
          <TextInput value={data.fileName} onChange={(v) => onChange({ fileName: v })} placeholder="artifact.md" /></div>
        <div style={fieldCss}><FieldLabel>Schema ref</FieldLabel>
          <TextInput value={data.schemaRef ?? ""} onChange={(v) => onChange({ schemaRef: v })} placeholder="schemas/tasks.schema.json" /></div>
        <div style={fieldCss}><FieldLabel>Notes</FieldLabel>
          <TextInput value={data.notes ?? ""} onChange={(v) => onChange({ notes: v })} placeholder="use 'external' to skip producer check" /></div>
        <button type="button" style={{ ...smallBtn, borderColor: "#f59e0b44", color: "#f59e0b" }} onClick={onSimulateChange}>Simulate upstream change</button>
        <div style={fieldCss}><FieldLabel>Presenter note</FieldLabel>
          <TextAreaInput rows={2} value={data.presenterNote ?? ""} onChange={(v) => onChange({ presenterNote: v })} placeholder="Talking point for presentation mode." /></div>
      </Accordion>
    </>
  );
}

// ── Integration editor ────────────────────────────────────────────────────────

function IntegrationEditor({
  data, onChange,
}: { data: IntegrationNodeData; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1a2540" }}>
        <div style={fieldCss}><FieldLabel>Name</FieldLabel>
          <TextInput value={data.name} onChange={(v) => onChange({ name: v })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={fieldCss}><FieldLabel>Type</FieldLabel>
            <SelectInput value={data.subtype} options={[
              { value: "email_send",    label: "Email — send" },
              { value: "email_receive", label: "Email — receive" },
              { value: "form_submit",   label: "Form submission" },
              { value: "legacy_system", label: "Legacy system" },
              { value: "webhook",       label: "Webhook" },
              { value: "file_transfer", label: "File transfer" },
              { value: "notification",  label: "Notification" },
              { value: "other",         label: "Other" },
            ]} onChange={(v) => onChange({ subtype: v })} /></div>
          <div style={fieldCss}><FieldLabel>Direction</FieldLabel>
            <SelectInput value={data.direction} options={[
              { value: "inbound",       label: "↓ Inbound" },
              { value: "outbound",      label: "↑ Outbound" },
              { value: "bidirectional", label: "↕ Both" },
            ]} onChange={(v) => onChange({ direction: v })} /></div>
        </div>
        <div style={fieldCss}><FieldLabel>System</FieldLabel>
          <TextInput value={data.system ?? ""} onChange={(v) => onChange({ system: v })} placeholder="e.g. Outlook, SAP, SharePoint" /></div>
        <div style={fieldCss}><FieldLabel>Description</FieldLabel>
          <TextAreaInput rows={2} value={data.description ?? ""} onChange={(v) => onChange({ description: v })} /></div>
      </div>

      <Accordion title="Inputs & Outputs">
        <div style={fieldCss}><FieldLabel>Inputs (artifact filenames, one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.inputs ?? []).join("\n")} onChange={(v) => onChange({ inputs: linesToList(v) })} placeholder="project_request.md" /></div>
        <div style={fieldCss}><FieldLabel>Outputs (artifact filenames, one per line)</FieldLabel>
          <TextAreaInput rows={3} value={(data.outputs ?? []).join("\n")} onChange={(v) => onChange({ outputs: linesToList(v) })} placeholder="confirmation.md" /></div>
        <div style={fieldCss}><FieldLabel>Manual steps</FieldLabel>
          <TextAreaInput rows={3} value={data.manualSteps ?? ""} onChange={(v) => onChange({ manualSteps: v })} placeholder="Describe what a person must do when this cannot be automated." /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center" }}>
          <div style={fieldCss}><FieldLabel>Estimated time</FieldLabel>
            <TextInput value={data.estimatedTime ?? ""} onChange={(v) => onChange({ estimatedTime: v })} placeholder="e.g. 2–5 min" /></div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, cursor: "pointer", paddingTop: 16 }}>
            <input type="checkbox" checked={data.automated ?? false} onChange={(e) => onChange({ automated: e.target.checked })} />
            Can be automated
          </label>
        </div>
      </Accordion>

      <Accordion title="Advanced">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={fieldCss}><FieldLabel>Owner</FieldLabel>
            <TextInput value={data.owner ?? ""} onChange={(v) => onChange({ owner: v })} /></div>
          <div style={fieldCss}><FieldLabel>Team</FieldLabel>
            <TextInput value={data.team ?? ""} onChange={(v) => onChange({ team: v })} /></div>
        </div>
        <div style={fieldCss}><FieldLabel>Notes</FieldLabel>
          <TextAreaInput rows={2} value={data.notes ?? ""} onChange={(v) => onChange({ notes: v })} /></div>
        <div style={fieldCss}><FieldLabel>Presenter note</FieldLabel>
          <TextAreaInput rows={2} value={data.presenterNote ?? ""} onChange={(v) => onChange({ presenterNote: v })} placeholder="Talking point for presentation mode." /></div>
      </Accordion>
    </>
  );
}

// ── Proposal & System editors ─────────────────────────────────────────────────

function ProposalEditor({
  data, nodeId, onChange, onMerge,
}: { data: ProposalNodeData; nodeId: string; onChange: (patch: Record<string, unknown>) => void; onMerge: () => void }) {
  const proposalDefRef = useRef<HTMLTextAreaElement | null>(null);
  const statusColor = data.status === "approved" ? "#22c55e" : data.status === "rejected" ? "#ef4444" : data.status === "modified" ? "#60a5fa" : "#f59e0b";
  return (
    <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
      <div style={fieldCss}><FieldLabel>Name</FieldLabel>
        <TextInput value={data.name} onChange={(v) => onChange({ name: v })} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusColor + "18", border: `1px solid ${statusColor}44`, borderRadius: 999, padding: "3px 10px" }}>{data.status ?? "pending"}</span>
        <SelectInput value={data.proposalType} options={[
          { value: "proposed_skill", label: "Proposed skill" }, { value: "proposed_artifact", label: "Proposed artifact" },
          { value: "proposed_contract_change", label: "Contract change" }, { value: "proposed_edge_change", label: "Edge change" },
        ]} onChange={(v) => onChange({ proposalType: v })} />
      </div>
      {data.reason && (
        <div style={{ fontSize: 12, color: "#94a3b8", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "7px 10px", lineHeight: 1.6 }}>{data.reason}</div>
      )}
      <div style={fieldCss}><FieldLabel>Source</FieldLabel>
        <TextInput value={data.source ?? ""} onChange={(v) => onChange({ source: v })} /></div>
      <div style={fieldCss}><FieldLabel>Reason</FieldLabel>
        <TextAreaInput rows={3} value={data.reason ?? ""} onChange={(v) => onChange({ reason: v })} placeholder="Why is this change proposed?" /></div>
      <FieldLabel>Edit definition (JSON)</FieldLabel>
      <textarea key={nodeId} ref={proposalDefRef} rows={6} style={textareaStyle} defaultValue={JSON.stringify(data.proposedDefinition ?? {}, null, 2)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={{ ...smallBtn, borderColor: "#60a5fa44", color: "#60a5fa" }} onClick={() => {
          const raw = proposalDefRef.current?.value;
          if (!raw) return;
          try { onChange({ proposedDefinition: JSON.parse(raw) as Record<string, unknown>, status: "modified" }); }
          catch { window.alert("Invalid JSON"); }
        }}>Apply JSON</button>
        <button type="button" style={{ ...smallBtn, borderColor: "#22c55e44", color: "#22c55e" }} onClick={() => onChange({ status: "approved" })}>Approve</button>
        <button type="button" style={dangerBtn} onClick={() => onChange({ status: "rejected" })}>Reject</button>
        <button type="button" style={{ ...smallBtn, borderColor: "#3b82f644", color: "#3b82f6" }} onClick={onMerge}>Merge</button>
      </div>
    </div>
  );
}

function ConditionalEditor({
  data, onChange,
}: { data: ConditionalNodeData; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
      <div style={fieldCss}><FieldLabel>Name</FieldLabel>
        <TextInput value={data.name} onChange={(v) => onChange({ name: v })} placeholder="e.g. Credit check" /></div>
      <div style={fieldCss}><FieldLabel>Condition</FieldLabel>
        <TextAreaInput rows={3} value={data.condition} onChange={(v) => onChange({ condition: v })} placeholder="e.g. Customer credit score > 700" /></div>
      <div style={fieldCss}><FieldLabel>Expression (optional)</FieldLabel>
        <TextInput value={data.conditionExpression ?? ""} onChange={(v) => onChange({ conditionExpression: v })} placeholder="e.g. artifacts.credit_score > 700" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={fieldCss}><FieldLabel>True branch label</FieldLabel>
          <TextInput value={data.trueLabel ?? "Yes"} onChange={(v) => onChange({ trueLabel: v })} /></div>
        <div style={fieldCss}><FieldLabel>False branch label</FieldLabel>
          <TextInput value={data.falseLabel ?? "No"} onChange={(v) => onChange({ falseLabel: v })} /></div>
      </div>
      <div style={fieldCss}><FieldLabel>Notes</FieldLabel>
        <TextAreaInput rows={2} value={data.notes ?? ""} onChange={(v) => onChange({ notes: v })} placeholder="Decision rationale or context." /></div>
      <div style={{ padding: "8px 10px", background: "#0f1a2e", border: "1px solid #f9731622", borderRadius: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
        <span style={{ color: "#f97316", fontWeight: 700 }}>⋈ Routing:</span> Connect this node to two downstream nodes.
        The first edge is the <span style={{ color: "#22c55e" }}>true</span> branch,
        the second is the <span style={{ color: "#ef4444" }}>false</span> branch.
      </div>
    </div>
  );
}

function SystemEditor({
  data, onChange,
}: { data: SystemNodeData; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
      <div style={fieldCss}><FieldLabel>Name</FieldLabel>
        <TextInput value={data.name} onChange={(v) => onChange({ name: v })} /></div>
      <div style={fieldCss}><FieldLabel>System role</FieldLabel>
        <TextInput value={data.systemRole ?? ""} onChange={(v) => onChange({ systemRole: v })} placeholder="e.g. staleness_engine" /></div>
      <div style={fieldCss}><FieldLabel>Description</FieldLabel>
        <TextAreaInput rows={3} value={data.description ?? ""} onChange={(v) => onChange({ description: v })} /></div>
      <div style={fieldCss}><FieldLabel>Presenter note</FieldLabel>
        <TextAreaInput rows={2} value={data.presenterNote ?? ""} onChange={(v) => onChange({ presenterNote: v })} placeholder="Talking point for presentation mode." /></div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ViewTab = "edit" | "debug";

export function InspectorPanel() {
  const {
    workflow, selectedNodeId, updateNode, deleteNode, duplicateNode,
    markArtifactChanged, mergeProposal, validation, setWorkflow, setObjective,
  } = useWorkflowStore();
  const jobs = useRuntimeStore((s) => s.jobs);
  const runtime = useRuntimeStore();
  const [viewTab, setViewTab] = useState<ViewTab>("edit");

  const selected = workflow.nodes.find((n) => n.id === selectedNodeId);

  const running = useMemo(() => new Set(jobs.filter((j) => j.status === "running").map((j) => j.stepId)), [jobs]);
  const failed  = useMemo(() => new Set(jobs.filter((j) => j.status === "failed").map((j) => j.stepId)),  [jobs]);
  const derived = useMemo(() => deriveState(workflow, running, failed), [workflow, running, failed]);
  const why     = useMemo(() => selected ? explainNode(workflow, selected.id, running, failed) : [], [selected, workflow, running, failed]);
  const nodeIssues = useMemo(() => selected ? validation.issues.filter((i) => i.nodeId === selected.id) : [], [selected, validation]);
  const summary = useMemo(() => generateSummary(workflow), [workflow]);

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!selected) {
    const nodeCount = workflow.nodes.filter((n) => n.type !== "proposal").length;
    return (
      <aside id="wfos-inspector" style={panelCss}>
        <div style={{ padding: "12px", display: "grid", gap: 10, borderBottom: "1px solid #1e293b" }}>
          <strong style={{ fontSize: 13, color: "#e2e8f0" }}>Workflow</strong>
          {nodeCount === 0 ? (
            <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.7 }}>
              Canvas is empty. Press{" "}
              <kbd style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 3, padding: "0 5px", fontSize: 10 }}>W</kbd>{" "}
              to open the Workflow Wizard.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>{summary}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "skills",       count: workflow.nodes.filter((n) => n.type === "skill").length,       color: "#3b82f6" },
                  { label: "artifacts",    count: workflow.nodes.filter((n) => n.type === "artifact").length,    color: "#8b5cf6" },
                  { label: "checkpoints",  count: workflow.nodes.filter((n) => n.type === "human").length,       color: "#f59e0b" },
                  { label: "integrations", count: workflow.nodes.filter((n) => n.type === "integration").length, color: "#0ea5e9" },
                ].filter((s) => s.count > 0).map((s) => (
                  <span key={s.label} style={{ fontSize: 11, color: s.color, background: s.color + "18", border: `1px solid ${s.color}44`, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
                    {s.count} {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1e293b" }}>
          <div style={fieldCss}>
            <FieldLabel>Business objective</FieldLabel>
            <TextAreaInput rows={3} value={workflow.objective ?? ""} onChange={(v) => setObjective(v)}
              placeholder="What business problem does this workflow solve?" />
          </div>
          <div style={fieldCss}>
            <FieldLabel>Description</FieldLabel>
            <TextAreaInput rows={2} value={workflow.description ?? ""} onChange={(v) => setWorkflow({ ...workflow, description: v })}
              placeholder="Optional technical description." />
          </div>
        </div>

        <div style={{ padding: "10px 12px", display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 11, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>Keyboard shortcuts</strong>
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 2.1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px" }}>
            {[
              ["W", "Open Wizard"], ["P", "Present"], ["D/S/R", "Switch mode"],
              ["Del", "Delete node"], ["⌘Z", "Undo / Redo"], ["Esc", "Deselect"],
            ].map(([key, label]) => (
              <div key={key}><span style={{ color: "#64748b", fontFamily: "monospace", minWidth: 40, display: "inline-block" }}>{key}</span>{label}</div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // ── Node selected ─────────────────────────────────────────────────────────

  const color = NODE_COLORS[selected.type] ?? "#64748b";
  const nodeName = String((selected.data as { name?: string }).name ?? selected.id);
  const debugBadge = nodeIssues.filter((i) => i.severity === "error").length;
  const runsBadge = jobs.filter((j) => j.stepId === selected.id).length;

  return (
    <aside style={panelCss}>
      {/* Accent bar — color-coded to node type */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${color}99 0%, ${color}33 50%, transparent 100%)`, flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(148,163,184,0.12)", background: "linear-gradient(180deg, rgba(8,15,30,0.92), rgba(5,10,20,0.92))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}66` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{nodeName}</div>
          <div style={{ fontSize: 9, color: color, opacity: 0.7, marginTop: 2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{selected.type}</div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" style={smallBtn} onClick={() => duplicateNode(selected.id)} title="Duplicate">⎘</button>
          <button type="button" style={dangerBtn} onClick={() => deleteNode(selected.id)} title="Delete">✕</button>
        </div>
      </div>

      {/* Tab bar: Edit | Debug */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(148,163,184,0.12)", background: "rgba(5,10,20,0.78)" }}>
        {([
          { id: "edit",  label: "Edit",  badge: null },
          { id: "debug", label: "Debug", badge: debugBadge || (runsBadge && selected.type === "skill" ? runsBadge : 0) || null },
        ] as { id: ViewTab; label: string; badge: number | null }[]).map(({ id, label, badge }) => (
          <button key={id} type="button" onClick={() => setViewTab(id)}
            style={{ flex: 1, fontSize: 11, padding: "7px 4px", border: "none", borderBottom: viewTab === id ? `2px solid ${color}` : "2px solid transparent", background: "transparent", color: viewTab === id ? "#e2e8f0" : "#64748b", fontWeight: viewTab === id ? 700 : 400, cursor: "pointer", position: "relative" }}>
            {label}
            {badge != null && badge > 0 && (
              <span style={{ position: "absolute", top: 3, right: 4, background: badge === debugBadge ? "#ef4444" : "#3b82f6", color: "#fff", borderRadius: 999, fontSize: 9, fontWeight: 700, padding: "0 4px", lineHeight: "14px" }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Edit tab */}
      {viewTab === "edit" && (
        <div className="inspector-tab-content">
          {selected.type === "skill" && (
            <SkillEditor data={selected.data as SkillNodeData} onChange={(p) => updateNode(selected.id, p)} />
          )}
          {selected.type === "artifact" && (
            <ArtifactEditor data={selected.data as ArtifactNodeData} onChange={(p) => updateNode(selected.id, p)} onSimulateChange={() => markArtifactChanged(selected.id)} />
          )}
          {selected.type === "human" && (
            <HumanEditor data={selected.data as HumanNodeData} onChange={(p) => updateNode(selected.id, p)} />
          )}
          {selected.type === "integration" && (
            <IntegrationEditor data={selected.data as IntegrationNodeData} onChange={(p) => updateNode(selected.id, p)} />
          )}
          {selected.type === "proposal" && (
            <ProposalEditor data={selected.data as ProposalNodeData} nodeId={selected.id} onChange={(p) => updateNode(selected.id, p)} onMerge={() => mergeProposal(selected.id)} />
          )}
          {selected.type === "system" && (
            <SystemEditor data={selected.data as SystemNodeData} onChange={(p) => updateNode(selected.id, p)} />
          )}
          {selected.type === "conditional" && (
            <ConditionalEditor data={selected.data as ConditionalNodeData} onChange={(p) => updateNode(selected.id, p)} />
          )}
        </div>
      )}

      {/* Debug tab */}
      {viewTab === "debug" && (
        <div className="inspector-tab-content" style={{ display: "grid", gap: 0 }}>
          {/* Why is this node in its current state? */}
          <div style={{ padding: "10px 12px", display: "grid", gap: 8, borderBottom: "1px solid #1a2540" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>State explanation</span>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#cbd5e1", lineHeight: 1.8 }}>
              {why.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            {selected.type === "artifact" && derived.artifacts[selected.id] && (
              <pre style={{ fontSize: 11, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8, color: "#94a3b8", whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(derived.artifacts[selected.id], null, 2)}
              </pre>
            )}
            {selected.type === "skill" && derived.skills[selected.id] && (
              <pre style={{ fontSize: 11, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8, color: "#94a3b8", whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(derived.skills[selected.id], null, 2)}
              </pre>
            )}
          </div>

          {/* Validation issues */}
          {nodeIssues.length > 0 && (
            <div style={{ padding: "10px 12px", display: "grid", gap: 6, borderBottom: "1px solid #1a2540" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em", textTransform: "uppercase" }}>Validation issues</span>
              {nodeIssues.map((issue) => (
                <div key={issue.id} style={{ fontSize: 11, background: issue.severity === "error" ? "#ef444418" : "#f59e0b18", border: `1px solid ${issue.severity === "error" ? "#ef444444" : "#f59e0b44"}`, borderRadius: 6, padding: "5px 8px", color: issue.severity === "error" ? "#ef4444" : "#f59e0b" }}>
                  <strong>{issue.severity.toUpperCase()}</strong>: {issue.message}
                </div>
              ))}
            </div>
          )}

          {/* Job simulation — skills only */}
          {selected.type === "skill" && (
            <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>Job simulation</span>
              {jobs.filter((j) => j.stepId === selected.id).length === 0 && (
                <button type="button" style={{ ...smallBtn, borderColor: "#3b82f644", color: "#3b82f6" }} onClick={() => runtime.queue(selected.id)}>+ Queue first job</button>
              )}
              {jobs.filter((j) => j.stepId === selected.id).slice().reverse().map((j) => {
                const sc2 = j.status === "success" ? "#22c55e" : j.status === "failed" ? "#ef4444" : j.status === "running" ? "#3b82f6" : "#64748b";
                return (
                  <div key={j.jobId} style={{ border: `1px solid ${sc2}44`, borderRadius: 8, padding: 8, fontSize: 12, background: sc2 + "0a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>{j.jobId}</span>
                      <span style={{ color: sc2, fontWeight: 600 }}>{j.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button type="button" style={smallBtn} onClick={() => runtime.queue(selected.id)}>Queue new</button>
                      <button type="button" style={smallBtn} onClick={() => runtime.start(j.jobId)}>Start</button>
                      <button type="button" style={{ ...smallBtn, color: "#22c55e", borderColor: "#22c55e44" }} onClick={() => runtime.complete(j.jobId)}>Complete</button>
                      <button type="button" style={dangerBtn} onClick={() => runtime.fail(j.jobId)}>Fail</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
