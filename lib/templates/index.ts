import { nanoid } from "nanoid";
import { buildInferredEdge, syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import type {
  ArtifactNodeData,
  BlastRadius,
  EscalationPolicy,
  HumanNodeData,
  IntegrationNodeData,
  IntegrationSubtype,
  OutputContract,
  RetryPolicy,
  RiskCategory,
  SkillNodeData,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function id() {
  return nanoid();
}

function integrationDirection(subtype: IntegrationSubtype): IntegrationNodeData["direction"] {
  if (subtype === "email_receive" || subtype === "form_submit") return "inbound";
  if (subtype === "email_send" || subtype === "notification") return "outbound";
  return "bidirectional";
}

function node(
  type: WorkflowNode["type"],
  name: string,
  description: string,
  col: number,
  row: number,
  extra: Record<string, unknown> = {},
): WorkflowNode {
  const position = { x: 80 + col * 260, y: 80 + row * 160 };
  const nodeId = id();

  if (type === "integration") {
    const e = extra as Partial<IntegrationNodeData>;
    const subtype = (e.subtype ?? "other") as IntegrationSubtype;
    return {
      id: nodeId,
      type: "integration",
      position,
      data: {
        name,
        description,
        subtype,
        system: e.system,
        direction: e.direction ?? integrationDirection(subtype),
        inputs: e.inputs ?? [],
        outputs: e.outputs ?? [],
        ...e,
      },
    };
  }

  if (type === "human") {
    const e = extra as Partial<HumanNodeData>;
    return {
      id: nodeId,
      type: "human",
      position,
      data: {
        name,
        description,
        subtype: e.subtype ?? "data_entry",
        requiredInputs: e.requiredInputs ?? [],
        producedArtifacts: e.producedArtifacts ?? [],
        ...e,
      },
    };
  }

  if (type === "artifact") {
    const e = extra as Partial<ArtifactNodeData>;
    const fileName = e.fileName ?? name;
    const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";
    const artifactType =
      e.artifactType ??
      (ext === "md"
        ? "md"
        : ext === "json"
          ? "json"
          : ext === "yaml" || ext === "yml"
            ? "yaml"
            : ext === "csv"
              ? "csv"
              : ext === "xlsx" || ext === "xls"
                ? "xlsx"
                : ext === "txt"
                  ? "txt"
                  : "other");
    return {
      id: nodeId,
      type: "artifact",
      position,
      data: {
        name: e.name ?? fileName,
        fileName,
        artifactType,
        status: e.status ?? "unknown",
        description,
        ...e,
      },
    };
  }

  throw new Error(`templates/index: unsupported node type ${type}`);
}

/** Create a skill node with full contract fields. */
function skill(
  name: string,
  description: string,
  col: number,
  row: number,
  opts: {
    intent?: string;
    inputs?: string[];
    outputs?: string[];
    autonomyLevel?: 0 | 1 | 2 | 3;
    riskCategory?: RiskCategory;
    blastRadius?: BlastRadius;
    retryPolicy?: RetryPolicy;
    escalationPolicy?: EscalationPolicy;
    tags?: string[];
    category?: string;
  } = {},
): WorkflowNode {
  const position = { x: 80 + col * 260, y: 80 + row * 160 };
  const fileName = name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() + ".yaml";
  const data: SkillNodeData = {
    name,
    description: opts.intent ?? description,
    fileName,
    inputs: opts.inputs ?? [],
    outputs: opts.outputs ?? [],
    requires: opts.inputs ?? [],
    produces: opts.outputs ?? [],
    validations: [],
    tags: opts.tags ?? [],
    category: opts.category,
    enabled: true,
    version: 1,
    autonomyLevel: opts.autonomyLevel ?? 3,
    riskCategory: opts.riskCategory ?? "standard",
    blastRadius: opts.blastRadius,
    retryPolicy: opts.retryPolicy ?? { maxAttempts: 3, backoffSeconds: 30 },
    escalationPolicy: opts.escalationPolicy,
  };
  return { id: nanoid(), type: "skill", position, data };
}

/** Create a future-state artifact node with an output contract. */
function artifact(
  fileName: string,
  description: string,
  col: number,
  row: number,
  contract?: OutputContract,
): WorkflowNode {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "other";
  const artifactType = (
    ext === "md" ? "md" :
    ext === "json" ? "json" :
    ext === "yaml" || ext === "yml" ? "yaml" :
    ext === "csv" ? "csv" :
    ext === "xlsx" ? "xlsx" :
    "other"
  ) as ArtifactNodeData["artifactType"];
  const position = { x: 80 + col * 260, y: 80 + row * 160 };
  const data: ArtifactNodeData = {
    name: fileName,
    fileName,
    artifactType,
    status: "unknown",
    description,
    outputContract: contract,
  };
  return { id: nanoid(), type: "artifact", position, data };
}

/** Create a future-state workflow (workflowType: "future_state"). */
function futureWorkflow(name: string, description: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name,
    description,
    workflowType: "future_state",
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    metadata: { graphVersion: "1.0.0" },
  };
}

/** Wire edges using the same rules as the studio (integration ↔ artifact, human links, …). */
function buildTemplateEdges(nodes: WorkflowNode[], links: Array<[number, number] | [number, number, string]>): WorkflowEdge[] {
  const wf: Workflow = {
    id: "template-wiring",
    name: "",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes,
    edges: [],
    metadata: { graphVersion: "1.0.0" },
  };
  const out: WorkflowEdge[] = [];
  for (const spec of links) {
    const from = spec[0];
    const to = spec[1];
    const label = spec.length > 2 ? spec[2] : undefined;
    const A = nodes[from];
    const B = nodes[to];
    if (!A || !B || from === to) continue;
    const e0 = buildInferredEdge(wf, A.id, B.id, id());
    if (!e0) continue;
    const edge = label ? { ...e0, label } : e0;
    out.push(edge);
    wf.edges = [...wf.edges, edge];
  }
  return out;
}

function workflow(name: string, description: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  const now = new Date().toISOString();
  return {
    id: id(),
    name,
    description,
    workflowType: "current_state",
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    metadata: { graphVersion: "1.0.0" },
  };
}

// ─── Template definitions ─────────────────────────────────────────────────────

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  painPoints: string[];
  automationPotential: "high" | "medium" | "low";
  build: () => Workflow;
};

// 1. Invoice Approval
function buildInvoiceApproval(): Workflow {
  const n1 = node("integration", "receive_invoice_email", "Supplier emails invoice as PDF attachment to AP inbox", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const n2 = node("artifact", "invoice.pdf", "Supplier invoice document received by email", 1, 0);
  const n3 = node("human", "download_and_save", "AP clerk downloads PDF from email and saves to shared drive folder", 2, 0, { subtype: "file_movement" });
  const n4 = node("artifact", "invoice_register.xlsx", "Running Excel spreadsheet tracking all invoices received", 3, 0);
  const n5 = node("human", "enter_invoice_data", "AP clerk manually types invoice details into Excel register: supplier, amount, date, PO number", 0, 1, { subtype: "data_entry" });
  const n6 = node("human", "check_po_match", "AP clerk opens separate ERP window to check if PO exists and amounts match — manually compares figures", 1, 1, { subtype: "judgment" });
  const n7 = node("integration", "send_approval_email", "AP clerk emails invoice PDF to department manager with approval request", 2, 1, { subtype: "email_send", system: "Outlook" });
  const n8 = node("human", "manager_approves", "Manager reviews invoice PDF attached to email, replies 'approved' or 'rejected' in email thread", 3, 1, { subtype: "approval" });
  const n9 = node("human", "update_register", "AP clerk updates Excel register with approval status and stamps PDF 'Approved'", 0, 2, { subtype: "data_entry" });
  const n10 = node("human", "process_payment", "AP clerk logs into ERP and manually enters payment details to schedule supplier payment", 1, 2, { subtype: "data_entry" });
  const n11 = node("integration", "send_remittance", "AP clerk sends remittance advice email to supplier", 2, 2, { subtype: "email_send", system: "Outlook" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8, "approved"],
    [8, 9],
    [9, 10],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Invoice Approval (Current State)",
      "Manual AP process: invoices arrive by email, data entered into Excel, manager approves by reply email, payment entered manually into ERP.",
      nodes,
      edges,
    ),
  );
}

