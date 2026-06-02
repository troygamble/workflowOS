import type { Workflow, WorkflowNode, IntegrationSubtype } from "@/lib/types/workflow";
import { buildEdgesFromContracts } from "@/lib/graph/wire-from-contracts";
import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";

export type HealFix = {
  type:
    | "removed_duplicate_node"
    | "deduped_array"
    | "fixed_invalid_subtype"
    | "synced_produces"
    | "fixed_artifact_type"
    | "rewired_edges"
    | "removed_dangling_edge";
  message: string;
  nodeId?: string;
};

export type DeterministicHealResult = {
  workflow: Workflow;
  fixes: HealFix[];
  remainingIssues: {
    orphanedNodes: WorkflowNode[];
    missingArtifacts: { nodeId: string; nodeName: string; fileName: string }[];
    duplicateFileNames: string[];
    humanNoInput: WorkflowNode[];
    humanNoOutput: WorkflowNode[];
  };
};

const VALID_SUBTYPES = new Set<string>([
  "email_send", "email_receive", "form_submit", "legacy_system",
  "webhook", "file_transfer", "notification", "other",
]);

function dedup<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function deterministicHeal(workflow: Workflow): DeterministicHealResult {
  const fixes: HealFix[] = [];
  let nodes = workflow.nodes.map((n) => ({ ...n, data: { ...n.data } })) as WorkflowNode[];
  let edges = [...workflow.edges];

  // ── 1. Remove duplicate-named nodes (keep the one with most edges) ──
  {
    const edgeCount = new Map<string, number>();
    for (const e of edges) {
      edgeCount.set(e.source, (edgeCount.get(e.source) ?? 0) + 1);
      edgeCount.set(e.target, (edgeCount.get(e.target) ?? 0) + 1);
    }
    const seenNames = new Map<string, string>(); // name → id of keeper
    const removedIds = new Set<string>();
    for (const n of nodes) {
      const name = n.data.name;
      if (seenNames.has(name)) {
        const keeperId = seenNames.get(name)!;
        const keeperEdges = edgeCount.get(keeperId) ?? 0;
        const thisEdges = edgeCount.get(n.id) ?? 0;
        if (thisEdges > keeperEdges) {
          removedIds.add(keeperId);
          seenNames.set(name, n.id);
        } else {
          removedIds.add(n.id);
        }
        fixes.push({
          type: "removed_duplicate_node",
          message: `Removed duplicate node "${name}"`,
          nodeId: n.id,
        });
      } else {
        seenNames.set(name, n.id);
      }
    }
    if (removedIds.size > 0) {
      nodes = nodes.filter((n) => !removedIds.has(n.id));
      edges = edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target));
    }
  }

  // ── 2. Dedup inputs/outputs/requires/produces arrays ──
  for (const n of nodes) {
    if (n.type === "skill") {
      const d = n.data;
      const before = JSON.stringify([d.inputs, d.outputs, d.requires, d.produces]);
      d.inputs = dedup(d.inputs);
      d.outputs = dedup(d.outputs);
      d.requires = dedup(d.requires);
      d.produces = dedup(d.produces);
      if (JSON.stringify([d.inputs, d.outputs, d.requires, d.produces]) !== before) {
        fixes.push({ type: "deduped_array", message: `Deduplicated arrays in skill "${d.name}"`, nodeId: n.id });
      }
    }
    if (n.type === "integration") {
      const d = n.data;
      const before = JSON.stringify([d.inputs, d.outputs]);
      d.inputs = dedup(d.inputs);
      d.outputs = dedup(d.outputs);
      if (JSON.stringify([d.inputs, d.outputs]) !== before) {
        fixes.push({ type: "deduped_array", message: `Deduplicated arrays in integration "${d.name}"`, nodeId: n.id });
      }
    }
  }

  // ── 3. Fix invalid integration subtypes ──
  for (const n of nodes) {
    if (n.type === "integration" && !VALID_SUBTYPES.has(n.data.subtype)) {
      fixes.push({
        type: "fixed_invalid_subtype",
        message: `Integration "${n.data.name}": subtype "${n.data.subtype}" → "other"`,
        nodeId: n.id,
      });
      (n.data as { subtype: IntegrationSubtype }).subtype = "other";
    }
  }

  // ── 4. Sync produces ← outputs for skills that have outputs but empty produces ──
  for (const n of nodes) {
    if (n.type === "skill") {
      const d = n.data;
      if (d.outputs.length > 0 && d.produces.length === 0) {
        d.produces = [...d.outputs];
        fixes.push({ type: "synced_produces", message: `Synced produces from outputs for skill "${d.name}"`, nodeId: n.id });
      }
    }
  }

  // ── 5. Fix artifact types for folders ──
  for (const n of nodes) {
    if (n.type === "artifact") {
      const d = n.data;
      if (d.fileName.endsWith("/") && d.artifactType !== "other") {
        fixes.push({ type: "fixed_artifact_type", message: `Artifact "${d.name}": folder type → "other"`, nodeId: n.id });
        d.artifactType = "other";
      }
    }
  }

  // ── 6. Remove dangling edges ──
  const nodeSet = new Set(nodes.map((n) => n.id));
  const danglingEdges = edges.filter((e) => !nodeSet.has(e.source) || !nodeSet.has(e.target));
  if (danglingEdges.length > 0) {
    fixes.push({ type: "removed_dangling_edge", message: `Removed ${danglingEdges.length} dangling edge(s)` });
    edges = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
  }

  // ── 7. Re-wire edges from contracts ──
  const partialWorkflow: Workflow = { ...workflow, nodes, edges };
  const rewired = syncSkillContractsFromGraph(buildEdgesFromContracts(partialWorkflow));
  if (rewired.edges.length !== edges.length) {
    fixes.push({
      type: "rewired_edges",
      message: `Rewired edges from contracts: ${edges.length} → ${rewired.edges.length}`,
    });
  }
  nodes = rewired.nodes as WorkflowNode[];
  edges = rewired.edges;

  // ── Compute remaining issues ──
  const edgesByNode = new Map<string, number>();
  for (const e of edges) {
    edgesByNode.set(e.source, (edgesByNode.get(e.source) ?? 0) + 1);
    edgesByNode.set(e.target, (edgesByNode.get(e.target) ?? 0) + 1);
  }
  const orphanedNodes = nodes.filter((n) => (edgesByNode.get(n.id) ?? 0) === 0);

  const artifactFileNames = new Set(
    nodes.filter((n) => n.type === "artifact").map((n) => n.data.fileName as string)
  );
  const missingArtifacts: DeterministicHealResult["remainingIssues"]["missingArtifacts"] = [];
  for (const n of nodes) {
    if (n.type === "skill") {
      for (const f of [...n.data.inputs, ...n.data.outputs]) {
        if (!artifactFileNames.has(f)) {
          missingArtifacts.push({ nodeId: n.id, nodeName: n.data.name, fileName: f });
        }
      }
    }
    if (n.type === "integration") {
      for (const f of [...(n.data.inputs ?? []), ...(n.data.outputs ?? [])]) {
        if (f && !artifactFileNames.has(f)) {
          missingArtifacts.push({ nodeId: n.id, nodeName: n.data.name, fileName: f });
        }
      }
    }
  }

  const fileNameCounts = new Map<string, number>();
  for (const n of nodes) {
    if (n.type === "artifact") {
      const fn = n.data.fileName as string;
      fileNameCounts.set(fn, (fileNameCounts.get(fn) ?? 0) + 1);
    }
  }
  const duplicateFileNames = [...fileNameCounts.entries()]
    .filter(([, c]) => c > 1)
    .map(([fn]) => fn);

  // Human nodes with no inputs (nothing feeds them)
  const humanNoInput = nodes.filter((n) => {
    if (n.type !== "human") return false;
    const incomingCount = edges.filter((e) => e.target === n.id).length;
    return incomingCount === 0;
  });

  // Human nodes with no outputs (nothing comes out)
  const humanNoOutput = nodes.filter((n) => {
    if (n.type !== "human") return false;
    const outgoingCount = edges.filter((e) => e.source === n.id).length;
    return outgoingCount === 0;
  });

  return {
    workflow: { ...workflow, nodes, edges },
    fixes,
    remainingIssues: { orphanedNodes, missingArtifacts, duplicateFileNames, humanNoInput, humanNoOutput },
  };
}
