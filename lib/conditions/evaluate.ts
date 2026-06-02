import type { Workflow } from "@/lib/types/workflow";

/** Base name without extension, e.g. "tasks" from "tasks.md". */
export function fileBaseName(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(0, i) : fileName;
}

export function findArtifactIdByFileBase(workflow: Workflow, base: string): { id: string; fileName: string } | undefined {
  for (const n of workflow.nodes) {
    if (n.type === "artifact" && fileBaseName(n.data.fileName) === base) {
      return { id: n.id, fileName: n.data.fileName };
    }
  }
  return undefined;
}

/**
 * Spec-style tokens: "tasks.exists", "proposal.up_to_date", "schedule.valid", "updates.current"
 */
export function evaluateConditionString(cond: string, workflow: Workflow): { ok: boolean; detail: string } {
  const c = cond.trim();
  const dot = c.indexOf(".");
  if (dot < 0) {
    return { ok: false, detail: `Malformed condition: ${c}` };
  }
  const base = c.slice(0, dot);
  const key = c.slice(dot + 1);
  const art = findArtifactIdByFileBase(workflow, base);
  if (!art) {
    return { ok: false, detail: `No artifact for token base "${base}"` };
  }
  const node = workflow.nodes.find((n) => n.id === art.id);
  if (!node || node.type !== "artifact") {
    return { ok: false, detail: "Internal: artifact not found" };
  }
  const status = node.data.status ?? "unknown";
  if (key === "exists") {
    return { ok: status !== "missing", detail: `exists → ${status}` };
  }
  if (key === "up_to_date" || key === "current") {
    return { ok: status === "updated", detail: `up to date (updated) → ${status}` };
  }
  if (key === "valid" || key === "consistent") {
    return { ok: status === "updated", detail: `valid/consistent → ${status}` };
  }
  return { ok: false, detail: `Unknown condition key "${key}"` };
}

export function evaluateConditionList(conditions: string[], workflow: Workflow): { allOk: boolean; unmet: string[] } {
  const unmet: string[] = [];
  for (const cond of conditions) {
    const r = evaluateConditionString(cond, workflow);
    if (!r.ok) unmet.push(`${cond} (${r.detail})`);
  }
  return { allOk: unmet.length === 0, unmet };
}
