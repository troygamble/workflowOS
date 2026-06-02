"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { ArtifactNode } from "@/components/nodes/artifact-node";
import { ConditionalNode } from "@/components/nodes/conditional-node";
import { HumanNode } from "@/components/nodes/human-node";
import { IntegrationNode } from "@/components/nodes/integration-node";
import { ProposalNode } from "@/components/nodes/proposal-node";
import { SkillNode } from "@/components/nodes/skill-node";
import { SystemNode } from "@/components/nodes/system-node";
import { NODE_THEME } from "@/components/nodes/node-utils";
import { computeDerivedInvalidationEdges } from "@/lib/state/derived-edges";
import { deriveState } from "@/lib/state/state-engine";
import type {
  ArtifactNodeData,
  HumanNodeData,
  IntegrationNodeData,
  Mode,
  ProposalNodeData,
  SkillNodeData,
} from "@/lib/types/workflow";
import { useRuntimeStore } from "@/store/runtime-store";
import { useWorkflowStore } from "@/store/workflow-store";

const nodeTypes: Record<string, React.ComponentType<any>> = {
  skill: SkillNode,
  artifact: ArtifactNode,
  human: HumanNode,
  integration: IntegrationNode,
  proposal: ProposalNode,
  system: SystemNode,
  conditional: ConditionalNode,
};

function edgeColor(type: string): string {
  if (type === "derived_invalidation") return "#f97316";
  if (type === "proposal") return "#c084fc";
  if (type === "human") return "#f59e0b";
  if (type === "output") return "#3b82f6";
  if (type === "integration") return "#0ea5e9";
  if (type === "condition_true") return "#22c55e";
  if (type === "condition_false") return "#ef4444";
  return "#64748b";
}

function miniMapColor(node: Node): string {
  const t = node.type as keyof typeof NODE_THEME | undefined;
  return t && NODE_THEME[t] ? NODE_THEME[t].border : "#64748b";
}

type Props = { mode: Mode; onOpenWizard?: () => void; onOpenTemplates?: () => void; };

