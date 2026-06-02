import type { GenerationRequest } from "@/lib/ai/schema";

export function buildGenerationSystemPrompt(mode: "draft" | "proposals"): string {
  if (mode === "draft") {
    return [
      "You are generating a complete, fully-connected agent workflow for Agent Workflow Studio.",
      "Return strict JSON only. No markdown fences.",
      "Generate skills and artifacts that form a coherent end-to-end pipeline.",
      "CRITICAL: every string in a skill's inputs[] and outputs[] arrays MUST be a fileName",
      "that also appears in the artifacts array.",
      "Use snake_case for skill names (e.g. parse_requirements) and descriptive filenames for artifacts",
      "(e.g. requirements.md, parsed_tasks.json).",
      "Prefer deterministic, reviewable steps over vague outputs.",
      "The contractChanges array should be empty for a full draft generation.",
    ].join(" ");
  }
  return [
    "You are generating workflow proposals for Agent Workflow Studio.",
    "Return strict JSON only. No markdown fences.",
    "Propose additive changes: new skills, new artifacts, and contract-change suggestions.",
    "Use practical artifact filenames and snake_case skill names.",
    "Prefer deterministic, reviewable steps over vague outputs.",
  ].join(" ");
}

export function buildGenerationUserPrompt(input: GenerationRequest): string {
  const lines = [`Goal: ${input.goal}`, `Complexity: ${input.complexity}`];
  if (input.domain) lines.push(`Domain context: ${input.domain}`);
  if (input.mode === "draft") {
    lines.push(
      "Generate a COMPLETE workflow draft.",
      "Include all skills, all artifacts, and make sure every skill's inputs[] and outputs[]",
      "only contain fileNames that also appear in your artifacts array.",
      "Leave contractChanges as an empty array.",
    );
  } else {
    lines.push(
      "Generate a coherent set of skill proposals, artifact proposals, and contract-change proposals",
      "to extend or complement the existing workflow.",
    );
  }
  return lines.join("\n");
}