// 2. Employee Onboarding
function buildEmployeeOnboarding(): Workflow {
  const n1 = node("human", "hr_creates_onboarding_pack", "HR coordinator manually creates onboarding pack in Word, fills in employee details, prints and scans forms", 0, 0, { subtype: "data_entry" });
  const n2 = node("artifact", "onboarding_pack.docx", "New employee onboarding document with forms, policies, and schedule", 1, 0);
  const n3 = node("integration", "email_welcome_pack", "HR emails onboarding pack PDF to new employee and their manager", 2, 0, { subtype: "email_send", system: "Outlook" });
  const n4 = node("human", "it_creates_accounts", "IT helpdesk manually creates AD account, assigns licences in M365 admin portal, sets up laptop image", 3, 0, { subtype: "data_entry" });
  const n5 = node("human", "setup_system_access", "IT manually adds user to security groups, SharePoint sites, Teams channels, and shared mailboxes based on role", 0, 1, { subtype: "data_entry" });
  const n6 = node("human", "manager_books_induction", "Hiring manager manually books calendar slots for induction meetings, sends invites one by one", 1, 1, { subtype: "communication" });
  const n7 = node("human", "employee_completes_forms", "New employee fills in paper tax forms and bank details, hands to HR in person or scans and emails back", 2, 1, { subtype: "data_entry" });
  const n8 = node("artifact", "signed_forms.pdf", "Completed HR, payroll, and compliance forms from new employee", 3, 1);
  const n9 = node("human", "payroll_data_entry", "Payroll officer manually enters employee details, bank account, and tax info into payroll system", 0, 2, { subtype: "data_entry" });
  const n10 = node("human", "equipment_order", "Office manager emails supplier to order laptop, headset, and desk equipment — tracks in a spreadsheet", 1, 2, { subtype: "communication" });
  const n11 = node("human", "day_one_checklist", "HR walks new employee through checklist on day one, ticks items off a Word doc printed from template", 2, 2, { subtype: "file_movement" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [6, 10],
    [10, 9],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Employee Onboarding (Current State)",
      "Manual onboarding: HR creates paperwork manually, IT sets up accounts by hand, forms signed on paper, payroll keyed in separately.",
      nodes,
      edges,
    ),
  );
}

// 3. Project Intake
function buildProjectIntake(): Workflow {
  const n1 = node("integration", "project_request_email", "Stakeholder emails project request to PMO inbox with description and urgency", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const n2 = node("human", "log_to_register", "PMO coordinator opens project register spreadsheet and manually types in request details", 1, 0, { subtype: "data_entry" });
  const n3 = node("artifact", "project_register.xlsx", "Excel spreadsheet tracking all project requests with status, priority, and owner columns", 2, 0);
  const n4 = node("human", "initial_triage", "PMO manager reads the email, assesses strategic fit and resource availability from memory/experience", 3, 0, { subtype: "judgment" });
  const n5 = node("integration", "request_more_info", "PMO emails stakeholder asking for business case, requirements, and timeline", 0, 1, { subtype: "email_send", system: "Outlook" });
  const n6 = node("artifact", "business_case.docx", "Stakeholder-authored business case document submitted by email reply", 1, 1);
  const n7 = node("human", "create_project_brief", "PMO coordinator manually writes project brief in Word template, copying info from the email and business case", 2, 1, { subtype: "data_entry" });
  const n8 = node("artifact", "project_brief.docx", "Formal project brief with scope, objectives, stakeholders, and high-level plan", 3, 1);
  const n9 = node("human", "steering_committee_review", "Project brief printed and distributed in steering committee meeting — committee discusses and votes", 0, 2, { subtype: "approval" });
  const n10 = node("human", "assign_pm", "PMO manager looks at PM capacity spreadsheet and manually assigns a project manager", 1, 2, { subtype: "judgment" });
  const n11 = node("integration", "notify_stakeholder", "PMO emails stakeholder with decision and assigned PM", 2, 2, { subtype: "email_send", system: "Outlook" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Project Intake (Current State)",
      "Manual PMO intake: requests arrive by email, logged to Excel, briefs written in Word, steering committee approves in meetings.",
      nodes,
      edges,
    ),
  );
}

// 4. Contract Review & Signing
function buildContractReview(): Workflow {
  const n1 = node("integration", "receive_contract", "Legal or procurement receives draft contract from supplier by email", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const n2 = node("artifact", "draft_contract.docx", "Supplier's draft contract document", 1, 0);
  const n3 = node("human", "initial_legal_review", "In-house legal counsel reads contract, marks up changes using Word track changes", 2, 0, { subtype: "judgment" });
  const n4 = node("artifact", "redlined_contract.docx", "Contract with legal team's tracked changes and comments", 3, 0);
  const n5 = node("integration", "email_to_supplier", "Legal emails redlined contract back to supplier requesting changes", 0, 1, { subtype: "email_send", system: "Outlook" });
  const n6 = node("human", "supplier_review_cycle", "Supplier sends revised version — multiple email rounds of back-and-forth on changes (average 3-5 rounds)", 1, 1, { subtype: "communication" });
  const n7 = node("artifact", "final_contract.docx", "Agreed final version of contract ready for signing", 2, 1);
  const n8 = node("human", "management_approval", "Contract printed and walked to authorised signatory for wet signature, or emailed as PDF for DocuSign", 3, 1, { subtype: "approval" });
  const n9 = node("artifact", "signed_contract.pdf", "Fully executed contract with all signatures", 0, 2);
  const n10 = node("human", "file_in_sharepoint", "Paralegal manually uploads signed contract to SharePoint, fills in metadata fields, updates contract register", 1, 2, { subtype: "file_movement" });
  const n11 = node("artifact", "contract_register.xlsx", "Excel spreadsheet tracking all active contracts with expiry dates and renewal flags", 2, 2);
  const n12 = node("human", "diary_renewal_reminder", "Paralegal manually creates calendar reminder for contract expiry 90 days before end date", 3, 2, { subtype: "communication" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 11],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Contract Review & Signing (Current State)",
      "Manual contract process: redlining in Word, email negotiation rounds, wet or DocuSign signatures, manual filing to SharePoint.",
      nodes,
      edges,
    ),
  );
}

// 5. IT Support Ticket Escalation
function buildSupportEscalation(): Workflow {
  const n1 = node("integration", "ticket_arrives", "User emails helpdesk or submits form — lands in shared inbox with no structured routing", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const n2 = node("human", "read_and_classify", "L1 agent reads the email, decides urgency and category manually based on experience", 1, 0, { subtype: "judgment" });
  const n3 = node("human", "log_to_itsm", "L1 agent manually creates ticket in ITSM tool, types in description, selects category and priority", 2, 0, { subtype: "data_entry" });
  const n4 = node("artifact", "support_ticket.json", "Ticket record in ITSM system with ID, category, priority, and description", 3, 0);
  const n5 = node("human", "attempt_resolution", "L1 agent tries to resolve using knowledge base articles — searches manually in separate wiki", 0, 1, { subtype: "judgment" });
  const n6 = node("human", "escalate_to_l2", "L1 agent decides to escalate, emails or Teams messages L2 engineer with ticket number and summary", 1, 1, { subtype: "communication" });
  const n7 = node("human", "l2_investigation", "L2 engineer investigates — may need to remote in, check logs, or contact vendor. Updates ticket manually", 2, 1, { subtype: "judgment" });
  const n8 = node("human", "user_communication", "L2 engineer manually emails user with status update — no template, free-text each time", 3, 1, { subtype: "communication" });
  const n9 = node("human", "resolution_and_close", "Engineer resolves issue, types resolution notes in ITSM, manually changes status to resolved", 0, 2, { subtype: "data_entry" });
  const n10 = node("integration", "notify_user_resolved", "ITSM sends auto-email (if configured) or engineer manually emails user that ticket is resolved", 1, 2, { subtype: "email_send", system: "Outlook" });
  const n11 = node("human", "weekly_report", "Team lead manually exports ticket data from ITSM to Excel, creates pivot tables for weekly management report", 2, 2, { subtype: "data_entry" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5, "needs escalation"],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "IT Support Escalation (Current State)",
      "Manual helpdesk: tickets arrive by email, classified by hand, escalated via Teams, resolution notes typed manually, weekly reports in Excel.",
      nodes,
      edges,
    ),
  );
}

// 6. Sales Quote Approval
function buildSalesQuote(): Workflow {
  const n1 = node("human", "build_quote_in_excel", "Sales rep manually builds quote in Excel spreadsheet — copies pricing from a separate price list, applies discount manually", 0, 0, { subtype: "data_entry" });
  const n2 = node("artifact", "quote_v1.xlsx", "Draft quote Excel file with line items, pricing, and proposed discount", 1, 0);
  const n3 = node("human", "review_margin", "Sales rep checks margin calculation manually — compares to cost price in separate spreadsheet", 2, 0, { subtype: "judgment" });
  const n4 = node("human", "discount_approval", "If discount > 15%, sales rep emails sales manager to request approval with justification typed in email body", 3, 0, { subtype: "approval" });
  const n5 = node("human", "manager_reviews", "Sales manager reads email, reviews attached Excel, replies approve/reject/counter — no formal audit trail", 0, 1, { subtype: "approval" });
  const n6 = node("human", "convert_to_pdf", "Sales rep saves Excel as PDF manually, renames file with customer name and date", 1, 1, { subtype: "file_movement" });
  const n7 = node("artifact", "quote_final.pdf", "Final branded quote PDF ready to send to customer", 2, 1);
  const n8 = node("integration", "email_quote_to_customer", "Sales rep emails quote PDF to customer with covering message written from scratch each time", 3, 1, { subtype: "email_send", system: "Outlook" });
  const n9 = node("human", "log_to_crm", "Sales rep manually updates CRM opportunity with quote value, expected close date, and quote PDF attachment", 0, 2, { subtype: "data_entry" });
  const n10 = node("human", "follow_up_reminder", "Sales rep sets personal calendar reminder to follow up if no response in 5 days", 1, 2, { subtype: "communication" });
  const n11 = node("human", "customer_accepts", "Customer replies by email accepting quote — sales rep has to find original email thread and close the loop manually", 2, 2, { subtype: "approval" });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11];
  const edges = buildTemplateEdges(nodes, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5, "approved"],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Sales Quote Approval (Current State)",
      "Manual quoting: Excel pricing, email-based discount approvals, PDF conversion by hand, CRM updated manually, follow-ups via calendar reminders.",
      nodes,
      edges,
    ),
  );
}

