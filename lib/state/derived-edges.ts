import type { Workflow, WorkflowEdge } from "@/lib/types/workflow";

/** Visual only: derived invalidation from stale consumer edges (State/Run). */
export function computeDerivedInvalidationEdges(workflow: Workflow): WorkflowEdge[] {
  const out: WorkflowEdge[] = [];
  let i = 0;
  for (const e of workflow.edges) {
    if (e.edgeType !== "input") continue;
    const a = workflow.nodes.find(
      (n): n is Extract<Workflow["nodes"][number], { type: "artifact" }> => n.id === e.source && n.type === "artifact"
    );
    if (a && a.data.status === "stale") {
      out.push({
        id: `dinv_${i++}`,
        source: a.id,
        target: e.target,
        edgeType: "derived_invalidation",
        label: "stale",
        derived: true,
      });
    }
  }
  return out;
}
