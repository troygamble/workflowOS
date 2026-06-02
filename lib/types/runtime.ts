export type JobStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export type RuntimeJob = {
  jobId: string;
  runId: string;
  stepId: string;
  status: JobStatus;
  startedAt: string;
  endedAt: string | null;
  inputs: { artifact: string; hash: string }[];
  outputs: { artifact: string; hash: string | null }[];
  message?: string;
  error?: string | null;
};

export type RuntimeEventType =
  | "job_queued"
  | "job_started"
  | "job_progress"
  | "job_completed"
  | "job_failed"
  | "artifact_created"
  | "artifact_updated"
  | "artifact_deleted"
  | "proposal_created"
  | "proposal_approved"
  | "proposal_rejected"
  | "drift_detected"
  | "unknown_step_detected"
  | "unknown_artifact_detected";

export type RuntimeEvent = {
  eventId: string;
  timestamp: string;
  type: RuntimeEventType;
  stepId?: string;
  jobId?: string;
  payload: Record<string, unknown>;
};