// ─── Future-state template builders ──────────────────────────────────────────

// FS-1. Invoice Processing (AI-automated)
function buildInvoiceProcessingFS(): Workflow {
  const trigger = node("integration", "invoice_email_trigger", "New invoice email with PDF attachment arrives in AP inbox", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const raw = artifact("invoice.pdf", "Supplier invoice PDF received from email", 1, 0, {
    format: "any",
    requiredFields: ["vendor_name", "invoice_number", "amount", "invoice_date"],
    validationNote: "Must be a readable PDF (digital or scanned). Minimum fields detectable by OCR before extraction proceeds.",
  });
  const extract = skill("pdf_extraction", "Extract structured invoice data from PDF — handle digital and scanned PDFs", 2, 0, {
    intent: "Extract all invoice fields: vendor, amount, currency, date, line items, PO number. Handle both digital and scanned PDFs. Output structured JSON.",
    inputs: ["invoice.pdf"],
    outputs: ["extracted.json"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./input/", "./working/"], blockedPaths: ["./output/", "./vault/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 15, correctivePrompt: "Ensure all required fields are present. If scanned, try a different OCR approach. Output must be valid JSON." },
    tags: ["extraction", "pdf", "ocr"],
    category: "Data Extraction",
  });
  const extracted = artifact("extracted.json", "Structured invoice data extracted from PDF", 3, 0, {
    format: "json",
    requiredFields: ["vendor_name", "amount", "currency", "invoice_date", "invoice_number", "line_items"],
    validationNote: "All monetary and identity fields must be present. line_items must be an array with at least one entry.",
  });
  const validate = skill("po_matching_validation", "Match invoice against ERP purchase orders and validate amounts", 0, 1, {
    intent: "Query ERP for matching PO by PO number. Validate: amounts match within 2%, vendor name matches, items match. Flag discrepancies.",
    inputs: ["extracted.json"],
    outputs: ["validation-report.json"],
    autonomyLevel: 3,
    riskCategory: "financial",
    blastRadius: { allowedPaths: ["./working/"], allowedApis: ["erp-api/purchase-orders"], noNetworkAccess: false },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 30, correctivePrompt: "If PO not found, set po_match: false with reason. Do not invent data. Confidence score required." },
    escalationPolicy: { afterFailures: 2, escalateTo: "ap-manager", escalationNote: "PO matching failed after retries — manual review required" },
    tags: ["validation", "erp", "po-matching"],
    category: "Validation",
  });
  const validationReport = artifact("validation-report.json", "PO match result, discrepancy flags, confidence score", 1, 1, {
    format: "json",
    requiredFields: ["po_match", "confidence_score", "discrepancies", "recommendation"],
    validationNote: "confidence_score must be 0-1. discrepancies must be an array (empty if none). recommendation must be approve | reject | escalate.",
  });
  const approval = node("human", "finance_approval", "Finance approves invoice posting — required for all invoices per company policy", 2, 1, { subtype: "approval" });
  const post = skill("erp_posting", "Post approved invoice to ERP and schedule payment run", 3, 1, {
    intent: "Create invoice record in ERP with all extracted fields. Attach PDF. Schedule payment per payment terms. Output confirmation with ERP invoice ID.",
    inputs: ["extracted.json", "validation-report.json"],
    outputs: ["erp-confirmation.json"],
    autonomyLevel: 1,
    riskCategory: "financial",
    blastRadius: { allowedPaths: ["./output/"], allowedApis: ["erp-api/invoices", "erp-api/payments"] },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 60, correctivePrompt: "If ERP returns error, log full response and do not retry payment scheduling. Human review required." },
    escalationPolicy: { afterFailures: 1, escalateTo: "ap-manager", escalationNote: "ERP posting failed — do not retry payment without human sign-off" },
    tags: ["erp", "posting", "payment"],
    category: "System Integration",
  });
  const confirmation = artifact("erp-confirmation.json", "ERP invoice ID, payment schedule, posting timestamp", 2, 1, {
    format: "json",
    requiredFields: ["erp_invoice_id", "payment_date", "posted_at", "status"],
    validationNote: "status must be posted. erp_invoice_id must be a non-empty string.",
  });
  const notify = node("integration", "remittance_email", "Automated remittance advice sent to supplier", 3, 1, { subtype: "email_send", system: "Outlook" });

  const nodes = [trigger, raw, extract, extracted, validate, validationReport, approval, post, confirmation, notify];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6, "approved"],
    [6, 7], [7, 8], [8, 9],
  ]);
  return futureWorkflow(
    "Invoice Processing (AI-Automated)",
    "Contracts-first invoice pipeline: PDF extraction with output contracts, PO matching, Level 1 finance approval gate, ERP posting with blast radius enforcement.",
    nodes, edges,
  );
}

