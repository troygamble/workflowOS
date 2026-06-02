import OpenAI from "openai";
import { classifyAiError, timeoutSignal } from "@/lib/api-error";
import { guardProRoute } from "@/lib/api-guard";
import { openAiKeyRequiredResponse, resolveOpenAiKey } from "@/lib/studio/openai-key-server";
import { NextResponse } from "next/server";
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from "@/lib/ai/prompt";
import { generationRequestSchema, generationResponseSchema } from "@/lib/ai/schema";

export async function POST(req: Request) {
  const _guard = await guardProRoute(req);
  if (_guard) return _guard;


  const body = await req.json().catch(() => null);
  const parsed = generationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const apiKey = resolveOpenAiKey(req);
  if (!apiKey) return openAiKeyRequiredResponse();

  const mode = parsed.data.mode ?? "proposals";

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: buildGenerationSystemPrompt(mode) },
        { role: "user", content: buildGenerationUserPrompt(parsed.data) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "workflow_generation_payload",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              skills: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    inputs: { type: "array", items: { type: "string" } },
                    outputs: { type: "array", items: { type: "string" } },
                    requires: { type: "array", items: { type: "string" } },
                    produces: { type: "array", items: { type: "string" } },
                    validations: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "inputs", "outputs", "requires", "produces", "validations"],
                },
              },
              artifacts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    fileName: { type: "string" },
                    description: { type: "string" },
                    artifactType: { type: "string", enum: ["md", "json", "yaml", "csv", "xlsx", "txt", "other"] },
                  },
                  required: ["fileName", "artifactType"],
                },
              },
              contractChanges: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    stepName: { type: "string" },
                    requires: { type: "array", items: { type: "string" } },
                    produces: { type: "array", items: { type: "string" } },
                    validations: { type: "array", items: { type: "string" } },
                  },
                  required: ["stepName"],
                },
              },
            },
            required: ["summary", "skills", "artifacts", "contractChanges"],
          },
        },
      },
    }, { signal: timeoutSignal(45_000) });

    const rawText = response.output_text ?? "";
    const json = JSON.parse(rawText) as unknown;
    const output = generationResponseSchema.safeParse(json);
    if (!output.success) {
      return NextResponse.json(
        { ok: false, error: "Model returned invalid payload", details: output.error.issues, raw: rawText },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, payload: output.data });
  } catch (error) {
    const err = classifyAiError(error);
    return NextResponse.json(err, { status: err.status });
  }
}
