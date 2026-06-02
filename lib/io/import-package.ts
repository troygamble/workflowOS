import JSZip from "jszip";
import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import { applyStateJsonToWorkflow } from "@/lib/io/runtime-snapshot";
import type { StateJson } from "@/lib/io/runtime-snapshot";
import { workflowSchema } from "@/lib/schemas/workflow-schema";
import type { Workflow } from "@/lib/types/workflow";

export async function importWorkflowFromZip(file: File): Promise<Workflow> {
  const zip = await JSZip.loadAsync(file);
  const graphFile = zip.file("workflow-package/workflow/graph.json");
  if (!graphFile) throw new Error("Missing workflow graph.json");
  const content = await graphFile.async("string");
  const raw = JSON.parse(content) as unknown;
  const parsed = workflowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid workflow graph: " + parsed.error.issues.map((i) => i.message).join("; "));
  }
  let w = parsed.data as Workflow;
  const stateFile = zip.file("workflow-package/workflow/state.json");
  if (stateFile) {
    const st = JSON.parse(await stateFile.async("string")) as StateJson;
    w = applyStateJsonToWorkflow(w, st);
  }
  return syncSkillContractsFromGraph(w);
}

export async function importWorkflowFromGraph(file: File): Promise<Workflow> {
  const content = await file.text();
  const raw = JSON.parse(content) as unknown;
  const parsed = workflowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid workflow graph: " + parsed.error.issues.map((i) => i.message).join("; "));
  }
  return syncSkillContractsFromGraph(parsed.data as Workflow);
}
