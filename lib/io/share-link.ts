/**
 * lib/io/share-link.ts
 *
 * Encodes/decodes a Workflow as a URL-safe base64 string for shareable links.
 * The workflow is gzip-compressed then base64-encoded, stored in the URL hash
 * so it never hits any server:
 *
 *   <your-host>/view#<base64(gzip(JSON))>
 *
 * This is purely client-side — no backend required.
 * Max practical size: ~4MB URL before browsers complain (~800KB workflow JSON).
 */

import type { Workflow } from "@/lib/types/workflow";

// ── Encoding ──────────────────────────────────────────────────────────────────

/**
 * Encode a workflow to a base64url string suitable for a URL hash.
 * Uses CompressionStream (available in all modern browsers and Node 18+).
 */
export async function encodeWorkflow(workflow: Workflow): Promise<string> {
  const json = JSON.stringify(workflow);
  const bytes = new TextEncoder().encode(json);

  if (typeof CompressionStream !== "undefined") {
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    void writer.write(bytes);
    void writer.close();
    const compressed = await new Response(cs.readable).arrayBuffer();
    return uint8ToBase64url(new Uint8Array(compressed));
  }

  // Fallback: no compression (larger URL)
  return uint8ToBase64url(bytes);
}

/**
 * Decode a base64url string back to a Workflow.
 */
export async function decodeWorkflow(encoded: string): Promise<Workflow> {
  const bytes = base64urlToUint8(encoded);

  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      void writer.write(bytes.buffer as ArrayBuffer);
      void writer.close();
      const decompressed = await new Response(ds.readable).arrayBuffer();
      const json = new TextDecoder().decode(decompressed);
      return JSON.parse(json) as Workflow;
    } catch {
      // If decompression fails, try raw decode (uncompressed fallback)
    }
  }

  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as Workflow;
}

/**
 * Build the full shareable URL for a workflow.
 */
export async function buildShareUrl(workflow: Workflow, baseUrl?: string): Promise<string> {
  const encoded = await encodeWorkflow(workflow);
  const base = baseUrl ?? (typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  return `${base}/view#${encoded}`;
}

/**
 * Extract and decode a workflow from the current page's URL hash.
 * Returns null if the hash is empty or decoding fails.
 */
export async function decodeWorkflowFromHash(): Promise<Workflow | null> {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1); // remove leading #
  if (!hash) return null;
  try {
    return await decodeWorkflow(hash);
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uint8ToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlToUint8(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
