import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import { buildEdgesFromContracts } from "@/lib/graph/wire-from-contracts";
import type { Workflow } from "@/lib/types/workflow";

/**
 * True blank canvas — what every new session starts with.
 */
export const starterWorkflow: Workflow = {
  id: "wf_new",
  name: "My Workflow",
  version: "1.0.0",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  description: "",
  nodes: [],
  edges: [],
  metadata: { graphVersion: "1.0.0" },
};

/**
 * PMO Project Intake — a realistic 11-node workflow showing all node types.
 *
 * Story: A new project request arrives via email. The PMO assesses it,
 * a director reviews, a charter is drafted and sponsor-approved,
 * stakeholders are notified, and the project is registered in the
 * company's legacy PM tool before a full project plan is generated.
 *
 * This workflow deliberately includes integration nodes (email, legacy system)
 * alongside AI skills and human checkpoints — because real PMO processes
 * are never fully automated.
 */
const basePMOExample: Workflow = {
  id: "wf_pmo_intake",
  name: "PMO Project Intake",
  version: "1.0.0",
  objective: "Automate the intake, assessment, and approval of new project requests — from email to approved charter and project plan — while maintaining full human governance at every key decision point.",
  description: "End-to-end PMO intake workflow: email intake → AI assessment → PMO review → charter generation → sponsor sign-off → stakeholder notification → project registration → plan build.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { graphVersion: "1.0.0" },
  nodes: [
    // ── Integration: inbound email ───────────────────────────────────────────
    {
      id: "int_email_intake",
      type: "integration",
      position: { x: 40, y: 100 },
      data: {
        name: "email_intake",
        description: "Receive the project request email from the requestor and extract it as a structured document.",
        subtype: "email_receive",
        system: "Outlook",
        direction: "inbound",
        inputs: [],
        outputs: ["project_request.md"],
        manualSteps: "Monitor the PMO inbox. When a new project request email arrives, save the body and any attachments as project_request.md in the intake folder.",
        estimatedTime: "2–5 min",
        automated: false,
        team: "PMO",
        presenterNote: "Every project starts the same way — an email lands in the PMO inbox. Right now this step is manual. Once volume grows, we can automate it with an email parser. The rest of the pipeline is already ready.",
      },
    },

    // ── Artifact: project_request.md ────────────────────────────────────────
    {
      id: "art_project_request",
      type: "artifact",
      position: { x: 260, y: 60 },
      data: {
        name: "project_request.md",
        fileName: "project_request.md",
        artifactType: "md",
        status: "unknown",
        description: "Raw project request: requestor, business unit, objective, scope, budget estimate, desired timeline.",
        presenterNote: "This is the raw intake document. Everything downstream is derived from this single file.",
      },
    },

    // ── Skill: assess_request ────────────────────────────────────────────────
    {
      id: "skill_assess_request",
      type: "skill",
      position: { x: 460, y: 100 },
      data: {
        name: "assess_request",
        fileName: "assess_request.yaml",
        description: "Score and categorise the project request against the PMO prioritisation framework. Outputs a structured assessment with risk, effort, strategic alignment, and recommended priority.",
        inputs: ["project_request.md"],
        outputs: ["project_assessment.md"],
        requires: ["project_request.exists"],
        produces: ["project_assessment.exists", "project_assessment.scored"],
        validations: ["score is numeric", "risk level is set", "strategic alignment is rated"],
        tags: ["pmo", "scoring"],
        enabled: true,
        version: 1,
        team: "PMO",
        presenterNote: "AI reads the request and scores it across four dimensions: strategic alignment, effort, risk, and urgency. This removes scoring subjectivity and gives the PMO Director a consistent basis for every decision.",
      },
    },

    // ── Artifact: project_assessment.md ─────────────────────────────────────
    {
      id: "art_assessment",
      type: "artifact",
      position: { x: 680, y: 60 },
      data: {
        name: "project_assessment.md",
        fileName: "project_assessment.md",
        artifactType: "md",
        status: "unknown",
        description: "Scored assessment: priority tier, risk level, effort estimate, strategic alignment rating, and recommendation.",
        presenterNote: "A structured, comparable assessment. The PMO Director can now review a score rather than a raw email.",
      },
    },

    // ── Human: PMO Director Review ───────────────────────────────────────────
    {
      id: "human_pmo_review",
      type: "human",
      position: { x: 900, y: 100 },
      data: {
        name: "PMO Director Review",
        description: "The PMO Director reviews the AI assessment, validates the scoring, and decides whether to proceed, hold, or reject the request.",
        subtype: "approval" as const,
        approverRole: "PMO Director",
        requiredInputs: ["project_request.md", "project_assessment.md"],
        producedArtifacts: [],
        instructions: "Review the assessment score and check against current portfolio capacity. Approve to proceed to charter, or reject with a reason. If holding for a future quarter, note the target date.",
        team: "PMO",
        presenterNote: "This is the first human gate. No project proceeds without the PMO Director's explicit sign-off. The AI did the legwork; the director makes the call. This is exactly how it should be.",
      },
    },

    // ── Skill: draft_charter ─────────────────────────────────────────────────
    {
      id: "skill_draft_charter",
      type: "skill",
      position: { x: 900, y: 280 },
      data: {
        name: "draft_project_charter",
        fileName: "draft_project_charter.yaml",
        description: "Generate a full project charter from the approved request and assessment. Includes objectives, scope, deliverables, milestones, resource requirements, and risk register.",
        inputs: ["project_request.md", "project_assessment.md"],
        outputs: ["project_charter.md"],
        requires: ["project_request.exists", "project_assessment.scored"],
        produces: ["project_charter.exists"],
        validations: ["charter includes scope", "charter includes milestones", "charter includes risk register"],
        tags: ["pmo", "charter"],
        enabled: true,
        version: 1,
        team: "PMO",
        presenterNote: "The AI drafts a full charter in seconds — objectives, deliverables, milestones, risks. What used to take a project manager half a day now takes zero manual effort. The sponsor still reviews and signs off.",
      },
    },

    // ── Artifact: project_charter.md ────────────────────────────────────────
    {
      id: "art_charter",
      type: "artifact",
      position: { x: 680, y: 260 },
      data: {
        name: "project_charter.md",
        fileName: "project_charter.md",
        artifactType: "md",
        status: "unknown",
        description: "Full project charter: scope, objectives, deliverables, milestones, budget, resource plan, risk register.",
        presenterNote: "A complete, professionally structured charter — ready for the sponsor to review.",
      },
    },

    // ── Human: Sponsor Sign-off ──────────────────────────────────────────────
    {
      id: "human_sponsor_signoff",
      type: "human",
      position: { x: 460, y: 280 },
      data: {
        name: "Sponsor Sign-off",
        description: "The project sponsor reviews the charter, requests any amendments, and provides final approval to proceed.",
        subtype: "approval" as const,
        approverRole: "Project Sponsor",
        requiredInputs: ["project_charter.md"],
        producedArtifacts: [],
        instructions: "Review the charter carefully. Confirm scope, budget, and milestones are aligned with business expectations. Approve or return with requested changes.",
        presenterNote: "The second human gate. The sponsor sees a complete charter — not a rough email. They either approve or send it back. No ambiguity, no verbal approvals lost in an email thread.",
      },
    },

    // ── Integration: notify stakeholders ────────────────────────────────────
    {
      id: "int_notify_stakeholders",
      type: "integration",
      position: { x: 260, y: 280 },
      data: {
        name: "notify_stakeholders",
        description: "Send an approval notification email to the project requestor, the sponsor, and relevant team leads with the approved charter attached.",
        subtype: "email_send",
        system: "Outlook",
        direction: "outbound",
        inputs: ["project_charter.md"],
        outputs: [],
        manualSteps: "Compose and send a notification email to the project requestor, sponsor, and team leads. Attach the approved project_charter.md. Use the standard PMO approval email template.",
        estimatedTime: "3–5 min",
        automated: false,
        team: "PMO",
        presenterNote: "Once approved, everyone is notified immediately. No one waits to hear whether their project was approved — the communication is standardised and instant.",
      },
    },

    // ── Integration: register in legacy PM tool ──────────────────────────────
    {
      id: "int_register_project",
      type: "integration",
      position: { x: 260, y: 440 },
      data: {
        name: "register_project",
        description: "Create the official project record in the company's project management system. Assigns a project ID, sets up the project folder structure, and records the charter details.",
        subtype: "legacy_system",
        system: "Project Portfolio Manager",
        direction: "bidirectional",
        inputs: ["project_charter.md"],
        outputs: ["project_record.md"],
        manualSteps: "Log into Project Portfolio Manager. Create a new project record. Enter the project name, sponsor, PMO owner, start date, and priority tier from the charter. Save and note the assigned Project ID. Record the Project ID in project_record.md.",
        estimatedTime: "5–10 min",
        automated: false,
        team: "PMO",
        presenterNote: "This is the 'clunky but unavoidable' step. Our PM system doesn't have an API. Someone has to log in and create the record manually. We know this. We've documented it. We've estimated how long it takes. When we eventually get API access — or replace the system — this node becomes automated without changing anything else in the workflow.",
      },
    },

    // ── Artifact: project_record.md ─────────────────────────────────────────
    {
      id: "art_project_record",
      type: "artifact",
      position: { x: 480, y: 440 },
      data: {
        name: "project_record.md",
        fileName: "project_record.md",
        artifactType: "md",
        status: "unknown",
        description: "Official project record: Project ID, PM system URL, assigned project manager, folder path, registration date.",
        presenterNote: "Proof the project is officially registered. The Project ID from here flows into the plan.",
      },
    },
  ],
  edges: [],
};

// Build edges from contract arrays, then sync contracts from resulting edges
const wiredPMO = syncSkillContractsFromGraph(buildEdgesFromContracts(basePMOExample));

export const exampleWorkflow: Workflow = wiredPMO;

