import type { EdgeType, Workflow, WorkflowEdge } from "@/lib/types/workflow";

export function inferEdgeTypeFromEndpoints(
  workflow: Workflow,
  sourceId: string,
  targetId: string
): EdgeType | null {
  const s = workflow.nodes.find((n) => n.id === sourceId);
  const t = workflow.nodes.find((n) => n.id === targetId);
  if (!s || !t) return null;

  if (s.id === t.id) return null;

  const exists = workflow.edges.some((e) => e.source === sourceId && e.target === targetId);
  if (exists) return null;

  if (s.type === "artifact" && t.type === "skill") return "input";
  if (s.type === "skill" && t.type === "artifact") return "output";

  // Integration nodes connect to/from artifacts just like skills
  if (s.type === "artifact" && t.type === "integration") return "input";
  if (s.type === "integration" && t.type === "artifact") return "output";

  if (s.type === "proposal" || t.type === "proposal") return "proposal";

  if (s.type === "human" || t.type === "human") return "human";

  if (t.type === "system" && (s.type === "artifact" || s.type === "skill")) return "input";
  if (s.type === "system" && (t.type === "artifact" || t.type === "skill")) return "output";

  // Conditional node — default to condition_true; caller can override to condition_false
  if (s.type === "conditional") return "condition_true";

  return null;
}

export function buildInferredEdge(workflow: Workflow, source: string, target: string, id: string): WorkflowEdge | null {
  const t = inferEdgeTypeFromEndpoints(workflow, source, target);
  if (!t) return null;
  return { id, source, target, edgeType: t, derived: false };
}

/**
 * Synchronize skill and integration node `inputs` / `outputs` from `input` / `output` edges.
 * Also sets artifact ownerStepId on output edges.
 */
export function syncSkillContractsFromGraph(workflow: Workflow): Workflow {
  const next = structuredClone(workflow) as Workflow;
  for (const node of next.nodes) {
    if (node.type !== "skill" && node.type !== "integration") continue;
    const inputFiles: string[] = [];
    for (const e of next.edges) {
      if (e.target !== node.id || e.edgeType !== "input") continue;
      const src = next.nodes.find((n) => n.id === e.source);
      if (src?.type === "artifact") inputFiles.push(src.data.fileName);
    }
    const outputFiles: string[] = [];
    for (const e of next.edges) {
      if (e.source !== node.id || e.edgeType !== "output") continue;
      const tgt = next.nodes.find((n) => n.id === e.target);
      if (tgt?.type === "artifact") {
        outputFiles.push(tgt.data.fileName);
        tgt.data.ownerStepId = node.id;
      }
    }
    node.data.inputs = inputFiles;
    node.data.outputs = outputFiles;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
