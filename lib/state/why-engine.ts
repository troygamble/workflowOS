import { deriveState } from "@/lib/state/state-engine";
import type { Workflow } from "@/lib/types/workflow";

export function explainNode(
  workflow: Workflow,
  nodeId: string,
  runningStepIds: Set<string>,
  failedStepIds: Set<string>
): string[] {
  const n = workflow.nodes.find((x) => x.id === nodeId);
  if (!n) return ["Node not found"];

  const derived = deriveState(workflow, runningStepIds, failedStepIds);

  if (n.type === "artifact") {
    return derived.artifacts[nodeId]?.why ?? ["No artifact state computed"];
  }
  if (n.type === "skill") {
    return derived.skills[nodeId]?.why ?? ["No skill state computed"];
  }
  if (n.type === "human") {
    const lines: string[] = ["Human checkpoint"];
    if (n.data.instructions) lines.push(`Instructions: ${n.data.instructions}`);
    if (n.data.requiredInputs?.length) lines.push(`Expected inputs: ${n.data.requiredInputs.join(", ")}`);
    if (n.data.producedArtifacts?.length) lines.push(`Expected outputs: ${n.data.producedArtifacts.join(", ")}`);
    return lines;
  }
  if (n.type === "proposal") {
    const lines: string[] = [`Proposal: ${n.data.name}`, `Type: ${n.data.proposalType}`, `Status: ${n.data.status}`];
    if (n.data.reason) lines.push(`Reason: ${n.data.reason}`);
    if (n.data.source) lines.push(`Source: ${n.data.source}`);
    return lines;
  }
  if (n.type === "system") {
    return [`System node role: ${n.data.systemRole}`, n.data.description ?? ""].filter(Boolean);
  }
  return ["Unknown node type"];
}
