import OpenAI from "openai";
import { classifyAiError, timeoutSignal } from "@/lib/api-error";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";

export type WizardMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WizardAction =
  | { type: "none" }
  | { type: "add_nodes"; nodes: unknown[] }
  | { type: "set_workflow"; workflow: unknown };

export type WizardResponse = {
  reply: string;
  action: WizardAction;
};

const SYSTEM_PROMPT = `You are a workflow architect helping someone design an agentic automation workflow in Agent Workflow Studio.

══════════════════════════════════════════════
PHASE 1 — PROMPT UPLIFT (applies to first user message)
══════════════════════════════════════════════
When the user's first message is vague, conversational, or unstructured, DO NOT immediately ask a clarifying question and DO NOT add nodes.

Instead, do a structured restatement:
1. Infer the workflow phases from their description
2. List the key artifacts (files, documents, data) you can identify
3. Identify where human decisions or approvals are needed
4. Identify integration touchpoints (emails, external systems, file uploads, notifications)
5. Flag what is unclear or missing

Format your restatement clearly, then ask ONE targeted question to fill the most critical gap.

Example format:
"Here's what I'm hearing:

Phases: Initiation -> Planning -> Execution -> Reporting
Key artifacts: proposal.pdf, task_list.md, schedule.md, weekly_report.md
Human steps: Engineer assignment, Customer approval of scope
Integrations: Ingest customer emails, Upload reports to SharePoint
Unclear: How does this start - is the approved proposal emailed in, or uploaded manually?

[Your single question here]"

This uplift is MANDATORY for vague or unstructured first messages. It trains users to think in workflow terms and produces a much better graph.

══════════════════════════════════════════════
PHASE 2 — CONFIRMATION PLAN
══════════════════════════════════════════════
Once you have a clear picture (from a structured first message or after 1-2 exchanges), present a compact workflow plan before building anything:
- Phases in order
- 3-5 core artifacts with filenames
- Human checkpoints explicitly named
- Integration touchpoints explicitly named (real system names if known)
Then ask: "Does this look right? I'll start building Phase 1."

Do NOT add nodes until the user confirms or says "yes, go ahead."

══════════════════════════════════════════════
PHASE 3 — INCREMENTAL BUILD
══════════════════════════════════════════════
Build one phase at a time. After each phase, summarize what was added and ask if they want to continue or adjust.

THE FOUR NODE TYPES:
- SKILL nodes: automated AI or script steps that read input artifacts and produce output artifacts
- ARTIFACT nodes: files, documents, data that flow between steps — every file that matters is a node
- HUMAN nodes: checkpoints where a human must review, approve, or decide
- INTEGRATION nodes: steps that cross a system boundary — email, legacy systems, portals, notifications, webhooks. FIRST-CLASS nodes. Never skip or hide them.

When to use each:
- SKILL: anything an AI agent or script does autonomously
- HUMAN: approvals, reviews, assignments, decisions requiring judgement
- INTEGRATION: email send/receive, form submission, portal upload, Slack/Teams notification, external system entry
- ARTIFACT: every file or document that passes between steps

Integration subtypes: email_send, email_receive, form_submit, legacy_system, webhook, file_transfer, notification, other
Integration directions: inbound, outbound, bidirectional

CONTRACT RULES:
- inputs: artifact filenames this step reads (e.g. ["proposal.pdf", "task_list.md"])
- outputs: artifact filenames this step produces (e.g. ["schedule.json"])
- Every artifact must have exactly one producing node
- Use descriptive filenames: task_list.md not output.md

WORKFLOW DESIGN PRINCIPLES:
1. No skill should have undefined inputs — trace back to a real artifact
2. Human checkpoints gate high-stakes transitions: approvals, reviews, sign-offs
3. Integration nodes should be honest about manual effort (use manualSteps)
4. Prefer small, single-purpose skills over large multi-step ones
5. When something cannot be automated yet, make it an integration node — never skip it
6. Changes to upstream artifacts should invalidate downstream outputs

FIVE QUESTIONS THAT EXPOSE THE REAL WORKFLOW:
1. What STARTS it? (email arrival, form submission, manual upload, calendar trigger?)
2. What must be PRODUCED? (list the output files / reports)
3. Where does a HUMAN need to decide or approve?
4. What EXTERNAL SYSTEMS are touched? (email, SharePoint, Jira, SAP, etc.)
5. What REPEATS over time? (daily actions, weekly reports, continuous ingestion?)

HUMAN NODE SUBTYPES — always specify humanSubtype:
- "file_movement": Moving/copying files between locations -> Very High automation potential
- "communication": Sending messages, emails, reports -> High automation potential
- "data_entry": Inputting data into a system -> High automation potential
- "approval": Reviewing and approving/rejecting -> Medium automation potential
- "judgment": Contextual decisions requiring expertise -> Low automation potential
- "physical": Real-world physical actions -> No automation potential

CRITICAL: Every human node MUST have at least one input (something they review) AND at least one output (what they produce). A human checkpoint that receives nothing and produces nothing is invalid.

CONVERSATION STYLE:
- Always do the uplift first on vague input — no exceptions
- Ask one question at a time after the uplift
- Be concrete: name real systems, real filenames, real phases
- Surface human checkpoints and integration nodes explicitly
- Keep replies concise — this is a conversation, not a document

OUTPUT FORMAT:
Respond with valid JSON only. No markdown. No code fences.
{
  "reply": "your conversational response",
  "action": {
    "type": "none" | "add_nodes",
    "nodes": [] // only present when type is add_nodes, null when type is none
  }
}

When adding nodes:
{
  "nodeType": "skill" | "artifact" | "human" | "integration",
  "name": "snake_case_name or filename.ext",
  "description": "plain English description",
  "inputs": ["filename.ext"],      // skill/integration only, null otherwise
  "outputs": ["filename.ext"],     // skill/integration only, null otherwise
  "requires": [],                  // skill only, null otherwise
  "produces": [],                  // skill only, null otherwise
  "validations": [],               // skill only, null otherwise
  "subtype": "email_send",         // integration only, null otherwise
  "direction": "outbound",         // integration only, null otherwise
  "system": "Outlook",             // integration only, null otherwise
  "manualSteps": "...",            // integration only, null otherwise
  "automated": false               // integration only, null otherwise
}`;


