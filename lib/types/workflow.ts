export type Mode = "design" | "state" | "run";

export type NodeType = "skill" | "artifact" | "human" | "proposal" | "system" | "integration" | "conditional";
export type EdgeType = "input" | "output" | "human" | "proposal" | "derived_invalidation" | "integration" | "condition_true" | "condition_false";

export type ArtifactStatus = "updated" | "stale" | "missing" | "unknown";
export type SkillStatus = "idle" | "ready" | "blocked" | "running" | "failed";
export type ProposalStatus = "pending" | "approved" | "rejected" | "modified";

/** The kind of external touchpoint an integration node represents */
export type IntegrationSubtype =
  | "email_send"
  | "email_receive"
  | "form_submit"
  | "legacy_system"   // manual entry or retrieval from a system without a clean API
  | "webhook"
  | "file_transfer"   // SFTP, shared drive, portal upload/download
  | "notification"    // Slack, Teams, SMS
  | "other";

export type HumanSubtype =
  | "approval"       // Review and approve/reject
  | "data_entry"     // Input data into a system or form
  | "file_movement"  // Move/copy files between locations
  | "communication"  // Send message, email, report
  | "judgment"       // Contextual decision requiring expertise
  | "physical";      // Real-world action — cannot be automated

export type AutomationPotential = "very_high" | "high" | "medium" | "low" | "none";

export type WorkflowEnvironment = {
  productivity: "o365" | "google" | "mixed" | "other" | null;
  automationTools: "power_automate" | "zapier" | "custom" | "none" | null;
  fileStorage: "sharepoint" | "google_drive" | "network_shares" | "s3" | "mixed" | null;
  messaging: "teams" | "slack" | "email" | "other" | null;
  existingSystems: string[];
  weeklyFrequency: number | null;
  teamSize: number | null;
};

export type Position = { x: number; y: number };

export type BaseNode<T extends NodeType, D extends Record<string, unknown>> = {
  id: string;
  type: T;
  position: Position;
  data: D;
};

/**
 * Autonomy level for a skill node — how much trust is extended to AI execution.
 * 0 = suggest only (human executes)
 * 1 = execute with human approval before action
 * 2 = execute + log + easy rollback available
 * 3 = fully autonomous within blast radius
 */
export type AutonomyLevel = 0 | 1 | 2 | 3;

/** Risk classification — determines strictness of validation and oversight */
export type RiskCategory =
  | "standard"         // Default — normal business operations
  | "customer_facing"  // Directly affects customers (emails, reports, communications)
  | "financial"        // Touches money, billing, invoicing, payments
  | "legal"            // Contracts, compliance, regulatory submissions
  | "critical";        // Core system writes, irreversible operations

/** Retry policy — what happens when a contract is violated */
export type RetryPolicy = {
  /** Maximum number of retry attempts before escalating (default: 3) */
  maxAttempts?: number;
  /** Seconds to wait between attempts (default: 30) */
  backoffSeconds?: number;
  /**
   * Injected into the retry prompt: "Previous attempt failed because: {reason}. {correctivePrompt}"
   * Plain English guidance for what to fix. If omitted, only the failure reason is injected.
   */
  correctivePrompt?: string;
};

/** Escalation policy — what happens after retry exhaustion */
export type EscalationPolicy = {
  /** Escalate after this many consecutive contract failures (default: maxAttempts) */
  afterFailures?: number;
  /** ID of the human node to route to, or a role name (e.g. "finance-reviewer") */
  escalateTo?: string;
  /** Plain English message shown to the human when this escalation fires */
  escalationNote?: string;
};

/** Output contract for an artifact — defines what the file must contain */
export type OutputContract = {
  /** Plain English: what must this file contain? Claude reads this as its obligation */
  validationNote?: string;
  /** Frontmatter/JSON keys that must be present in the file */
  requiredFields?: string[];
  /** Expected file format */
  format?: "markdown" | "json" | "csv" | "any";
  /** Maximum allowed file size in kilobytes */
  maxSizeKb?: number;
};

/** Blast radius for a skill — defines what it is allowed to affect */
export type BlastRadius = {
  /** Relative paths the skill may write to (e.g. ["./output/", "./chunks/"]) */
  allowedPaths?: string[];
  /** Paths that must never be written to (e.g. [".env", "./config/"]) */
  blockedPaths?: string[];
  /** External APIs or services this skill is allowed to call */
  allowedApis?: string[];
  /** If true, this skill must not make any network calls */
  noNetworkAccess?: boolean;
  /** Hard kill if the skill runs longer than this many seconds */
  maxRuntimeSeconds?: number;
  /** Maximum spend limit in USD */
  maxCostUsd?: number;
};

export type SkillNodeData = {
  name: string;
  description?: string;
  fileName: string;
  inputs: string[];
  outputs: string[];
  requires: string[];
  produces: string[];
  validations: string[];
  tags: string[];
  category?: string;
  enabled: boolean;
  version: number;
  notes?: string;
  status?: SkillStatus;
  /** Person or role responsible for this step */
  owner?: string;
  /** Business unit or team that owns this step */
  team?: string;
  /** Path of the implementation file found in the project */
  implementationFile?: string;
  /** Plain-English talking point shown in presentation mode */
  presenterNote?: string;
  /** Safety constraints: what this skill is allowed to affect during execution */
  blastRadius?: BlastRadius;
  /**
   * How much trust is extended to this step's AI execution.
   * 0 = suggest only | 1 = execute with approval | 2 = execute + log + rollback | 3 = fully autonomous
   */
  autonomyLevel?: AutonomyLevel;
  /** Risk classification — determines strictness of validation and oversight applied */
  riskCategory?: RiskCategory;
  /** What happens when this step violates its output contract */
  retryPolicy?: RetryPolicy;
  /** What happens after retry exhaustion — route to human or halt */
  escalationPolicy?: EscalationPolicy;
  /** Runtime target for AI execution (e.g. "openai", "claude", "ollama_local", "bedrock") */
  runtimeTarget?: string;
  /** Specific model name for the chosen runtime target */
  modelName?: string;
  /** Optional system prompt override for this specific skill step */
  systemPromptOverride?: string;
  /** Estimated token count per run (for cost estimation) */
  estimatedTokensPerRun?: number;
};

