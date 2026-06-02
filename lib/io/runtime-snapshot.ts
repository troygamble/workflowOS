import type { RuntimeEvent, RuntimeJob } from "@/lib/types/runtime";
import type { Workflow } from "@/lib/types/workflow";

export type StateJson = {
  artifacts: Record<
    string,
    {
      status: string;
      lastUpdatedAt?: string;
      lastProducedBy?: string;
      lastRunId?: string;
    }
  >;
  updatedAt?: string;
};

export type ProposalRecord = {
  id: string;
  type: string;
  status: string;
  name: string;
  reason?: string;
  createdAt: string;
  source: string;
  proposedDefinition?: Record<string, unknown>;
};

export function buildStateJsonFromWorkflow(workflow: Workflow): StateJson {
  const artifacts: StateJson["artifacts"] = {};
  for (const n of workflow.nodes) {
    if (n.type === "artifact") {
      artifacts[n.data.fileName] = {
        status: n.data.status ?? "unknown",
        lastUpdatedAt: n.data.lastUpdatedAt,
        lastProducedBy: n.data.ownerStepId,
      };
    }
  }
  return { artifacts, updatedAt: workflow.updatedAt };
}

export function applyStateJsonToWorkflow(workflow: Workflow, state: StateJson): Workflow {
  const next = structuredClone(workflow) as Workflow;
  for (const n of next.nodes) {
    if (n.type !== "artifact") continue;
    const s = state.artifacts[n.data.fileName];
    if (!s) continue;
    n.data.status = s.status as typeof n.data.status;
    if (s.lastUpdatedAt) n.data.lastUpdatedAt = s.lastUpdatedAt;
    if (s.lastProducedBy) n.data.ownerStepId = s.lastProducedBy;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function buildProposalsPayloadFromWorkflow(workflow: Workflow): ProposalRecord[] {
  return workflow.nodes
    .filter((n) => n.type === "proposal")
    .map((n) => ({
      id: n.id,
      type: n.data.proposalType,
      status: n.data.status,
      name: n.data.name,
      reason: n.data.reason,
      createdAt: n.data.createdAt,
      source: n.data.source,
      proposedDefinition: n.data.proposedDefinition,
    }));
}

export function eventsToNdjson(events: RuntimeEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
}

export function buildRunsPayload(jobs: RuntimeJob[]): RuntimeJob[] {
  return jobs;
}