const CURRENT_STATE_PROMPT = `You are helping someone document their CURRENT MANUAL PROCESS — how things work today, before any automation.

Your job is to map exactly what the team does right now: every manual step, every app they open, every file they move, every email they send, every person who touches it, and critically — how long each step takes and how often it happens.

This is NOT about designing automation. This is about capturing reality — including the time cost.

WHAT TO ASK about each step:
1. What exactly happens? (describe the action)
2. Who does it? (role or person)
3. What tool or app do they use? (Outlook, Excel, SharePoint, Teams, SAP, a physical form, etc.)
4. What do they receive before this step? (the input)
5. What do they produce or send after? (the output)
6. How long does this step take, in minutes? (be specific — "about 15 minutes", "a few hours" = ~120 min)
7. How often does this process run? (daily, weekly, monthly, on-demand?)

Always ask for time estimates — they are critical for calculating the ROI of automation.

NODE TYPES for current-state mapping:
- HUMAN: any manual step a person does (most steps will be this)
- INTEGRATION: any app or system they touch (Outlook, Excel, SharePoint, Teams, paper forms, legacy systems)
- ARTIFACT: any document, file, spreadsheet, or data that gets created or passed along

Human subtypes for current-state:
- "file_movement": copying/moving/emailing a file manually
- "communication": writing and sending an email or message
- "data_entry": typing data into a system
- "approval": someone reviews and signs off
- "judgment": someone makes a decision based on their expertise
- "physical": something that happens in the real world (printing, signing, handing over)

GUIDANCE:
- Map the HAPPY PATH first, then ask about exceptions
- Don't skip steps that seem obvious — they are often the most automatable
- If they use Excel to track something, that is an integration node (Excel) + artifact node (the spreadsheet)
- If they email someone to notify them, that is a human node (write email) + integration node (Outlook/Gmail)
- If someone has to check a spreadsheet and retype data into another system, that is two separate human nodes
- Pain points are gold — ask what they hate about this process
- ALWAYS capture time estimates for each human step — if they don't know, prompt them to guess

After mapping 3-5 steps, do a quick summary including total estimated time per run.

When the full process is mapped, say: "Great — I've captured your current process. Ready to generate the automated version?"

ADDITIONAL FIELDS for human nodes in current-state mode:
- "minutesPerOccurrence": number — how many minutes this step takes each time (REQUIRED for all human nodes, estimate if unsure)
- "occurrencesPerWeek": number — how many times per week this process runs (put on the first node; e.g. 5 = daily, 1 = weekly, 0.25 = monthly)

OUTPUT FORMAT: Same JSON format as the main wizard.
Respond with valid JSON only. No markdown. No code fences.`;