// FS-2. Employee Onboarding (AI-automated)
function buildEmployeeOnboardingFS(): Workflow {
  const trigger = node("integration", "hr_system_trigger", "Offer letter countersigned event from HR system", 0, 0, { subtype: "form_submit", system: "Workday" });
  const offerLetter = artifact("offer-letter.pdf", "Signed offer letter from HR system", 1, 0, {
    format: "any",
    requiredFields: ["employee_name", "role_title", "start_date", "manager_name", "department"],
    validationNote: "PDF must contain all five fields for extraction to succeed. Source: HR onboarding system or signed DocuSign envelope.",
  });
  const extract = skill("employee_data_extraction", "Extract all onboarding fields from offer letter and HR system record", 2, 0, {
    intent: "Extract: legal name, preferred name, personal email, start date, role title, department, manager email, employment type, location. Validate against HR system record.",
    inputs: ["offer-letter.pdf"],
    outputs: ["employee-profile.json"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: false, allowedApis: ["hr-api/employees"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 15, correctivePrompt: "All required fields must be present. If ambiguous, use the HR system record as authoritative source." },
    tags: ["extraction", "hr", "onboarding"],
    category: "Data Extraction",
  });
  const profile = artifact("employee-profile.json", "Validated employee master record for onboarding", 3, 0, {
    format: "json",
    requiredFields: ["legal_name", "preferred_name", "personal_email", "start_date", "role_title", "department", "manager_email", "employment_type"],
    validationNote: "start_date must be ISO 8601. personal_email must match email pattern. All fields required.",
  });
  const provision = skill("account_provisioning", "Create Microsoft 365 / Google Workspace accounts and assign licence", 0, 1, {
    intent: "Create accounts using standard naming convention ({first}.{last}@company.com). Assign role-appropriate licence. Set initial password. Output provisioned account details.",
    inputs: ["employee-profile.json"],
    outputs: ["provisioned-accounts.json"],
    autonomyLevel: 2,
    riskCategory: "customer_facing",
    blastRadius: { allowedApis: ["microsoft-graph/users", "microsoft-graph/licences"], noNetworkAccess: false },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30, correctivePrompt: "If account creation fails due to name conflict, append department code suffix. Log all API responses." },
    escalationPolicy: { afterFailures: 3, escalateTo: "it-admin", escalationNote: "Account provisioning failed after 3 attempts — manual IT intervention required" },
    tags: ["provisioning", "m365", "accounts"],
    category: "System Integration",
  });
  const accounts = artifact("provisioned-accounts.json", "Work email, account IDs, licence assigned, temporary password token", 1, 1, {
    format: "json",
    requiredFields: ["work_email", "user_id", "licence_assigned", "provisioned_at"],
    validationNote: "work_email must be @company.com domain. licence_assigned must match employee type.",
  });
  const access = skill("role_access_setup", "Assign security groups, SharePoint sites, and application access based on role", 1, 1, {
    intent: "Read role_title and department from profile. Look up access matrix. Assign appropriate security groups, SharePoint sites, Teams channels, and application permissions.",
    inputs: ["employee-profile.json", "provisioned-accounts.json"],
    outputs: ["access-report.json"],
    autonomyLevel: 2,
    riskCategory: "customer_facing",
    blastRadius: { allowedApis: ["microsoft-graph/groups", "microsoft-graph/sites", "microsoft-graph/teams"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30, correctivePrompt: "Log each group assignment separately. If a group assignment fails, continue with others and report failures." },
    tags: ["access", "groups", "sharepoint"],
    category: "System Integration",
  });
  const accessReport = artifact("access-report.json", "Security groups assigned, SharePoint sites, Teams channels, app permissions", 2, 1, {
    format: "json",
    requiredFields: ["groups_assigned", "sharepoint_sites", "teams_channels", "completed_at"],
    validationNote: "All arrays must be present (empty array is acceptable if no assignments in that category).",
  });
  const welcome = skill("onboarding_pack_assembly", "Generate personalised welcome email and Day 1 checklist", 2, 1, {
    intent: "Compose a warm, personalised welcome email using employee name, role, start date, manager name. Attach Day 1 checklist with IT setup steps, login credentials instructions, and first-week schedule. Tone: professional but human.",
    inputs: ["employee-profile.json", "provisioned-accounts.json", "access-report.json"],
    outputs: ["welcome-email.md", "day1-checklist.md"],
    autonomyLevel: 3,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./output/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 10, correctivePrompt: "Email must be warm and specific to this employee. Checklist must include login URL and IT support contact." },
    tags: ["communication", "welcome", "onboarding"],
    category: "Communication",
  });
  const reviewGate = node("human", "manager_review", "Manager reviews welcome pack and approves send — verifies start date and role details", 3, 1, { subtype: "approval" });
  const sendEmail = node("integration", "send_welcome_email", "Welcome email sent to new employee personal address; IT confirmation to manager", 0, 2, { subtype: "email_send", system: "Outlook" });

  const nodes = [trigger, offerLetter, extract, profile, provision, accounts, access, accessReport, welcome, reviewGate, sendEmail];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9, "approved"], [9, 10],
  ]);
  return futureWorkflow(
    "Employee Onboarding (AI-Automated)",
    "End-to-end onboarding: data extraction with contracts, M365 provisioning with blast radius, access matrix assignment, personalised welcome pack generation, manager approval gate.",
    nodes, edges,
  );
}

// FS-3. Contract Review (AI-automated)
function buildContractReviewFS(): Workflow {
  const trigger = node("integration", "contract_email_trigger", "Contract received via email from counterparty or DocuSign", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const rawContract = artifact("contract-raw.pdf", "Unsigned contract document as received", 1, 0, {
    format: "any",
    requiredFields: ["party_a", "party_b", "effective_date", "governing_law"],
    validationNote: "Must be a readable PDF with identifiable parties. Acceptable sources: email attachment, DocuSign, SharePoint. Scanned contracts require OCR pre-processing.",
  });
  const extract = skill("contract_nlp_extraction", "Extract all material terms, parties, dates, and financial obligations from contract", 2, 0, {
    intent: "Extract: party names, effective date, termination date, auto-renewal clauses, payment terms, liability cap, governing law, key obligations, IP ownership, non-compete/non-solicit terms. Flag any non-standard clauses.",
    inputs: ["contract-raw.pdf"],
    outputs: ["contract-analysis.json"],
    autonomyLevel: 3,
    riskCategory: "legal",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 20, correctivePrompt: "Use section headings to locate clauses. If a field is absent from the contract, set it to null — do not infer. Flag all deviations from standard terms explicitly." },
    tags: ["nlp", "contract", "extraction", "legal"],
    category: "Data Extraction",
  });
  const analysis = artifact("contract-analysis.json", "Structured extraction of all material contract terms", 3, 0, {
    format: "json",
    requiredFields: ["party_a", "party_b", "effective_date", "termination_date", "payment_terms", "liability_cap", "governing_law", "auto_renewal"],
    validationNote: "Dates must be ISO 8601 or null. liability_cap must be numeric or null. All fields present.",
  });
  const riskFlag = skill("risk_flagging", "Compare extracted terms against standard playbook, produce risk-graded report", 0, 1, {
    intent: "Compare each extracted clause against the standard terms playbook. Flag deviations as LOW/MEDIUM/HIGH risk. For HIGH risk: explain the risk and provide suggested standard language. Output markdown report.",
    inputs: ["contract-analysis.json"],
    outputs: ["risk-report.md"],
    autonomyLevel: 3,
    riskCategory: "legal",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 20, correctivePrompt: "Every deviation must have a risk rating (LOW/MEDIUM/HIGH). HIGH risk items must include suggested alternative language. Do not skip clauses." },
    tags: ["risk", "legal", "playbook"],
    category: "Analysis",
  });
  const riskReport = artifact("risk-report.md", "Risk-graded analysis with deviations and suggested language", 1, 1, {
    format: "markdown",
    requiredFields: ["risk_level", "deviations", "high_risk_items", "recommendations"],
    validationNote: "risk_level must be LOW/MEDIUM/HIGH in frontmatter. deviations array must list each non-standard term.",
  });
  const legalReview = node("human", "legal_review", "Legal reviews risk report and approves negotiation strategy — required for MEDIUM/HIGH risk", 2, 1, { subtype: "judgment" });
  const redline = skill("redline_generation", "Generate tracked-changes redline document with negotiation positions", 3, 1, {
    intent: "Apply approved negotiation positions from risk report to contract. Generate a Word document with tracked changes. For each HIGH risk item, insert standard language. For MEDIUM risk items, annotate with comments.",
    inputs: ["contract-raw.pdf", "risk-report.md"],
    outputs: ["contract-redlined.md"],
    autonomyLevel: 2,
    riskCategory: "legal",
    blastRadius: { allowedPaths: ["./output/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 30, correctivePrompt: "Every HIGH risk item from the risk report must appear as a tracked change. Every MEDIUM risk item must have a comment. Do not modify LOW risk items without instruction." },
    escalationPolicy: { afterFailures: 2, escalateTo: "legal-team", escalationNote: "Redline generation failed — legal team must produce manually" },
    tags: ["redline", "negotiation", "legal"],
    category: "Document Generation",
  });
  const redlined = artifact("contract-redlined.md", "Redlined contract with tracked changes and negotiation comments", 0, 2, {
    format: "markdown",
    requiredFields: ["tracked_changes_count", "comments_count", "risk_items_addressed"],
    validationNote: "Must report count of tracked changes and comments in frontmatter. risk_items_addressed must match HIGH risk count from risk-report.",
  });
  const finalApproval = node("human", "final_signoff", "Legal and business sign-off on redlined contract before sending to counterparty", 1, 2, { subtype: "approval" });
  const signing = node("integration", "docusign_send", "Approved contract sent via DocuSign for counterparty signature", 2, 2, { subtype: "other", system: "DocuSign" });

  const nodes = [trigger, rawContract, extract, analysis, riskFlag, riskReport, legalReview, redline, redlined, finalApproval, signing];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6, "approved"],
    [6, 7], [7, 8], [8, 9, "approved"], [9, 10],
  ]);
  return futureWorkflow(
    "Contract Review (AI-Automated)",
    "Legal-grade contract pipeline: NLP extraction, risk-flagged analysis against playbook, human legal review gate, AI redlining with tracked changes, DocuSign delivery.",
    nodes, edges,
  );
}

