import OpenAI from "openai";
import { classifyAiError, timeoutSignal } from "@/lib/api-error";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";
import type { EdgeType, Workflow, WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import { nanoid } from "nanoid";

function inferAutomateEdgeType(source: string, target: string, nodes: WorkflowNode[]): EdgeType {
  const src = nodes.find((n) => n.id === source);
  const tgt = nodes.find((n) => n.id === target);
  if (!src || !tgt) return "output";
  if (src.type === "artifact" && tgt.type === "skill") return "input";
  if (src.type === "skill" && tgt.type === "artifact") return "output";
  if (src.type === "artifact" && tgt.type === "human") return "input";
  if (src.type === "skill" && tgt.type === "human") return "output";
  if (src.type === "human" && tgt.type === "artifact") return "output";
  if (src.type === "human" && tgt.type === "skill") return "output";
  if (src.type === "proposal" || tgt.type === "proposal") return "proposal";
  if (src.type === "integration" || tgt.type === "integration") return "integration";
  return "output";
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;


  const body = await req.json().catch(() => null) as { workflow?: unknown } | null;
  if (!body?.workflow) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  const currentWorkflow = body.workflow as Workflow;
  const summary = summariseCurrentState(currentWorkflow);

  const client = new OpenAI({ apiKey });

  const SYSTEM = `You are an automation architect. The user has mapped their current manual business process. Your job is to design the FUTURE STATE — an optimised, partially or fully automated version of the same process.

Rules:
- Keep every human decision point that genuinely requires judgment, compliance, or executive sign-off
- Replace manual file movement, data entry, copy/paste, and email-based approvals with automation nodes (skill type)
- Add integration nodes for the tools that will do the automation (Power Automate, SharePoint, Teams, etc.) based on the environment
- Remove redundant manual steps that are only manual because no automation existed before
- Keep the same business outcome and sequence logic — just automate the repetitive parts
- Name nodes clearly in business language, not technical jargon
- Return valid JSON only

Node types available:
- "skill": an automated step (script, API call, Power Automate flow, etc.)
- "human": a step that genuinely requires a human (judgment, approval, physical action)
- "integration": a system connection (SharePoint, Teams, Gmail, Salesforce, etc.)
- "artifact": a document, data file, or report produced or consumed
- "trigger": the event that starts this workflow`;

  const USER = `Current state workflow to automate:

${summary}

Transform this into the optimised future state. Automate what can be automated, keep what genuinely needs humans.`;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["nodes", "edges", "automationSummary"],
    properties: {
      automationSummary: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "name", "description"],
          properties: {
            id: { type: "string" },
            type: { enum: ["skill", "human", "integration", "artifact", "trigger"] },
            name: { type: "string" },
            description: { type: "string" },
            tool: { type: "string" },
            subtype: { type: "string" },
            automationNote: { type: "string" },
            replacesManualStep: { type: "string" },
          },
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to"],
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            label: { type: "string" },
          },
        },
      },
    },
  };

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: { name: "future_state", strict: true, schema },
      },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: USER },
      ],
    }, { signal: timeoutSignal(45_000) });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as {
      automationSummary: string;
      nodes: Array<{ id: string; type: string; name: string; description: string; tool?: string; subtype?: string; automationNote?: string; replacesManualStep?: string }>;
      edges: Array<{ from: string; to: string; label?: string }>;
    };

    // Build future-state workflow
    const now = new Date().toISOString();
    const idMap = new Map<string, string>(); // AI id → real nanoid
    data.nodes.forEach((n) => { idMap.set(n.id, nanoid()); });

    const COLS = 5;
    const H_GAP = 260;
    const V_GAP = 160;

    const nodes: WorkflowNode[] = data.nodes.map((n, idx) => {
      const realId = idMap.get(n.id)!;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const base = {
        id: realId,
        type: n.type as WorkflowNode["type"],
        position: { x: 80 + col * H_GAP, y: 80 + row * V_GAP },
        data: {
          name: n.name,
          description: n.description,
          status: "idle" as const,
          ...(n.tool ? { tool: n.tool } : {}),
          ...(n.subtype ? { subtype: n.subtype } : {}),
          ...(n.automationNote ? { notes: n.automationNote } : {}),
          requiredInputs: [],
          producedArtifacts: [],
        },
      };
      return base as WorkflowNode;
    });

    const edges: WorkflowEdge[] = data.edges.map((e) => {
      const source = idMap.get(e.from) ?? e.from;
      const target = idMap.get(e.to) ?? e.to;
      return {
        id: nanoid(),
        source,
        target,
        label: e.label,
        edgeType: inferAutomateEdgeType(source, target, nodes),
      };
    });

    const futureWorkflow: Workflow = {
      id: nanoid(),
      name: currentWorkflow.name + " — Automated",
      description: data.automationSummary,
      workflowType: "future_state",
      sourceWorkflowId: currentWorkflow.id,
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
      nodes,
      edges,
      metadata: {
        graphVersion: currentWorkflow.metadata?.graphVersion ?? "1.0.0",
        runtimeSource: "automate-workflow",
      },
      environment: currentWorkflow.environment,
    };

    return NextResponse.json({ ok: true, workflow: futureWorkflow, automationSummary: data.automationSummary });
  } catch (e) {
    const err = classifyAiError(e);
    return NextResponse.json(err, { status: err.status });
  }
}

// ─── Summarise current-state workflow for the prompt ─────────────────────────

function summariseCurrentState(w: Workflow): string {
  const env = w.environment;
  const lines: string[] = [];
  lines.push(`Workflow: ${w.name}`);
  if (w.description) lines.push(`Description: ${w.description}`);
  if (env) {
    lines.push(`Environment: ${env.productivity ?? "unknown"} productivity suite, ${env.fileStorage ?? "unknown"} storage, ${env.messaging ?? "email"} messaging`);
    if (env.existingSystems) lines.push(`Existing systems: ${env.existingSystems}`);
    if (env.weeklyFrequency) lines.push(`Frequency: ${env.weeklyFrequency}`);
    if (env.teamSize) lines.push(`Team size: ${env.teamSize}`);
  }
  lines.push("\nSteps (current manual process):");
  w.nodes.forEach((n, i) => {
    const d = n.data as { name?: string; description?: string; subtype?: string; tool?: string };
    lines.push(`${i + 1}. [${n.type}${d.subtype ? "/" + d.subtype : ""}] ${d.name ?? "Unnamed"}: ${d.description ?? ""}`);
  });
  return lines.join("\n");
}