export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;


  const body = await req.json().catch(() => null) as {
    messages?: WizardMessage[];
    workflow?: unknown;
    mode?: "default" | "current_state";
  } | null;

  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  const isCurrentState = body.mode === "current_state";

  const workflowContext = body.workflow
    ? buildWorkflowContext(body.workflow)
    : "The canvas is currently empty.";

  const messagesWithContext: WizardMessage[] = [
    {
      role: "assistant",
      content: `Current canvas state: ${workflowContext}\n\nIMPORTANT: Never add a node whose name already appears in the canvas state above. Reference existing nodes by name in your reply instead of re-creating them.`,
    },
    ...body.messages,
  ];

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: isCurrentState ? CURRENT_STATE_PROMPT : SYSTEM_PROMPT },
        ...messagesWithContext.map((m) => ({ role: m.role, content: m.content })),
      ],
      text: {
        format: {
          type: "json_schema",
          name: "wizard_response",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              action: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: { type: "string", enum: ["none", "add_nodes"] },
                  nodes: {
                    anyOf: [
                      {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            nodeType:              { type: "string", enum: ["skill", "artifact", "human", "integration"] },
                            name:                  { type: "string" },
                            description:           { anyOf: [{ type: "string" }, { type: "null" }] },
                            inputs:                { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                            outputs:               { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                            requires:              { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                            produces:              { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                            validations:           { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                            subtype:               { anyOf: [{ type: "string" }, { type: "null" }] },
                            direction:             { anyOf: [{ type: "string" }, { type: "null" }] },
                            system:                { anyOf: [{ type: "string" }, { type: "null" }] },
                            manualSteps:           { anyOf: [{ type: "string" }, { type: "null" }] },
                            automated:             { anyOf: [{ type: "boolean" }, { type: "null" }] },
                            humanSubtype:          { anyOf: [{ type: "string" }, { type: "null" }] },
                            minutesPerOccurrence:  { anyOf: [{ type: "number" }, { type: "null" }] },
                            occurrencesPerWeek:    { anyOf: [{ type: "number" }, { type: "null" }] },
                          },
                          required: ["nodeType", "name", "description", "inputs", "outputs", "requires", "produces", "validations", "subtype", "direction", "system", "manualSteps", "automated", "humanSubtype", "minutesPerOccurrence", "occurrencesPerWeek"],
                        },
                      },
                      { type: "null" },
                    ],
                  },
                },
                required: ["type", "nodes"],
              },
            },
            required: ["reply", "action"],
          },
        },
      },
    }, { signal: timeoutSignal(45_000) });

    const rawText = response.output_text ?? "";
    const parsed = JSON.parse(rawText) as WizardResponse;
    return NextResponse.json({ ok: true, ...parsed });
  } catch (error) {
    const err = classifyAiError(error);
    return NextResponse.json(err, { status: err.status });
  }
}

function buildWorkflowContext(workflow: unknown): string {
  const w = workflow as { nodes?: unknown[]; name?: string; objective?: string; environment?: unknown };
  if (!w?.nodes?.length) return "The canvas is currently empty.";
  const nodes = w.nodes as { type?: string; data?: { name?: string; subtype?: string; system?: string } }[];

  const unique = (arr: string[]) => [...new Set(arr)];

  const skills = unique(nodes.filter((n) => n.type === "skill").map((n) => n.data?.name ?? "?"));
  const artifacts = unique(nodes.filter((n) => n.type === "artifact").map((n) => n.data?.name ?? "?"));
  const humans = unique(nodes.filter((n) => n.type === "human").map((n) => n.data?.name ?? "?"));
  const integrations = unique(nodes.filter((n) => n.type === "integration").map((n) => {
    const d = n.data;
    return `${d?.name ?? "?"}${d?.system ? ` (${d.system})` : ""}`;
  }));

  const allNames = [...skills, ...artifacts, ...humans, ...integrations];
  const parts: string[] = [];
  if (w.objective) parts.push(`Objective: ${w.objective}`);
  parts.push(`Nodes already on canvas (DO NOT re-add these): ${allNames.join(", ")}`);
  if (skills.length) parts.push(`Skills: ${skills.join(", ")}`);
  if (artifacts.length) parts.push(`Artifacts: ${artifacts.join(", ")}`);
  if (humans.length) parts.push(`Human checkpoints: ${humans.join(", ")}`);
  if (integrations.length) parts.push(`Integrations: ${integrations.join(", ")}`);
  return parts.join(". ") || "Canvas has nodes but no details available.";
}