// FS-4. IT Support (AI-automated)
function buildSupportEscalationFS(): Workflow {
  const trigger = node("integration", "support_email_trigger", "Support request arrives by email or ticketing system webhook", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const rawTicket = artifact("raw-ticket.txt", "Unstructured support request text", 1, 0, {
    format: "any",
    requiredFields: ["user_email", "issue_description"],
    validationNote: "Plain text extracted from email body or ticketing webhook. Must contain at minimum a user identifier and issue description. Minimum 10 words.",
  });
  const classify = skill("ticket_classification", "Parse support request, classify category and priority, extract key details", 2, 0, {
    intent: "Classify the support request into category (hardware/software/access/network/other), priority (P1-P4 by impact and urgency), extract: user email, affected system, error message/description, steps already tried. Suggest resolution based on KB.",
    inputs: ["raw-ticket.txt"],
    outputs: ["ticket.json"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: false, allowedApis: ["kb-api/search"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "Category must be one of: hardware/software/access/network/other. Priority must be P1-P4. suggested_resolution is required even if it is 'Requires L2 investigation'." },
    tags: ["classification", "support", "nlp"],
    category: "Classification",
  });
  const ticket = artifact("ticket.json", "Structured ticket with category, priority, user details, KB suggestion", 1, 1, {
    format: "json",
    requiredFields: ["category", "priority", "user_email", "issue_summary", "suggested_resolution", "requires_l2"],
    validationNote: "priority must be P1/P2/P3/P4. requires_l2 must be boolean.",
  });
  const resolve = skill("auto_resolution_attempt", "Attempt automated resolution for known issue patterns", 2, 1, {
    intent: "For P3/P4 tickets in the software/access categories: attempt automated resolution using runbooks. Try password reset for access issues. Try service restart for known software issues. Document all steps taken and outcome.",
    inputs: ["ticket.json"],
    outputs: ["resolution-attempt.md"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], allowedApis: ["it-api/password-reset", "it-api/service-restart"] },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 30, correctivePrompt: "Document every step attempted. If resolution is not possible automatically, set resolved: false with clear reason. Do not claim success without verification." },
    tags: ["resolution", "automation", "runbook"],
    category: "Resolution",
  });
  const attempt = artifact("resolution-attempt.md", "Steps attempted, outcome, resolution status, time taken", 2, 1, {
    format: "markdown",
    requiredFields: ["resolved", "steps_taken", "outcome", "escalate_to_l2"],
    validationNote: "resolved must be boolean in frontmatter. steps_taken must be a non-empty array.",
  });
  const l2Review = node("human", "l2_engineer_review", "L2 engineer reviews unresolved tickets — picks up where auto-resolution left off", 3, 1, { subtype: "judgment" });
  const document = skill("resolution_documentation", "Write KB article from resolved ticket for future auto-resolution", 0, 2, {
    intent: "After resolution (auto or L2), write a structured KB article: problem description, root cause, resolution steps, prevention. Use clear language suitable for Level 1 engineers. Tag with affected system and category.",
    inputs: ["ticket.json", "resolution-attempt.md"],
    outputs: ["kb-article.md"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./output/kb/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "KB article must have: title, problem description, root_cause, resolution_steps (numbered), prevention. Suitable for a Level 1 engineer to follow." },
    tags: ["kb", "documentation", "knowledge-management"],
    category: "Documentation",
  });
  const kbArticle = artifact("kb-article.md", "Reusable knowledge base article for future resolution", 1, 2, {
    format: "markdown",
    requiredFields: ["title", "category", "affected_system", "root_cause", "resolution_steps"],
    validationNote: "resolution_steps must be a numbered list. root_cause must be non-empty.",
  });
  const notify = node("integration", "resolution_notification", "Resolution email sent to user; KB article posted to IT knowledge base", 2, 2, { subtype: "email_send", system: "Outlook" });

  const nodes = [trigger, rawTicket, classify, ticket, resolve, attempt, l2Review, document, kbArticle, notify];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
    [5, 6, "escalate"], [5, 7, "resolved"],
    [6, 7], [7, 8], [8, 9],
  ]);
  return futureWorkflow(
    "IT Support Escalation (AI-Automated)",
    "Intelligent support pipeline: NLP ticket classification, auto-resolution from runbooks, L2 escalation gate, KB article generation from every resolved ticket.",
    nodes, edges,
  );
}

