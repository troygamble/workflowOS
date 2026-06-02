import { deriveState } from "@/lib/state/state-engine";
import type { Workflow } from "@/lib/types/workflow";

type JobLike = { stepId: string; status: string };

export function getNextRecommendedStep(workflow: Workflow, jobs: JobLike[] = []): { stepId: string; reason: string } | null {
  const running = new Set(jobs.filter((j) => j.status === "running").map((j) => j.stepId));
  const failed = new Set(jobs.filter((j) => j.status === "failed").map((j) => j.stepId));
  const state = deriveState(workflow, running, failed);
  const ready = workflow.nodes
    .filter((n) => n.type === "skill")
    .filter((s) => state.skills[s.id]?.status === "ready")
    .sort((a, b) => (a.data.name ?? a.id).localeCompare(b.data.name ?? b.id))
    .map((s) => ({
      stepId: s.id,
      reason: state.skills[s.id]?.why.join(" · ") ?? "Ready to run",
    }));
  return ready[0] ?? null;
}
