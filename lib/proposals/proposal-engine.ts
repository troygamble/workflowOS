import type { RuntimeEvent } from "@/lib/types/runtime";
import type { ProposalNode, Workflow } from "@/lib/types/workflow";

export function createProposalNodeFromEvent(event: RuntimeEvent): ProposalNode {
  const proposalType =
    event.type === "unknown_artifact_detected"
      ? "proposed_artifact"
      : event.type === "unknown_step_detected"
      ? "proposed_skill"
      : "proposed_contract_change";

  return {
    id: `proposal_${crypto.randomUUID()}`,
    type: "proposal",
    position: { x: 200, y: 200 },
    data: {
      proposalType,
      name: String(event.payload.name ?? event.stepId ?? event.type),
      status: "pending",
      reason: String(event.payload.reason ?? "Runtime drift detected"),
      proposedDefinition: event.payload,
      createdAt: event.timestamp,
      source: "runtime",
    },
  };
}

export function applyProposalDecision(workflow: Workflow, proposalId: string, decision: "approved" | "rejected" | "modified"): Workflow {
  const next = structuredClone(workflow) as Workflow;
  const proposal = next.nodes.find((n) => n.id === proposalId && n.type === "proposal");
  if (!proposal || proposal.type !== "proposal") return next;
  proposal.data.status = decision;
  next.updatedAt = new Date().toISOString();
  return next;
}