// FS-5. Sales Quote (AI-automated)
function buildSalesQuoteFS(): Workflow {
  const trigger = node("integration", "crm_quote_trigger", "Quote request created in CRM by sales rep", 0, 0, { subtype: "form_submit", system: "Salesforce" });
  const quoteRequest = artifact("quote-request.json", "Quote request with customer ID, products, requested quantities, target close date", 1, 0, {
    format: "json",
    requiredFields: ["customer_id", "opportunity_id", "line_items", "requested_discount_pct"],
    validationNote: "All fields required. line_items must be non-empty array.",
  });
  const price = skill("pricing_and_data_extraction", "Retrieve customer history, apply pricing rules, calculate margin", 2, 0, {
    intent: "Look up customer pricing tier from CRM. Apply current price list. Calculate volume discounts. Compute line-item totals, subtotal, tax, grand total. Calculate gross margin percentage. Flag if margin < 20%.",
    inputs: ["quote-request.json"],
    outputs: ["quote-data.json"],
    autonomyLevel: 3,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./working/"], allowedApis: ["crm-api/customers", "pricing-api/rates"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 20, correctivePrompt: "margin_pct is required and must be a number. All pricing must come from the pricing API — never hardcode rates. If API fails, exit with error rather than using stale data." },
    tags: ["pricing", "crm", "calculation"],
    category: "Data Processing",
  });
  const quoteData = artifact("quote-data.json", "Priced quote with line items, totals, margin, discount breakdown", 3, 0, {
    format: "json",
    requiredFields: ["customer_id", "line_items", "subtotal", "discount_pct", "total", "margin_pct", "currency"],
    validationNote: "margin_pct must be numeric. total must equal subtotal minus discount. currency required.",
  });
  const discountCheck = skill("discount_validation", "Validate discount against margin thresholds and approval policy", 0, 1, {
    intent: "Check: if discount_pct > 15% OR margin_pct < 20%, set requires_approval: true with reason. Otherwise set requires_approval: false. Output clear recommendation with business justification.",
    inputs: ["quote-data.json"],
    outputs: ["discount-check.json"],
    autonomyLevel: 3,
    riskCategory: "financial",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 10, correctivePrompt: "requires_approval must be boolean. If true, reason must be specific (e.g. 'discount 18% exceeds 15% threshold'). Do not approve exceptions automatically." },
    tags: ["discount", "approval", "financial"],
    category: "Validation",
  });
  const discountResult = artifact("discount-check.json", "Approval flag, threshold breach details, recommendation", 1, 1, {
    format: "json",
    requiredFields: ["requires_approval", "reason", "recommended_action"],
    validationNote: "requires_approval must be boolean. reason must be non-empty when requires_approval is true.",
  });
  const managerApproval = node("human", "manager_discount_approval", "Sales manager approves discount exception — reviews margin impact and justification", 2, 1, { subtype: "approval" });
  const generatePdf = skill("quote_pdf_generation", "Generate branded, print-ready quote PDF with all commercial terms", 3, 1, {
    intent: "Generate a professionally formatted quote PDF: company branding, customer details, itemised pricing table, payment terms, validity period, T&Cs reference. Use current brand template. Output a clean, customer-facing document.",
    inputs: ["quote-data.json"],
    outputs: ["quote.pdf"],
    autonomyLevel: 3,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./output/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 15, correctivePrompt: "PDF must include: company logo, customer name, all line items with unit prices, total, payment terms, quote validity date. Use professional language." },
    tags: ["pdf", "quote", "generation"],
    category: "Document Generation",
  });
  const quotePdf = artifact("quote.pdf", "Branded quote PDF ready for customer delivery", 0, 2, {
    format: "any",
    requiredFields: ["quote_number", "valid_until", "total_amount"],
    validationNote: "Quote number, validity date, and total amount must all be present in the document.",
  });
  const deliver = skill("crm_update_and_delivery", "Update CRM opportunity and send quote to customer", 1, 2, {
    intent: "Update Salesforce opportunity: stage to Proposal Delivered, amount to quote total, close date. Log quote activity. Send quote email to primary contact with personalised covering message. Set follow-up task for 5 business days.",
    inputs: ["quote.pdf", "quote-data.json"],
    outputs: ["delivery-confirmation.json"],
    autonomyLevel: 2,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./output/"], allowedApis: ["crm-api/opportunities", "crm-api/activities", "crm-api/tasks"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30, correctivePrompt: "CRM update must happen before email send. Log each API call. If email send fails, do not mark as delivered — report failure." },
    escalationPolicy: { afterFailures: 3, escalateTo: "sales-ops", escalationNote: "CRM update or email delivery failed — sales ops must intervene" },
    tags: ["crm", "delivery", "salesforce"],
    category: "System Integration",
  });
  const confirmation = artifact("delivery-confirmation.json", "CRM update status, email delivery status, follow-up task ID", 2, 2, {
    format: "json",
    requiredFields: ["crm_updated", "email_sent", "followup_task_id", "delivered_at"],
    validationNote: "crm_updated and email_sent must both be true for successful delivery.",
  });

  const nodes = [trigger, quoteRequest, price, quoteData, discountCheck, discountResult, managerApproval, generatePdf, quotePdf, deliver, confirmation];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
    [5, 6, "requires approval"], [5, 7, "auto-approved"],
    [6, 7, "approved"], [7, 8], [8, 9], [9, 10],
  ]);
  return futureWorkflow(
    "Sales Quote (AI-Automated)",
    "Contract-driven quoting: live pricing from CRM, margin validation, discount approval gate, branded PDF generation, automated CRM update and delivery with follow-up task.",
    nodes, edges,
  );
}

// FS-6. PDF → Obsidian Knowledge Ingestion
function buildPdfToObsidianFS(): Workflow {
  const trigger = node("integration", "file_watch_trigger", "New PDF detected in ./input/ directory by file watcher", 0, 0, { subtype: "form_submit", system: "File System" });
  const inputPdf = artifact("input.pdf", "Source PDF document to ingest into knowledge vault", 1, 0, {
    format: "any",
    requiredFields: ["title", "page_count"],
    validationNote: "Any readable PDF. Minimum 1 page. title inferred from filename if not present in metadata. Scanned PDFs acceptable — OCR will be applied during extraction.",
  });
  const extract = skill("pdf_text_extraction", "Extract full text from PDF preserving heading hierarchy and structure", 2, 0, {
    intent: "Extract all text from PDF. Preserve heading levels (H1/H2/H3) using markdown syntax. Detect and flag tables, code blocks, and footnotes. Record metadata: page count, file SHA-256, detected language, extractor used.",
    inputs: ["input.pdf"],
    outputs: ["extracted.md"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], blockedPaths: ["./vault/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "Frontmatter must include source_sha256, page_count, and extractor_used. If OCR required, note this in extractor_used. Preserve all heading structure." },
    tags: ["extraction", "pdf", "markdown"],
    category: "Data Extraction",
  });
  const extracted = artifact("extracted.md", "Full text extraction with preserved structure and frontmatter metadata", 3, 0, {
    format: "markdown",
    requiredFields: ["source_sha256", "page_count", "extractor_used", "language"],
    validationNote: "Frontmatter must have all 4 fields. source_sha256 must be a 64-char hex string.",
  });
  const chunk = skill("semantic_chunking", "Split extracted text into semantically coherent atomic chunks", 0, 1, {
    intent: "Split the document into atomic knowledge chunks of 200-600 words each. Chunk at natural boundaries: section headings, paragraph breaks. Preserve context: each chunk should be self-contained and understandable without surrounding chunks. Assign each chunk a stable ID based on content hash.",
    inputs: ["extracted.md"],
    outputs: ["chunks-manifest.json"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "No chunk should be under 100 words or over 800 words. Each chunk must have: id, title, content, word_count, source_page. Write chunks to ./working/chunks/ directory." },
    tags: ["chunking", "nlp", "knowledge"],
    category: "Processing",
  });
  const chunksManifest = artifact("chunks-manifest.json", "Index of all chunks with IDs, titles, word counts, source page references", 1, 1, {
    format: "json",
    requiredFields: ["total_chunks", "source_file", "chunks"],
    validationNote: "chunks array must be non-empty. Each chunk entry must have id, title, word_count, file_path.",
  });
  const frontmatter = skill("frontmatter_generation", "Generate Obsidian-compatible YAML frontmatter and wikilinks for each chunk", 1, 1, {
    intent: "For each chunk: generate YAML frontmatter with tags (topic-based), aliases, source metadata, created date. Identify internal links to other chunks in the batch (using wikilink syntax [[ChunkTitle]]). Generate a descriptive filename in kebab-case.",
    inputs: ["chunks-manifest.json"],
    outputs: ["enriched-chunks-manifest.json"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "Every chunk file must have: tags array, source field, created date. Filenames must be kebab-case. Internal links must use [[FileName]] syntax." },
    tags: ["frontmatter", "obsidian", "metadata"],
    category: "Processing",
  });
  const enriched = artifact("enriched-chunks-manifest.json", "All chunks with frontmatter, wikilinks, and final filenames", 2, 1, {
    format: "json",
    requiredFields: ["total_chunks", "vault_subfolder", "chunks"],
    validationNote: "Each chunk must have frontmatter_yaml, filename, and wikilinks array. vault_subfolder must be set.",
  });
  const vaultWrite = skill("obsidian_vault_write", "Write all enriched chunks to Obsidian vault folder structure", 2, 1, {
    intent: "Write each chunk as a .md file into the target vault subfolder. Create the subfolder if it doesn't exist. Write a vault-index.md file linking all chunks. Do not overwrite existing files — append version suffix if file exists.",
    inputs: ["enriched-chunks-manifest.json"],
    outputs: ["vault-index.md"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./vault/"], blockedPaths: ["./input/", "./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 10, correctivePrompt: "Never overwrite existing vault files without a version suffix. Confirm each file write with the count of bytes written. vault-index.md must link to every chunk with [[wikilink]]." },
    tags: ["obsidian", "vault", "writing"],
    category: "Output",
  });
  const vaultIndex = artifact("vault-index.md", "Master index note in Obsidian vault linking all ingested chunks", 3, 1, {
    format: "markdown",
    requiredFields: ["source_title", "total_chunks", "vault_path", "ingested_at", "tags"],
    validationNote: "Must contain a wikilink [[]] for every chunk in the manifest. total_chunks must match manifest.",
  });

  const nodes = [trigger, inputPdf, extract, extracted, chunk, chunksManifest, frontmatter, enriched, vaultWrite, vaultIndex];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  ]);
  return futureWorkflow(
    "PDF → Obsidian Knowledge Ingestion",
    "Fully autonomous knowledge pipeline: PDF extraction with structural preservation, semantic chunking, Obsidian frontmatter generation with wikilinks, vault writing. Zero human steps. Blast-radius contained to vault folder.",
    nodes, edges,
  );
}


