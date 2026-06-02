/**
 * Run log types — the provenance trail for every workflow execution.
 * Every hook writes entries to .workflow-os/runs/{runId}.ndjson
 */

export type RunEventType =
  | "run_start"         // workflow execution began
  | "skill_start"       // a skill step began
  | "tool_use"          // Claude invoked a tool (bash, write, read, etc.)
  | "blast_radius_ok"   // blast radius check passed
  | "blast_radius_block"// blast radius check blocked the action
  | "contract_check"    // output contract validation ran
  | "contract_pass"     // contract satisfied ✓
  | "contract_fail"     // contract violated — Claude will retry
  | "retry"             // retry attempt N
  | "approval_pending"  // Level 1 step waiting for human sign-off
  | "approval_granted"  // human approved
  | "approval_rejected" // human rejected — step halted
  | "escalation"        // escalation policy fired
  | "skill_complete"    // skill step done
  | "run_complete"      // all steps done
  | "run_failed";       // workflow halted due to unrecoverable error

export type ContractCheckResult = {
  passed: boolean;
  artifactName?: string;
  requiredFields?: string[];
  missingFields?: string[];
  violations?: string[];
  validationNote?: string;
};

export type RunLogEntry = {
  /** ISO 8601 timestamp */
  ts: string;
  /** Unique run ID (hex) — all entries for one execution share a runId */
  runId: string;
  /** Event type */
  event: RunEventType;
  /** Matches the WorkflowNode id from the contract map */
  nodeId?: string;
  /** Human-readable step name */
  skillName?: string;
  /** Tool name (Bash, Write, Read, etc.) for tool_use events */
  toolName?: string;
  /** Truncated tool input for display */
  toolInputSummary?: string;
  /** What Claude said it was going to do before this step */
  approachSummary?: string;
  /** Contract check result for contract_pass/fail events */
  contractResult?: ContractCheckResult;
  /** Which retry attempt this is (1-based) */
  retryAttempt?: number;
  /** Where this escalation is routed */
  escalationTarget?: string;
  /** Human-readable summary shown in the run log UI */
  message: string;
};

/** State file written to .workflow-os/state.json */
export type WorkflowRunState = {
  /** Currently executing run, undefined if idle */
  activeRunId?: string;
  /** Most recently completed run */
  lastRunId?: string;
  /** Start time of active run */
  startedAt?: string;
  /** Which node is currently executing */
  activeNodeId?: string;
  /** Status per node — keyed by nodeId */
  nodeStates: Record<string, NodeRunState>;
};

export type NodeRunState = {
  status: "waiting" | "running" | "passed" | "failed" | "escalated" | "skipped";
  lastRunAt?: string;
  contractPassed?: boolean;
  retryCount?: number;
};

/** Approval request written to .workflow-os/approvals/{id}.json */
export type ApprovalRequest = {
  id: string;
  nodeId: string;
  skillName: string;
  autonomyLevel: number;
  riskCategory?: string;
  /** What Claude is about to do */
  pendingAction: string;
  /** Tool that was intercepted */
  toolName: string;
  createdAt: string;
};
