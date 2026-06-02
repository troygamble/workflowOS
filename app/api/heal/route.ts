import OpenAI from "openai";
import { classifyAiError, timeoutSignal } from "@/lib/api-error";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";
import { deterministicHeal } from "@/lib/heal/deterministic-healer";
import type { Workflow, WorkflowNode } from "@/lib/types/workflow";

export type HealQuestion = {
  id: string;
  message: string;
  nodeIds: string[];
  options?: { label: string; value: string }[];
  freeText?: boolean;
};

export type HealSuggestion = {
  id: string;
  description: string;
  /** What kind of change this represents */
  changeType: "add_artifact" | "add_edge" | "remove_node" | "update_node";
  nodeId?: string;
  /** If changeType is add_artifact, the artifact spec */
  artifact?: { name: string; fileName: string; description: string };
  /** If changeType is add_edge, the source/target node names */
  edge?: { sourceName: string; targetName: string };
};

export type HealResponse = {
  workflowPurpose: string;
  deterministicFixes: { message: string }[];
  aiSuggestions: HealSuggestion[];
  questions: HealQuestion[];
  healedWorkflow: Workflow;
};

export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;


  const body = await req.json().catch(() => null) as { workflow?: unknown } | null;
  if (!body?.workflow) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  // ── Phase 1: Deterministic healing (always runs) ──
  const deterministicResult = deterministicHeal(body.workflow as Workflow);
  const { workflow: cleanedWorkflow, fixes, remainingIssues } = deterministicResult;

  // ── Phase 2: AI analysis of remaining issues ──
  const graphSummary = buildGraphSummary(cleanedWorkflow, remainingIssues);

  const SYSTEM = `You are an expert workflow analyst. You are given a workflow graph and a list of remaining issues after automatic cleanup.

Your job:
1. Understand what this workflow is trying to accomplish (1-2 sentences)
2. For each remaining issue, suggest a specific fix OR ask the user a targeted question
3. Never hallucinate node names — only reference nodes that exist in the graph summary
4. For orphaned nodes (no edges), decide: can you infer where they connect? If yes, suggest an edge. If no, ask the user.
5. For missing artifacts (referenced by filename but no artifact node exists), suggest creating the artifact node.
6. Be concise and specific. This is a repair tool, not a design tool.

Respond with valid JSON only matching the schema.`;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: graphSummary },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "heal_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              workflowPurpose: { type: "string" },
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    description: { type: "string" },
                    changeType: {
                      type: "string",
                      enum: ["add_artifact", "add_edge", "remove_node", "update_node"],
                    },
                    nodeId: { anyOf: [{ type: "string" }, { type: "null" }] },
                    artifactName: { anyOf: [{ type: "string" }, { type: "null" }] },
                    artifactFileName: { anyOf: [{ type: "string" }, { type: "null" }] },
                    artifactDescription: { anyOf: [{ type: "string" }, { type: "null" }] },
                    edgeSourceName: { anyOf: [{ type: "string" }, { type: "null" }] },
                    edgeTargetName: { anyOf: [{ type: "string" }, { type: "null" }] },
                  },
                  required: [
                    "id", "description", "changeType", "nodeId",
                    "artifactName", "artifactFileName", "artifactDescription",
                    "edgeSourceName", "edgeTargetName",
                  ],
                },
              },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    message: { type: "string" },
                    nodeIds: { type: "array", items: { type: "string" } },
                    options: {
                      anyOf: [
                        {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                            },
                            required: ["label", "value"],
                          },
                        },
                        { type: "null" },
                      ],
                    },
                    freeText: { anyOf: [{ type: "boolean" }, { type: "null" }] },
                  },
                  required: ["id", "message", "nodeIds", "options", "freeText"],
                },
              },
            },
            required: ["workflowPurpose", "suggestions", "questions"],
          },
        },
      },
    }, { signal: timeoutSignal(45_000) });

    const rawText = response.output_text ?? "{}";
    const parsed = JSON.parse(rawText) as {
      workflowPurpose: string;
      suggestions: {
        id: string; description: string; changeType: string;
        nodeId: string | null; artifactName: string | null; artifactFileName: string | null;
        artifactDescription: string | null; edgeSourceName: string | null; edgeTargetName: string | null;
      }[];
      questions: {
        id: string; message: string; nodeIds: string[];
        options: { label: string; value: string }[] | null;
        freeText: boolean | null;
      }[];
    };

    const aiSuggestions: HealSuggestion[] = parsed.suggestions.map((s) => ({
      id: s.id,
      description: s.description,
      changeType: s.changeType as HealSuggestion["changeType"],
      nodeId: s.nodeId ?? undefined,
      artifact: s.artifactName ? {
        name: s.artifactName,
        fileName: s.artifactFileName ?? s.artifactName,
        description: s.artifactDescription ?? "",
      } : undefined,
      edge: s.edgeSourceName ? {
        sourceName: s.edgeSourceName,
        targetName: s.edgeTargetName ?? "",
      } : undefined,
    }));

    const questions: HealQuestion[] = parsed.questions.map((q) => ({
      id: q.id,
      message: q.message,
      nodeIds: q.nodeIds,
      options: q.options ?? undefined,
      freeText: q.freeText ?? true,
    }));

    const result: HealResponse = {
      workflowPurpose: parsed.workflowPurpose,
      deterministicFixes: fixes.map((f) => ({ message: f.message })),
      aiSuggestions,
      questions,
      healedWorkflow: cleanedWorkflow,
    };

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const { error: aiError } = classifyAiError(error);
    // Even if AI fails, return the deterministic result with a graceful degradation message
    return NextResponse.json({
      ok: true,
      workflowPurpose: "AI analysis unavailable",
      deterministicFixes: fixes.map((f) => ({ message: f.message })),
      aiSuggestions: [],
      questions: buildFallbackQuestions(remainingIssues),
      healedWorkflow: cleanedWorkflow,
      aiError,
    });
  }
}

