import type { RuntimeEvent } from "@/lib/types/runtime";
import type { Workflow } from "@/lib/types/workflow";

function skillIdOrNameInWorkflow(workflow: Workflow, stepId: string): boolean {
  for (const n of workflow.nodes) {
    if (n.type === "skill" && (n.id === stepId || n.data.name === stepId)) {
      return true;
    }
  }
  return false;
}

export function detectRuntimeDrift(workflow: Workflow, event: RuntimeEvent): RuntimeEvent[] {
  const warnings: RuntimeEvent[] = [];
  const artifactFileNames = new Set(workflow.nodes.filter((n) => n.type === "artifact").map((n) => n.data.fileName));

  if (event.stepId && !skillIdOrNameInWorkflow(workflow, event.stepId)) {
    warnings.push({
      eventId: `evt_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      type: "unknown_step_detected",
      stepId: event.stepId,
      payload: {
        reason: "Runtime stepId is not a known skill id or name on the graph",
        name: event.stepId,
      },
    });
  }

  const artifact = event.payload.artifact;
  if (typeof artifact === "string" && !artifactFileNames.has(artifact)) {
    warnings.push({
      eventId: `evt_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      type: "unknown_artifact_detected",
      stepId: event.stepId,
      payload: { artifact, reason: "Runtime artifact not declared in workflow model" },
    });
  }

  return warnings;
}
