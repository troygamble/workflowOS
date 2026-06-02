import OpenAI from "openai";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";
import type { Workflow } from "@/lib/types/workflow";

// ─── PSF Domain definitions ───────────────────────────────────────────────────

export type PSFRating = "Strong" | "Partial" | "Gap" | "N/A";

export interface PSFDomain {
  id: string;        // D1–D8
  name: string;
  rating: PSFRating;
  score: number;     // 0–100
  evidence: string;  // What in the workflow supports/lacks this domain
  gaps: string[];    // Specific gaps identified
  recommendations: string[]; // Concrete nodes/artifacts to add
}

export interface PSFAnalysisResponse {
  overall_score: number;       // 0–100 weighted average
  summary: string;             // 1-2 sentence summary
  domains: PSFDomain[];
  top_gaps: string[];          // Top 3 most critical gaps
  top_recommendations: string[]; // Top 3 highest-value additions
}

const DOMAIN_DEFINITIONS = `
D1 – Data Contracts & Validation
Inputs to every AI component are validated against an explicit schema or contract before processing.
Look for: input validation nodes, schema checks, sanitisation steps, type guards on tool inputs.

D2 – Output Validation
AI outputs are validated before being acted upon or surfaced to users.
Look for: output parsers, response validators, format checks, confidence thresholds, assertion nodes.

D3 – Data Protection
Sensitive data (PII, credentials, confidential content) is identified, masked, or isolated throughout.
Look for: PII detection nodes, data masking artifacts, access control boundaries, audit trail artifacts.

D4 – Observability & Monitoring
The system produces structured logs, traces, and metrics that allow diagnosis of production issues.
Look for: logging nodes, monitoring integrations, trace artifacts, alerting hooks, audit log outputs.

D5 – Deployment Safety
Deployments are gated, reversible, and tested before reaching production users.
Look for: staging gates, rollback mechanisms, canary/shadow nodes, test artifacts, approval checkpoints.

D6 – Human Oversight & Control
Humans can meaningfully intervene at the right point in the right way — not just observe.
Look for: human review nodes, approval gates, escalation paths, circuit breakers, override mechanisms.

D7 – Security & Access Control
The system enforces authentication, authorisation, and least-privilege at each boundary.
Look for: auth nodes, permission checks, API key management artifacts, rate limiting, injection prevention.

D8 – Vendor Resilience
The system has a tested story for when an AI vendor has an outage or degrades in quality.
Look for: fallback model nodes, retry logic, vendor abstraction layers, timeout handling, alternative providers.
`;

export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;

  const body = await req.json().catch(() => null) as { workflow?: unknown } | null;
  if (!body?.workflow) {
    return NextResponse.json({ error: "No workflow provided" }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  const workflow = body.workflow as Workflow;
  const nodeList = workflow.nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    return `- [${n.type}] ${String(d.name ?? d.title ?? n.id)}: ${String(d.description ?? d.spec ?? "")}`;
  }).join("\n");

  const edgeList = workflow.edges.map((e) => `${e.source} → ${e.target} (${e.edgeType})`).join("\n");

  const prompt = `You are an expert in the Production AI Institute Production Safety Framework (PSF).

Analyse the following workflow against all 8 PSF domains and return a structured JSON assessment.

WORKFLOW NODES:
${nodeList || "(empty workflow)"}

WORKFLOW EDGES:
${edgeList || "(no edges)"}

PSF DOMAIN DEFINITIONS:
${DOMAIN_DEFINITIONS}

SCORING GUIDE:
- Strong (score 80–100): Domain is explicitly addressed with appropriate nodes/artifacts
- Partial (score 40–79): Domain is partially addressed but with significant gaps
- Gap (score 0–39): Domain is absent or only nominally present
- N/A: Domain genuinely does not apply to this workflow type

Be specific about evidence and gaps. Reference actual node names where relevant.
If the workflow is empty or has only 1-2 nodes, most domains will be Gap — that is correct.`;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_score: { type: "number" },
      summary: { type: "string" },
      domains: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            rating: { type: "string", enum: ["Strong", "Partial", "Gap", "N/A"] },
            score: { type: "number" },
            evidence: { type: "string" },
            gaps: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name", "rating", "score", "evidence", "gaps", "recommendations"],
        },
      },
      top_gaps: { type: "array", items: { type: "string" } },
      top_recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["overall_score", "summary", "domains", "top_gaps", "top_recommendations"],
  };

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: "psf_analysis",
          strict: true,
          schema,
        },
      },
      max_output_tokens: 3000,
    });

    const raw = response.output_text;
    const result = JSON.parse(raw) as PSFAnalysisResponse;
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[psf-analyze] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