// 7. Email Triage & Response Routing (current state)
function buildEmailTriage(): Workflow {
  const n0 = node("integration", "email_arrives", "Emails land in shared inbox — sales@, support@, info@ — mixed from customers, suppliers, and spam", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const n1 = node("human", "read_and_decide", "Team member opens each email, reads, and manually decides: sales inquiry / support request / billing / junk / forward elsewhere", 1, 0, { subtype: "judgment", minutesPerOccurrence: 4, occurrencesPerWeek: 75 });
  const n2 = node("artifact", "email_register.xlsx", "Spreadsheet tracking high-priority emails that need follow-up — updated inconsistently", 2, 0);
  const n3 = node("human", "write_reply", "Team member writes response from scratch — no templates, tone varies by person, no SLA tracking", 3, 0, { subtype: "data_entry", minutesPerOccurrence: 12, occurrencesPerWeek: 40 });
  const n4 = node("integration", "send_reply", "Reply sent manually from shared inbox — no logging, no threading standard", 0, 1, { subtype: "email_send", system: "Outlook" });
  const n5 = node("human", "forward_to_team", "Complex or escalated emails manually forwarded to sales rep, support engineer, or manager with brief note", 1, 1, { subtype: "approval", minutesPerOccurrence: 5, occurrencesPerWeek: 20 });
  const n6 = node("human", "weekly_report", "Office manager manually counts email volumes in the Excel register and writes a weekly summary email to management", 2, 1, { subtype: "data_entry", minutesPerOccurrence: 45, occurrencesPerWeek: 1 });

  const nodes = [n0, n1, n2, n3, n4, n5, n6];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [1, 3], [3, 4], [1, 5], [2, 6],
  ]);
  return syncSkillContractsFromGraph(
    workflow(
      "Email Triage & Response Routing (Current State)",
      "Shared inbox process: manual reading and sorting, replies written from scratch, inconsistent forwarding, no SLA, weekly report compiled manually. Every company has this problem.",
      nodes,
      edges,
    ),
  );
}

