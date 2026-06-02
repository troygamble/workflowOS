"use client";

import { useEffect, useRef, useState } from "react";
import { buildEdgesFromContracts } from "@/lib/graph/wire-from-contracts";
import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import { generationToDraftWorkflow, generationToProposalNodes } from "@/lib/ai/convert";
import type { GenerationRequest, GenerationResponse } from "@/lib/ai/schema";
import type { Workflow, WorkflowNode, WorkflowEnvironment } from "@/lib/types/workflow";
import { useWorkflowStore } from "@/store/workflow-store";
import type { WizardMessage } from "@/app/api/wizard/route";
import { studioAiFetch } from "@/lib/studio/openai-key-client";

const uid = () => crypto.randomUUID().slice(0, 8);

// ─── Wizard node spec (from API) ──────────────────────────────────────────────

type WizardNodeSpec = {
  nodeType: "skill" | "artifact" | "human" | "integration";
  name: string;
  description?: string;
  inputs?: string[];
  outputs?: string[];
  requires?: string[];
  produces?: string[];
  validations?: string[];
  // Integration-specific
  subtype?: string;
  direction?: string;
  system?: string;
  manualSteps?: string;
  automated?: boolean;
  // Human-specific
  humanSubtype?: string | null;
  minutesPerOccurrence?: number | null;
  occurrencesPerWeek?: number | null;
};

// Valid integration subtypes — coerce anything the LLM invents to "other"
const VALID_INTEGRATION_SUBTYPES = new Set([
  "email_send", "email_receive", "form_submit", "legacy_system",
  "webhook", "file_transfer", "notification", "other",
]);

function dedup<T>(arr: T[] | null | undefined): T[] {
  if (!arr) return [];
  return [...new Set(arr)];
}

function specToNode(spec: WizardNodeSpec, index: number): WorkflowNode {
  const id = `${spec.nodeType}_${uid()}`;
  const x = spec.nodeType === "artifact" ? 480 : spec.nodeType === "human" ? 280 : 180;
  const y = 80 + index * 130;

  if (spec.nodeType === "skill") {
    const outputs = dedup(spec.outputs);
    return {
      id,
      type: "skill",
      position: { x, y },
      data: {
        name: spec.name,
        fileName: `${spec.name}.yaml`,
        description: spec.description,
        inputs: dedup(spec.inputs),
        outputs,
        requires: dedup(spec.requires),
        produces: dedup(spec.produces).length > 0 ? dedup(spec.produces) : outputs,
        validations: dedup(spec.validations),
        tags: [],
        enabled: true,
        version: 1,
      },
    };
  } else if (spec.nodeType === "artifact") {
    const isFolder = spec.name.endsWith("/");
    const ext = !isFolder && spec.name.includes(".") ? spec.name.split(".").pop() : undefined;
    const artType = (ext && ["md", "json", "yaml", "csv", "xlsx", "txt"].includes(ext)
      ? ext
      : "other") as "md" | "json" | "yaml" | "csv" | "xlsx" | "txt" | "other";
    return {
      id,
      type: "artifact",
      position: { x, y },
      data: {
        name: spec.name,
        fileName: spec.name,
        artifactType: artType,
        description: spec.description,
        status: "unknown",
      },
    };
  } else if (spec.nodeType === "integration") {
    const rawSubtype = spec.subtype ?? "other";
    const subtype = VALID_INTEGRATION_SUBTYPES.has(rawSubtype) ? rawSubtype : "other";
    return {
      id,
      type: "integration",
      position: { x: 80, y },
      data: {
        name: spec.name,
        description: spec.description,
        subtype: subtype as import("@/lib/types/workflow").IntegrationSubtype,
        direction: (spec.direction ?? "outbound") as "inbound" | "outbound" | "bidirectional",
        system: spec.system,
        inputs: dedup(spec.inputs),
        outputs: dedup(spec.outputs),
        manualSteps: spec.manualSteps,
        automated: spec.automated ?? false,
      },
    };
  } else {
    const VALID_HUMAN_SUBTYPES = new Set(["approval","data_entry","file_movement","communication","judgment","physical"]);
    const rawSubtype = spec.humanSubtype ?? "judgment";
    const subtype = VALID_HUMAN_SUBTYPES.has(rawSubtype) ? rawSubtype : "judgment";
    return {
      id,
      type: "human",
      position: { x: 280, y },
      data: {
        name: spec.name,
        description: spec.description,
        subtype: subtype as import("@/lib/types/workflow").HumanSubtype,
        requiredInputs: dedup(spec.inputs),
        producedArtifacts: dedup(spec.outputs),
        ...(spec.minutesPerOccurrence != null ? { minutesPerOccurrence: spec.minutesPerOccurrence } : {}),
        ...(spec.occurrencesPerWeek != null ? { occurrencesPerWeek: spec.occurrencesPerWeek } : {}),
      },
    };
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const OPENER = "What are you trying to automate? Give me a quick description — even a rough one is fine. We'll refine it together.";

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "7px 0",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 0,
    borderWidth: 0,
    borderStyle: "solid",
    borderBottomWidth: 2,
    borderBottomColor: active ? "#7c3aed" : "transparent",
    background: "transparent",
    color: active ? "#c4b5fd" : "#64748b",
    transition: "all 0.15s",
  };
}

function genTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "5px 0",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? "#3b82f6" : "#334155",
    background: active ? "#1e3a5f" : "transparent",
    color: active ? "#93c5fd" : "#94a3b8",
    transition: "all 0.15s",
  };
}

// ─── Environment gathering ────────────────────────────────────────────────────

const ENV_OPTIONS = {
  productivity: [
    { value: "o365", label: "Microsoft 365", icon: "🟦" },
    { value: "google", label: "Google Workspace", icon: "🟥" },
    { value: "mixed", label: "Mixed", icon: "⚡" },
    { value: "other", label: "Other", icon: "◇" },
  ],
  fileStorage: [
    { value: "sharepoint", label: "SharePoint / OneDrive", icon: "📁" },
    { value: "google_drive", label: "Google Drive", icon: "📁" },
    { value: "network_shares", label: "Network Shares", icon: "🖧" },
    { value: "s3", label: "Cloud (S3/Azure)", icon: "☁" },
    { value: "mixed", label: "Mixed", icon: "⚡" },
  ],
  messaging: [
    { value: "teams", label: "Teams", icon: "💬" },
    { value: "slack", label: "Slack", icon: "💬" },
    { value: "email", label: "Email only", icon: "✉" },
    { value: "other", label: "Other", icon: "◇" },
  ],
  automationTools: [
    { value: "power_automate", label: "Power Automate", icon: "⚡" },
    { value: "zapier", label: "Zapier", icon: "⚡" },
    { value: "custom", label: "Custom / Dev team", icon: "⚙" },
    { value: "none", label: "None yet", icon: "○" },
  ],
  weeklyFrequency: [
    { value: "daily", label: "Daily (5+ times/week)", icon: "🔄" },
    { value: "several", label: "Several times/week (2–4x)", icon: "🔄" },
    { value: "weekly", label: "Once a week", icon: "📅" },
    { value: "monthly", label: "Monthly or less", icon: "📅" },
    { value: "ondemand", label: "On demand / ad hoc", icon: "◇" },
  ],
  teamSize: [
    { value: "1to5", label: "1–5 people", icon: "👤" },
    { value: "6to15", label: "6–15 people", icon: "👥" },
    { value: "16to50", label: "16–50 people", icon: "🏢" },
    { value: "50plus", label: "50+ people", icon: "🏢" },
  ],
} as const;

