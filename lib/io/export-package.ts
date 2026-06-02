import JSZip from "jszip";
import YAML from "yaml";
import {
  buildProposalsPayloadFromWorkflow,
  buildRunsPayload,
  buildStateJsonFromWorkflow,
  eventsToNdjson,
} from "@/lib/io/runtime-snapshot";
import type { RuntimeEvent, RuntimeJob } from "@/lib/types/runtime";
import type { ArtifactNodeData, BlastRadius, EscalationPolicy, OutputContract, RetryPolicy, RiskCategory, SkillNodeData, Workflow, WorkflowEnvironment, HumanNodeData, IntegrationNodeData } from "@/lib/types/workflow";

// ─── Starter content for artifact placeholders ────────────────────────────────

const starterByType: Record<string, string> = {
  md: "# Artifact\n\n",
  json: "{}\n",
  yaml: "# artifact\n",
  csv: "col1,col2\n",
  txt: "",
  xlsx: "",
  other: "",
};

export type ExportOptions = {
  jobs?: RuntimeJob[];
  events?: RuntimeEvent[];
};

// ─── Environment-aware tool recommendations ───────────────────────────────────

function toolForEnv(env: WorkflowEnvironment | undefined, purpose: string): string {
  const prod = env?.productivity ?? "none";
  const automation = env?.automationTools ?? "none";

  if (purpose === "file_movement") {
    if (prod === "o365") return "Power Automate (SharePoint connector)";
    if (prod === "google") return "Apps Script / Google Drive API";
    if (automation === "zapier") return "Zapier (File Storage action)";
    return "Power Automate or custom script";
  }
  if (purpose === "email_send") {
    if (prod === "o365") return "Power Automate (Outlook connector)";
    if (prod === "google") return "Apps Script (GmailApp)";
    return "SMTP via automation tool";
  }
  if (purpose === "approval") {
    if (prod === "o365") return "Power Automate Approvals / Teams Adaptive Cards";
    if (prod === "google") return "Google Forms + Apps Script";
    return "Power Automate Approvals (recommended)";
  }
  if (purpose === "data_entry") {
    if (prod === "o365") return "Power Automate + AI Builder forms";
    if (prod === "google") return "Google Forms + Apps Script";
    return "AI-powered form with RPA fallback";
  }
  if (purpose === "notification") {
    const msg = env?.messaging ?? "email";
    if (msg === "teams") return "Power Automate (Teams connector)";
    if (msg === "slack") return "Zapier or Slack API";
    return "Email notification via automation tool";
  }
  if (purpose === "data_processing") {
    if (automation === "custom") return "Custom script (Python/Node)";
    if (prod === "o365") return "Power Automate with AI Builder";
    return "Power Automate or custom script";
  }
  return "Review with PS team";
}

function effortForSubtype(subtype: string): string {
  const map: Record<string, string> = {
    file_movement: "Low — 0.5–1 day",
    communication: "Low — 0.5–1 day",
    data_entry: "Medium — 2–3 days",
    approval: "Medium — 1–2 days",
    judgment: "N/A — stays human",
    physical: "N/A — stays human",
  };
  return map[subtype] ?? "Medium — 2–4 days";
}

function integrationToolForSubtype(subtype: string, system: string | undefined, env: WorkflowEnvironment | undefined): string {
  const prod = env?.productivity ?? "none";
  if (subtype === "email_send" || subtype === "email_receive") return toolForEnv(env, "email_send");
  if (subtype === "file_transfer") return toolForEnv(env, "file_movement");
  if (subtype === "notification") return toolForEnv(env, "notification");
  if (subtype === "form_submit") {
    if (prod === "o365") return "Microsoft Forms + Power Automate";
    if (prod === "google") return "Google Forms";
    return "Web form + webhook";
  }
  if (subtype === "webhook") return "Power Automate HTTP trigger or custom API endpoint";
  if (subtype === "legacy_system") {
    if (system) return `${system} API adapter — assess auth and connectivity`;
    return "Legacy system adapter — requires technical assessment";
  }
  return "Custom connector — review with PS team";
}

// ─── Implementation guide builder ─────────────────────────────────────────────