export type ArtifactNodeData = {
  name: string;
  description?: string;
  fileName: string;
  artifactType: "md" | "json" | "yaml" | "csv" | "xlsx" | "txt" | "other";
  schemaRef?: string;
  ownerStepId?: string;
  status?: ArtifactStatus;
  lastUpdatedAt?: string;
  notes?: string;
  presenterNote?: string;
  /** Output contract — what this artifact must contain when produced */
  outputContract?: OutputContract;
};

export type HumanNodeData = {
  name: string;
  description?: string;
  subtype: HumanSubtype;
  automationPotential?: AutomationPotential;  // computed from subtype if not set
  requiredInputs: string[];
  producedArtifacts: string[];
  instructions?: string;
  approverRole?: string;
  /** Person responsible for this checkpoint */
  owner?: string;
  /** Business unit or team responsible */
  team?: string;
  notes?: string;
  presenterNote?: string;
  /** Minutes this step takes each time it occurs (captured during current-state mapping) */
  minutesPerOccurrence?: number;
  /** How often this step occurs per week (for ROI calculation) */
  occurrencesPerWeek?: number;
};

/**
 * Integration node — represents a step that crosses a system boundary:
 * sending or receiving an email, interacting with a legacy system, posting
 * a notification, uploading to a portal, etc.
 *
 * These are the "clunky but unavoidable" steps that can't yet be fully
 * automated, or that bridge to systems without clean APIs. They are
 * first-class citizens of the workflow — not hidden, not ignored.
 */
export type IntegrationNodeData = {
  name: string;
  description?: string;
  subtype: IntegrationSubtype;
  /** The external system involved (e.g. "Outlook", "SAP", "SharePoint", "Slack") */
  system?: string;
  /** Whether data flows in, out, or both */
  direction: "inbound" | "outbound" | "bidirectional";
  /** Artifact files this step consumes */
  inputs: string[];
  /** Artifact files this step produces */
  outputs: string[];
  /** Plain-language description of what a person must do when this cannot be automated */
  manualSteps?: string;
  /** Rough time cost (e.g. "2–5 min", "1 hr") */
  estimatedTime?: string;
  /** True if this can be fully automated; false or undefined if it requires manual action */
  automated?: boolean;
  owner?: string;
  team?: string;
  notes?: string;
  presenterNote?: string;
};

export type ProposalNodeData = {
  proposalType: "proposed_skill" | "proposed_artifact" | "proposed_contract_change" | "proposed_edge_change";
  name: string;
  description?: string;
  status: ProposalStatus;
  reason?: string;
  proposedDefinition?: Record<string, unknown>;
  createdAt: string;
  source: string;
  notes?: string;
  presenterNote?: string;
};

export type SystemNodeData = {
  name: string;
  description?: string;
  systemRole: string;
  presenterNote?: string;
};

export type ConditionalNodeData = {
  name: string;
  /** Human-readable condition description */
  condition: string;
  /** Optional machine-evaluable expression for automated routing */
  conditionExpression?: string;
  /** Label shown on the true/yes branch */
  trueLabel?: string;
  /** Label shown on the false/no branch */
  falseLabel?: string;
  notes?: string;
};

export type SkillNode = BaseNode<"skill", SkillNodeData>;
export type ArtifactNode = BaseNode<"artifact", ArtifactNodeData>;
export type HumanNode = BaseNode<"human", HumanNodeData>;
export type IntegrationNode = BaseNode<"integration", IntegrationNodeData>;
export type ProposalNode = BaseNode<"proposal", ProposalNodeData>;
export type SystemNode = BaseNode<"system", SystemNodeData>;
export type ConditionalGateNode = BaseNode<"conditional", ConditionalNodeData>;

export type WorkflowNode =
  | SkillNode
  | ArtifactNode
  | HumanNode
  | IntegrationNode
  | ProposalNode
  | SystemNode
  | ConditionalGateNode;

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  edgeType: EdgeType;
  label?: string;
  derived?: boolean;
};

export type WorkflowMetadata = {
  graphVersion: string;
  exportedAt?: string;
  runtimeSource?: string;
};

export type WorkflowType = "current_state" | "future_state";

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  /** Client or organisation this workflow belongs to */
  clientName?: string;
  /** Current stage in the consulting engagement lifecycle */
  engagementStatus?: "discovery" | "proposal_sent" | "signed" | "deploying" | "live" | "completed";
  /** Agreed engagement fee (USD) */
  engagementFee?: number;
  /** Monthly retainer fee (USD) */
  retainerFee?: number;
  /** The business objective this workflow is designed to achieve */
  objective?: string;
  /** current_state = manual as-is process map; future_state = automated to-be design */
  workflowType?: WorkflowType;
  /** ID of the current-state workflow this was generated from (future_state only) */
  sourceWorkflowId?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: WorkflowMetadata;
  environment?: WorkflowEnvironment;
};

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};
