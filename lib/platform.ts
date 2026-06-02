/**
 * lib/platform.ts
 *
 * Platform detection utilities.
 *
 * isElectron()  — true when running inside the PAI desktop app.
 *                 The Electron preload bridge exposes window.workflowOS.
 *
 * Premium features (AI wizard, export, proposals) are gated to Electron
 * to prevent server costs from the free web version.
 */

export function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as Record<string, unknown>).workflowOS !== "undefined";
}

/** Returns a human-readable platform label for display */
export function platformLabel(): "desktop" | "web" {
  return isElectron() ? "desktop" : "web";
}

/**
 * Feature flags — call at runtime.
 * Each flag is a function so it re-evaluates after hydration.
 *
 * Pro features (AI, export, proposal) are available to:
 *   1. Clerk plan === "pro" or "agency" (web subscribers)
 *   2. Desktop app users (isElectron())
 *
 * Pass `isPro` (from useUser/publicMetadata) to the features that
 * need a plan check, or use the Clerk `guard()` in TopBar directly.
 */

/**
 * Returns true if the current user should have access to "Pro" features.
 *
 * Studio is the free reference implementation of PSF. All Studio features
 * are available to any signed-in user (and anonymous users on the desktop
 * app). This function previously gated by plan === "pro"|"agency"; the
 * paid tier was retired on 2026-05-16. The function is preserved so we
 * can re-introduce gating in future without rewriting call sites.
 */
export function isProOrDesktop(plan: string | null | undefined): boolean {
  // Plan parameter retained for API compatibility; intentionally unread.
  void plan;
  return true;
}

export const features = {
  /** AI Wizard — Pro web or desktop */
  aiWizard:        (plan?: string | null) => isProOrDesktop(plan),
  /** AI Workflow Healer — Pro web or desktop */
  aiHeal:          (plan?: string | null) => isProOrDesktop(plan),
  /** AI Executive Brief — Pro web or desktop */
  aiExecBrief:     (plan?: string | null) => isProOrDesktop(plan),
  /** AI Automate This — Pro web or desktop */
  aiAutomate:      (plan?: string | null) => isProOrDesktop(plan),
  /** Export deployment ZIP — Pro web or desktop */
  exportZip:       (plan?: string | null) => isProOrDesktop(plan),
  /** Export as .wfos community bundle — desktop only legacy */
  exportWfos:      () => isElectron(),
  /** Client proposal generation (HTML) — Pro web or desktop */
  proposal:        (plan?: string | null) => isProOrDesktop(plan),
  /** Consulting kit documents — desktop only legacy */
  consultingKit:   () => isElectron(),
  /** Share workflow link */
  shareLink:       () => true, // free — read-only, no server cost
  /** Templates + community browsing */
  templates:       () => true,
};
