import type { RuntimeEvent, RuntimeJob } from "@/lib/types/runtime";
import type { Workflow } from "@/lib/types/workflow";

const now = () => new Date().toISOString();

export function queueJob(stepId: string, runId = "run_local"): RuntimeJob {
  return {
    jobId: `job_${crypto.randomUUID()}`,
    runId,
    stepId,
    status: "queued",
    startedAt: now(),
    endedAt: null,
    inputs: [],
    outputs: [],
    message: "Queued from simulator",
    error: null,
  };
}

export function transitionJob(job: RuntimeJob, status: RuntimeJob["status"]): RuntimeJob {
  return {
    ...job,
    status,
    endedAt: status === "running" || status === "queued" ? null : now(),
  };
}

export function eventForJob(type: RuntimeEvent["type"], job: RuntimeJob): RuntimeEvent {
  return {
    eventId: `evt_${crypto.randomUUID()}`,
    timestamp: now(),
    type,
    stepId: job.stepId,
    jobId: job.jobId,
    payload: { message: job.message ?? "", status: job.status },
  };
}

export function applyJobResultToWorkflow(workflow: Workflow, job: RuntimeJob): Workflow {
  if (job.status !== "success") return workflow;
  const next = structuredClone(workflow) as Workflow;
  const outputEdges = next.edges.filter((e) => e.source === job.stepId && e.edgeType === "output");
  for (const edge of outputEdges) {
    const artifact = next.nodes.find(
      (n): n is Extract<Workflow["nodes"][number], { type: "artifact" }> => n.id === edge.target && n.type === "artifact",
    );
    if (artifact) {
      artifact.data.status = "updated";
      artifact.data.lastUpdatedAt = now();
      artifact.data.ownerStepId = job.stepId;
    }
  }
  next.updatedAt = now();
  return next;
}