function buildGraphSummary(
  workflow: Workflow,
  remainingIssues: {
    orphanedNodes: WorkflowNode[];
    missingArtifacts: { nodeId: string; nodeName: string; fileName: string }[];
    duplicateFileNames: string[];
    humanNoInput: WorkflowNode[];
    humanNoOutput: WorkflowNode[];
  }
): string {
  const skills = workflow.nodes.filter((n) => n.type === "skill").map((n) => `  - ${n.data.name} [id:${n.id}]`);
  const artifacts = workflow.nodes.filter((n) => n.type === "artifact").map((n) => `  - ${n.data.name} (${(n.data as { fileName: string }).fileName}) [id:${n.id}]`);
  const humans = workflow.nodes.filter((n) => n.type === "human").map((n) => `  - ${n.data.name} [id:${n.id}]`);
  const integrations = workflow.nodes.filter((n) => n.type === "integration").map((n) => `  - ${n.data.name} [id:${n.id}]`);

  const orphanLines = remainingIssues.orphanedNodes.map(
    (n) => `  - [${n.type}] "${n.data.name}" (id:${n.id}) — zero edges, completely disconnected`
  );
  const missingLines = remainingIssues.missingArtifacts.map(
    (m) => `  - Skill/integration "${m.nodeName}" (id:${m.nodeId}) references "${m.fileName}" but no artifact node has that filename`
  );

  const humanNoInputLines = remainingIssues.humanNoInput.map(
    (n) => `  - [human] "${n.data.name}" (id:${n.id}) — no incoming edges`
  );
  const humanNoOutputLines = remainingIssues.humanNoOutput.map(
    (n) => `  - [human] "${n.data.name}" (id:${n.id}) — no outgoing edges`
  );

  return `WORKFLOW: ${workflow.name}
OBJECTIVE: ${workflow.objective ?? "not specified"}

NODES:
Skills:
${skills.join("\n") || "  (none)"}
Artifacts:
${artifacts.join("\n") || "  (none)"}
Human checkpoints:
${humans.join("\n") || "  (none)"}
Integrations:
${integrations.join("\n") || "  (none)"}

REMAINING ISSUES TO RESOLVE:
Orphaned nodes (no edges):
${orphanLines.join("\n") || "  (none)"}
Missing artifact nodes:
${missingLines.join("\n") || "  (none)"}
Duplicate artifact filenames:
${remainingIssues.duplicateFileNames.map((f) => `  - "${f}"`).join("\n") || "  (none)"}
Human nodes with no inputs:
${humanNoInputLines.join("\n") || "  (none)"}
Human nodes with no outputs:
${humanNoOutputLines.join("\n") || "  (none)"}

Analyze these remaining issues. For each one:
- If you can confidently determine the fix from the workflow context, suggest it.
- If you need user input, ask a question.
- Keep suggestions and questions to the most impactful issues only (max 8 suggestions, max 4 questions).`;
}

function buildFallbackQuestions(remainingIssues: {
  orphanedNodes: WorkflowNode[];
  missingArtifacts: { nodeId: string; nodeName: string; fileName: string }[];
  humanNoInput?: WorkflowNode[];
  humanNoOutput?: WorkflowNode[];
}): HealQuestion[] {
  const questions: HealQuestion[] = [];
  for (const n of remainingIssues.orphanedNodes.slice(0, 4)) {
    questions.push({
      id: `orphan-${n.id}`,
      message: `"${n.data.name}" is disconnected — where should it connect in the workflow?`,
      nodeIds: [n.id],
      freeText: true,
    });
  }
  for (const n of (remainingIssues.humanNoInput ?? []).slice(0, 2)) {
    questions.push({
      id: `human-no-input-${n.id}`,
      message: `Human checkpoint "${n.data.name}" has no incoming connections — what artifact or step should feed into it?`,
      nodeIds: [n.id],
      freeText: true,
    });
  }
  for (const n of (remainingIssues.humanNoOutput ?? []).slice(0, 2)) {
    questions.push({
      id: `human-no-output-${n.id}`,
      message: `Human checkpoint "${n.data.name}" has no outgoing connections — what should happen after this checkpoint?`,
      nodeIds: [n.id],
      freeText: true,
    });
  }
  return questions;
}
