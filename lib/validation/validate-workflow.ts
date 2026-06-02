import { evaluateConditionString } from "@/lib/conditions/evaluate";
import type { ValidationIssue, ValidationResult, Workflow } from "@/lib/types/workflow";

const push = (issues: ValidationIssue[], issue: ValidationIssue) => issues.push(issue);

function hasDirectedCycle(nodeIds: string[], edges: { source: string; target: string }[]): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);
  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (u: string): boolean => {
    visited.add(u);
    stack.add(u);
    for (const v of adj.get(u) ?? []) {
      if (!visited.has(v)) {
        if (dfs(v)) return true;
      } else if (stack.has(v)) {
        return true;
      }
    }
    stack.delete(u);
    return false;
  };

  for (const id of nodeIds) {
    if (!visited.has(id) && dfs(id)) return true;
  }
  return false;
}

function reachableNodeIdsFromSeeds(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  seeds: Set<string>
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);
  const seen = new Set<string>();
  const q = [...seeds];
  for (const s of q) seen.add(s);
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (!seen.has(v)) {
        seen.add(v);
        q.push(v);
      }
    }
  }
  return seen;
}

function indegreeZero(nodeIds: string[], edges: { source: string; target: string }[]): Set<string> {
  const inCount = new Map<string, number>();
  for (const id of nodeIds) inCount.set(id, 0);
  for (const e of edges) inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
  const z = new Set<string>();
  for (const [id, c] of inCount) {
    if (c === 0) z.add(id);
  }
  return z;
}

export function validateWorkflow(workflow: Workflow): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = workflow.nodes.map((n) => n.id);
  const nodeSet = new Set(nodeIds);

  {
    const seen = new Set<string>();
    for (const node of workflow.nodes) {
      if (seen.has(node.id)) {
        push(issues, {
          id: `dup-${node.id}`,
          severity: "error",
          code: "DUPLICATE_NODE_ID",
          message: `Duplicate node id: ${node.id}`,
          nodeId: node.id,
        });
      }
      seen.add(node.id);
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
      push(issues, {
        id: `dangling-${edge.id}`,
        severity: "error",
        code: "DANGLING_EDGE",
        message: `Edge ${edge.id} references a missing node`,
        nodeId: !nodeSet.has(edge.source) ? edge.source : edge.target,
      });
    }
  }

  if (hasDirectedCycle(nodeIds, workflow.edges)) {
    push(issues, { id: "cycle", severity: "error", code: "CYCLE_DETECTED", message: "Workflow graph contains a directed cycle" });
  }

  const seeds = indegreeZero(nodeIds, workflow.edges);
  const forwardReach = reachableNodeIdsFromSeeds(nodeIds, workflow.edges, seeds);
  for (const n of workflow.nodes) {
    if (n.type === "skill" && !forwardReach.has(n.id)) {
      push(issues, {
        id: `unreachable-skill-${n.id}`,
        severity: "warning",
        code: "UNREACHABLE_NODE",
        message: `Skill "${n.data.name}" is not reachable from any graph entry point`,
        nodeId: n.id,
      });
    }
  }

  for (const n of workflow.nodes) {
    if (n.type === "artifact") {
      const producedByStep = workflow.edges.filter((e) => e.target === n.id && e.edgeType === "output");
      if (producedByStep.length === 0 && !n.data.notes?.toLowerCase().includes("external") && n.data.fileName) {
        push(issues, {
          id: `orphan-art-${n.id}`,
          severity: "warning",
          code: "ORPHAN_ARTIFACT",
          message: `Artifact ${n.data.fileName} has no producing step. Add "external" to notes, or connect a skill/integration output edge.`,
          nodeId: n.id,
        });
      }
    }
  }

  // Integration node validation
  for (const n of workflow.nodes) {
    if (n.type !== "integration") continue;
    const hasAnyEdge = workflow.edges.some((e) => e.source === n.id || e.target === n.id);
    if (!hasAnyEdge) {
      push(issues, {
        id: `isolated-integration-${n.id}`,
        severity: "warning",
        code: "ISOLATED_INTEGRATION",
        message: `Integration "${n.data.name}" is not connected to any artifact or step`,
        nodeId: n.id,
      });
    }
    for (const f of n.data.inputs ?? []) {
      if (!workflow.nodes.some((x) => x.type === "artifact" && x.data.fileName === f)) {
        push(issues, {
          id: `int-missing-input-${n.id}-${f}`,
          severity: "error",
          code: "MISSING_INPUT_FILE",
          message: `Integration "${n.data.name}" references input "${f}" with no matching artifact node`,
          nodeId: n.id,
        });
      }
    }
    for (const f of n.data.outputs ?? []) {
      if (!workflow.nodes.some((x) => x.type === "artifact" && x.data.fileName === f)) {
        push(issues, {
          id: `int-missing-output-${n.id}-${f}`,
          severity: "error",
          code: "MISSING_OUTPUT_FILE",
          message: `Integration "${n.data.name}" references output "${f}" with no matching artifact node`,
          nodeId: n.id,
        });
      }
    }
  }

  const fileNames = new Set<string>();
  for (const n of workflow.nodes) {
    if (n.type === "artifact") {
      if (fileNames.has(n.data.fileName)) {
        push(issues, {
          id: `dup-filename-${n.data.fileName}`,
          severity: "error",
          code: "DUPLICATE_ARTIFACT_FILENAME",
          message: `Duplicate artifact file name: ${n.data.fileName}`,
        });
      }
      fileNames.add(n.data.fileName);
    }
  }

  for (const n of workflow.nodes) {
    if (n.type !== "skill") continue;
    if (!n.data.enabled) continue;
    if ((n.data.outputs?.length ?? 0) === 0) {
      push(issues, {
        id: `skill-out-${n.id}`,
        severity: "error",
        code: "SKILL_OUTPUT_REQUIRED",
        message: `Skill "${n.data.name}" must have at least one output artifact or output edge`,
        nodeId: n.id,
      });
    }
    for (const f of n.data.inputs ?? []) {
      if (!fileNames.has(f) && !workflow.nodes.some((x) => x.type === "artifact" && x.data.fileName === f)) {
        push(issues, {
          id: `missing-input-file-${n.id}-${f}`,
          severity: "error",
          code: "MISSING_INPUT_FILE",
          message: `Skill "${n.data.name}" references input "${f}" with no matching artifact node`,
          nodeId: n.id,
        });
      }
    }
    for (const f of n.data.outputs ?? []) {
      if (!fileNames.has(f) && !workflow.nodes.some((x) => x.type === "artifact" && x.data.fileName === f)) {
        push(issues, {
          id: `missing-output-file-${n.id}-${f}`,
          severity: "error",
          code: "MISSING_OUTPUT_FILE",
          message: `Skill "${n.data.name}" references output "${f}" with no matching artifact node`,
          nodeId: n.id,
        });
      }
    }
    for (const cond of n.data.requires ?? []) {
      const r = evaluateConditionString(cond, workflow);
      if (cond.includes(".") && !r.ok) {
        /* ok false just means not satisfied, not always invalid - check parse */
      }
    }
  }

  for (const n of workflow.nodes) {
    if (n.type === "skill") {
      for (const cond of n.data.requires ?? []) {
        if (!String(cond).includes(".")) {
          push(issues, {
            id: `req-syntax-${n.id}`,
            severity: "warning",
            code: "REQUIRES_SYNTAX",
            message: `Skill "${n.data.name}" has requires entry "${cond}" (expected "artifactKey.property" form)`,
            nodeId: n.id,
          });
        }
      }
    }
  }

  return { valid: issues.every((i) => i.severity !== "error"), issues };
}
