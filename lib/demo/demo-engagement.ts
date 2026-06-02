/**
 * lib/demo/demo-engagement.ts
 *
 * Two demo modes:
 *   openDemoEngagement() — loads the Invoice Approval template + instantly
 *     opens the proposal PDF for the "see it in action" button.
 *   loadDemoToCanvas()   — loads the template into the canvas store ONLY,
 *     no PDF open. Used by the guided tour so the canvas has real content
 *     to spotlight without any modal jumping up.
 */

import { openProposal } from "@/lib/io/proposal-html";
import type { ProposalBranding } from "@/lib/io/proposal-html";
import { WORKFLOW_TEMPLATES } from "@/lib/templates";
import type { HumanNodeData } from "@/lib/types/workflow";
import { useWorkflowStore } from "@/store/workflow-store";

const DEMO_BRANDING: ProposalBranding = {
  firmName: "Apex AI Consulting",
  tagline: "AI Workflow Automation for Finance & Operations Teams",
  consultantName: "Alex Morgan",
  email: "alex@apexai.consulting",
  websiteUrl: "apexai.consulting",
  accentColor: "#6d28d9",
};

function buildDemoWorkflow() {
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === "invoice-processing-fs");
  if (!template) return null;
  const workflow = template.build();
  // Inject realistic human time data so the ROI section tells a compelling story
  for (const node of workflow.nodes) {
    if (node.type === "human") {
      const d = node.data as HumanNodeData;
      d.minutesPerOccurrence = 45;
      d.occurrencesPerWeek = 30;
    }
  }
  return workflow;
}

/** Load demo content into the canvas store — no modal opened. */
export function loadDemoToCanvas(): void {
  const workflow = buildDemoWorkflow();
  if (!workflow) {
    console.warn("Demo template not found");
    return;
  }
  useWorkflowStore.getState().setWorkflow(workflow, true);
}

/** Load demo content AND immediately open the proposal PDF. */
export function openDemoEngagement(): void {
  const workflow = buildDemoWorkflow();
  if (!workflow) {
    console.warn("Demo template not found");
    return;
  }
  openProposal(workflow, DEMO_BRANDING);
}
