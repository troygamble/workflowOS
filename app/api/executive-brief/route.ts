import OpenAI from "openai";
import { classifyAiError, timeoutSignal } from "@/lib/api-error";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";
import type { Workflow, WorkflowNode } from "@/lib/types/workflow";

// ─── Response types ───────────────────────────────────────────────────────────

export type ExecPhase = {
  name: string;
  description: string;
  steps: string[];
};

export type ExecHuman = {
  name: string;
  role: string;
  decision: string;
};

export type ExecOutput = {
  name: string;
  description: string;
  value: string;
};

export type ExecGap = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
};

export type AutomationStep = {
  name: string;
  canAutomate: boolean;
  tool: string;
  effort: string;
  reason: string;
};

export type AutomationBreakdown = {
  automatedCount: number;
  automatableSteps: AutomationStep[];
  staysHumanSteps: AutomationStep[];
  weeklySavedHours: number | null;
  psDaysEstimate: number | null;
};

export type ExecutiveBriefResponse = {
  title: string;
  summary: string;
  problem: string;
  phases: ExecPhase[];
  humanTouchpoints: ExecHuman[];
  keyOutputs: ExecOutput[];
  gaps: ExecGap[];
  automationBreakdown: AutomationBreakdown;
  readinessScore: number;
  readinessRationale: string;
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;


  const body = await req.json().catch(() => null) as { workflow?: unknown } | null;
  if (!body?.workflow) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  const workflow = body.workflow as Workflow;
  const summary = buildWorkflowSummary(workflow);

  const SYSTEM = `You are a senior management consultant writing an executive briefing document.

Your audience is C-suite executives and senior managers who have NO technical background and NO knowledge of the workflow tool being used.

Write in clear, confident, business-focused language. Avoid all technical jargon (no "nodes", "edges", "artifacts", "skills" — instead say "steps", "documents", "processes", "decisions").

Your job is to:
1. Explain what this workflow accomplishes in plain English
2. Break it into clear business phases
3. Identify where humans make decisions and whether those could be automated
4. Summarize what the workflow produces (deliverables)
5. Identify real business gaps — missing approvals, unclear ownership, processes that don't connect
6. Give a SPECIFIC automation breakdown — not a generic score but per-step analysis
7. Give an honest readiness score (0-100) reflecting how complete and robust this workflow is

AUTOMATION BREAKDOWN RULES:
- automatedCount = number of skill/automated steps that require no human action
- automatableSteps = human/manual steps that COULD be automated. For each: name, tool (be specific based on environment), effort ("Low: 1-2 days", "Medium: 3-5 days", "High: 1-2 weeks"), reason why it can be automated
- staysHumanSteps = human steps that should stay human (judgment, compliance, executive decisions). For each: name, tool = "Keep human", effort = "None", reason why it cannot/should not be automated
- weeklySavedHours = honest estimate of hours saved per week if all automatable steps are done (null if cannot estimate)
- psDaysEstimate = total professional services days to implement all automatable steps (null if cannot estimate)

ENVIRONMENT-SPECIFIC TOOL RECOMMENDATIONS:
- o365: Power Automate, SharePoint, Teams, Microsoft Forms, Graph API
- google: Apps Script, Google Drive API, Gmail API, Google Chat, Google Forms
- mixed: name the specific tool for each step based on which system it touches
- none: recommend starting with Power Automate (most common first step for non-technical orgs)

Be honest: a file movement step in O365 that could be done with Power Automate in 2 hours is NOT the same as a complex judgment call that requires a senior manager. Say so explicitly.

Respond with valid JSON only matching the schema.`;

  const autoStepSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      canAutomate: { type: "boolean" },
      tool: { type: "string" },
      effort: { type: "string" },
      reason: { type: "string" },
    },
    required: ["name", "canAutomate", "tool", "effort", "reason"],
  };

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: summary },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "executive_brief",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              problem: { type: "string" },
              phases: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    steps: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "description", "steps"],
                },
              },
              humanTouchpoints: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    role: { type: "string" },
                    decision: { type: "string" },
                  },
                  required: ["name", "role", "decision"],
                },
              },
              keyOutputs: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    value: { type: "string" },
                  },
                  required: ["name", "description", "value"],
                },
              },
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["title", "description", "severity"],
                },
              },
              automationBreakdown: {
                type: "object",
                additionalProperties: false,
                properties: {
                  automatedCount: { type: "number" },
                  automatableSteps: { type: "array", items: autoStepSchema },
                  staysHumanSteps: { type: "array", items: autoStepSchema },
                  weeklySavedHours: { anyOf: [{ type: "number" }, { type: "null" }] },
                  psDaysEstimate: { anyOf: [{ type: "number" }, { type: "null" }] },
                },
                required: ["automatedCount", "automatableSteps", "staysHumanSteps", "weeklySavedHours", "psDaysEstimate"],
              },
              readinessScore: { type: "number" },
              readinessRationale: { type: "string" },
            },
            required: ["title", "summary", "problem", "phases", "humanTouchpoints", "keyOutputs", "gaps", "automationBreakdown", "readinessScore", "readinessRationale"],
          },
        },
      },
    }, { signal: timeoutSignal(45_000) });

    const parsed = JSON.parse(response.output_text ?? "{}") as ExecutiveBriefResponse;
    return NextResponse.json({ ok: true, ...parsed });

  } catch (error) {
    const err = classifyAiError(error);
    return NextResponse.json(err, { status: err.status });
  }
}