function EnvironmentGather({ onComplete }: { onComplete: () => void }) {
  const setEnvironment = useWorkflowStore((s) => s.setEnvironment);
  const [step, setStep] = useState(0);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [existingSystemsText, setExistingSystemsText] = useState("");

  const buttonSteps = [
    { key: "productivity", question: "What's your primary productivity environment?", options: ENV_OPTIONS.productivity },
    { key: "fileStorage", question: "Where are files and documents stored?", options: ENV_OPTIONS.fileStorage },
    { key: "messaging", question: "What's your main team communication platform?", options: ENV_OPTIONS.messaging },
    { key: "automationTools", question: "Do you have any automation tools available?", options: ENV_OPTIONS.automationTools },
    { key: "weeklyFrequency", question: "How often does this workflow run?", options: ENV_OPTIONS.weeklyFrequency },
    { key: "teamSize", question: "How many people are involved in this workflow?", options: ENV_OPTIONS.teamSize },
  ] as const;

  const totalSteps = buttonSteps.length + 1; // +1 for existing systems text step
  const isTextStep = step >= buttonSteps.length;

  const FREQ_MAP: Record<string, number | null> = {
    "daily": 5, "several": 3, "weekly": 1, "monthly": 0.25, "ondemand": null,
  };
  const TEAM_MAP: Record<string, number | null> = {
    "1to5": 3, "6to15": 10, "16to50": 30, "50plus": 75,
  };

  const finish = (existingSystems: string[]) => {
    setEnvironment({
      productivity: (env.productivity ?? null) as WorkflowEnvironment["productivity"],
      fileStorage: (env.fileStorage ?? null) as WorkflowEnvironment["fileStorage"],
      messaging: (env.messaging ?? null) as WorkflowEnvironment["messaging"],
      automationTools: (env.automationTools ?? null) as WorkflowEnvironment["automationTools"],
      existingSystems,
      weeklyFrequency: env.weeklyFrequency != null ? (FREQ_MAP[env.weeklyFrequency] ?? null) : null,
      teamSize: env.teamSize != null ? (TEAM_MAP[env.teamSize] ?? null) : null,
    });
    onComplete();
  };

  const select = (value: string) => {
    const currentStep = buttonSteps[step];
    const newEnv = { ...env, [currentStep.key]: value };
    setEnv(newEnv);
    setStep(step + 1); // advances into text step on last button step
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "16px", justifyContent: "center" }}>
      <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Step {step + 1} of {totalSteps}
      </div>

      {!isTextStep ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4 }}>
            {buttonSteps[step].question}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            This helps the wizard suggest the right automation tools for your environment.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {buttonSteps[step].options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: "#0f172a", border: "1px solid #1e293b",
                  color: "#e2e8f0", fontSize: 13, textAlign: "left",
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e293b"; }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4 }}>
            Any existing systems we should know about?
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            List ERP, CRM, or custom apps (comma-separated). This helps the wizard name the right integration steps and tool recommendations.
          </div>
          <input
            type="text"
            value={existingSystemsText}
            onChange={(e) => setExistingSystemsText(e.target.value)}
            placeholder="e.g. SAP, Salesforce, SharePoint, custom ERP"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                finish(existingSystemsText.split(",").map((s) => s.trim()).filter(Boolean));
              }
            }}
            autoFocus
            style={{
              fontSize: 13,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8, padding: "10px 14px", color: "#e2e8f0",
            }}
          />
          <button
            type="button"
            onClick={() => finish(existingSystemsText.split(",").map((s) => s.trim()).filter(Boolean))}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "10px 14px", borderRadius: 8, cursor: "pointer",
              background: "#1e3a5f", border: "1px solid #3b82f6",
              color: "#93c5fd", fontSize: 13, fontWeight: 700,
            }}
          >
            Done — Start Building
          </button>
        </>
      )}

      <button type="button" onClick={() => finish([])} style={{ fontSize: 11, color: "#475569", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        Skip — set up later
      </button>
    </div>
  );
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────

function ChatTab({ onOpenExecBrief }: { onOpenExecBrief?: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);
  const [envDone, setEnvDone] = useState(!!workflow.environment);

  const [messages, setMessages] = useState<WizardMessage[]>([
    { role: "assistant", content: OPENER },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nodesAdded, setNodesAdded] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: WizardMessage = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await studioAiFetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, workflow }),
      });
      const data = await res.json() as
        | { ok: true; reply: string; action: { type: string; nodes?: WizardNodeSpec[] } }
        | { ok: false; error: string };

      if (!data.ok) { setError(data.error); return; }

      const assistantMsg: WizardMessage = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.action.type === "add_nodes" && data.action.nodes?.length) {
        const currentNodes = useWorkflowStore.getState().workflow.nodes;
        const existingNames = new Set(currentNodes.map((n) => n.data.name));
        const seenInBatch = new Set<string>();
        const freshSpecs = data.action.nodes.filter((spec) => {
          if (existingNames.has(spec.name) || seenInBatch.has(spec.name)) return false;
          seenInBatch.add(spec.name);
          return true;
        });
        if (!freshSpecs.length) return;
        const newNodes = freshSpecs.map((spec, i) =>
          specToNode(spec, currentNodes.length + i)
        );
        const updatedWorkflow: Workflow = {
          ...useWorkflowStore.getState().workflow,
          nodes: [...currentNodes, ...newNodes],
          edges: useWorkflowStore.getState().workflow.edges,
        };
        const wired = syncSkillContractsFromGraph(buildEdgesFromContracts(updatedWorkflow));
        setWorkflow(wired);
        setNodesAdded((n) => n + newNodes.length);
        setTimeout(() => applyAutoLayout(), 50);

        // Warn about human nodes placed with no defined inputs or outputs
        const disconnectedHumans = newNodes.filter((n) => {
          if (n.type !== "human") return false;
          const d = n.data as { requiredInputs?: string[]; producedArtifacts?: string[] };
          return !d.requiredInputs?.length && !d.producedArtifacts?.length;
        });
        if (disconnectedHumans.length > 0) {
          const names = disconnectedHumans.map((n) => `"${n.data.name}"`).join(", ");
          const plural = disconnectedHumans.length > 1;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ Note: ${plural ? "these human steps" : "the human step"} ${names} ${plural ? "have" : "has"} no defined inputs or outputs yet. What does ${plural ? "each" : "it"} receive, and what does ${plural ? "they" : "it"} produce? Tell me and I'll wire them up — an unconnected human step is a gap in the workflow.`,
            },
          ]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  if (!envDone) {
    return <EnvironmentGather onComplete={() => setEnvDone(true)} />;
  }

  return (
    <>
      {nodesAdded > 0 && (
        <div style={{ padding: "6px 18px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11,
            background: "#14532d",
            color: "#86efac",
            borderRadius: 999,
            padding: "2px 10px",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#22c55e",
          }}>
            {nodesAdded} node{nodesAdded !== 1 ? "s" : ""} added to canvas
          </span>
          {onOpenExecBrief && (
            <button
              type="button"
              onClick={onOpenExecBrief}
              style={{
                background: "#0d1a35",
                border: "1px solid #1e3a5f",
                borderRadius: 999,
                color: "#67e8f9",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✨ Generate Executive Brief
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: msg.role === "user" ? "#1e3a5f" : "#1e293b",
              borderWidth: 1, borderStyle: "solid",
              borderColor: msg.role === "user" ? "#3b82f6" : "#334155",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: msg.role === "user" ? "#93c5fd" : "#64748b",
              flexShrink: 0,
            }}>
              {msg.role === "user" ? "you" : "AI"}
            </div>
            <div style={{
              maxWidth: "78%",
              background: msg.role === "user" ? "#1e3a5f" : "#1e293b",
              borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
              padding: "10px 14px",
              fontSize: 13, lineHeight: 1.6, color: "#e2e8f0",
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#1e293b", borderWidth: 1, borderStyle: "solid", borderColor: "#334155",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#64748b",
            }}>AI</div>
            <div style={{
              background: "#1e293b", borderRadius: "4px 12px 12px 12px",
              padding: "10px 14px", fontSize: 13, color: "#64748b",
            }}>
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#fca5a5", padding: "8px 12px", background: "#7f1d1d22", borderRadius: 6 }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 18px",
        borderTop: "1px solid #1e293b",
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
      }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe your workflow... (Enter to send, Shift+Enter for new line)"
          disabled={loading}
          style={{
            flex: 1, resize: "none", fontSize: 13,
            background: "#1e293b",
            borderWidth: 1, borderStyle: "solid", borderColor: "#334155",
            borderRadius: 8, padding: "8px 12px", color: "#e2e8f0",
          }}
        />
        <button
          type="button"
          disabled={loading || !input.trim()}
          onClick={() => void sendMessage(input)}
          style={{
            padding: "8px 16px",
            background: "#1e1040",
            borderWidth: 1, borderStyle: "solid", borderColor: "#7c3aed",
            borderRadius: 8, color: "#c4b5fd",
            fontWeight: 600, fontSize: 13,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>

      <div style={{ padding: "6px 18px 10px", fontSize: 10, color: "#334155", textAlign: "center" }}>
        Nodes appear on the canvas as the conversation progresses · Close when done — the workflow stays
      </div>
    </>
  );
}

// ─── Quick Generate tab ───────────────────────────────────────────────────────

type GenMode = "draft" | "proposals";

function QuickGenerateTab({ onOpenExecBrief }: { onOpenExecBrief?: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const addProposalNodes = useWorkflowStore((s) => s.addProposalNodes);
  const approveAndMergeAll = useWorkflowStore((s) => s.approveAndMergeAll);
  const runValidation = useWorkflowStore((s) => s.runValidation);

  const [genMode, setGenMode] = useState<GenMode>("draft");
  const [goal, setGoal] = useState("");
  const [complexity, setComplexity] = useState<GenerationRequest["complexity"]>("medium");
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState("");
  const [error, setError] = useState("");

  const proposalCount = workflow.nodes.filter((n) => n.type === "proposal").length;
  const nonEmptyCanvas = workflow.nodes.filter((n) => n.type !== "proposal").length > 0;

  const placeholder =
    genMode === "draft"
      ? 'e.g. "Automated project intake pipeline that parses requirements, assigns tasks, and produces a status report"'
      : 'e.g. "Add a stakeholder approval gate before the final report is sent"';

  const onGenerate = async () => {
    if (genMode === "draft" && nonEmptyCanvas) {
      const ok = window.confirm("Generate Draft will replace the current canvas. Continue?");
      if (!ok) return;
    }
    setLoading(true);
    setError("");
    setLastSummary("");
    try {
      const body: GenerationRequest = {
        goal: goal.trim() || placeholder,
        mode: genMode,
        complexity,
      };
      const res = await studioAiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | { ok: true; payload: GenerationResponse }
        | { ok: false; error: string; details?: unknown };
      if (!res.ok || !data.ok) {
        setError(data.ok ? "Generation failed" : data.error);
        return;
      }
      if (genMode === "draft") {
        const draft = generationToDraftWorkflow(data.payload, goal.trim() || "AI Generated Workflow");
        setWorkflow(draft);
        runValidation();
        const skillCount = draft.nodes.filter((n) => n.type === "skill").length;
        const artCount = draft.nodes.filter((n) => n.type === "artifact").length;
        setLastSummary(`Done: ${skillCount} skills, ${artCount} artifacts, ${draft.edges.length} edges wired.`);
      } else {
        const proposals = generationToProposalNodes(data.payload);
        addProposalNodes(proposals);
        runValidation();
        setLastSummary(`${proposals.length} proposals added — review below, then "Build All".`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const onApproveAll = () => {
    const result = approveAndMergeAll();
    runValidation();
    if (result.errors.length) {
      setError(`Merged ${result.mergedCount}. Errors: ${result.errors.join("; ")}`);
    } else {
      setLastSummary(`Built! ${result.mergedCount} proposals merged into the workflow.`);
      setError("");
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "grid", gap: 12, alignContent: "start" }}>

      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
        Describe your goal and generate a complete workflow in one shot.
        Use <strong style={{ color: "#94a3b8" }}>Draft</strong> to replace the canvas,
        or <strong style={{ color: "#94a3b8" }}>Proposals</strong> to add reviewable nodes to an existing workflow.
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" style={genTabStyle(genMode === "draft")}
          onClick={() => { setGenMode("draft"); setLastSummary(""); setError(""); }}>
          Draft Workflow
        </button>
        <button type="button" style={genTabStyle(genMode === "proposals")}
          onClick={() => { setGenMode("proposals"); setLastSummary(""); setError(""); }}>
          Add Proposals
        </button>
      </div>

      <textarea
        rows={4}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={placeholder}
        style={{
          fontSize: 13,
          resize: "vertical",
          background: "#1e293b",
          borderWidth: 1, borderStyle: "solid", borderColor: "#334155",
          borderRadius: 8, padding: "8px 12px", color: "#e2e8f0",
        }}
      />

      <label style={{ fontSize: 12, color: "#94a3b8" }}>
        Complexity
        <select
          value={complexity}
          onChange={(e) => setComplexity(e.target.value as GenerationRequest["complexity"])}
          style={{
            display: "block", marginTop: 4, width: "100%",
            background: "#1e293b", borderWidth: 1, borderStyle: "solid",
            borderColor: "#334155", borderRadius: 6,
            padding: "5px 8px", fontSize: 12, color: "#e2e8f0",
          }}
        >
          <option value="small">Small (3–5 skills)</option>
          <option value="medium">Medium (6–10 skills)</option>
          <option value="large">Large (10+ skills)</option>
        </select>
      </label>

      <button
        type="button"
        disabled={loading}
        onClick={() => void onGenerate()}
        style={{
          background: genMode === "draft" ? "#1e1040" : "#1e293b",
          borderWidth: 1, borderStyle: "solid",
          borderColor: genMode === "draft" ? "#7c3aed" : "#475569",
          borderRadius: 8,
          color: genMode === "draft" ? "#c4b5fd" : "#cbd5e1",
          fontWeight: 700, fontSize: 13,
          padding: "9px 0",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Generating…" : genMode === "draft" ? "Generate Draft Workflow" : "Generate Proposals"}
      </button>

      {genMode === "proposals" && proposalCount > 0 && (
        <button
          type="button"
          onClick={onApproveAll}
          style={{
            background: "#14532d",
            borderWidth: 1, borderStyle: "solid", borderColor: "#22c55e",
            borderRadius: 8, color: "#86efac",
            fontWeight: 700, fontSize: 13,
            padding: "9px 0",
            cursor: "pointer",
          }}
        >
          {`Approve & Build All (${proposalCount})`}
        </button>
      )}

      {lastSummary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontSize: 12, color: "#86efac", lineHeight: 1.6,
            background: "#14532d33", borderRadius: 6, padding: "8px 12px",
          }}>
            {lastSummary}
          </div>
          {onOpenExecBrief && (
            <button
              type="button"
              onClick={onOpenExecBrief}
              style={{
                alignSelf: "flex-start",
                background: "linear-gradient(90deg, #0d1a35, #0c1a2e)",
                border: "1px solid #0891b2",
                borderRadius: 8,
                color: "#67e8f9",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              ✨ Generate Executive Brief
            </button>
          )}
        </div>
      )}
      {error && (
        <div style={{
          fontSize: 12, color: "#fca5a5", lineHeight: 1.6,
          background: "#7f1d1d33", borderRadius: 6, padding: "8px 12px",
        }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>
        Requires OPENAI_API_KEY in .env.local
      </div>
    </div>
  );
}

// ─── Map Process Tab (current-state capture) ──────────────────────────────────

const MAP_OPENER = `Let\'s map how your team does this TODAY — the real, manual process before any automation.

Walk me through it step by step. For each step, tell me:
• What exactly happens?
• Who does it? (role or name)
• What tool or app do they use? (Outlook, Excel, SharePoint, a paper form, etc.)
• What comes in, and what goes out?
• Roughly how long does it take?

What\'s the first thing that happens?`;

function MapProcessTab({ onOpenExecBrief }: { onOpenExecBrief?: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);

  const [messages, setMessages] = useState<WizardMessage[]>([
    { role: "assistant", content: MAP_OPENER },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nodesAdded, setNodesAdded] = useState(0);
  const [readyToAutomate, setReadyToAutomate] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: WizardMessage = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await studioAiFetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          workflow: useWorkflowStore.getState().workflow,
          mode: "current_state",
        }),
      });
      const data = (await res.json()) as { ok: true; reply: string; action: { type: string; nodes?: unknown[] } } | { ok: false; error: string };
      if (!data.ok) { setError((data as { ok: false; error: string }).error); return; }

      const assistantMsg: WizardMessage = { role: "assistant", content: (data as { ok: true; reply: string; action: { type: string; nodes?: unknown[] } }).reply };
      setMessages((prev) => [...prev, assistantMsg]);

      // Detect "ready to automate" signal in the reply
      if (assistantMsg.content.toLowerCase().includes("ready to generate the automated") || assistantMsg.content.toLowerCase().includes("automated version")) {
        setReadyToAutomate(true);
      }

      const action = (data as { ok: true; reply: string; action: { type: string; nodes?: unknown[] } }).action;
      if (action.type === "add_nodes" && action.nodes?.length) {
        const currentNodes = useWorkflowStore.getState().workflow.nodes;
        const existingNames = new Set(currentNodes.map((n) => n.data.name));
        const seenInBatch = new Set<string>();
        const freshSpecs = (action.nodes as Parameters<typeof specToNode>[0][]).filter((spec) => {
          if (existingNames.has(spec.name) || seenInBatch.has(spec.name)) return false;
          seenInBatch.add(spec.name);
          return true;
        });
        if (!freshSpecs.length) return;
        const newNodes = freshSpecs.map((spec, i) => specToNode(spec, currentNodes.length + i));
        const updatedWorkflow: Workflow = {
          ...useWorkflowStore.getState().workflow,
          workflowType: "current_state",
          nodes: [...currentNodes, ...newNodes],
          edges: useWorkflowStore.getState().workflow.edges,
        };
        const wired = syncSkillContractsFromGraph(buildEdgesFromContracts(updatedWorkflow));
        setWorkflow(wired);
        setNodesAdded((n) => n + newNodes.length);
        setTimeout(() => applyAutoLayout(), 50);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {nodesAdded > 0 && (
        <div style={{ padding: "6px 18px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, background: "#1a1020", color: "#a78bfa", borderRadius: 999, padding: "2px 10px", border: "1px solid #7c3aed" }}>
            {nodesAdded} step{nodesAdded !== 1 ? "s" : ""} mapped
          </span>
          {(readyToAutomate || nodesAdded >= 3) && (
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Canvas tagged as <strong style={{ color: "#a78bfa" }}>Current State</strong>
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: msg.role === "user" ? "#1a1020" : "#1e293b", border: `1px solid ${msg.role === "user" ? "#7c3aed" : "#334155"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: msg.role === "user" ? "#c4b5fd" : "#64748b", flexShrink: 0 }}>
              {msg.role === "user" ? "you" : "AI"}
            </div>
            <div style={{ maxWidth: "78%", background: msg.role === "user" ? "#1a1020" : "#1e293b", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1e293b", border: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#64748b" }}>AI</div>
            <div style={{ background: "#1e293b", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", fontSize: 13, color: "#64748b" }}>Mapping...</div>
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: "#fca5a5", padding: "8px 12px", background: "#7f1d1d22", borderRadius: 6 }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 18px", borderTop: "1px solid #1e293b", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
          placeholder="Describe the next step... (Enter to send)"
          disabled={loading}
          style={{ flex: 1, resize: "none", fontSize: 13, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0" }}
        />
        <button type="button" onClick={() => void sendMessage(input)} disabled={loading || !input.trim()} style={{ padding: "8px 16px", borderRadius: 8, background: "#7c3aed22", border: "1px solid #7c3aed", color: "#c4b5fd", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Map
        </button>
      </div>
    </>
  );
}


// ─── Main export ──────────────────────────────────────────────────────────────

type WizardTab = "chat" | "generate" | "map";

export function WorkflowWizard({ onClose, onOpenExecBrief }: { onClose: () => void; onOpenExecBrief?: () => void }) {
  const [activeTab, setActiveTab] = useState<WizardTab>("chat");

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "#0b102099",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: 700,
        maxWidth: "95vw",
        height: "82vh",
        maxHeight: 720,
        background: "#0f172a",
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#334155",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 18px 0",
          borderBottom: "1px solid #1e293b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>
                Workflow Builder
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Design through conversation, or generate from a description
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none", border: "none",
                color: "#64748b", cursor: "pointer",
                fontSize: 18, lineHeight: 1, padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0 }}>
            <button
              type="button"
              style={tabStyle(activeTab === "chat")}
              onClick={() => setActiveTab("chat")}
            >
              Chat with Wizard
            </button>
            <button
              type="button"
              style={{ ...tabStyle(activeTab === "generate"), marginLeft: 4 }}
              onClick={() => setActiveTab("generate")}
            >
              Quick Generate
            </button>
            <button
              type="button"
              style={{ ...tabStyle(activeTab === "map"), marginLeft: 4, color: activeTab === "map" ? "#a78bfa" : undefined, borderBottomColor: activeTab === "map" ? "#7c3aed" : "transparent" }}
              onClick={() => setActiveTab("map")}
            >
              Map Process
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10, color: "#334155", alignSelf: "flex-end", paddingBottom: 8 }}>
              W to open/close
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeTab === "chat" ? <ChatTab onOpenExecBrief={onOpenExecBrief} /> : activeTab === "generate" ? <QuickGenerateTab onOpenExecBrief={onOpenExecBrief} /> : <MapProcessTab onOpenExecBrief={onOpenExecBrief} />}
        </div>
      </div>
    </div>
  );
}
