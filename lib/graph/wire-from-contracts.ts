import type { Workflow, WorkflowEdge } from "@/lib/types/workflow";

const uid = () => crypto.randomUUID().slice(0, 8);

/**
 * Creates input/output edges for all skill and integration nodes whose
 * contract arrays reference artifact nodes by fileName.
 *
 * Safe to call multiple times (skips edges that already exist).
 */
export function buildEdgesFromContracts(workflow: Workflow): Workflow {
  const next = structuredClone(workflow) as Workflow;

  // Index artifact nodes by fileName
  const artifactsByFileName = new Map<string, string>();
  for (const n of next.nodes) {
    if (n.type === "artifact") {
      artifactsByFileName.set(n.data.fileName, n.id);
    }
  }

  const existingKeys = new Set(next.edges.map((e) => `${e.source}--${e.target}`));
  const newEdges: WorkflowEdge[] = [];

  for (const n of next.nodes) {
    // Both skill and integration nodes declare inputs[] / outputs[] against artifact fileNames
    if (n.type !== "skill" && n.type !== "integration") continue;

    for (const inputFile of n.data.inputs ?? []) {
      const artifactId = artifactsByFileName.get(inputFile);
      if (!artifactId) continue;
      const key = `${artifactId}--${n.id}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        newEdges.push({
          id: `e_${uid()}`,
          source: artifactId,
          target: n.id,
          edgeType: "input",
          derived: false,
        });
      }
    }

    for (const outputFile of n.data.outputs ?? []) {
      const artifactId = artifactsByFileName.get(outputFile);
      if (!artifactId) continue;
      const key = `${n.id}--${artifactId}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        newEdges.push({
          id: `e_${uid()}`,
          source: n.id,
          target: artifactId,
          edgeType: "output",
          derived: false,
        });
      }
    }
  }

  next.edges = [...next.edges, ...newEdges];
  next.updatedAt = new Date().toISOString();
  return next;
}