// ─── Build plain-text workflow summary for the AI ────────────────────────────

function buildWorkflowSummary(workflow: Workflow): string {
  const skills = workflow.nodes.filter((n) => n.type === "skill");
  const artifacts = workflow.nodes.filter((n) => n.type === "artifact");
  const humans = workflow.nodes.filter((n) => n.type === "human");
  const integrations = workflow.nodes.filter((n) => n.type === "integration");

  const id_to_name = new Map(workflow.nodes.map((n) => [n.id, n.data.name]));

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of workflow.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of workflow.edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
  }

  const terminalArtifacts = artifacts.filter(
    (n) => (outgoing.get(n.id) ?? []).length === 0
  );

  const orphans = workflow.nodes.filter(
    (n) =>
      (outgoing.get(n.id) ?? []).length === 0 &&
      (incoming.get(n.id) ?? []).length === 0
  );

  const flowLines: string[] = [];
  for (const s of skills) {
    const ins = (incoming.get(s.id) ?? []).map((id) => id_to_name.get(id) ?? id);
    const outs = (outgoing.get(s.id) ?? []).map((id) => id_to_name.get(id) ?? id);
    const desc = (s.data as { description?: string }).description ?? "";
    flowLines.push(`  AUTOMATED STEP "${s.data.name}": ${desc}`);
    if (ins.length) flowLines.push(`    Takes in: ${ins.join(", ")}`);
    if (outs.length) flowLines.push(`    Produces: ${outs.join(", ")}`);
  }

  for (const h of humans) {
    const ins = (incoming.get(h.id) ?? []).map((id) => id_to_name.get(id) ?? id);
    const outs = (outgoing.get(h.id) ?? []).map((id) => id_to_name.get(id) ?? id);
    const d = h.data as { subtype?: string; description?: string };
    const subtype = d.subtype ?? "judgment";
    const automationPotentialMap: Record<string, string> = {
      file_movement: "Very High", communication: "High", data_entry: "High",
      approval: "Medium", judgment: "Low", physical: "None",
    };
    const potential = automationPotentialMap[subtype] ?? "Unknown";
    flowLines.push(`  HUMAN STEP "${h.data.name}" [subtype: ${subtype}, automation potential: ${potential}]:`);
    if (ins.length) flowLines.push(`    Reviews/receives: ${ins.join(", ")}`);
    if (outs.length) flowLines.push(`    Produces: ${outs.join(", ")}`);
    if (!ins.length) flowLines.push(`    WARNING: No inputs defined — disconnected step`);
    if (!outs.length) flowLines.push(`    WARNING: No outputs defined — disconnected step`);
  }

  for (const i of integrations) {
    const d = i.data as { description?: string; subtype?: string };
    const outs = (outgoing.get(i.id) ?? []).map((id) => id_to_name.get(id) ?? id);
    flowLines.push(`  INTEGRATION "${i.data.name}" (${d.subtype ?? "integration"}): ${d.description ?? ""}`);
    if (outs.length) flowLines.push(`    Produces/triggers: ${outs.join(", ")}`);
  }

  const env = workflow.environment;
  const envLines: string[] = [];
  if (env) {
    envLines.push(
      "ENVIRONMENT CONTEXT:",
      `  Productivity suite: ${env.productivity ?? "unknown"}`,
      `  File storage: ${env.fileStorage ?? "unknown"}`,
      `  Messaging: ${env.messaging ?? "unknown"}`,
      `  Automation tools available: ${env.automationTools ?? "unknown"}`,
    );
    if (env.existingSystems?.length) {
      envLines.push(`  Existing systems: ${env.existingSystems.join(", ")}`);
    }
    if (env.weeklyFrequency) envLines.push(`  Workflow runs: ~${env.weeklyFrequency}x per week`);
    if (env.teamSize) envLines.push(`  Team size: ${env.teamSize} people`);
  } else {
    envLines.push("ENVIRONMENT CONTEXT: Not specified — provide generic recommendations");
  }

  const lines = [
    `WORKFLOW NAME: ${workflow.name}`,
    workflow.objective ? `STATED OBJECTIVE: ${workflow.objective}` : "",
    "",
    `TOTAL STEPS: ${skills.length} automated, ${humans.length} human decision points, ${integrations.length} integrations`,
    `DOCUMENTS/DATA FLOWING THROUGH: ${artifacts.length} files and data objects`,
    "",
    ...envLines,
    "",
    "DETAILED PROCESS FLOW (use this for your automation breakdown):",
    ...flowLines,
    "",
    "FINAL DELIVERABLES:",
    ...terminalArtifacts.map((n) => `  - ${n.data.name}`),
    "",
    orphans.length > 0
      ? `DISCONNECTED STEPS (${orphans.length} steps not wired into the flow — flag as gaps):
${orphans.map((n) => `  - "${n.data.name}" [${n.type}]`).join("\n")}`
      : "All steps are connected.",
  ].filter((l) => l !== undefined);

  return lines.join("\n");
}