function buildImplementationGuide(workflow: Workflow): string {
  const env = workflow.environment;
  const lines: string[] = [];

  lines.push(`# Implementation Guide: ${workflow.name}`);
  lines.push("");
  lines.push("> **PAI PS Bridge Document**");
  lines.push("> This document is generated from the workflow design and is the specification input");
  lines.push("> for your Professional Services implementation team. Each section specifies what needs");
  lines.push("> to be built, which tools to use, and the estimated effort.");
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString().split("T")[0]}*`);
  lines.push("");

  // Environment summary
  lines.push("---");
  lines.push("");
  lines.push("## Environment Context");
  lines.push("");
  if (env) {
    const envRows = [
      ["Productivity suite", env.productivity ?? "Not specified"],
      ["File storage", env.fileStorage ?? "Not specified"],
      ["Messaging platform", env.messaging ?? "Not specified"],
      ["Automation tools", env.automationTools ?? "Not specified"],
      ["Existing systems", env.existingSystems?.length ? env.existingSystems.join(", ") : "None specified"],
      ["Workflow frequency", env.weeklyFrequency != null ? `~${env.weeklyFrequency}x per week` : "Not specified"],
      ["Team size", env.teamSize != null ? `~${env.teamSize} people` : "Not specified"],
    ];
    for (const [label, value] of envRows) {
      lines.push(`| **${label}** | ${value} |`);
    }
    lines.push("");
    if (!env.productivity) {
      lines.push("> ⚠️ **Environment not fully specified.** Automation tool recommendations below are generic.");
      lines.push("> Run the workflow wizard and complete the environment questionnaire for specific recommendations.");
      lines.push("");
    }
  } else {
    lines.push("> ⚠️ **Environment not specified.** All tool recommendations are generic. Complete the environment");
    lines.push("> questionnaire in the Workflow Wizard for environment-specific guidance.");
    lines.push("");
  }

  // Skills
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  if (skillNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Automated Steps");
    lines.push("");
    lines.push("These steps run without human intervention. Each requires a skill implementation");
    lines.push("that executes the logic against your real systems.");
    lines.push("");

    for (const skill of skillNodes) {
      const d = skill.data;
      lines.push(`### ${d.name}`);
      lines.push("");
      if (d.description) {
        lines.push(`**What it does:** ${d.description}`);
        lines.push("");
      }
      lines.push("**Contracts:**");
      if (d.requires?.length) lines.push(`- Inputs required: \`${d.requires.join("`, `")}\``);
      if (d.produces?.length) lines.push(`- Outputs produced: \`${d.produces.join("`, `")}\``);
      lines.push("");
      lines.push("**Implementation approach:**");
      lines.push(`- Tool: ${toolForEnv(env, "data_processing")}`);
      lines.push("- Execution environment: agent (LLM-assisted) or script (deterministic)");
      lines.push("- Timeout: 300 seconds | Retries: 3 × 30s backoff");
      lines.push("- Error handling: stop_workflow (default — change to notify_human if recovery needed)");
      lines.push("");
      lines.push("**PS checklist:**");
      lines.push("- [ ] Confirm input sources are accessible from the execution environment");
      lines.push("- [ ] Confirm output destinations are writable");
      lines.push("- [ ] Define error handling behaviour (stop vs notify vs skip)");
      lines.push("- [ ] Test with sample data before connecting to live systems");
      lines.push("");
    }
  }

  // Human steps
  const humanNodes = workflow.nodes.filter((n) => n.type === "human");
  if (humanNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Human Decision Points");
    lines.push("");
    lines.push("These steps require human action. Subtypes indicate automation potential.");
    lines.push("");

    for (const node of humanNodes) {
      const d = node.data as HumanNodeData;
      const subtype = d.subtype ?? "judgment";
      const effort = effortForSubtype(subtype);
      const isAutomatable = !["judgment", "physical"].includes(subtype);

      lines.push(`### ${d.name}`);
      lines.push("");
      lines.push(`**Type:** ${subtype.replace(/_/g, " ")} | **Automation potential:** ${isAutomatable ? "✅ Can be automated" : "👤 Keep human"}`);
      lines.push("");

      if (d.description) {
        lines.push(`**Description:** ${d.description}`);
        lines.push("");
      }

      lines.push("**Connections:**");
      if (d.requiredInputs?.length) lines.push(`- Requires: \`${d.requiredInputs.join("`, `")}\``);
      else lines.push("- ⚠️ No inputs defined — specify what this step receives");
      if (d.producedArtifacts?.length) lines.push(`- Produces: \`${d.producedArtifacts.join("`, `")}\``);
      else lines.push("- ⚠️ No outputs defined — specify what this step produces");
      lines.push("");

      if (isAutomatable) {
        lines.push("**Automation recommendation:**");
        lines.push(`- Suggested tool: ${toolForEnv(env, subtype)}`);
        lines.push(`- Estimated effort: ${effort}`);
        lines.push("- Route to automation in Phase 2 implementation");
        lines.push("");
        lines.push("**PS checklist:**");
        lines.push("- [ ] Define trigger condition (when does this step get initiated?)");
        lines.push("- [ ] Define acceptance criteria (what constitutes completion?)");
        lines.push("- [ ] Wire approval/response back into workflow state");
        lines.push("- [ ] Set SLA — what happens if no response within N hours?");
      } else {
        lines.push("**Implementation:**");
        lines.push("- This step requires human judgment — do not attempt to automate");
        lines.push("- Ensure the human receives all required inputs before being prompted");
        lines.push("- Define how the workflow pauses and resumes after human action");
        lines.push("");
        lines.push("**PS checklist:**");
        lines.push("- [ ] Define how human is notified (email, Teams, web UI)");
        lines.push("- [ ] Define the interface for recording the decision/output");
        lines.push("- [ ] Define escalation path if unavailable");
      }
      lines.push("");
    }
  }

  // Integration nodes
  const integrationNodes = workflow.nodes.filter((n) => n.type === "integration");
  if (integrationNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Integration Points");
    lines.push("");
    lines.push("These are connections to external systems. Each requires an adapter or connector.");
    lines.push("");

    for (const node of integrationNodes) {
      const d = node.data as IntegrationNodeData;
      lines.push(`### ${d.name}`);
      lines.push("");
      lines.push(`**Type:** ${d.subtype?.replace(/_/g, " ") ?? "integration"} | **Direction:** ${d.direction ?? "outbound"}`);
      if (d.system) lines.push(`**System:** ${d.system}`);
      lines.push("");
      if (d.description) {
        lines.push(`**What it does:** ${d.description}`);
        lines.push("");
      }
      lines.push("**Implementation:**");
      lines.push(`- Recommended approach: ${integrationToolForSubtype(d.subtype ?? "other", d.system, env)}`);
      lines.push(`- Automated: ${d.automated ? "Yes" : "No — currently manual"}`);
      if (d.manualSteps) lines.push(`- Current manual process: ${d.manualSteps}`);
      lines.push("");
      lines.push("**PS checklist:**");
      lines.push("- [ ] Confirm API/connector access and credentials");
      lines.push("- [ ] Test connectivity in target environment");
      lines.push("- [ ] Handle auth token refresh / expiry");
      lines.push("- [ ] Define error handling if external system is unavailable");
      lines.push("");
    }
  }

  // Gap summary
  const orphans = workflow.nodes.filter((n) => {
    const hasEdge = workflow.edges.some((e) => e.source === n.id || e.target === n.id);
    return !hasEdge && n.type !== "proposal";
  });
  const disconnectedHumans = humanNodes.filter((n) => {
    const d = n.data as HumanNodeData;
    return !d.requiredInputs?.length || !d.producedArtifacts?.length;
  });

  if (orphans.length > 0 || disconnectedHumans.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## ⚠️ Gaps Requiring Attention");
    lines.push("");
    lines.push("The following issues must be resolved before this workflow can be implemented.");
    lines.push("");
    if (orphans.length > 0) {
      lines.push("**Disconnected nodes (not wired into the flow):**");
      for (const n of orphans) {
        lines.push(`- \`${n.data.name}\` [${n.type}] — connect to the workflow or remove`);
      }
      lines.push("");
    }
    if (disconnectedHumans.length > 0) {
      lines.push("**Human steps with missing inputs or outputs:**");
      for (const n of disconnectedHumans) {
        const d = n.data as HumanNodeData;
        const missing = [];
        if (!d.requiredInputs?.length) missing.push("inputs");
        if (!d.producedArtifacts?.length) missing.push("outputs");
        lines.push(`- \`${n.data.name}\` — missing: ${missing.join(" and ")}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  lines.push("1. **Review this document** with the PS team and resolve all ⚠️ gaps above");
  lines.push("2. **Confirm environment access** — credentials, permissions, network access for each integration");
  lines.push("3. **Prioritise automation** — start with Low effort items (file movements, notifications)");
  lines.push("4. **Build and test skill runners** using the skill YAMLs in `skills/`");
  lines.push("5. **Deploy to staging** — run the full workflow end-to-end before production");
  lines.push("6. **Set up monitoring** — configure alerts for stuck or failed steps");

  return lines.join("\n");
}

// ─── Automation opportunity report ────────────────────────────────────────────

function buildAutomationReport(workflow: Workflow): string {
  const env = workflow.environment;
  const lines: string[] = [];

  lines.push(`# Automation Opportunity Report: ${workflow.name}`);
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString().split("T")[0]}*`);
  lines.push("");

  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const humanNodes = workflow.nodes.filter((n) => n.type === "human");
  const integrationNodes = workflow.nodes.filter((n) => n.type === "integration");

  const SUBTYPE_POTENTIAL: Record<string, string> = {
    file_movement: "Very High",
    communication: "High",
    data_entry: "High",
    approval: "Medium",
    judgment: "None — keep human",
    physical: "None — keep human",
  };

  const automatableHumans = humanNodes.filter(
    (n) => !["judgment", "physical"].includes((n.data as HumanNodeData).subtype ?? "judgment")
  );
  const stayHumans = humanNodes.filter(
    (n) => ["judgment", "physical"].includes((n.data as HumanNodeData).subtype ?? "judgment")
  );

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Category | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Steps already automated | ${skillNodes.length} |`);
  lines.push(`| Human steps that can be automated | ${automatableHumans.length} |`);
  lines.push(`| Human steps that stay human | ${stayHumans.length} |`);
  lines.push(`| Integration points | ${integrationNodes.length} |`);
  lines.push("");

  const totalSteps = skillNodes.length + humanNodes.length;
  const fullAutoPct = totalSteps > 0
    ? Math.round(((skillNodes.length + automatableHumans.length) / totalSteps) * 100)
    : 0;

  lines.push(`**If all automatable steps are implemented: ${fullAutoPct}% of this workflow runs without human intervention.**`);
  lines.push("");

  if (env?.weeklyFrequency != null) {
    const hoursPerRun = automatableHumans.length * 0.5; // rough 30min per manual step
    const weeklySaved = Math.round(hoursPerRun * env.weeklyFrequency * 10) / 10;
    lines.push(`**Estimated time saved:** ~${weeklySaved} hours/week (based on ~30min per automated step at ${env.weeklyFrequency}x/week frequency)`);
    lines.push("");
  }

  // Automatable steps
  if (automatableHumans.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Steps That Can Be Automated");
    lines.push("");
    lines.push("| Step | Type | Automation Potential | Recommended Tool | Effort |");
    lines.push("|---|---|---|---|---|");

    for (const node of automatableHumans) {
      const d = node.data as HumanNodeData;
      const subtype = d.subtype ?? "judgment";
      const potential = SUBTYPE_POTENTIAL[subtype] ?? "Medium";
      const tool = toolForEnv(env, subtype);
      const effort = effortForSubtype(subtype);
      lines.push(`| ${d.name} | ${subtype.replace(/_/g, " ")} | ${potential} | ${tool} | ${effort} |`);
    }
    lines.push("");
  }

  // Skills detail
  if (skillNodes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Already Automated (Skill Steps)");
    lines.push("");
    lines.push("These steps are defined as automated skills. They require PS implementation against your real systems.");
    lines.push("");
    for (const skill of skillNodes) {
      lines.push(`- **${skill.data.name}** — ${skill.data.description ?? "No description"}`);
    }
    lines.push("");
  }

  // Stays human
  if (stayHumans.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Steps That Stay Human");
    lines.push("");
    lines.push("These require genuine human judgment or physical action. Automation is not appropriate.");
    lines.push("");
    for (const node of stayHumans) {
      const d = node.data as HumanNodeData;
      lines.push(`- **${d.name}** [${d.subtype}] — ${d.description ?? "Human judgment required"}`);
    }
    lines.push("");
  }

  // Effort estimate
  lines.push("---");
  lines.push("");
  lines.push("## Effort Estimate");
  lines.push("");

  let totalDays = 0;
  const effortLines: string[] = [];

  for (const skill of skillNodes) {
    effortLines.push(`| ${skill.data.name} (skill implementation) | 1–3 days |`);
    totalDays += 2;
  }
  for (const node of automatableHumans) {
    const d = node.data as HumanNodeData;
    const effort = effortForSubtype(d.subtype ?? "judgment");
    const days = d.subtype === "file_movement" ? 1 : d.subtype === "communication" ? 1 : d.subtype === "data_entry" ? 3 : 2;
    effortLines.push(`| ${d.name} (automate ${d.subtype?.replace(/_/g, " ")}) | ${effort} |`);
    totalDays += days;
  }
  for (const node of integrationNodes) {
    effortLines.push(`| ${node.data.name} (integration adapter) | 1–3 days |`);
    totalDays += 2;
  }
  effortLines.push(`| **Testing & UAT** | ${Math.max(2, Math.round(totalDays * 0.3))} days |`);
  effortLines.push(`| **Documentation & handover** | 1–2 days |`);

  lines.push("| Item | Estimate |");
  lines.push("|---|---|");
  for (const row of effortLines) lines.push(row);
  lines.push("");
  lines.push(`**Total estimated PS engagement: ${totalDays}–${totalDays + Math.round(totalDays * 0.5)} days**`);
  lines.push("");
  lines.push("> *Estimates assume a PS team with experience in your environment. Adjust based on system complexity,*");
  lines.push("> *existing API availability, and security/compliance requirements.*");

  return lines.join("\n");
}

// ─── Environment context doc ──────────────────────────────────────────────────

function buildEnvironmentDoc(workflow: Workflow): string {
  const env = workflow.environment;
  if (!env) {
    return "# Environment Context\n\nNo environment context was specified for this workflow.\nRun the Workflow Wizard and complete the environment questionnaire.\n";
  }

  const lines: string[] = [];
  lines.push("# Environment Context");
  lines.push("");
  lines.push("This document records the business environment context captured during workflow design.");
  lines.push("It drives all tool recommendations throughout this deployment package.");
  lines.push("");
  lines.push("## Captured Values");
  lines.push("");
  lines.push(`- **Productivity suite:** ${env.productivity ?? "not specified"}`);
  lines.push(`- **File storage:** ${env.fileStorage ?? "not specified"}`);
  lines.push(`- **Messaging:** ${env.messaging ?? "not specified"}`);
  lines.push(`- **Automation tools:** ${env.automationTools ?? "not specified"}`);
  lines.push(`- **Existing systems:** ${env.existingSystems?.length ? env.existingSystems.join(", ") : "none specified"}`);
  lines.push(`- **Workflow frequency:** ${env.weeklyFrequency != null ? `~${env.weeklyFrequency}x per week` : "not specified"}`);
  lines.push(`- **Team size:** ${env.teamSize != null ? `~${env.teamSize} people` : "not specified"}`);
  lines.push("");
  lines.push("## Implications for Implementation");
  lines.push("");

  if (env.productivity === "o365") {
    lines.push("- **Primary stack:** Microsoft 365");
    lines.push("- File operations → SharePoint/OneDrive via Graph API or Power Automate");
    lines.push("- Email → Outlook via Power Automate or Graph API");
    lines.push("- Approvals → Power Automate Approvals or Teams Adaptive Cards");
    lines.push("- Scheduling → Power Automate recurrence triggers");
  } else if (env.productivity === "google") {
    lines.push("- **Primary stack:** Google Workspace");
    lines.push("- File operations → Google Drive API or Apps Script");
    lines.push("- Email → Gmail API or Apps Script GmailApp");
    lines.push("- Approvals → Google Forms + Apps Script or third-party approval tool");
    lines.push("- Scheduling → Apps Script time-based triggers or Cloud Scheduler");
  } else if (env.productivity === "mixed") {
    lines.push("- **Mixed environment** — specify per-step which system is authoritative");
    lines.push("- Recommend a unified automation layer (Power Automate or Zapier) to bridge systems");
    lines.push("- Identify the single source of truth for each data type");
  }

  if (env.automationTools === "none") {
    lines.push("");
    lines.push("⚠️ **No automation tools currently in place.**");
    lines.push("Recommend starting with Power Automate (included in M365) or Zapier.");
    lines.push("First PS engagement should include tool selection and licensing assessment.");
  }

  if (env.existingSystems?.length) {
    lines.push("");
    lines.push(`## Existing System Integrations Required`);
    lines.push("");
    for (const sys of env.existingSystems) {
      lines.push(`### ${sys}`);
      lines.push("- [ ] Confirm API availability and documentation");
      lines.push("- [ ] Confirm authentication method (OAuth, API key, service account)");
      lines.push("- [ ] Confirm network access from automation environment");
      lines.push("- [ ] Identify PS contact / system owner");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Enhanced README ──────────────────────────────────────────────────────────

function buildReadme(workflow: Workflow): string {
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const humanNodes = workflow.nodes.filter((n) => n.type === "human");
  const integrationNodes = workflow.nodes.filter((n) => n.type === "integration");
  const artifactNodes = workflow.nodes.filter((n) => n.type === "artifact");

  return [
    `# ${workflow.name}`,
    "",
    `> Version ${workflow.version} · Generated by PAI Studio`,
    "",
    "## What's in this package",
    "",
    "| Folder | Contents |",
    "|---|---|",
    "| `skills/` | YAML specification for each automated step |",
    "| `state/` | Placeholder files for workflow artifacts |",
    "| `workflow/` | Graph definition, state, run history |",
    "| `docs/` | Implementation guide, automation report, environment context |",
    "",
    "## Workflow Summary",
    "",
    `- **${skillNodes.length}** automated steps (skills)`,
    `- **${humanNodes.length}** human decision points`,
    `- **${integrationNodes.length}** integration points`,
    `- **${artifactNodes.length}** data artifacts`,
    "",
    "## How to use this package",
    "",
    "### For executives / sponsors",
    "Read `docs/AUTOMATION_REPORT.md` — it summarises what can be automated, estimated savings, and PS effort.",
    "",
    "### For PS / implementation team",
    "Read `docs/IMPLEMENTATION_GUIDE.md` — it walks through every step with specific tool recommendations,",
    "effort estimates, and implementation checklists.",
    "",
    "### For developers / technical team",
    "The skill contracts are in `skills/*.yaml`. Each YAML defines inputs, outputs, execution environment,",
    "and retry policy. Implement each skill against your target systems.",
    "",
    "The full workflow graph is in `workflow/graph.json`.",
    "",
    "### For compliance / audit",
    "The `workflow/graph.json` is the authoritative specification of what this workflow is designed to do.",
    "Compare against runtime telemetry to detect drift.",
    "",
    "## Skills",
    "",
    ...skillNodes.map((s) => `- **${s.data.name}** (\`skills/${s.data.fileName}\`): ${s.data.description ?? ""}`),
    "",
    "## Human Decision Points",
    "",
    ...humanNodes.map((n) => {
      const d = n.data as HumanNodeData;
      return `- **${d.name}** [${d.subtype ?? "judgment"}]`;
    }),
  ].join("\n");
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function buildWorkflowZip(workflow: Workflow, opts: ExportOptions = {}): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("workflow-package");
  if (!root) throw new Error("Zip root could not be created");

  const skills = root.folder("skills");
  const stateFolder = root.folder("state");
  const schemas = root.folder("schemas");
  const wf = root.folder("workflow");
  const docs = root.folder("docs");
  if (!skills || !stateFolder || !schemas || !wf || !docs) throw new Error("Package folders could not be created");

  const env = workflow.environment;

  // ── Skills ──
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  for (const skill of skillNodes) {
    const d = skill.data;
    skills.file(
      d.fileName,
      YAML.stringify({
        name: d.name,
        description: d.description ?? "",
        // Input/output contracts
        inputs: d.inputs ?? [],
        outputs: d.outputs ?? [],
        requires: d.requires ?? [],
        produces: d.produces ?? [],
        validations: d.validations ?? [],
        // Execution spec
        executionEnvironment: env?.productivity === "o365" ? "power_automate_or_agent"
          : env?.productivity === "google" ? "apps_script_or_agent"
          : "agent",
        timeout: 300,
        errorHandling: "stop_workflow",
        // Tracing
        owner: d.owner ?? null,
        team: d.team ?? null,
        enabled: d.enabled,
        version: d.version,
        // Blast radius — safety constraints
        blastRadius: (d as SkillNodeData).blastRadius ?? null,
        // Runtime target — which AI executes this step
        runtimeTarget: (d as SkillNodeData).runtimeTarget ?? "claude",
        modelName: (d as SkillNodeData).modelName ?? null,
        systemPromptOverride: (d as SkillNodeData).systemPromptOverride ?? null,
        estimatedTokensPerRun: (d as SkillNodeData).estimatedTokensPerRun ?? null,
        // Autonomy + risk
        autonomyLevel: (d as SkillNodeData).autonomyLevel ?? 3,
        riskCategory: (d as SkillNodeData).riskCategory ?? "standard",
        // Contract enforcement
        retryPolicy: (d as SkillNodeData).retryPolicy ?? { maxAttempts: 3, backoffSeconds: 30 },
        escalationPolicy: (d as SkillNodeData).escalationPolicy ?? null,
        // PS notes
        implementationNotes: d.implementationFile
          ? `See ${d.implementationFile}`
          : `IMPLEMENT: Create this skill using ${toolForEnv(env, "data_processing")}. See GETTING_STARTED.md for implementation guidance.`,
        environmentContext: env
          ? {
              productivity: env.productivity,
              automationTools: env.automationTools,
            }
          : null,
      }),
    );
  }

  // ── Artifact placeholders ──
  const artifactNodes = workflow.nodes.filter((n) => n.type === "artifact");
  for (const artifact of artifactNodes) {
    stateFolder.file(artifact.data.fileName, starterByType[artifact.data.artifactType] ?? "");
    const oc = (artifact.data as ArtifactNodeData).outputContract;
    if (oc && (oc.validationNote || (oc.requiredFields && oc.requiredFields.length > 0))) {
      // Write a contract sidecar alongside the artifact
      const contractFileName = artifact.data.fileName.replace(/\.[^.]+$/, "") + ".contract.yaml";
      stateFolder.file(contractFileName, YAML.stringify({
        artifact: artifact.data.fileName,
        contract: {
          validationNote: oc.validationNote ?? null,
          requiredFields: oc.requiredFields ?? [],
          format: oc.format ?? "any",
          maxSizeKb: oc.maxSizeKb ?? null,
        },
      }));
    }
  }

  // ── Schemas ──
  schemas.file("tasks.schema.json", JSON.stringify({ type: "object" }, null, 2));

  // ── Workflow files ──
  const manifestBody = {
    id: workflow.id,
    name: workflow.name,
    version: workflow.version,
    generatedAt: new Date().toISOString(),
    nodeCounts: {
      skills: skillNodes.length,
      artifacts: artifactNodes.length,
      humans: workflow.nodes.filter((n) => n.type === "human").length,
      integrations: workflow.nodes.filter((n) => n.type === "integration").length,
    },
    environment: workflow.environment ?? null,
  };
  wf.file("graph.json", JSON.stringify(workflow, null, 2));
  wf.file("manifest.yaml", YAML.stringify(manifestBody));
  wf.file("state.json", JSON.stringify(buildStateJsonFromWorkflow(workflow), null, 2));
  wf.file("runs.json", JSON.stringify(buildRunsPayload(opts.jobs ?? []), null, 2));
  wf.file("events.log", eventsToNdjson(opts.events ?? []));
  wf.file("proposals.json", JSON.stringify(buildProposalsPayloadFromWorkflow(workflow), null, 2));

  // ── PS Bridge documents ──
  docs.file("README.md", buildReadme(workflow));
  docs.file("IMPLEMENTATION_GUIDE.md", buildImplementationGuide(workflow));
  docs.file("AUTOMATION_REPORT.md", buildAutomationReport(workflow));
  docs.file("ENVIRONMENT.md", buildEnvironmentDoc(workflow));
  docs.file("INTEGRATIONS.md", buildIntegrationsCatalog(workflow));

  // ── Contract map — makes the workflow runnable by Claude Code ──
  root!.file("CLAUDE.md", buildClaudeMd(workflow));

  // ── Getting started guide ──
  root!.file("GETTING_STARTED.md", buildGettingStarted(workflow));

    // ── Claude Code config + hook scripts ──
  const dotClaude = root!.folder(".claude");
  if (dotClaude) {
    dotClaude.file("hooks.json", buildHooksJson(workflow));
  }
  const hooksDir = root!.folder("hooks");
  if (hooksDir) {
    hooksDir.file("log-run-event.js", buildLogRunEventJs());
    hooksDir.file("validate-blast-radius.js", buildValidateBlastRadiusJs(workflow));
    hooksDir.file("validate-output-contract.js", buildValidateOutputContractJs(workflow));
  }

  // ── Run log directory structure ──
  const workflowOsDir = root!.folder(".workflow-os");
  if (workflowOsDir) {
    const runsDir = workflowOsDir.folder("runs");
    if (runsDir) runsDir.file(".gitkeep", "");
    const approvalsDir = workflowOsDir.folder("approvals");
    if (approvalsDir) approvalsDir.file(".gitkeep", "");
    workflowOsDir.file("state.json", JSON.stringify({
      activeRunId: null,
      lastRunId: null,
      nodeStates: {},
    }, null, 2));
    workflowOsDir.file("README.md", [
      "# .workflow-os/",
      "",
      "Runtime state for PAI contract enforcement.",
      "",
      "## runs/",
      "NDJSON run logs written by hooks during Claude Code execution.",
      "Each file is named `{runId}.ndjson` and contains one JSON event per line.",
      "Load these files into PAI Studio or the desktop app to view the run history.",
      "",
      "## approvals/",
      "Approval tokens for Level 1 autonomy steps.",
      "`{nodeId}.pending` — waiting for sign-off.",
      "`{nodeId}.approved` — sign-off granted (written by desktop app or manually).",
      "",
      "## state.json",
      "Current run state: active run ID, node statuses.",
    ].join("\n"));
  }

  return zip.generateAsync({ type: "blob" });
}

// ─── Integration adapter catalog ──────────────────────────────────────────────

function buildIntegrationsCatalog(workflow: Workflow): string {
  const env = workflow.environment;
  const prod = env?.productivity ?? "none";
  const storage = env?.fileStorage ?? "none";
  const msg = env?.messaging ?? "email";
  const automation = env?.automationTools ?? "none";

  const lines: string[] = [];

  lines.push("# Integration Adapter Catalog");
  lines.push("");
  lines.push("This document lists every integration adapter relevant to this workflow, organised by system. Each entry includes the PS effort to stand it up, authentication method, and any prerequisites.");
  lines.push("");
  lines.push(`> **Environment context:** Productivity = ${prod} | Storage = ${storage} | Messaging = ${msg} | Automation tooling = ${automation}`);
  lines.push("");

  // ── Microsoft 365 ──────────────────────────────────────────────────────────
  if (prod === "o365" || storage === "sharepoint" || msg === "teams") {
    lines.push("---");
    lines.push("");
    lines.push("## Microsoft 365 Integrations");
    lines.push("");

    lines.push("### Power Automate (Flow)");
    lines.push("The primary automation backbone for M365 environments. Used for file movement, approvals, notifications, and API calls.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | Service account or managed identity |");
    lines.push("| PS effort to stand up | 0.5 days (tenant already licensed) |");
    lines.push("| Licence required | Microsoft 365 Business Standard or Power Automate per-user plan |");
    lines.push("| Prerequisites | Admin consent for connectors; DLP policy review |");
    lines.push("");
    lines.push("**Key connectors used in this workflow:**");
    lines.push("- SharePoint — read/write documents and lists");
    lines.push("- Outlook — send emails, read mailboxes");
    lines.push("- Teams — post adaptive cards, trigger approvals");
    lines.push("- Approvals — structured human-in-the-loop sign-offs");
    lines.push("- HTTP — call external REST APIs");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Create service account with least-privilege M365 licence");
    lines.push("- [ ] Enable required connectors in Power Platform admin centre");
    lines.push("- [ ] Configure DLP policy to allow SharePoint + Outlook connectors");
    lines.push("- [ ] Test flow with sample document end-to-end");
    lines.push("- [ ] Document flow URL and environment ID in project wiki");
    lines.push("");

    lines.push("### SharePoint Online");
    lines.push("Document storage, structured list tracking, and approval workflows.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | App registration (OAuth 2.0) or service account |");
    lines.push("| PS effort to stand up | 1 day (site structure + permissions) |");
    lines.push("| Prerequisites | SharePoint site provisioned; content types agreed |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Provision document library with agreed folder structure");
    lines.push("- [ ] Define metadata columns (status, owner, date, type)");
    lines.push("- [ ] Set up permission groups (read-only, contributor, owner)");
    lines.push("- [ ] Configure versioning and retention policy");
    lines.push("- [ ] Test Power Automate read/write against the library");
    lines.push("");

    if (msg === "teams") {
      lines.push("### Microsoft Teams");
      lines.push("Notification channel, approval cards, and human-step prompts delivered directly to the team.");
      lines.push("");
      lines.push("| Property | Value |");
      lines.push("|---|---|");
      lines.push("| Auth method | Bot registration in Azure AD |");
      lines.push("| PS effort to stand up | 0.5–1 day |");
      lines.push("| Prerequisites | Teams admin access; bot framework registration |");
      lines.push("");
      lines.push("**PS checklist:**");
      lines.push("- [ ] Register bot in Azure AD (or use Power Automate Teams connector)");
      lines.push("- [ ] Create dedicated Teams channel for workflow notifications");
      lines.push("- [ ] Design adaptive card templates for each human decision point");
      lines.push("- [ ] Test card delivery and approval response flow");
      lines.push("");
    }

    lines.push("### Microsoft Graph API");
    lines.push("Unified REST API for M365 — used when Power Automate connectors are insufficient or custom logic is needed.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | Azure AD App registration (client credentials or delegated) |");
    lines.push("| PS effort to stand up | 1–2 days |");
    lines.push("| Prerequisites | Azure AD tenant admin access; API permissions granted |");
    lines.push("");
    lines.push("**Common scopes for this workflow:**");
    lines.push("- `Files.ReadWrite.All` — SharePoint/OneDrive file access");
    lines.push("- `Mail.Send` — Send email on behalf of service account");
    lines.push("- `ChannelMessage.Send` — Post to Teams channel");
    lines.push("- `User.Read.All` — Resolve user profiles and managers");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Register application in Azure AD portal");
    lines.push("- [ ] Grant and admin-consent required API permissions");
    lines.push("- [ ] Generate client secret (store in Key Vault, not plain text)");
    lines.push("- [ ] Implement token refresh logic in custom code");
    lines.push("- [ ] Test with Graph Explorer before wiring into flow");
    lines.push("");
  }

  // ── Google Workspace ───────────────────────────────────────────────────────
  if (prod === "google" || storage === "google_drive") {
    lines.push("---");
    lines.push("");
    lines.push("## Google Workspace Integrations");
    lines.push("");

    lines.push("### Google Apps Script");
    lines.push("Server-side JavaScript that runs inside Google Workspace — ideal for lightweight automation without external infrastructure.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | OAuth 2.0 (user or service account) |");
    lines.push("| PS effort to stand up | 0.5 days |");
    lines.push("| Prerequisites | Google Workspace Business Standard or above |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Create script project in Google Apps Script console");
    lines.push("- [ ] Enable required Workspace APIs (Drive, Gmail, Sheets, etc.)");
    lines.push("- [ ] Set up time-based or event-based triggers");
    lines.push("- [ ] Deploy as web app if webhook endpoint needed");
    lines.push("- [ ] Store secrets in Script Properties (not in code)");
    lines.push("");

    lines.push("### Google Drive API");
    lines.push("Programmatic access to files, folders, permissions, and metadata.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | Service account with domain-wide delegation |");
    lines.push("| PS effort to stand up | 1 day |");
    lines.push("| Prerequisites | GCP project; Drive API enabled; service account created |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Create GCP service account and download JSON key");
    lines.push("- [ ] Grant domain-wide delegation in Google Admin");
    lines.push("- [ ] Test impersonation of workflow service account");
    lines.push("- [ ] Agree shared drive structure and permission model");
    lines.push("");

    lines.push("### Gmail API");
    lines.push("Send, read, and label emails programmatically.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | Service account with Gmail delegation |");
    lines.push("| PS effort to stand up | 0.5 days |");
    lines.push("| Prerequisites | Gmail API enabled in GCP; delegation granted |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Enable Gmail API in GCP console");
    lines.push("- [ ] Configure send-as alias if workflow sends from shared inbox");
    lines.push("- [ ] Implement exponential backoff for rate limits (250 quota units/second)");
    lines.push("");

    if (prod === "google") {
      lines.push("### Google Chat / Workspace Chat");
      lines.push("Deliver notifications and human prompts via Chat spaces or direct messages.");
      lines.push("");
      lines.push("| Property | Value |");
      lines.push("|---|---|");
      lines.push("| Auth method | Chat app bot (service account) |");
      lines.push("| PS effort to stand up | 1 day |");
      lines.push("| Prerequisites | Google Workspace admin; Chat API enabled |");
      lines.push("");
      lines.push("**PS checklist:**");
      lines.push("- [ ] Register Chat app in GCP console");
      lines.push("- [ ] Configure slash commands or webhook for inbound triggers");
      lines.push("- [ ] Design card messages for each human decision point");
      lines.push("- [ ] Add bot to relevant Chat spaces");
      lines.push("");
    }
  }

  // ── Automation tools ───────────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Automation Platform");
  lines.push("");

  if (automation === "zapier") {
    lines.push("### Zapier");
    lines.push("No-code automation connecting 6,000+ apps. Best for simple triggers and actions without custom code.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | OAuth per connected app |");
    lines.push("| PS effort to stand up | 0.5 days per Zap |");
    lines.push("| Licence required | Zapier Professional or Team ($49–$69/mo) |");
    lines.push("| Limitation | 2-step Zaps on free; multi-step needs paid plan |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Create Zapier team account and add PS engineer");
    lines.push("- [ ] Connect each app (OAuth approval required per user)");
    lines.push("- [ ] Build each Zap, testing with live data");
    lines.push("- [ ] Enable error alerts (email or Slack) for failed Zaps");
    lines.push("- [ ] Document Zap IDs and owner in project wiki");
    lines.push("");
  } else if (automation === "custom") {
    lines.push("### Custom Code / Scripts");
    lines.push("Hand-built automation in Python, Node.js, or PowerShell. Maximum flexibility; requires developer resources to maintain.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | Service accounts / API keys per integration |");
    lines.push("| PS effort to stand up | 2–5 days depending on scope |");
    lines.push("| Infrastructure | Azure Functions, AWS Lambda, or on-prem task scheduler |");
    lines.push("");
    lines.push("**PS checklist:**");
    lines.push("- [ ] Agree hosting environment (serverless vs scheduled job vs always-on service)");
    lines.push("- [ ] Implement structured logging (JSON format, correlation IDs)");
    lines.push("- [ ] Store all credentials in environment variables or a secrets manager");
    lines.push("- [ ] Write unit tests for each integration connector");
    lines.push("- [ ] Set up CI/CD pipeline for automated deployment");
    lines.push("- [ ] Configure alerting on unhandled exceptions");
    lines.push("");
  } else {
    // none / default — recommend starting point
    lines.push("### Recommended starting point: Power Automate");
    lines.push("No automation tooling has been selected yet. For most Microsoft 365 environments, Power Automate is the lowest-effort starting point.");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|---|---|");
    lines.push("| Auth method | M365 account (included in Business Standard) |");
    lines.push("| PS effort to stand up | 0.5 days |");
    lines.push("| Alternatives | Zapier (app-agnostic), n8n (self-hosted), Make (data-heavy) |");
    lines.push("");
    lines.push("**PS recommendation:** Start with Power Automate for any M365-adjacent steps. Introduce a specialised tool only when Power Automate connectors are insufficient.");
    lines.push("");
  }

  // ── General integration best practices ─────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Integration Best Practices (All Environments)");
  lines.push("");
  lines.push("### Authentication");
  lines.push("- Never use personal accounts for integrations — always use service accounts or app registrations");
  lines.push("- Rotate secrets on a schedule (90-day maximum recommended)");
  lines.push("- Store credentials in a secrets manager (Azure Key Vault, AWS Secrets Manager, 1Password Teams)");
  lines.push("- Use least-privilege: grant only the permissions the automation actually needs");
  lines.push("");
  lines.push("### Error handling");
  lines.push("- Every integration step must have an error handler that alerts the workflow owner");
  lines.push("- Include correlation IDs in logs so failures can be traced end-to-end");
  lines.push("- Implement retry logic with exponential backoff for transient failures");
  lines.push("- Log both the trigger payload and the response for every external API call");
  lines.push("");
  lines.push("### Testing");
  lines.push("- Test each connector in isolation before wiring into the full workflow");
  lines.push("- Use a sandbox/staging environment that mirrors production data structure");
  lines.push("- Run an end-to-end test with a real (sanitised) document before go-live");
  lines.push("- Define acceptance criteria with the client before UAT begins");
  lines.push("");
  lines.push("### Handover");
  lines.push("- Document every integration in this catalog with the actual credentials location");
  lines.push("- Record the service account UPNs and their licence assignments");
  lines.push("- Confirm the client has access to all integration admin portals");
  lines.push("- Schedule a 30-day post-go-live check-in");
  lines.push("");

  return lines.join("\n");
}

// ─── Getting started guide ──────────────────────────────────────────────────────

function buildGettingStarted(workflow: Workflow): string {
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const humanNodes = workflow.nodes.filter((n) => n.type === "human");
  const integrationNodes = workflow.nodes.filter((n) => n.type === "integration");
  const avgAutonomy = skillNodes.length > 0
    ? skillNodes.reduce((s, n) => s + (((n.data as SkillNodeData).autonomyLevel) ?? 1), 0) / skillNodes.length
    : 1;
  const isHighAutonomy = avgAutonomy >= 2;

  const integrationLines = integrationNodes.length > 0
    ? integrationNodes.map((n) => `- **${n.data.name ?? "Integration"}** — add credentials to \`.env\``).join("\n")
    : "- No external integrations required";

  return `# Getting Started — ${workflow.name ?? "Workflow"}

## Running this workflow for your client in 15 minutes

This package was generated by [PAI Studio](https://www.productionai.institute) and is ready to run with Claude Code.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Node.js** | v18 or later (\`node --version\`) |
| **Claude Code** | \`npm install -g @anthropic-ai/claude-code\` |
| **Claude API Key** | Set \`ANTHROPIC_API_KEY\` in your environment |
${integrationNodes.length > 0 ? `| **Integration credentials** | See section below |` : ""}

---

## Step 1 — Set up environment

\`\`\`bash
# Clone or unzip this package into a project directory
cd ${workflow.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "workflow"}

# Copy the example env file and fill in your credentials
cp .env.example .env
\`\`\`

Edit \`.env\` with your credentials:

\`\`\`env
ANTHROPIC_API_KEY=sk-ant-...
${integrationNodes.length > 0 ? integrationNodes.map((n) => `${String(n.data.name ?? "INTEGRATION").toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY=your-key-here`).join("\n") : "# No additional credentials required"}
\`\`\`

---

## Step 2 — Run in supervised mode (recommended first time)

${isHighAutonomy
  ? `This workflow contains ${skillNodes.filter((n) => ((n.data as SkillNodeData).autonomyLevel ?? 1) >= 2).length} fully-automated skills. On first run, we recommend setting all skills to supervised mode to review outputs before enabling full automation.`
  : `This workflow is already configured with human approval gates at key decision points. All outputs will be reviewed before actions are taken.`}

\`\`\`bash
# Start Claude Code in the project directory
claude

# Then run the workflow
/run-workflow
\`\`\`

---

## Step 3 — Review the first run

Claude Code will:

${skillNodes.slice(0, 5).map((n, i) => `${i + 1}. Execute **${(n.data as SkillNodeData).name ?? "Skill"}** and write output to \`.workflow-os/runs/\``).join("\n")}
${humanNodes.length > 0 ? humanNodes.slice(0, 3).map((n) => `- ⏸ **Pause at ${(n.data as HumanNodeData).name ?? "human step"}** and wait for your approval`).join("\n") : ""}

View the live run log in PAI Monitor (\`wfos monitor\`) or open \`.workflow-os/runs/\` directly.

---

## Step 4 — Approve human steps

When the workflow pauses at a human step, approval files appear in:

\`\`\`
.workflow-os/pending/<action-id>.json
\`\`\`

To approve via the Monitor: open PAI desktop app → Live Monitor → approve.

To approve via CLI:

\`\`\`bash
# Approve an action
echo '{"approved": true}' > .workflow-os/pending/<action-id>.approved.json

# Reject with reason
echo '{"approved": false, "reason": "..."}' > .workflow-os/pending/<action-id>.rejected.json
\`\`\`

---

## Step 5 — Increase autonomy over time

Once you're confident in the outputs, increase autonomy levels in PAI Studio:

1. Open PAI Studio → load this workflow
2. Click a skill node → Inspector panel → Autonomy Level
3. Graduate from **Supervised** → **Automated** as trust is established
4. Re-export the ZIP to get updated hook scripts

---

## Integrations

${integrationLines}

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| \`ANTHROPIC_API_KEY not set\` | Add key to \`.env\` or export in shell |
| Skill fails with timeout | Increase \`timeoutMs\` in \`workflow.yaml\` |
| Hook script not found | Run \`chmod +x hooks/*.js\` |
| Approval pending forever | Check \`.workflow-os/pending/\` directory |
| Output contract mismatch | Review schema in Inspector → Output Contract tab |

---

## Run log location

All execution events are logged as NDJSON:

\`\`\`
.workflow-os/runs/<run-id>.ndjson
\`\`\`

Open in PAI Studio → Runs tab to visualise the full execution trace.

---

## Need help?

- **Docs:** https://www.productionai.institute
- **Community:** https://www.productionai.institute/studio
- **Email:** hello@productionai.institute

---

*Generated by PAI Studio · ${new Date().toISOString().split("T")[0]}*
`;
}

// ─── Contract map (CLAUDE.md) ─────────────────────────────────────────────────

function buildClaudeMd(workflow: Workflow): string {
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const artifactNodes = workflow.nodes.filter((n) => n.type === "artifact");

  const lines: string[] = [];
  lines.push(`# ${workflow.name}`);
  lines.push("");
  lines.push(`> **PAI Contract Map** — generated ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  if (workflow.description) {
    lines.push(workflow.description);
    lines.push("");
  }
  lines.push("## Objective");
  lines.push("");
  lines.push(workflow.objective ?? workflow.description ?? `Execute the ${workflow.name} workflow.`);
  lines.push("");
  lines.push("## Execution Model");
  lines.push("");
  lines.push("This is a **contract-driven workflow**. Each skill specifies:");
  lines.push("- **Intent** — what this step is for, in plain English");
  lines.push("- **Output contract** — what must be produced (checked after each step)");
  lines.push("- **Blast radius** — what this step is allowed to affect");
  lines.push("");
  lines.push("You decide *how* to satisfy each contract. Adapt to actual conditions —");
  lines.push("don't assume a fixed implementation. The contract is stable; your approach can evolve.");
  lines.push("");
  lines.push("## Skills");
  lines.push("");

  for (const skill of skillNodes) {
    const d = skill.data as SkillNodeData;
    const br = d.blastRadius;

    lines.push(`### ${d.name}`);
    lines.push("");
    lines.push(`**Intent:** ${d.description ?? "(no description set)"}`);
    lines.push("");

    if (d.outputs && d.outputs.length > 0) {
      lines.push(`**Produces:** ${d.outputs.join(", ")}`);
    }
    if (d.inputs && d.inputs.length > 0) {
      lines.push(`**Reads:** ${d.inputs.join(", ")}`);
    }

    // Find connected artifact contracts
    const outputEdges = workflow.edges.filter((e) => e.source === skill.id && e.edgeType === "output");
    const contractedArtifacts = outputEdges
      .map((e) => workflow.nodes.find((n) => n.id === e.target && n.type === "artifact"))
      .filter(Boolean);

    if (contractedArtifacts.length > 0) {
      lines.push("");
      lines.push("**Output contracts:**");
      for (const art of contractedArtifacts) {
        if (!art) continue;
        const ad = art.data as ArtifactNodeData;
        const oc = ad.outputContract;
        if (oc) {
          lines.push(`- \`${ad.fileName}\``);
          if (oc.validationNote) lines.push(`  - ${oc.validationNote}`);
          if (oc.requiredFields && oc.requiredFields.length > 0) {
            lines.push(`  - Required fields: \`${oc.requiredFields.join("`, `")}\``);
          }
          if (oc.format && oc.format !== "any") lines.push(`  - Format: ${oc.format}`);
          if (oc.maxSizeKb) lines.push(`  - Max size: ${oc.maxSizeKb} KB`);
        } else {
          lines.push(`- \`${ad.fileName}\` (no contract defined)`);
        }
      }
    }

    // Autonomy + risk
    const autonomyLabels = ["Suggest only", "Execute with approval", "Execute + log + rollback", "Fully autonomous"];
    const alevel = d.autonomyLevel ?? 3;
    lines.push(`**Autonomy:** Level ${alevel} — ${autonomyLabels[alevel]}`);
    if (d.riskCategory && d.riskCategory !== "standard") {
      lines.push(`**Risk category:** ${d.riskCategory} ⚠`);
    }

    if (br) {
      lines.push("");
      lines.push("**Boundaries:**");
      if (br.allowedPaths && br.allowedPaths.length > 0) {
        lines.push(`- May write to: ${br.allowedPaths.map((p) => `\`${p}\``).join(", ")}`);
      }
      if (br.blockedPaths && br.blockedPaths.length > 0) {
        lines.push(`- Must NOT write to: ${br.blockedPaths.map((p) => `\`${p}\``).join(", ")}`);
      }
      if (br.allowedApis && br.allowedApis.length > 0) {
        lines.push(`- Allowed APIs: ${br.allowedApis.join(", ")}`);
      }
      if (br.noNetworkAccess) lines.push("- **No network access** (air-gapped)");
      if (br.maxRuntimeSeconds) lines.push(`- Max runtime: ${br.maxRuntimeSeconds}s`);
      if (br.maxCostUsd) lines.push(`- Max spend: $${br.maxCostUsd}`);
    }

    // Retry + escalation
    const rp = d.retryPolicy as RetryPolicy | undefined;
    const ep = d.escalationPolicy as EscalationPolicy | undefined;
    if (rp || ep) {
      lines.push("");
      lines.push("**On contract failure:**");
      if (rp) {
        const attempts = rp.maxAttempts ?? 3;
        const backoff = rp.backoffSeconds ?? 30;
        lines.push(`- Retry up to ${attempts} times (${backoff}s backoff)`);
        if (rp.correctivePrompt) {
          lines.push(`- Corrective guidance: "${rp.correctivePrompt}"`);
        }
      }
      if (ep) {
        const after = ep.afterFailures ?? (rp?.maxAttempts ?? 3);
        if (ep.escalateTo) {
          lines.push(`- After ${after} failures: escalate to **${ep.escalateTo}**`);
        } else {
          lines.push(`- After ${after} failures: halt workflow`);
        }
        if (ep.escalationNote) {
          lines.push(`- Escalation message: "${ep.escalationNote}"`);
        }
      }
    }

    lines.push("");
  }

  lines.push("## Artifacts");
  lines.push("");
  for (const art of artifactNodes) {
    const d = art.data as ArtifactNodeData;
    const oc = d.outputContract;
    const contractBadge = oc && (oc.validationNote || (oc.requiredFields && oc.requiredFields.length > 0))
      ? " ✓"
      : "";
    lines.push(`- **\`${d.fileName}\`**${contractBadge} — ${d.description ?? d.name}`);
    if (oc?.validationNote) {
      lines.push(`  - Contract: ${oc.validationNote}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push(`*Contract map generated by PAI Studio from workflow \`${workflow.id}\`.*`);
  lines.push(`*Last updated: ${new Date().toISOString()}*`);

  return lines.join("\n");
}

// ─── Claude Code hooks (blast radius enforcement) ─────────────────────────────

function buildHooksJson(workflow: Workflow): string {
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const hasBlastRadius = skillNodes.some((s) => {
    const d = s.data as SkillNodeData;
    return d.blastRadius && (
      (d.blastRadius.allowedPaths && d.blastRadius.allowedPaths.length > 0) ||
      (d.blastRadius.blockedPaths && d.blastRadius.blockedPaths.length > 0) ||
      d.blastRadius.noNetworkAccess
    );
  });

  const hasOutputContracts = workflow.nodes.some((n) => {
    if (n.type !== "artifact") return false;
    const d = n.data as ArtifactNodeData;
    return d.outputContract && (d.outputContract.validationNote || (d.outputContract.requiredFields && d.outputContract.requiredFields.length > 0));
  });

  const hooks: Array<{ event: string; matcher: string; command: string }> = [];

  if (hasBlastRadius) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Bash",
      command: "node hooks/validate-blast-radius.js",
    });
    hooks.push({
      event: "PreToolUse",
      matcher: "Write",
      command: "node hooks/validate-blast-radius.js",
    });
  }

  if (hasOutputContracts) {
    hooks.push({
      event: "PostToolUse",
      matcher: "Write",
      command: "node hooks/validate-output-contract.js",
    });
  }

  return JSON.stringify({ hooks }, null, 2);
}

// ─── Hook script generators ───────────────────────────────────────────────────

function buildLogRunEventJs(): string {
  return `#!/usr/bin/env node
/**
 * log-run-event.js — PAI shared run logger
 * Appends NDJSON entries to .workflow-os/runs/{runId}.ndjson
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.join(process.cwd(), '.workflow-os', 'state.json');
const RUNS_DIR = path.join(process.cwd(), '.workflow-os', 'runs');

function getOrCreateRunId() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (state.activeRunId) return state.activeRunId;
  } catch {}
  const runId = crypto.randomBytes(6).toString('hex');
  const state = { activeRunId: runId, startedAt: new Date().toISOString(), nodeStates: {} };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return runId;
}

function setActiveNode(nodeId) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state.activeNodeId = nodeId;
    state.nodeStates = state.nodeStates || {};
    state.nodeStates[nodeId] = { status: 'running', lastRunAt: new Date().toISOString() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function setNodeStatus(nodeId, status, extra) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state.nodeStates = state.nodeStates || {};
    state.nodeStates[nodeId] = { ...state.nodeStates[nodeId], status, ...extra };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function logEvent(entry) {
  const runId = getOrCreateRunId();
  const logFile = path.join(RUNS_DIR, runId + '.ndjson');
  const line = JSON.stringify({ ts: new Date().toISOString(), runId, ...entry }) + '\n';
  fs.appendFileSync(logFile, line);
  return runId;
}

module.exports = { logEvent, getOrCreateRunId, setActiveNode, setNodeStatus };
`;
}

function buildValidateBlastRadiusJs(workflow: Workflow): string {
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const config = skillNodes
    .map((n) => {
      const d = n.data as SkillNodeData;
      if (!d.blastRadius && !d.autonomyLevel) return null;
      return {
        nodeId: n.id,
        skillName: d.name,
        autonomyLevel: d.autonomyLevel ?? 3,
        riskCategory: d.riskCategory ?? "standard",
        allowedPaths: d.blastRadius?.allowedPaths ?? [],
        blockedPaths: d.blastRadius?.blockedPaths ?? [],
        allowedApis: d.blastRadius?.allowedApis ?? [],
        noNetworkAccess: d.blastRadius?.noNetworkAccess ?? false,
        maxRuntimeSeconds: d.blastRadius?.maxRuntimeSeconds,
      };
    })
    .filter(Boolean);

  const configJson = JSON.stringify(config, null, 2);

  return `#!/usr/bin/env node
/**
 * validate-blast-radius.js — PAI PreToolUse hook
 * Enforces blast radius constraints and handles Level 1 approval gates.
 * Exit 0 = allow | Exit 2 = block (Claude retries with message)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logEvent, setActiveNode } = require('./log-run-event');

// Baked-in blast radius config from PAI Studio export
const BLAST_RADIUS_CONFIG = ${configJson};

const STATE_FILE = path.join(process.cwd(), '.workflow-os', 'state.json');
const APPROVALS_DIR = path.join(process.cwd(), '.workflow-os', 'approvals');

function getActiveNodeConfig() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return BLAST_RADIUS_CONFIG.find((c) => c.nodeId === state.activeNodeId) || null;
  } catch {
    return null;
  }
}

function checkApproval(nodeId, toolName, inputSummary) {
  fs.mkdirSync(APPROVALS_DIR, { recursive: true });
  const approvedFile = path.join(APPROVALS_DIR, nodeId + '.approved');
  if (fs.existsSync(approvedFile)) {
    logEvent({ event: 'approval_granted', nodeId, message: 'Approval token found — proceeding' });
    return true; // approved
  }
  // Write pending approval request
  const id = crypto.randomBytes(4).toString('hex');
  const pendingFile = path.join(APPROVALS_DIR, nodeId + '.pending');
  fs.writeFileSync(pendingFile, JSON.stringify({
    id, nodeId, toolName, pendingAction: inputSummary,
    createdAt: new Date().toISOString(),
  }, null, 2));
  logEvent({ event: 'approval_pending', nodeId, toolName, message: \`Waiting for approval: \${toolName}\` });
  return false;
}

function isNetworkCommand(cmd) {
  return /\b(curl|wget|fetch|axios|requests|http|https|urllib|aiohttp)\b/i.test(cmd);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    const toolName = event.tool_name || '';
    const toolInput = event.tool_input || {};

    const skill = getActiveNodeConfig();

    if (!skill) {
      // No active skill with constraints — allow
      logEvent({ event: 'tool_use', toolName, message: \`\${toolName}: no constraints (allowed)\` });
      process.exit(0);
    }

    // ── Level 1 autonomy gate ────────────────────────────────────────────────
    if (skill.autonomyLevel <= 1) {
      const approved = checkApproval(skill.nodeId, toolName, JSON.stringify(toolInput).slice(0, 200));
      if (!approved) {
        const msg = [
          \`⏸  APPROVAL REQUIRED — \${skill.skillName}\`,
          \`\`,
          \`This step has Autonomy Level \${skill.autonomyLevel} (\${skill.riskCategory}) and requires human sign-off.\`,
          \`\`,
          \`Open PAI desktop app to approve, or run:\`,
          \`  touch .workflow-os/approvals/\${skill.nodeId}.approved\`,
          \`\`,
          \`Then retry this step.\`,
        ].join('\n');
        console.log(msg);
        process.exit(2);
      }
    }

    // ── Blast radius checks ──────────────────────────────────────────────────
    if (toolName === 'Bash' || toolName === 'bash') {
      const cmd = toolInput.command || '';

      // Network access check
      if (skill.noNetworkAccess && isNetworkCommand(cmd)) {
        const msg = \`🛡  BLAST RADIUS VIOLATION — \${skill.skillName}\nNetwork access is not allowed for this step.\nCommand: \${cmd.slice(0, 100)}\`;
        console.log(msg);
        logEvent({ event: 'blast_radius_block', nodeId: skill.nodeId, skillName: skill.skillName, toolName, message: 'Blocked: network access' });
        process.exit(2);
      }

      // Blocked paths check
      for (const blocked of skill.blockedPaths) {
        if (cmd.includes(blocked)) {
          const msg = \`🛡  BLAST RADIUS VIOLATION — \${skill.skillName}\nAccess to "\${blocked}" is not permitted.\nCommand: \${cmd.slice(0, 100)}\`;
          console.log(msg);
          logEvent({ event: 'blast_radius_block', nodeId: skill.nodeId, skillName: skill.skillName, toolName, message: \`Blocked path: \${blocked}\` });
          process.exit(2);
        }
      }
    }

    if (toolName === 'Write' || toolName === 'write') {
      const filePath = toolInput.file_path || toolInput.path || '';
      const normalised = filePath.replace(/\\\\/g, '/').replace(/^\.\//,'');

      // Allowed paths — if defined, file must be within one of them
      if (skill.allowedPaths.length > 0) {
        const allowed = skill.allowedPaths.some((p) => {
          const norm = p.replace(/^\.\//,'');
          return normalised.startsWith(norm);
        });
        if (!allowed) {
          const msg = \`🛡  BLAST RADIUS VIOLATION — \${skill.skillName}\nFile "\${filePath}" is outside the allowed write paths.\nAllowed: \${skill.allowedPaths.join(', ')}\`;
          console.log(msg);
          logEvent({ event: 'blast_radius_block', nodeId: skill.nodeId, skillName: skill.skillName, toolName, message: \`Out-of-bounds write: \${filePath}\` });
          process.exit(2);
        }
      }

      // Blocked paths — explicit denials
      for (const blocked of skill.blockedPaths) {
        const norm = blocked.replace(/^\.\//,'');
        if (normalised.includes(norm)) {
          const msg = \`🛡  BLAST RADIUS VIOLATION — \${skill.skillName}\nFile "\${filePath}" matches a blocked path: \${blocked}\`;
          console.log(msg);
          logEvent({ event: 'blast_radius_block', nodeId: skill.nodeId, skillName: skill.skillName, toolName, message: \`Blocked write: \${blocked}\` });
          process.exit(2);
        }
      }
    }

    logEvent({ event: 'blast_radius_ok', nodeId: skill.nodeId, skillName: skill.skillName, toolName, message: \`\${toolName}: allowed\` });
    process.exit(0);
  } catch (e) {
    // Never block on errors in the hook itself
    process.exit(0);
  }
});
`;
}

function buildValidateOutputContractJs(workflow: Workflow): string {
  const artifactNodes = workflow.nodes.filter((n) => n.type === "artifact");
  const contracts: Record<string, { artifactName: string; nodeId: string; format?: string; requiredFields: string[]; validationNote?: string; maxSizeKb?: number }> = {};

  for (const art of artifactNodes) {
    const d = art.data as ArtifactNodeData;
    if (d.outputContract && (d.outputContract.validationNote || (d.outputContract.requiredFields && d.outputContract.requiredFields.length > 0))) {
      const oc = d.outputContract;
      contracts[d.fileName] = {
        artifactName: d.fileName,
        nodeId: art.id,
        format: oc.format,
        requiredFields: oc.requiredFields ?? [],
        validationNote: oc.validationNote,
        maxSizeKb: oc.maxSizeKb,
      };
    }
  }

  const contractsJson = JSON.stringify(contracts, null, 2);

  return `#!/usr/bin/env node
/**
 * validate-output-contract.js — PAI PostToolUse hook
 * Validates that written files satisfy their output contracts.
 * Exit 0 = satisfied | Exit 2 = violated (Claude retries with injected reason)
 */
const fs = require('fs');
const path = require('path');
const { logEvent, setNodeStatus } = require('./log-run-event');

// Baked-in output contracts from PAI Studio export
const OUTPUT_CONTRACTS = ${contractsJson};

function findContract(filePath) {
  const base = path.basename(filePath);
  if (OUTPUT_CONTRACTS[base]) return OUTPUT_CONTRACTS[base];
  if (OUTPUT_CONTRACTS[filePath]) return OUTPUT_CONTRACTS[filePath];
  // Try partial match
  for (const [key, contract] of Object.entries(OUTPUT_CONTRACTS)) {
    if (filePath.endsWith(key) || filePath.includes(key.replace('./', ''))) {
      return contract;
    }
  }
  return null;
}

function checkFrontmatter(content, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    // Check YAML frontmatter (--- ... ---) and JSON/plain key presence
    if (!content.includes(field + ':') && !content.includes('"' + field + '"') && !content.includes("'" + field + "'")) {
      missing.push(field);
    }
  }
  return missing;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    const toolName = event.tool_name || '';
    const toolInput = event.tool_input || {};

    if (toolName !== 'Write' && toolName !== 'write') {
      process.exit(0);
    }

    const filePath = toolInput.file_path || toolInput.path || '';
    const content = toolInput.content || '';
    const contract = findContract(filePath);

    if (!contract) {
      process.exit(0); // No contract for this file — allow
    }

    const violations = [];

    // Check required fields
    if (contract.requiredFields && contract.requiredFields.length > 0) {
      const missing = checkFrontmatter(content, contract.requiredFields);
      for (const f of missing) violations.push(\`Missing required field: "\${f}"\`);
    }

    // Check file size
    if (contract.maxSizeKb) {
      const sizeKb = Buffer.byteLength(content, 'utf8') / 1024;
      if (sizeKb > contract.maxSizeKb) {
        violations.push(\`File too large: \${sizeKb.toFixed(1)} KB (max: \${contract.maxSizeKb} KB)\`);
      }
    }

    if (violations.length > 0) {
      const reason = violations.join('\n  ');
      const msg = [
        \`📋 CONTRACT VIOLATION — \${contract.artifactName}\`,
        \`\`,
        ...violations.map((v) => \`  ✗ \${v}\`),
        \`\`,
        contract.validationNote ? \`Contract requirement: \${contract.validationNote}\` : '',
        \`\`,
        \`Correct the output and try again.\`,
      ].filter((l) => l !== undefined).join('\n');

      console.log(msg);
      logEvent({
        event: 'contract_fail',
        nodeId: contract.nodeId,
        message: \`Contract failed for \${contract.artifactName}: \${violations.join('; ')}\`,
        contractResult: { passed: false, artifactName: contract.artifactName, requiredFields: contract.requiredFields, missingFields: violations.filter(v => v.includes('Missing')).map(v => v.replace('Missing required field: "', '').replace('"', '')), violations },
      });
      setNodeStatus(contract.nodeId, 'failed', { contractPassed: false });
      process.exit(2); // Claude retries
    }

    logEvent({
      event: 'contract_pass',
      nodeId: contract.nodeId,
      message: \`✓ Contract satisfied for \${contract.artifactName}\`,
      contractResult: { passed: true, artifactName: contract.artifactName, requiredFields: contract.requiredFields },
    });
    setNodeStatus(contract.nodeId, 'passed', { contractPassed: true });
    process.exit(0);
  } catch (e) {
    process.exit(0); // Don't block on hook errors
  }
});
`;
}
