import { buildEdgesFromContracts } from "@/lib/graph/wire-from-contracts";
import { buildInferredEdge, syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import type { Workflow, WorkflowNode } from "@/lib/types/workflow";

const uid = () => crypto.randomUUID().slice(0, 8);

export function mergeApprovedProposalIntoWorkflow(
  workflow: Workflow,
  proposalId: string
): { ok: true; workflow: Workflow } | { ok: false; error: string } {
  const proposal = workflow.nodes.find((n) => n.id === proposalId && n.type === "proposal");
  if (!proposal || proposal.type !== "proposal") {
    return { ok: false, error: "Not a proposal node" };
  }
  if (proposal.data.status !== "approved" && proposal.data.status !== "modified") {
    return { ok: false, error: "Proposal must be approved (or modified) before merge" };
  }
  const def = proposal.data.proposedDefinition;
  if (!def || typeof def !== "object") {
    return { ok: false, error: "Missing proposedDefinition" };
  }

  const next: Workflow = structuredClone(workflow);
  const t = proposal.data.proposalType;

  if (t === "proposed_artifact") {
    const fileName = String((def as { fileName?: string }).fileName ?? "new_artifact.md");
    const name = String((def as { name?: string }).name ?? fileName);
    const id = `artifact_${uid()}`;
    const newNode: WorkflowNode = {
      id,
      type: "artifact",
      position: { x: 320, y: 120 },
      data: {
        name,
        fileName,
        artifactType: "md",
        status: "missing",
        notes: (def as { notes?: string }).notes,
      },
    };
    next.nodes = [...next.nodes, newNode];
  } else if (t === "proposed_skill") {
    const name = String((def as { name?: string }).name ?? "new_skill");
    const fileName = String((def as { fileName?: string }).fileName ?? `${name}.yaml`);
    const id = `skill_${uid()}`;
    const newNode: WorkflowNode = {
      id,
      type: "skill",
      position: { x: 200, y: 200 },
      data: {
        name,
        fileName,
        inputs: (def as { inputs?: string[] }).inputs ?? [],
        outputs: (def as { outputs?: string[] }).outputs ?? [],
        requires: (def as { requires?: string[] }).requires ?? [],
        produces: (def as { produces?: string[] }).produces ?? [],
        validations: (def as { validations?: string[] }).validations ?? [],
        tags: [],
        enabled: (def as { enabled?: boolean }).enabled ?? true,
        version: (def as { version?: number }).version ?? 1,
        description: (def as { description?: string }).description,
      },
    };
    next.nodes = [...next.nodes, newNode];
  } else if (t === "proposed_contract_change") {
    const stepId = String((def as { stepId?: string }).stepId ?? "");
    const skill = next.nodes.find((n) => n.id === stepId && n.type === "skill");
    if (skill && skill.type === "skill") {
      const d = def as { inputs?: string[]; outputs?: string[]; requires?: string[]; produces?: string[]; validations?: string[] };
      if (d.inputs) skill.data.inputs = d.inputs;
      if (d.outputs) skill.data.outputs = d.outputs;
      if (d.requires) skill.data.requires = d.requires;
      if (d.produces) skill.data.produces = d.produces;
      if (d.validations) skill.data.validations = d.validations;
    } else {
      return { ok: false, error: `Skill ${stepId} not found` };
    }
  } else if (t === "proposed_edge_change") {
    const d = def as { sourceId?: string; targetId?: string };
    if (!d.sourceId || !d.targetId) return { ok: false, error: "Edge proposal needs sourceId and targetId" };
    const id = `e_prop_${uid()}`;
    const edge = buildInferredEdge(next, d.sourceId, d.targetId, id);
    if (!edge) return { ok: false, error: "Invalid edge for proposal" };
    next.edges = [...next.edges, edge];
  }

  const withoutProposal: Workflow = {
    ...next,
    nodes: next.nodes.filter((n) => n.id !== proposalId),
    updatedAt: new Date().toISOString(),
  };

  // Auto-wire edges from contracts, then sync contracts from graph
  return {
    ok: true,
    workflow: syncSkillContractsFromGraph(buildEdgesFromContracts(withoutProposal)),
  };
}

/**
 * Bulk-merge all approved/modified proposals in one pass,
 * then wire edges and sync contracts once at the end.
 */
export function mergeAllApprovedProposals(
  workflow: Workflow
): { workflow: Workflow; mergedCount: number; errors: string[] } {
  const toMerge = workflow.nodes.filter(
    (n) =>
      n.type === "proposal" &&
      (n.data.status === "approved" || n.data.status === "modified")
  );

  let current = structuredClone(workflow) as Workflow;
  const errors: string[] = [];
  let mergedCount = 0;

  for (const proposal of toMerge) {
    const result = mergeApprovedProposalIntoWorkflow(current, proposal.id);
    if (result.ok) {
      current = result.workflow;
      mergedCount++;
    } else {
      errors.push(`${proposal.data.name}: ${result.error}`);
    }
  }

  // Final wire + sync pass
  return {
    workflow: syncSkillContractsFromGraph(buildEdgesFromContracts(current)),
    mergedCount,
    errors,
  };
}