export function WorkflowCanvas({ mode, onOpenWizard, onOpenTemplates }: Props) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const connectNodes = useWorkflowStore((s) => s.connectNodes);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const validation = useWorkflowStore((s) => s.validation);
  const jobs = useRuntimeStore((s) => s.jobs);

  const running = useMemo(
    () => new Set(jobs.filter((j) => j.status === "running").map((j) => j.stepId)),
    [jobs]
  );
  const failed = useMemo(
    () => new Set(jobs.filter((j) => j.status === "failed").map((j) => j.stepId)),
    [jobs]
  );
  const derived = useMemo(
    () => deriveState(workflow, running, failed),
    [workflow, running, failed]
  );
  const issuesByNode = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const issue of validation.issues) {
      if (issue.nodeId && issue.severity === "error") map[issue.nodeId] = true;
    }
    return map;
  }, [validation]);

  const allEdges = useMemo(() => {
    const derivedEdges = mode === "design" ? [] : computeDerivedInvalidationEdges(workflow);
    return [...workflow.edges, ...derivedEdges];
  }, [workflow, mode]);

  const viewNodes: Node[] = useMemo(
    () =>
      workflow.nodes.map((n) => {
        const hasIssues = issuesByNode[n.id] ?? false;
        let enriched: Record<string, unknown> = { ...n.data, hasIssues };

        if (n.type === "skill") {
          const d = n.data as SkillNodeData;
          enriched = {
            ...enriched,
            derivedStatus: derived.skills[n.id]?.status ?? d.status ?? "idle",
            inputCount: d.inputs?.length ?? 0,
            outputCount: d.outputs?.length ?? 0,
            implementationFile: d.implementationFile,
            presenterNote: d.presenterNote,
            team: d.team,
            owner: d.owner,
            runtimeTarget: d.runtimeTarget,
            modelName: d.modelName,
          };
        } else if (n.type === "artifact") {
          const d = n.data as ArtifactNodeData;
          enriched = {
            ...enriched,
            derivedStatus: derived.artifacts[n.id]?.status ?? d.status ?? "unknown",
          };
        } else if (n.type === "human") {
          const d = n.data as HumanNodeData;
          enriched = {
            ...enriched,
            subtype: d.subtype,
            requiredInputCount: d.requiredInputs?.length ?? 0,
            producedArtifactCount: d.producedArtifacts?.length ?? 0,
            team: d.team,
            owner: d.owner,
            minutesPerOccurrence: d.minutesPerOccurrence,
          };
        } else if (n.type === "integration") {
          const d = n.data as IntegrationNodeData;
          enriched = {
            ...enriched,
            subtype: d.subtype,
            direction: d.direction,
            system: d.system,
            automated: d.automated,
            estimatedTime: d.estimatedTime,
            inputCount: d.inputs?.length ?? 0,
            outputCount: d.outputs?.length ?? 0,
            team: d.team,
            owner: d.owner,
          };
        } else if (n.type === "proposal") {
          const d = n.data as ProposalNodeData;
          enriched = {
            ...enriched,
            status: d.status,
            proposalType: d.proposalType,
            source: d.source,
          };
        }

        return {
          id: n.id,
          position: n.position,
          type: n.type,
          data: enriched,
        };
      }),
    [workflow.nodes, derived, issuesByNode]
  );

  const viewEdges: Edge[] = useMemo(
    () =>
      allEdges.map((e) => {
        const color = edgeColor(e.edgeType);
        const isActive =
          mode === "run" &&
          ((e.edgeType === "output" &&
            jobs.some((j) => j.status === "running" && j.stepId === e.source)) ||
            (e.edgeType === "input" &&
              jobs.some((j) => j.status === "running" && j.stepId === e.target)));
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          // Labels shown only on hover via ReactFlow default — too noisy otherwise
          // label: e.edgeType + (e.derived ? " (derived)" : ""),
          animated: isActive,
          style: {
            stroke: color,
            strokeWidth: isActive ? 2.5 : 1.5,
            opacity: mode === "design" ? 0.7 : mode === "run" && e.derived ? 0.4 : 1,
            strokeDasharray: e.edgeType === "derived_invalidation" ? "6 3" : undefined,
            filter: isActive ? `drop-shadow(0 0 3px ${color})` : undefined,
          },
        };
      }),
    [allEdges, mode, jobs]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(viewNodes);
  const [edges, setReactEdges, onEdgesChange] = useEdgesState(viewEdges);

  useEffect(() => setNodes(viewNodes), [setNodes, viewNodes]);
  useEffect(() => setReactEdges(viewEdges), [setReactEdges, viewEdges]);

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const ok = connectNodes(connection.source, connection.target);
    if (!ok) {
      window.alert("That connection is not valid for these node types, or the edge already exists.");
    }
  };

  const syncNodePositions = () => {
    const map = new Map(nodes.map((n) => [n.id, n.position]));
    const current = useWorkflowStore.getState().workflow;
    setWorkflow(
      {
        ...current,
        nodes: current.nodes.map((n) => ({ ...n, position: map.get(n.id) ?? n.position })),
      },
      true
    );
  };

  return (
    <section
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        contain: "layout style paint",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: mode === "run" ? "rgba(29,78,216,0.68)" : mode === "state" ? "rgba(120,53,15,0.68)" : "rgba(15,23,42,0.72)",
          border: `1px solid ${mode === "run" ? "#3b82f6" : mode === "state" ? "#f59e0b" : "#475569"}`,
          borderRadius: 999,
          padding: "4px 16px",
          fontSize: 11,
          fontWeight: 700,
          color: "#e2e8f0",
          letterSpacing: "0.08em",
          pointerEvents: "none",
          boxShadow: "0 12px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {mode === "design" ? "DESIGN MODE" : mode === "state" ? "STATE MODE" : "RUN MODE"}
      </div>
      {workflow.nodes.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto", textAlign: "center", maxWidth: 610, padding: 34, background: "linear-gradient(180deg, rgba(9,18,34,0.86), rgba(5,10,20,0.68))", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, boxShadow: "0 28px 84px rgba(0,0,0,0.44), 0 0 0 1px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.06)", backdropFilter: "blur(16px) saturate(1.2)", WebkitBackdropFilter: "blur(16px) saturate(1.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
              How do you want to start?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>

              {/* AI Wizard */}
              <button
                type="button"
                onClick={onOpenWizard}
                style={{ background: "linear-gradient(180deg, rgba(76,29,149,0.34), rgba(16,8,32,0.92))", border: "1px solid #7c3aed55", borderRadius: 10, padding: "16px 14px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 16px 34px rgba(76,29,149,0.16), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#7c3aed"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#7c3aed44"; }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>✨</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd" }}>AI Wizard</span>
                <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Describe your process in natural language — AI maps it into structured nodes</span>
                <span style={{ fontSize: 10, color: "#7c3aed", marginTop: 2 }}>Press W</span>
              </button>

              {/* Templates */}
              <button
                type="button"
                onClick={onOpenTemplates}
                style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(8,15,30,0.9))", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, padding: "16px 14px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 16px 34px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.06)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#3b82f6"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e293b"; }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>📁</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd" }}>Templates</span>
                <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Start from a real process — Invoice Approval, Onboarding, and more</span>
                <span style={{ fontSize: 10, color: "#3b82f6", marginTop: 2 }}>14 templates</span>
              </button>

              {/* Manual */}
              <div
                style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(8,15,30,0.82))", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, padding: "16px 14px", textAlign: "left", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 16px 34px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.05)" }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>🔨</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>Build Manually</span>
                <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Use the left panel to add nodes step by step</span>
                <span style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>← See left panel</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "#64748b" }}>
              Tip: every workflow is{" "}
              <span style={{ color: "#3b82f6" }}>Skills</span>{" (automated) · "}
              <span style={{ color: "#f59e0b" }}>Humans</span>{" (decisions) · "}
              <span style={{ color: "#0ea5e9" }}>Integrations</span>{" (external apps) · "}
              <span style={{ color: "#64748b" }}>Artifacts</span>{" (files)"}
            </div>
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", position: "relative" }}>
        <ReactFlow
          style={{ width: "100%", height: "100%" }}
          proOptions={{ hideAttribution: true }}
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={syncNodePositions}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(undefined)}
          fitView
          deleteKeyCode={null}
        >
        <MiniMap
          nodeColor={miniMapColor}
          nodeStrokeColor="#1e293b"
          nodeStrokeWidth={2}
          bgColor="#080e1c"
          maskColor="#0b102066"
          style={{ background: "#080e1c" }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#1e3a5f" />
    
        <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}
