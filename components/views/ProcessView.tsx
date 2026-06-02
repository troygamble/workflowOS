"use client";

import { useWorkflowStore } from "@/store/workflow-store";
import type {
  ArtifactNodeData,
  BlastRadius,
  HumanNodeData,
  IntegrationNodeData,
  SkillNodeData,
  Workflow,
  WorkflowNode,
} from "@/lib/types/workflow";

// ─── Topological sort ─────────────────────────────────────────────────────────

function topoSort(workflow: Workflow): WorkflowNode[] {
  const edges = workflow.edges.filter((e) => !e.derived);
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const n of workflow.nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }
  for (const e of edges) {
    children.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  const ordered: WorkflowNode[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = workflow.nodes.find((n) => n.id === id);
    if (node) ordered.push(node);
    for (const child of children.get(id) ?? []) {
      const deg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }
  // Append any disconnected nodes
  for (const n of workflow.nodes) {
    if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
}

function getConnectedArtifacts(nodeId: string, workflow: Workflow, direction: "in" | "out"): string[] {
  const artifactIds = workflow.edges
    .filter((e) => direction === "out" ? e.source === nodeId : e.target === nodeId)
    .map((e) => direction === "out" ? e.target : e.source)
    .filter((id) => workflow.nodes.find((n) => n.id === id)?.type === "artifact");

  return artifactIds.map((id) => {
    const n = workflow.nodes.find((n) => n.id === id);
    return (n?.data as ArtifactNodeData)?.name ?? id;
  });
}

// ─── Node renderers ───────────────────────────────────────────────────────────

const HUMAN_SUBTYPE_LABEL: Record<string, string> = {
  approval: "reviews and approves",
  data_entry: "enters data",
  file_movement: "moves or sends a file",
  communication: "sends a message",
  judgment: "makes a decision",
  physical: "completes a physical action",
};

const INTEGRATION_SUBTYPE_LABEL: Record<string, string> = {
  email_send: "sends an email",
  email_receive: "receives an email",
  form_submit: "submits a form",
  legacy_system: "accesses an external system",
  webhook: "triggers a webhook",
  file_transfer: "transfers a file",
  notification: "sends a notification",
  other: "connects to an external system",
};

function StepCard({
  node,
  index,
  workflow,
  isFirst,
  isLast,
}: {
  node: WorkflowNode;
  index: number;
  workflow: Workflow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const outputs = getConnectedArtifacts(node.id, workflow, "out");
  const inputs = getConnectedArtifacts(node.id, workflow, "in");

  if (node.type === "artifact") return null; // artifacts shown inline, not as steps

  let accent = "#64748b";
  let icon = "•";
  let typeLabel = "";
  let headline = node.data.name as string;
  let body = (node.data as { description?: string }).description ?? "";
  let badge: string | null = null;
  let badgeColor = "#64748b";
  let hasBlastRadius = false;

  if (node.type === "integration") {
    const d = node.data as IntegrationNodeData;
    accent = "#0ea5e9";
    icon = "🔗";
    typeLabel = "External System";
    const action = INTEGRATION_SUBTYPE_LABEL[d.subtype] ?? "connects";
    body = body || `${action}${d.system ? ` via ${d.system}` : ""}`;
    badge = d.system ?? null;
    badgeColor = "#0ea5e9";
    if (!d.description && d.subtype?.includes("receive")) {
      typeLabel = "Trigger";
      icon = "🚀";
      accent = "#22c55e";
      badgeColor = "#22c55e";
    }
  } else if (node.type === "skill") {
    const sd = node.data as SkillNodeData;
    accent = "#3b82f6";
    icon = "⚡";
    typeLabel = "Automated";
    badge = "AI / Script";
    badgeColor = "#3b82f6";
    const br = sd.blastRadius as BlastRadius | undefined;
    hasBlastRadius = !!(br && (
      (br.allowedPaths && br.allowedPaths.length > 0) ||
      (br.blockedPaths && br.blockedPaths.length > 0) ||
      br.noNetworkAccess
    ));
  } else if (node.type === "human") {
    const d = node.data as HumanNodeData;
    accent = "#f59e0b";
    icon = "👤";
    typeLabel = "Human Step";
    const action = HUMAN_SUBTYPE_LABEL[d.subtype] ?? "handles";
    if (!body && d.subtype) body = `Someone ${action}`;
    if (d.minutesPerOccurrence) {
      badge = `⏱ ${d.minutesPerOccurrence < 60 ? `${d.minutesPerOccurrence} min` : `${(d.minutesPerOccurrence / 60).toFixed(1)} hr`}`;
      badgeColor = "#f59e0b";
    }
  } else if (node.type === "system") {
    accent = "#8b5cf6";
    icon = "🖥";
    typeLabel = "System";
  }

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
      {/* Left spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
        <div style={{
          width: 2,
          flex: isFirst ? "0 0 20px" : "0 0 16px",
          background: isFirst ? "transparent" : "#1e293b",
        }} />
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: accent + "22", border: `2px solid ${accent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{
          width: 2, flex: 1,
          background: isLast ? "transparent" : "#1e293b",
          minHeight: 16,
        }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginLeft: 12, marginBottom: 8,
        background: "#0a0f1e", border: `1px solid ${accent}33`,
        borderRadius: 10, padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {typeLabel}
          </span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: badgeColor,
              background: badgeColor + "18", border: `1px solid ${badgeColor}44`,
              borderRadius: 999, padding: "1px 8px",
            }}>
              {badge}
            </span>
          )}
          {hasBlastRadius && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#f97316",
              background: "#f9731618", border: "1px solid #f9731644",
              borderRadius: 999, padding: "1px 8px",
            }}>
              🛡 bounded
            </span>
          )}
          {index > 0 && node.type !== "integration" && (
            <span style={{ fontSize: 9, color: "#334155", marginLeft: "auto" }}>Step {index}</span>
          )}
        </div>

        {/* Headline */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3 }}>
          {headline}
        </div>

        {/* Body */}
        {body && (
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{body}</div>
        )}

        {/* Inputs */}
        {inputs.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
            <span style={{ fontSize: 10, color: "#334155" }}>Uses:</span>
            {inputs.map((a) => (
              <span key={a} style={{ fontSize: 10, color: "#475569", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, padding: "1px 6px" }}>
                📄 {a}
              </span>
            ))}
          </div>
        )}

        {/* Outputs */}
        {outputs.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#334155" }}>Produces:</span>
            {outputs.map((a) => {
              const artNode = workflow.nodes.find(
                (n) => n.type === "artifact" && (n.data as ArtifactNodeData).fileName === a
              );
              const oc = artNode ? (artNode.data as ArtifactNodeData).outputContract : undefined;
              const hasContract = oc && (oc.validationNote || (oc.requiredFields && oc.requiredFields.length > 0));
              return (
                <span key={a} title={hasContract ? oc!.validationNote ?? "Contract defined" : "No contract yet"}
                  style={{
                    fontSize: 10,
                    color: hasContract ? "#22c55e" : "#475569",
                    background: hasContract ? "#0a1a12" : "#0f172a",
                    border: hasContract ? "1px solid #22c55e44" : "1px solid #1e293b",
                    borderRadius: 4, padding: "1px 6px",
                  }}>
                  {hasContract ? "✓" : "📄"} {a}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ workflow }: { workflow: Workflow }) {
  const steps = workflow.nodes.filter((n) => n.type !== "artifact");
  const human = workflow.nodes.filter((n) => n.type === "human");
  const automated = workflow.nodes.filter((n) => n.type === "skill");
  const totalMins = human.reduce((s, n) => s + ((n.data as HumanNodeData).minutesPerOccurrence ?? 0), 0);

  const stat = (value: string, label: string, color: string) => (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      display: "flex", gap: 0,
      background: "#0a0f1e", border: "1px solid #1e293b",
      borderRadius: 10, padding: "12px 0", marginBottom: 20,
    }}>
      {stat(String(steps.length), "total steps", "#94a3b8")}
      <div style={{ width: 1, background: "#1e293b" }} />
      {stat(String(automated.length), "automated", "#3b82f6")}
      <div style={{ width: 1, background: "#1e293b" }} />
      {stat(String(human.length), "human steps", "#f59e0b")}
      {totalMins > 0 && <>
        <div style={{ width: 1, background: "#1e293b" }} />
        {stat(
          totalMins < 60 ? `${totalMins}m` : `${(totalMins / 60).toFixed(1)}h`,
          "manual time/run",
          "#f59e0b"
        )}
      </>}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyProcessView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: 40 }}>
      <div style={{ fontSize: 36, opacity: 0.15 }}>📋</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>No steps yet</div>
      <div style={{ fontSize: 12, color: "#1e293b", textAlign: "center", maxWidth: 280, lineHeight: 1.7 }}>
        Add nodes using the left panel — they&apos;ll appear here as a readable process document as you build.
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProcessView() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const ordered = topoSort(workflow).filter((n) => n.type !== "artifact" && n.type !== "proposal");

  if (ordered.length === 0) return <EmptyProcessView />;

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#080c18",
      display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 680, padding: "28px 32px" }}>

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Process Overview
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1.2 }}>
            {workflow.name || "Untitled Workflow"}
          </h2>
          {workflow.objective && (
            <p style={{ fontSize: 13, color: "#64748b", margin: "8px 0 0", lineHeight: 1.6 }}>
              {workflow.objective}
            </p>
          )}
        </div>

        {/* Summary stats */}
        <SummaryBar workflow={workflow} />

        {/* Step-by-step */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          How it works
        </div>
        <div>
          {ordered.map((node, i) => (
            <StepCard
              key={node.id}
              node={node}
              index={i + 1}
              workflow={workflow}
              isFirst={i === 0}
              isLast={i === ordered.length - 1}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #0f172a", fontSize: 11, color: "#1e293b", textAlign: "center" }}>
          {workflow.workflowType === "current_state"
            ? "This is the current manual process — use ⚡ Automate This to generate the future-state version."
            : workflow.workflowType === "future_state"
            ? "This is the future automated state."
            : "Switch to Canvas view to connect and rearrange nodes."}
        </div>
      </div>
    </div>
  );
}