// FS-7. Email Triage & Response Routing (AI-automated)
function buildEmailTriageFS(): Workflow {
  const trigger = node("integration", "inbox_trigger", "New email arrives in shared inbox — webhook or polling trigger fires immediately", 0, 0, { subtype: "email_receive", system: "Outlook" });
  const rawEmail = artifact("raw-email.json", "Raw email content: subject, body, sender, attachments metadata, received timestamp", 1, 0, {
    format: "json",
    requiredFields: ["subject", "body", "sender_email", "received_at", "thread_id"],
    validationNote: "All fields required. body must be non-empty. received_at must be ISO 8601.",
  });
  const classify = skill("email_classification", "Classify email intent, urgency, and route to appropriate handler", 2, 0, {
    intent: "Classify the email into: category (sales_inquiry | support_request | billing_query | complaint | internal | spam | other), urgency (P1-P4), sentiment (positive/neutral/negative/urgent). Extract: key ask or question, relevant customer ID if identifiable, estimated reply time needed. Set requires_human: true for complaints, legal mentions, or high-value sales. Output routing decision.",
    inputs: ["raw-email.json"],
    outputs: ["classification.json"],
    autonomyLevel: 3,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 5, correctivePrompt: "category must be one of the listed values. urgency must be P1-P4. requires_human must be boolean. Do not classify legal or complaint emails as anything except their true category." },
    tags: ["classification", "routing", "email", "nlp"],
    category: "Classification",
  });
  const classification = artifact("classification.json", "Email category, urgency, sentiment, routing decision, requires_human flag", 2, 0, {
    format: "json",
    requiredFields: ["category", "urgency", "sentiment", "requires_human", "routing_target", "key_ask"],
    validationNote: "category must be one of the defined enum values. urgency must be P1/P2/P3/P4. requires_human must be boolean.",
  });
  const draftReply = skill("reply_drafting", "Draft a professional, on-brand reply using category-specific templates and context", 1, 1, {
    intent: "Using the email classification and category, draft a reply that: answers the key ask directly, maintains professional and friendly tone, includes appropriate next steps or follow-up. Use the template for this category as a starting point but personalise based on the email content. For support requests: include ticket reference placeholder. For sales: include a call-to-action. Do not invent facts — use placeholders [TEAM_MEMBER_NAME] for items needing personalisation.",
    inputs: ["raw-email.json", "classification.json"],
    outputs: ["draft-reply.md"],
    autonomyLevel: 3,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./working/"], noNetworkAccess: true },
    retryPolicy: { maxAttempts: 2, backoffSeconds: 10, correctivePrompt: "Reply must directly address the key_ask from classification.json. Do not use hollow corporate language. Tone must match sentiment — empathetic for complaints, enthusiastic for sales. Include a clear next step." },
    tags: ["drafting", "email", "communication"],
    category: "Communication",
  });
  const draftReplyDoc = artifact("draft-reply.md", "Drafted email reply ready for auto-send or human review", 1, 1, {
    format: "markdown",
    requiredFields: ["subject_line", "greeting", "body", "sign_off"],
    validationNote: "Must include subject_line in frontmatter. Body must be at least 2 sentences. No placeholder variables may remain if requires_human is false.",
  });
  const humanReview = node("human", "review_and_send", "Human reviews draft reply for complaints, sales over threshold, and P1/P2 tickets — approves or edits before send", 2, 1, { subtype: "approval" });
  const logTicket = skill("crm_ticket_logging", "Create or update CRM record and support ticket with email thread and classification", 3, 1, {
    intent: "Create a support/CRM record for this email: log sender details, classification, key ask, draft reply, timestamp. For support_request: create ticket with priority matching urgency. For sales_inquiry: create or update opportunity. Link email thread ID for full context. Set follow-up reminder based on urgency: P1=4hrs, P2=24hrs, P3=48hrs, P4=5 days.",
    inputs: ["raw-email.json", "classification.json", "draft-reply.md"],
    outputs: ["ticket-log.json"],
    autonomyLevel: 2,
    riskCategory: "customer_facing",
    blastRadius: { allowedPaths: ["./output/"], allowedApis: ["crm-api/tickets", "crm-api/opportunities", "crm-api/contacts"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 15, correctivePrompt: "ticket_id is required in output. follow_up_due must be set based on urgency tier. If CRM API returns error, log and retry — do not skip logging." },
    tags: ["crm", "ticketing", "logging"],
    category: "System Integration",
  });
  const ticketLog = artifact("ticket-log.json", "CRM/ticket record ID, follow-up due date, classification summary", 2, 1, {
    format: "json",
    requiredFields: ["ticket_id", "crm_record_id", "follow_up_due", "category", "urgency"],
    validationNote: "ticket_id and crm_record_id must be non-empty strings. follow_up_due must be ISO 8601.",
  });
  const sendReply = node("integration", "auto_send_reply", "Approved or auto-approved reply sent via Outlook — reply-to-thread preserving context", 0, 2, { subtype: "email_send", system: "Outlook" });
  const report = skill("daily_inbox_digest", "Compile daily inbox digest: volumes by category, SLA performance, unresolved threads", 3, 0, {
    intent: "Each day at 08:00: query ticket logs for the past 24 hours. Compute: total emails, by-category breakdown, average response time, P1/P2 SLA breach count, unresolved over 48hrs. Format as a clean HTML email digest for the team. Flag any threads unresolved for > urgency SLA.",
    inputs: ["ticket-log.json"],
    outputs: ["inbox-digest.md"],
    autonomyLevel: 3,
    riskCategory: "standard",
    blastRadius: { allowedPaths: ["./output/"], noNetworkAccess: false, allowedApis: ["crm-api/tickets"] },
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30, correctivePrompt: "Digest must include total_emails, breakdown_by_category (object), avg_response_minutes, sla_breach_count, and unresolved_threads list. If no data, send a '0 emails received' digest — do not skip." },
    tags: ["reporting", "digest", "analytics"],
    category: "Reporting",
  });
  const digest = artifact("inbox-digest.md", "Daily email volume digest with SLA stats, category breakdown, unresolved flags", 3, 0, {
    format: "markdown",
    requiredFields: ["date", "total_emails", "by_category", "avg_response_minutes", "sla_breaches"],
    validationNote: "All fields in frontmatter. by_category must be an object with at least one key. sla_breaches must be numeric.",
  });
  const notifyDigest = node("integration", "send_digest", "Daily digest email sent to team distribution list at 08:00 AM", 0, 3, { subtype: "email_send", system: "Outlook" });

  const nodes = [trigger, rawEmail, classify, classification, draftReply, draftReplyDoc, humanReview, logTicket, ticketLog, sendReply, report, digest, notifyDigest];
  const edges = buildTemplateEdges(nodes, [
    [0, 1], [1, 2], [2, 3],
    [3, 4], [4, 5],
    [5, 6, "requires review"], [5, 9, "auto-approved"],
    [6, 9, "approved"],
    [3, 7], [7, 8],
    [8, 10], [10, 11], [11, 12],
  ]);
  return futureWorkflow(
    "Email Triage & Response Routing (AI-Automated)",
    "Universal inbox automation: AI classifies every email, drafts on-brand replies, logs CRM tickets, auto-sends routine replies, escalates complaints and high-value inquiries to humans. Daily digest replaces manual reporting.",
    nodes, edges,
  );
}
// ─── Template registry ─────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "invoice-approval",
    name: "Invoice Approval",
    description: "AP process from email receipt through manager approval to ERP payment entry",
    category: "Finance",
    icon: "📄",
    painPoints: ["Manual Excel data entry", "Email approval chains with no audit trail", "Re-keying into ERP"],
    automationPotential: "high",
    build: buildInvoiceApproval,
  },
  {
    id: "employee-onboarding",
    name: "Employee Onboarding",
    description: "From offer acceptance to day one — IT setup, HR forms, access provisioning",
    category: "HR",
    icon: "👥",
    painPoints: ["IT accounts created by hand", "Paper forms and scanning", "No visibility on status"],
    automationPotential: "high",
    build: buildEmployeeOnboarding,
  },
  {
    id: "project-intake",
    name: "Project Intake",
    description: "PMO request intake from email to steering committee approval and PM assignment",
    category: "PMO",
    icon: "📋",
    painPoints: ["Excel register updated manually", "Briefs written from scratch in Word", "Committee decisions undocumented"],
    automationPotential: "medium",
    build: buildProjectIntake,
  },
  {
    id: "contract-review",
    name: "Contract Review & Signing",
    description: "Supplier contract from receipt through redlining, negotiation, signing, and filing",
    category: "Legal",
    icon: "📝",
    painPoints: ["Multiple email rounds", "No version control", "Manual filing and expiry tracking"],
    automationPotential: "medium",
    build: buildContractReview,
  },
  {
    id: "support-escalation",
    name: "IT Support Escalation",
    description: "Helpdesk ticket from inbox to L2 escalation, resolution, and weekly reporting",
    category: "IT",
    icon: "🖥️",
    painPoints: ["Tickets arrive by email with no routing", "Weekly reports built in Excel manually", "No SLA tracking"],
    automationPotential: "high",
    build: buildSupportEscalation,
  },
  {
    id: "sales-quote",
    name: "Sales Quote Approval",
    description: "Quote build in Excel through discount approval to customer acceptance and CRM update",
    category: "Sales",
    icon: "💼",
    painPoints: ["Excel pricing copied by hand", "Discount approvals by email reply", "CRM updated manually"],
    automationPotential: "high",
    build: buildSalesQuote,
  },
  // ── Future-state (AI-automated) templates ─────────────────────────────────
  {
    id: "invoice-processing-fs",
    name: "Invoice Processing",
    description: "AI-automated AP pipeline: PDF extraction with output contracts, PO matching, Level 1 finance approval gate, ERP posting",
    category: "Finance",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildInvoiceProcessingFS,
  },
  {
    id: "employee-onboarding-fs",
    name: "Employee Onboarding",
    description: "End-to-end onboarding: data extraction, M365 provisioning with blast radius, access matrix, personalised welcome pack",
    category: "HR",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildEmployeeOnboardingFS,
  },
  {
    id: "contract-review-fs",
    name: "Contract Review",
    description: "Legal-grade pipeline: NLP extraction, risk flagging against playbook, human legal review gate, AI redlining with tracked changes",
    category: "Legal",
    icon: "⚡",
    painPoints: [],
    automationPotential: "medium",
    build: buildContractReviewFS,
  },
  {
    id: "support-escalation-fs",
    name: "IT Support Escalation",
    description: "Intelligent support: NLP classification, auto-resolution from runbooks, L2 escalation gate, KB article generation",
    category: "IT",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildSupportEscalationFS,
  },
  {
    id: "sales-quote-fs",
    name: "Sales Quote",
    description: "Contract-driven quoting: live CRM pricing, margin validation, discount approval gate, branded PDF generation, automated CRM update",
    category: "Sales",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildSalesQuoteFS,
  },
  {
    id: "pdf-to-obsidian",
    name: "PDF → Obsidian",
    description: "Fully autonomous knowledge ingestion: PDF extraction, semantic chunking, frontmatter generation, vault writing with wikilinks",
    category: "Knowledge",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildPdfToObsidianFS,
  },
  {
    id: "email-triage",
    name: "Email Triage & Routing",
    description: "Shared inbox process: manual reading, sorting, and reply writing with no SLA, templates, or automation",
    category: "Operations",
    icon: "📧",
    painPoints: ["Replies inconsistent in tone and speed", "No SLA tracking", "Weekly report built manually in Excel", "Escalations happen by accident"],
    automationPotential: "high",
    build: buildEmailTriage,
  },
  {
    id: "email-triage-fs",
    name: "Email Triage & Response",
    description: "AI-powered inbox: intent classification, drafted replies, CRM ticket logging, auto-send for routine emails, daily digest",
    category: "Operations",
    icon: "⚡",
    painPoints: [],
    automationPotential: "high",
    build: buildEmailTriageFS,
  },
];