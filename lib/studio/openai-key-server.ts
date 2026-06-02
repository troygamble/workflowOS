import { NextResponse } from "next/server";
import { OPENAI_KEY_HEADER } from "@/lib/studio/openai-key-constants";

export { OPENAI_KEY_HEADER };

/**
 * Resolve the OpenAI key for a Studio AI request.
 * Prefers the user's BYOK header; falls back to OPENAI_API_KEY for local dev /
 * self-host operators who supply a server key.
 */
export function resolveOpenAiKey(req: Request): string | null {
  const fromClient = req.headers.get(OPENAI_KEY_HEADER)?.trim();
  if (fromClient && fromClient.startsWith("sk-")) return fromClient;
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  return null;
}

export function openAiKeyRequiredResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Add your OpenAI API key in Studio settings to use AI features.",
      code: "OPENAI_KEY_REQUIRED",
    },
    { status: 402 },
  );
}
