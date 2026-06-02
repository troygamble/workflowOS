/**
 * lib/api-guard.ts
 *
 * Server-side guards for AI API routes.
 *
 * DESKTOP_API_TOKEN — set this env var in Vercel production to require the
 * Electron app's x-wfos-desktop header. Without it, any web user can call
 * the AI routes and burn your OpenAI quota.
 *
 * In development (NODE_ENV !== "production") all checks are skipped so local
 * dev works without any config.
 */

import { auth } from "@clerk/nextjs/server";

// In-memory rate limiter — keyed by IP, resets per process restart
const _hits = new Map<string, number[]>();

/**
 * Simple sliding-window rate limiter.
 * Returns true if the request is within the allowed rate, false if over limit.
 */
export function rateLimit(
  ip: string,
  maxRequests = 20,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const window = (_hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  window.push(now);
  _hits.set(ip, window);
  return window.length <= maxRequests;
}

/**
 * Checks whether the request is allowed to use desktop-only AI routes.
 *
 * Returns a Response to short-circuit if blocked, or null if allowed.
 *
 * Gate is ONLY active when DESKTOP_API_TOKEN is set in the environment,
 * so local dev and the desktop app work without any headers.
 */
export function requireDesktop(req: Request): Response | null {
  const expected = process.env.DESKTOP_API_TOKEN;
  if (!expected) return null; // not configured — open (dev or self-hosted)

  const token = req.headers.get("x-wfos-desktop");
  if (token !== expected) {
    return Response.json(
      { ok: false, error: "This feature requires the PAI desktop app." },
      { status: 402 },
    );
  }
  return null;
}

/**
 * Convenience: run both rate-limit and desktop checks.
 * Call at the top of any AI route handler.
 */
export function guardAiRoute(req: Request): Response | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!rateLimit(ip)) {
    return Response.json(
      { ok: false, error: "Too many requests — please wait a moment." },
      { status: 429 },
    );
  }

  return requireDesktop(req);
}

/**
 * Guard for Pro-only AI routes.
 * Checks: rate limit → Clerk auth → Pro/Agency plan.
 *
 * Returns a Response to short-circuit if blocked, or null if allowed.
 */
export async function guardProRoute(req: Request): Promise<Response | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!rateLimit(ip)) {
    return Response.json(
      { ok: false, error: "Too many requests — please wait a moment." },
      { status: 429 },
    );
  }

  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session.userId;
  } catch {
    // auth() throws outside Clerk middleware context — treat as unauthenticated
  }

  if (!userId) {
    return Response.json(
      { ok: false, error: "Sign in to use AI features." },
      { status: 401 },
    );
  }

  // Studio's "Pro" tier was retired on 2026-05-16; Studio is now the free
  // reference implementation of PSF. AI features remain protected by rate
  // limiting and the auth gate above; no plan check is performed.
  return null;
}
