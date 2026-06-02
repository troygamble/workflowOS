/**
 * lib/api-error.ts
 *
 * Shared OpenAI error classification and user-friendly messaging for all
 * AI API routes.  Import `classifyAiError` in every route catch block.
 *
 * OpenAI SDK errors expose a `.status` number and `.message` string.
 * We map those to messages that the client UI can display directly.
 */

interface OpenAiLikeError {
  status?: number;
  message?: string;
  code?: string;
}

export interface AiErrorResponse {
  ok: false;
  error: string;
  /** HTTP status code to forward to the client */
  status: number;
}

/**
 * Classify any caught value from an OpenAI SDK call and return a structured
 * error response ready to pass to `NextResponse.json(...)`.
 *
 * @example
 * ```ts
 * } catch (e) {
 *   const err = classifyAiError(e);
 *   return NextResponse.json(err, { status: err.status });
 * }
 * ```
 */
export function classifyAiError(e: unknown): AiErrorResponse {
  const err = e as OpenAiLikeError;

  // ── Timeout (AbortSignal / fetch abort) ─────────────────────────────────────
  if (
    e instanceof Error &&
    (e.name === "AbortError" || e.message?.includes("aborted"))
  ) {
    return {
      ok: false,
      error: "The AI request timed out. The model may be overloaded — please try again in a moment.",
      status: 504,
    };
  }

  // ── OpenAI SDK errors (status codes) ────────────────────────────────────────
  if (err.status === 401) {
    return {
      ok: false,
      error: "OpenAI authentication failed. Check that OPENAI_API_KEY is valid in your .env.local.",
      status: 500,
    };
  }

  if (err.status === 429) {
    return {
      ok: false,
      error: "OpenAI rate limit reached. You have hit your API quota — check your OpenAI usage dashboard or wait a minute and try again.",
      status: 429,
    };
  }

  if (err.status === 503 || err.status === 502) {
    return {
      ok: false,
      error: "OpenAI is temporarily unavailable. Please try again in a few seconds.",
      status: 503,
    };
  }

  if (err.status === 400) {
    return {
      ok: false,
      error: `Bad request to OpenAI: ${err.message ?? "invalid parameters"}`,
      status: 400,
    };
  }

  if (err.status === 413) {
    return {
      ok: false,
      error: "The workflow is too large to process in one request. Try simplifying it or splitting it into smaller workflows.",
      status: 413,
    };
  }

  // ── JSON parse errors ────────────────────────────────────────────────────────
  if (e instanceof SyntaxError) {
    return {
      ok: false,
      error: "The AI returned an unexpected response. Please try again.",
      status: 502,
    };
  }

  // ── Generic fallback ─────────────────────────────────────────────────────────
  const message = e instanceof Error ? e.message : "Unknown error";
  return {
    ok: false,
    error: message.length > 200 ? message.slice(0, 200) + "…" : message,
    status: 500,
  };
}

/**
 * Build an AbortSignal that fires after `ms` milliseconds.
 * Pass to OpenAI SDK calls via { signal }.
 */
export function timeoutSignal(ms = 45_000): AbortSignal {
  return AbortSignal.timeout(ms);
}
