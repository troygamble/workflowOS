/**
 * lib/io/wfos-package.ts
 *
 * The .wfos bundle format — PAI Studio portable workflow package.
 *
 * A .wfos file is a ZIP archive containing:
 *   manifest.json   — metadata (title, author, tags, version, etc.)
 *   workflow.json   — the full Workflow object
 *   preview.png     — optional thumbnail (base64 PNG supplied by caller)
 *   hooks/          — optional hook scripts (copied from export-package if present)
 *
 * This is purely client-side. No server required.
 */

import JSZip from "jszip";
import type { Workflow } from "@/lib/types/workflow";

// ─── Manifest schema ──────────────────────────────────────────────────────────

export interface WfosManifest {
  /** Bundle format version — always "1" for now */
  formatVersion: "1";
  /** Human-readable workflow title */
  title: string;
  /** Short one-line description */
  description: string;
  /** Author name or alias */
  author: string;
  /** Author email — optional */
  authorEmail?: string;
  /** ISO 8601 creation date */
  createdAt: string;
  /** Semantic version of this workflow (e.g. "1.0.0") */
  version: string;
  /** Department / domain tags */
  tags: string[];
  /** Workflow type hint */
  workflowType?: "current_state" | "future_state" | "general";
  /** License: MIT | Commercial | Personal */
  license: "MIT" | "Commercial" | "Personal";
  /** Rough autonomy level summary: 0-3 */
  autonomySummary?: number;
  /** Node count snapshot */
  nodeCount?: number;
  /** Whether hooks/ directory is included */
  includesHooks?: boolean;
  /** Whether preview.png is included */
  includesPreview?: boolean;
  /** Homepage / community URL */
  homepage?: string;
  /** Minimum PAI Studio version required */
  minAppVersion?: string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface WfosExportOptions {
  manifest: Omit<WfosManifest, "formatVersion" | "createdAt" | "nodeCount" | "workflowType" | "includesHooks" | "includesPreview">;
  /** Optional base64-encoded PNG thumbnail */
  previewPng?: string;
  /** Optional hook scripts { filename: content } */
  hooks?: Record<string, string>;
}

/**
 * Pack a Workflow + metadata into a .wfos ZIP blob ready for download.
 */
export async function exportAsWfos(
  workflow: Workflow,
  options: WfosExportOptions
): Promise<Blob> {
  const zip = new JSZip();

  // Compute autonomy summary from skill nodes
  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const avgAutonomy =
    skillNodes.length > 0
      ? Math.round(
          skillNodes.reduce((sum, n) => {
            const level = (n.data as { autonomyLevel?: number }).autonomyLevel ?? 1;
            return sum + level;
          }, 0) / skillNodes.length
        )
      : undefined;

  const manifest: WfosManifest = {
    formatVersion: "1",
    ...options.manifest,
    createdAt: new Date().toISOString(),
    workflowType: workflow.workflowType ?? "general",
    nodeCount: workflow.nodes.length,
    autonomySummary: avgAutonomy,
    includesHooks: !!(options.hooks && Object.keys(options.hooks).length > 0),
    includesPreview: !!options.previewPng,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("workflow.json", JSON.stringify(workflow, null, 2));

  if (options.previewPng) {
    // Strip data URL prefix if present
    const b64 = options.previewPng.replace(/^data:image\/png;base64,/, "");
    zip.file("preview.png", b64, { base64: true });
  }

  if (options.hooks) {
    const hooksFolder = zip.folder("hooks")!;
    for (const [name, content] of Object.entries(options.hooks)) {
      hooksFolder.file(name, content);
    }
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface WfosImportResult {
  workflow: Workflow;
  manifest: WfosManifest;
  /** base64 preview PNG if present */
  previewDataUrl?: string;
  /** hook script contents */
  hooks?: Record<string, string>;
}

/**
 * Unpack a .wfos file (File or ArrayBuffer) back into a Workflow + manifest.
 * Throws on malformed archives.
 */
export async function importFromWfos(
  source: File | ArrayBuffer
): Promise<WfosImportResult> {
  const zip = await JSZip.loadAsync(source);

  // Read manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Invalid .wfos: missing manifest.json");
  const manifestRaw = await manifestFile.async("string");
  const manifest = JSON.parse(manifestRaw) as WfosManifest;

  if (manifest.formatVersion !== "1") {
    throw new Error(`Unsupported .wfos format version: ${manifest.formatVersion}`);
  }

  // Read workflow
  const workflowFile = zip.file("workflow.json");
  if (!workflowFile) throw new Error("Invalid .wfos: missing workflow.json");
  const workflowRaw = await workflowFile.async("string");
  const workflow = JSON.parse(workflowRaw) as Workflow;

  // Optional preview
  let previewDataUrl: string | undefined;
  const previewFile = zip.file("preview.png");
  if (previewFile) {
    const b64 = await previewFile.async("base64");
    previewDataUrl = `data:image/png;base64,${b64}`;
  }

  // Optional hooks
  const hooks: Record<string, string> = {};
  const hooksFolder = zip.folder("hooks");
  if (hooksFolder) {
    const hookFiles = Object.entries(zip.files).filter(
      ([name]) => name.startsWith("hooks/") && !name.endsWith("/")
    );
    for (const [name, file] of hookFiles) {
      hooks[name.replace("hooks/", "")] = await file.async("string");
    }
  }

  return {
    workflow,
    manifest,
    previewDataUrl,
    hooks: Object.keys(hooks).length > 0 ? hooks : undefined,
  };
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Trigger a browser download of a .wfos blob.
 */
export function downloadWfos(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".wfos") ? filename : `${filename}.wfos`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sanitise a workflow name into a safe filename stem.
 */
export function safeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workflow";
}
