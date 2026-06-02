import type { Workflow } from "@/lib/types/workflow";

export function propagateStaleness(workflow: Workflow, changedArtifactNodeId: string): Workflow {
  const next = structuredClone(workflow) as Workflow;
  const changedNode = next.nodes.find(
    (n): n is Extract<Workflow["nodes"][number], { type: "artifact" }> =>
      n.id === changedArtifactNodeId && n.type === "artifact",
  );
  if (changedNode) {
    changedNode.data.status = "updated";
  }
  const queue = [changedArtifactNodeId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const artifactId = queue.shift();
    if (!artifactId || seen.has(artifactId)) continue;
    seen.add(artifactId);

    const impactedSkills = next.edges.filter((e) => e.source === artifactId && e.edgeType === "input").map((e) => e.target);
    for (const skillId of impactedSkills) {
      const downstreamArtifacts = next.edges.filter((e) => e.source === skillId && e.edgeType === "output").map((e) => e.target);
      for (const downstreamArtifactId of downstreamArtifacts) {
        const artifact = next.nodes.find(
          (n): n is Extract<Workflow["nodes"][number], { type: "artifact" }> => n.id === downstreamArtifactId && n.type === "artifact",
        );
        if (artifact && artifact.data.status !== "stale") {
          artifact.data.status = "stale";
          queue.push(downstreamArtifactId);
        }
      }
    }
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

