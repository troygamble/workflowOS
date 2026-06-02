"use client";

import { useMemo, useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { NODE_THEME } from "@/components/nodes/node-utils";
import type {
  ArtifactNodeData,
  HumanNodeData,
  ProposalNodeData,
  SkillNodeData,
  SystemNodeData,
  Workflow,
  WorkflowNode,
} from "@/lib/types/workflow";

// ---------------------------------------------------------------------------
// Topological order
// ---------------------------------------------------------------------------

function topologicalOrder(workflow: Workflow): WorkflowNode[] {
  const inDegree = new Map<string, number>();
  for (const n of workflow.nodes) inDegree.set(n.id, 0);

  const adj = new Map<string, string[]>();
  for (const e of workflow.edges) {
    if (e.derived) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  const queue = workflow.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const result: WorkflowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    result.push(node);
    for (const neighborId of adj.get(node.id) ?? []) {
      const newDeg = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, newDeg);
      if (newDeg === 0) {
        const neighbor = workflow.nodes.find((n) => n.id === neighborId);
        if (neighbor) queue.push(neighbor);
      }
    }
  }

  // Add anything remaining (e.g. in cycles)
  for (const n of workflow.nodes) {
    if (!visited.has(n.id)) result.push(n);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Auto-facts helpers
// ---------------------------------------------------------------------------

function nodeNeighbors(
  nodeId: string,
  workflow: Workflow
): { inputs: WorkflowNode[]; outputs: WorkflowNode[] } {
  const inputs: WorkflowNode[] = [];
  const outputs: WorkflowNode[] = [];
  for (const e of workflow.edges) {
    if (e.derived) continue;
    if (e.target === nodeId) {
      const n = workflow.nodes.find((x) => x.id === e.source);
      if (n) inputs.push(n);
    }
    if (e.source === nodeId) {
      const n = workflow.nodes.find((x) => x.id === e.target);
      if (n) outputs.push(n);
    }
  }
  return { inputs, outputs };
}

function nodeName(n: WorkflowNode): string {
  return String((n.data as { name?: string }).name ?? n.id);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",
  artifact: "#8b5cf6",
  human: "#f59e0b",
  proposal: "#a855f7",
  system: "#14b8a6",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NodeChip({ node, faded }: { node: WorkflowNode; faded?: boolean }) {
  const theme = NODE_THEME[node.type as keyof typeof NODE_THEME];
  const color = TYPE_COLORS[node.type] ?? "#64748b";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: color + "12",
        border: "1px solid " + color + (faded ? "33" : "55"),
        borderRadius: 8,
        padding: "6px 10px",
        opacity: faded ? 0.5 : 1,
        minWidth: 0,
        maxWidth: 160,
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>{theme?.icon ?? "?"}</span>
      <span
        style={{
          fontSize: 11,
          color: faded ? "#475569" : "#e2e8f0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 600,
        }}
      >
        {nodeName(node)}
      </span>
    </div>
  );
}

function AutoFacts({
  node,
  workflow,
}: {
  node: WorkflowNode;
  workflow: Workflow;
}) {
  const { inputs, outputs } = nodeNeighbors(node.id, workflow);
  const lines: string[] = [];

  if (node.type === "skill") {
    const d = node.data as SkillNodeData;
    if (d.inputs.length > 0) lines.push("Consumes: " + d.inputs.join(", "));
    if (d.outputs.length > 0) lines.push("Produces: " + d.outputs.join(", "));
    if (d.requires.length > 0) lines.push("Requires: " + d.requires.slice(0, 3).join(", ") + (d.requires.length > 3 ? "…" : ""));
    if (d.implementationFile) lines.push("Implementation: " + d.implementationFile);
    if (!d.enabled) lines.push("Note: this skill is currently disabled.");
  } else if (node.type === "artifact") {
    const d = node.data as ArtifactNodeData;
    lines.push("File: " + d.fileName + " (" + d.artifactType.toUpperCase() + ")");
    const producers = inputs.filter((n) => n.type === "skill").map(nodeName);
    const consumers = outputs.filter((n) => n.type === "skill").map(nodeName);
    if (producers.length > 0) lines.push("Produced by: " + producers.join(", "));
    if (consumers.length > 0) lines.push("Consumed by: " + consumers.join(", "));
    if (d.schemaRef) lines.push("Schema: " + d.schemaRef);
  } else if (node.type === "human") {
    const d = node.data as HumanNodeData;
    if (d.approverRole) lines.push("Assigned to: " + d.approverRole);
    if (d.requiredInputs.length > 0) lines.push("Needs: " + d.requiredInputs.join(", "));
    if (d.producedArtifacts.length > 0) lines.push("Produces: " + d.producedArtifacts.join(", "));
  } else if (node.type === "proposal") {
    const d = node.data as ProposalNodeData;
    lines.push("Type: " + d.proposalType.replace(/_/g, " "));
    lines.push("Status: " + d.status);
    if (d.source) lines.push("From: " + d.source);
  } else if (node.type === "system") {
    const d = node.data as SystemNodeData;
    lines.push("Role: " + d.systemRole);
  }

  if (!lines.length) return null;
  return (
    <div
      style={{
        background: "#0b1020",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 12, color: "#94a3b8" }}>
          {l}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = { onExit: () => void };

export function PresentationMode({ onExit }: Props) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const orderedNodes = useMemo(() => topologicalOrder(workflow), [workflow]);
  const [stepIndex, setStepIndex] = useState(0);

  const current = orderedNodes[stepIndex];
  if (!current) return null;

  const { inputs, outputs } = nodeNeighbors(current.id, workflow);
  const color = TYPE_COLORS[current.type] ?? "#64748b";
  const theme = NODE_THEME[current.type as keyof typeof NODE_THEME];
  const data = current.data as Record<string, unknown>;
  const presenterNote = data.presenterNote as string | undefined;
  const description = data.description as string | undefined;
  const instructions = (data as HumanNodeData).instructions;
  const reason = (data as ProposalNodeData).reason;

  const totalSteps = orderedNodes.length;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#080e1c",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        color: "#e2e8f0",
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 24px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0b1020",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
          {workflow.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#475569" }}>
            Step {stepIndex + 1} of {totalSteps}
          </span>
          {/* Progress bar */}
          <div
            style={{
              width: 120,
              height: 4,
              background: "#1e293b",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: color,
                borderRadius: 999,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <button
            type="button"
            onClick={onExit}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#64748b",
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            End Presentation
          </button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 40px",
          gap: 24,
          overflow: "auto",
        }}
      >
        {/* Flow context: inputs → current → outputs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 900,
          }}
        >
          {inputs.length > 0 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {inputs.slice(0, 4).map((n) => (
                  <NodeChip key={n.id} node={n} faded />
                ))}
                {inputs.length > 4 && (
                  <span style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
                    +{inputs.length - 4} more
                  </span>
                )}
              </div>
              <span style={{ fontSize: 20, color: "#334155" }}>→</span>
            </>
          )}

          {/* Current node card */}
          <div
            style={{
              background: color + "10",
              border: "2px solid " + color,
              borderRadius: 16,
              padding: "18px 24px",
              minWidth: 240,
              maxWidth: 360,
              textAlign: "center",
              boxShadow: "0 0 32px " + color + "22",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>{theme?.icon ?? "?"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
              {nodeName(current)}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color,
              }}
            >
              {current.type}
            </div>
          </div>

          {outputs.length > 0 && (
            <>
              <span style={{ fontSize: 20, color: "#334155" }}>→</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outputs.slice(0, 4).map((n) => (
                  <NodeChip key={n.id} node={n} faded />
                ))}
                {outputs.length > 4 && (
                  <span style={{ fontSize: 11, color: "#475569", textAlign: "center" }}>
                    +{outputs.length - 4} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Notes + facts */}
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Presenter note (primary text) */}
          {presenterNote && (
            <div
              style={{
                background: color + "10",
                border: "1px solid " + color + "44",
                borderRadius: 10,
                padding: "14px 18px",
                fontSize: 15,
                color: "#e2e8f0",
                lineHeight: 1.7,
              }}
            >
              {presenterNote}
            </div>
          )}

          {/* Description fallback */}
          {!presenterNote && (description ?? instructions ?? reason) && (
            <div
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "14px 18px",
                fontSize: 14,
                color: "#94a3b8",
                lineHeight: 1.7,
              }}
            >
              {description ?? instructions ?? reason}
            </div>
          )}

          {/* No notes hint */}
          {!presenterNote && !description && !instructions && !reason && (
            <div
              style={{
                border: "1px dashed #1e293b",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 12,
                color: "#334155",
                textAlign: "center",
              }}
            >
              Add a presenter note to this node in the Inspector panel to display talking points here.
            </div>
          )}

          {/* Auto-facts */}
          <AutoFacts node={current} workflow={workflow} />
        </div>
      </div>

      {/* ── Bottom controls ─────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 24px",
          borderTop: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0b1020",
        }}
      >
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => i - 1)}
          style={{
            border: "1px solid #334155",
            borderRadius: 8,
            background: "transparent",
            color: stepIndex === 0 ? "#334155" : "#e2e8f0",
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: stepIndex === 0 ? "default" : "pointer",
          }}
        >
          Back
        </button>

        {/* Step dots (up to 12, then numbers) */}
        {totalSteps <= 12 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {orderedNodes.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStepIndex(i)}
                style={{
                  width: i === stepIndex ? 20 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === stepIndex ? color : i < stepIndex ? "#334155" : "#1e293b",
                  border: "none",
                  cursor: "pointer",
                  transition: "width 0.2s ease, background 0.2s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#475569", minWidth: 80, textAlign: "center" }}>
            {stepIndex + 1} / {totalSteps}
          </span>
        )}

        <button
          type="button"
          disabled={stepIndex === totalSteps - 1}
          onClick={() => setStepIndex((i) => i + 1)}
          style={{
            border: "none",
            borderRadius: 8,
            background: stepIndex === totalSteps - 1 ? "#1e293b" : color,
            color: stepIndex === totalSteps - 1 ? "#334155" : "#fff",
            padding: "8px 24px",
            fontSize: 13,
            fontWeight: 700,
            cursor: stepIndex === totalSteps - 1 ? "default" : "pointer",
          }}
        >
          {stepIndex === totalSteps - 1 ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
