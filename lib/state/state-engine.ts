import { evaluateConditionList } from "@/lib/conditions/evaluate";
import type { ArtifactStatus, SkillStatus, Workflow } from "@/lib/types/workflow";

export type DerivedState = {
  artifacts: Record<string, { status: ArtifactStatus; why: string[] }>;
  skills: Record<string, { status: SkillStatus; why: string[] }>;
};

function artifactByFileName(workflow: Workflow, fileName: string): Extract<Workflow["nodes"][number], { type: "artifact" }> | undefined {
  return workflow.nodes.find(
    (n): n is Extract<Workflow["nodes"][number], { type: "artifact" }> => n.type === "artifact" && n.data.fileName === fileName
  );
}

export function deriveState(
  workflow: Workflow,
  runningStepIds: Set<string> = new Set(),
  failedStepIds: Set<string> = new Set()
): DerivedState {
  const artifacts: DerivedState["artifacts"] = {};
  const skills: DerivedState["skills"] = {};

  for (const node of workflow.nodes) {
    if (node.type === "artifact") {
      const status = node.data.status ?? "unknown";
      const why: string[] = [`Artifact "${node.data.fileName}" status is ${status}`];
      if (node.data.ownerStepId) why.push(`Owner step: ${node.data.ownerStepId}`);
      if (node.data.lastUpdatedAt) why.push(`Last updated: ${node.data.lastUpdatedAt}`);
      artifacts[node.id] = { status, why };
    }
  }

  for (const skill of workflow.nodes) {
    if (skill.type !== "skill") continue;

    if (runningStepIds.has(skill.id)) {
      skills[skill.id] = { status: "running", why: ["A job is currently running for this step"] };
      continue;
    }
    if (failedStepIds.has(skill.id)) {
      skills[skill.id] = { status: "failed", why: ["The most recent job for this step failed"] };
      continue;
    }

    const req = evaluateConditionList(skill.data.requires ?? [], workflow);
    if (!req.allOk) {
      skills[skill.id] = { status: "blocked", why: ["Unmet requires:", ...req.unmet] };
      continue;
    }

    const missingInputs: string[] = [];
    for (const file of skill.data.inputs ?? []) {
      const a = artifactByFileName(workflow, file);
      if (!a) {
        missingInputs.push(`${file} (no artifact node)`);
      } else if ((a.data.status ?? "unknown") === "missing") {
        missingInputs.push(`${file} is missing`);
      }
    }
    if (missingInputs.length > 0) {
      skills[skill.id] = { status: "blocked", why: ["Required input artifacts:", ...missingInputs] };
      continue;
    }

    const outWhy: string[] = [];
    let anyStaleOrMissing = false;
    for (const file of skill.data.outputs ?? []) {
      const a = artifactByFileName(workflow, file);
      if (!a) {
        anyStaleOrMissing = true;
        outWhy.push(`${file}: no artifact node`);
        continue;
      }
      const st = a.data.status ?? "unknown";
      if (st === "missing" || st === "stale") {
        anyStaleOrMissing = true;
        outWhy.push(`${file}: ${st}`);
      }
    }

    if (skill.data.outputs?.length === 0) {
      skills[skill.id] = {
        status: "blocked",
        why: ["Skill has no outputs declared; add an output edge to an artifact"],
      };
      continue;
    }

    if (anyStaleOrMissing) {
      skills[skill.id] = { status: "ready", why: ["Work to (re)produce outputs:", ...outWhy] };
    } else {
      skills[skill.id] = { status: "idle", why: ["All inputs present and outputs are up to date"] };
    }
  }

  return { artifacts, skills };
}
