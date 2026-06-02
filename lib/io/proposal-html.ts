/**
 * lib/io/proposal-html.ts
 *
 * Generates a stunning, print-ready HTML client proposal from a Workflow.
 * Opens in a new browser tab. The user prints / saves as PDF via Cmd+P.
 *
 * Sections:
 *   1. Cover page (branded, full-bleed)
 *   2. Executive summary
 *   3. Current → Future state transformation
 *   4. Automation blueprint (node-by-node)
 *   5. Contract & governance summary
 *   6. ROI analysis
 *   7. Integration requirements
 *   8. Next steps & timeline
 *   9. Back cover
 */

import type {
  Workflow,
  SkillNodeData,
  HumanNodeData,
  ArtifactNodeData,
  IntegrationNodeData,
} from "@/lib/types/workflow";

// ─── Branding ─────────────────────────────────────────────────────────────────

export interface ProposalBranding {
  firmName?: string;
  tagline?: string;
  logoDataUrl?: string;
  accentColor?: string;
  websiteUrl?: string;
  consultantName?: string;
  email?: string;
  /** Your blended hourly rate for ROI calculations (USD, default 120) */
  hourlyRate?: number;
  /** Implementation cost per skill — overrides the default estimate */
  costPerSkill?: number;
}

const BRAND_LS_KEY = "wfos-brand";

export function loadBranding(): ProposalBranding {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(BRAND_LS_KEY) ?? "{}") as ProposalBranding;
  } catch {
    return {};
  }
}

export function saveBranding(b: ProposalBranding): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRAND_LS_KEY, JSON.stringify(b));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTONOMY_LABELS = ["Human-in-loop", "Supervised AI", "Automated", "Fully Autonomous"];
const AUTONOMY_COLORS = ["#64748b", "#3b82f6", "#22c55e", "#f59e0b"];

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateProposalHtml(workflow: Workflow, branding: ProposalBranding = {}): string {
  const accent = branding.accentColor ?? "#6d28d9";
  const accentLight = accent + "18";
  const firmName = branding.firmName ?? "PAI Studio";
  const tagline = branding.tagline ?? "AI Workflow Automation";

  const skillNodes = workflow.nodes.filter((n) => n.type === "skill");
  const humanNodes = workflow.nodes.filter((n) => n.type === "human");
  const artifactNodes = workflow.nodes.filter((n) => n.type === "artifact");
  const integrationNodes = workflow.nodes.filter((n) => n.type === "integration");

  // ROI calculation — uses branding.hourlyRate if set, or workflow.engagementFee for cost
  const humanWeeklyMins = humanNodes.reduce((sum, n) => {
    const d = n.data as HumanNodeData;
    return sum + (d.minutesPerOccurrence ?? 30) * (d.occurrencesPerWeek ?? 5);
  }, 0);
  const hourlyRate = branding.hourlyRate ?? 120; // $120/hr is a more realistic blended rate
  const weeklyHours = humanWeeklyMins / 60;
  const annualHours = weeklyHours * 52;
  const annualSavingsDollars = Math.round(annualHours * hourlyRate);
  // Use actual engagement fee if set, otherwise estimate from node count
  const costPerSkill = branding.costPerSkill ?? 3500;
  const baseCost = 4500; // discovery, design, QA
  const estimatedCost = skillNodes.length * costPerSkill + baseCost;
  const implementationCost = (workflow as { engagementFee?: number }).engagementFee ?? estimatedCost;
  const paybackMonths = annualSavingsDollars > 0 && implementationCost > 0
    ? Math.ceil(implementationCost / (annualSavingsDollars / 12))
    : 0;

  // Autonomy breakdown
  const autonomyBuckets = [0, 0, 0, 0];
  for (const n of skillNodes) {
    const level = (n.data as SkillNodeData).autonomyLevel ?? 1;
    autonomyBuckets[level]++;
  }
  const avgAutonomy = skillNodes.length > 0
    ? skillNodes.reduce((s, n) => s + ((n.data as SkillNodeData).autonomyLevel ?? 1), 0) / skillNodes.length
    : 1;

  // Integrations
  const integrationList = integrationNodes.map((n) => n.data.name ?? "Integration");

  // Skills list for blueprint
  const skillRows = skillNodes.map((n) => {
    const d = n.data as SkillNodeData;
    const level = d.autonomyLevel ?? 1;
    const risk = d.riskCategory ?? "low";
    const contract = "—"; // outputContract lives on ArtifactNodeData, not SkillNodeData
    return `
      <tr>
        <td>${esc(d.name ?? n.id)}</td>
        <td><span class="badge" style="background:${AUTONOMY_COLORS[level]}22;color:${AUTONOMY_COLORS[level]};border:1px solid ${AUTONOMY_COLORS[level]}44">${AUTONOMY_LABELS[level]}</span></td>
        <td class="risk-${risk}">${risk.charAt(0).toUpperCase() + risk.slice(1)}</td>
        <td style="color:#6b7280">${d.retryPolicy ? `${d.retryPolicy.maxAttempts ?? 3}× / ${d.retryPolicy.backoffSeconds ?? 30}s backoff` : "—"}</td>
        <td style="color:#6b7280">${contract}</td>
      </tr>`;
  }).join("");

  // Human steps
  const humanRows = humanNodes.map((n) => {
    const d = n.data as HumanNodeData;
    const weeklyMins = (d.minutesPerOccurrence ?? 30) * (d.occurrencesPerWeek ?? 5);
    const annualHrs = Math.round((weeklyMins / 60) * 52);
    return `
      <tr>
        <td>${esc(d.name ?? n.id)}</td>
        <td>${d.minutesPerOccurrence ?? 30} min</td>
        <td>${d.occurrencesPerWeek ?? 5}× / week</td>
        <td style="color:#ef4444;font-weight:600">${annualHrs} hrs/year</td>
        <td style="color:#6b7280">${esc(d.subtype ?? "approval")}</td>
      </tr>`;
  }).join("");

  // Artifacts
  const artifactRows = artifactNodes.map((n) => {
    const d = n.data as ArtifactNodeData;
    return `<li><strong>${esc(d.name ?? n.id)}</strong>${d.description ? " — " + esc(d.description) : ""}</li>`;
  }).join("");

  // Timeline phases
  const phaseCount = Math.max(3, Math.ceil(skillNodes.length / 3));
  const phases = Array.from({ length: phaseCount }, (_, i) => {
    const start = Math.round(i * 2.5) + 1;
    const end = Math.round((i + 1) * 2.5);
    const phaseName = i === 0 ? "Discovery & Setup" : i === phaseCount - 1 ? "Go-Live & Handoff" : `Automation Phase ${i}`;
    const nodes = skillNodes.slice(i * 3, (i + 1) * 3);
    return { name: phaseName, weeks: `Weeks ${start}–${end}`, nodes };
  });

  const phaseRows = phases.map((p, i) => `
    <tr>
      <td><strong>Phase ${i + 1}: ${esc(p.name)}</strong></td>
      <td style="color:#6b7280">${p.weeks}</td>
      <td>${p.nodes.map((n) => esc((n.data as SkillNodeData).name ?? n.id)).join(", ") || "Setup & configuration"}</td>
    </tr>`).join("");

  const logoHtml = branding.logoDataUrl
    ? `<img src="${branding.logoDataUrl}" alt="Logo" style="height:48px;object-fit:contain;margin-bottom:16px" />`
    : `<div style="width:48px;height:48px;background:linear-gradient(135deg,${accent},${accent}cc);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin-bottom:16px">${firmName.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(workflow.name ?? "Automation Proposal")} — ${esc(firmName)}</title>
<style>
  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    line-height: 1.6;
    font-size: 14px;
  }

  /* ── Print toolbar (screen only) ── */
  .print-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 52px;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 1000;
    gap: 12px;
  }
  .print-bar span { color: #94a3b8; font-size: 13px; }
  .print-btn {
    background: linear-gradient(135deg, ${accent}, ${accent}cc);
    border: none;
    border-radius: 8px;
    padding: 9px 24px;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 16px ${accent}44;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .print-btn:hover { opacity: 0.9; }
  .print-meta { color: #64748b; font-size: 12px; }

  @media print {
    .print-bar { display: none !important; }
    body { padding-top: 0 !important; }
  }

  body { padding-top: 52px; }

  /* ── Page wrapper ── */
  .page {
    max-width: 900px;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 0 0 1px #e2e8f0, 0 8px 32px rgba(0,0,0,0.08);
  }

  @media print {
    .page {
      max-width: 100%;
      box-shadow: none;
      margin: 0;
    }
    .page-break { page-break-before: always; }
  }

  /* ── Cover ── */
  .cover {
    background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
    padding: 80px 64px 64px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -200px; right: -200px;
    width: 600px; height: 600px;
    background: radial-gradient(circle, ${accent}33 0%, transparent 70%);
    pointer-events: none;
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -100px; left: -100px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, #1e40af22 0%, transparent 70%);
    pointer-events: none;
  }
  .cover-top { position: relative; z-index: 1; }
  .cover-mid { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 60px 0; }
  .cover-bottom { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-end; }

  .cover-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: ${accent}22;
    border: 1px solid ${accent}44;
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 700;
    color: ${accent}cc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  .cover-title {
    font-size: 42px;
    font-weight: 900;
    color: #f1f5f9;
    letter-spacing: -1.5px;
    line-height: 1.1;
    margin-bottom: 12px;
  }
  .cover-subtitle {
    font-size: 18px;
    color: #94a3b8;
    font-weight: 400;
    margin-bottom: 40px;
    max-width: 480px;
    line-height: 1.5;
  }
  .cover-stats {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
  }
  .cover-stat { text-align: left; }
  .cover-stat-val { font-size: 28px; font-weight: 900; color: #f1f5f9; letter-spacing: -1px; }
  .cover-stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

  .cover-firm { text-align: right; }
  .cover-firm-name { font-size: 14px; font-weight: 700; color: #e2e8f0; }
  .cover-firm-tag { font-size: 11px; color: #64748b; margin-top: 2px; }
  .cover-date { font-size: 12px; color: #475569; }

  /* ── Content pages ── */
  .content { padding: 64px; }
  .section { margin-bottom: 56px; }
  .section:last-child { margin-bottom: 0; }

  .section-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 8px;
  }
  h2 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #0f172a;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid ${accentLight};
  }
  h3 {
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 12px;
    margin-top: 24px;
  }
  p { color: #374151; margin-bottom: 12px; line-height: 1.7; }

  /* ── Callout ── */
  .callout {
    background: ${accentLight};
    border-left: 3px solid ${accent};
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0;
    font-size: 13px;
    color: #374151;
  }
  .callout strong { color: #0f172a; }

  /* ── Stats grid ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin: 24px 0;
  }
  .stat-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .stat-val { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
  .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

  /* ── ROI card ── */
  .roi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin: 24px 0;
  }
  .roi-card {
    border-radius: 12px;
    padding: 24px;
    text-align: center;
  }
  .roi-card.green { background: #f0fdf4; border: 1px solid #86efac; }
  .roi-card.blue { background: #eff6ff; border: 1px solid #93c5fd; }
  .roi-card.purple { background: ${accentLight}; border: 1px solid ${accent}44; }
  .roi-val { font-size: 30px; font-weight: 900; letter-spacing: -1px; }
  .roi-card.green .roi-val { color: #16a34a; }
  .roi-card.blue .roi-val { color: #2563eb; }
  .roi-card.purple .roi-val { color: ${accent}; }
  .roi-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-top: 4px; }
  .roi-sub { font-size: 12px; color: #6b7280; margin-top: 8px; }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin: 16px 0;
  }
  th {
    background: #f1f5f9;
    text-align: left;
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
  }
  td {
    padding: 11px 14px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .risk-high { color: #dc2626; font-weight: 700; }
  .risk-medium { color: #d97706; font-weight: 600; }
  .risk-low { color: #16a34a; }
  .risk-critical { color: #7c3aed; font-weight: 700; }

  /* ── Timeline ── */
  .timeline-row { display: flex; gap: 0; margin: 16px 0; }
  .timeline-phase {
    flex: 1;
    padding: 16px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    margin-right: 8px;
    position: relative;
  }
  .timeline-phase:last-child { margin-right: 0; }
  .timeline-phase::after {
    content: '→';
    position: absolute;
    right: -16px;
    top: 50%;
    transform: translateY(-50%);
    color: #cbd5e1;
    font-size: 14px;
  }
  .timeline-phase:last-child::after { display: none; }
  .phase-num { font-size: 10px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 0.08em; }
  .phase-name { font-size: 12px; font-weight: 700; color: #0f172a; margin: 4px 0; }
  .phase-weeks { font-size: 10px; color: #6b7280; }

  /* ── Integration chips ── */
  .integration-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }
  .chip-icon { font-size: 16px; }

  /* ── Artifacts list ── */
  .artifact-list { list-style: none; margin: 12px 0; }
  .artifact-list li { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .artifact-list li:last-child { border-bottom: none; }

  /* ── Next steps ── */
  .steps-list { list-style: none; counter-reset: steps; margin: 16px 0; }
  .steps-list li {
    counter-increment: steps;
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding: 16px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .steps-list li:last-child { border-bottom: none; }
  .step-num {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, ${accent}, ${accent}cc);
    border-radius: 50%;
    color: #fff;
    font-weight: 800;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .step-content-title { font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px; }
  .step-content-desc { font-size: 12px; color: #6b7280; line-height: 1.5; }

  /* ── Back cover ── */
  .back-cover {
    background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%);
    padding: 80px 64px;
    text-align: center;
    min-height: 40vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    position: relative;
    overflow: hidden;
  }
  .back-cover::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 600px; height: 600px;
    background: radial-gradient(circle, ${accent}22 0%, transparent 70%);
    pointer-events: none;
  }
  .back-cover-title { font-size: 28px; font-weight: 900; color: #f1f5f9; letter-spacing: -0.5px; position: relative; z-index: 1; }
  .back-cover-sub { font-size: 14px; color: #64748b; max-width: 400px; line-height: 1.6; position: relative; z-index: 1; }
  .back-cover-contact { position: relative; z-index: 1; margin-top: 8px; }
  .back-cover-contact a { color: ${accent}; font-weight: 600; text-decoration: none; font-size: 14px; }

  /* ── Divider ── */
  .divider { height: 1px; background: linear-gradient(90deg, transparent, #e2e8f0, transparent); margin: 48px 0; }

  /* ── Footer ── */
  .page-footer {
    border-top: 1px solid #f1f5f9;
    padding: 16px 64px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #94a3b8;
  }
</style>
</head>
<body>

<!-- Print bar (screen only) -->
<div class="print-bar">
  <span>📄 ${esc(workflow.name ?? "Automation Proposal")} — ready to save as PDF</span>
  <button class="print-btn" onclick="window.print()">
    ⬇ Save as PDF
  </button>
</div>

<div class="page">

<!-- ══════════════════════════════════════════════════════ COVER ══════════════ -->
<div class="cover">
  <div class="cover-top">
    ${logoHtml.replace(/\n\s*/g, " ")}
    <div style="font-size:13px;font-weight:700;color:#e2e8f0">${esc(firmName)}</div>
    <div style="font-size:11px;color:#475569;margin-top:2px">${esc(tagline)}</div>
  </div>

  <div class="cover-mid">
    <div class="cover-label">⚡ Automation Proposal</div>
    <div class="cover-title">${esc(workflow.name ?? "AI Automation Proposal")}</div>
    <div class="cover-subtitle">
      A complete blueprint for automating your operations with AI agents — including contracts, guardrails, and a phased deployment plan.
    </div>
    <div class="cover-stats">
      <div class="cover-stat">
        <div class="cover-stat-val">${skillNodes.length}</div>
        <div class="cover-stat-label">AI Skills</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-val">${humanNodes.length}</div>
        <div class="cover-stat-label">Human Steps</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-val">${annualSavingsDollars > 0 ? fmtMoney(annualSavingsDollars) : "TBD"}</div>
        <div class="cover-stat-label">Annual Savings</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-val">${paybackMonths > 0 ? paybackMonths + " mo" : "—"}</div>
        <div class="cover-stat-label">Payback Period</div>
      </div>
    </div>
  </div>

  <div class="cover-bottom">
    <div class="cover-date">Prepared ${todayStr()}</div>
    <div class="cover-firm">
      ${branding.consultantName ? `<div class="cover-firm-name">${esc(branding.consultantName)}</div>` : ""}
      ${branding.email ? `<div class="cover-firm-tag">${esc(branding.email)}</div>` : ""}
      ${branding.websiteUrl ? `<div class="cover-firm-tag">${esc(branding.websiteUrl)}</div>` : ""}
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════ EXECUTIVE SUMMARY ═══════ -->
<div class="page-break"></div>
<div class="content">
  <div class="section">
    <div class="section-label">01 — Overview</div>
    <h2>Executive Summary</h2>
    <p>
      This proposal outlines a phased AI automation programme for <strong>${esc(workflow.name ?? "your operations")}</strong>.
      Using large language models and structured output contracts, we will replace ${humanNodes.length} manual human step${humanNodes.length !== 1 ? "s" : ""} with
      ${skillNodes.length} AI-powered skill${skillNodes.length !== 1 ? "s" : ""} — each governed by explicit contracts, blast radius limits, and escalation policies
      that ensure safe, auditable execution.
    </p>
    <p>
      The result is a workflow that runs autonomously for routine cases, escalates intelligently when exceptions arise,
      and produces a complete provenance trail for every decision made.
    </p>

    <div class="callout">
      <strong>Key outcome:</strong> Estimated ${annualSavingsDollars > 0 ? fmtMoney(annualSavingsDollars) + " in annual labour savings" : "significant labour savings"} with
      a projected payback period of ${paybackMonths > 0 ? paybackMonths + " months" : "under 12 months"}.
      ${avgAutonomy >= 2 ? "The majority of tasks will run fully automated, requiring human input only for exceptions." : "Human oversight is maintained for all high-risk decisions."}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">${workflow.nodes.length}</div>
        <div class="stat-label">Total Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${workflow.edges.length}</div>
        <div class="stat-label">Connections</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${integrationNodes.length}</div>
        <div class="stat-label">Integrations</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${phases.length}</div>
        <div class="stat-label">Deploy Phases</div>
      </div>
    </div>
  </div>

<!-- ══════════════════════════════════════════════════ ROI ANALYSIS ═══════════ -->
  <div class="section">
    <div class="section-label">02 — Business Case</div>
    <h2>Return on Investment</h2>

    <div class="roi-grid">
      <div class="roi-card green">
        <div class="roi-val">${fmtMoney(annualSavingsDollars > 0 ? annualSavingsDollars : implementationCost * 2)}</div>
        <div class="roi-lbl">Annual Savings</div>
        <div class="roi-sub">${Math.round(annualHours)} hrs/year automated × $${hourlyRate}/hr</div>
      </div>
      <div class="roi-card blue">
        <div class="roi-val">${fmtMoney(implementationCost)}</div>
        <div class="roi-lbl">Implementation Cost</div>
        <div class="roi-sub">One-time setup + integration work</div>
      </div>
      <div class="roi-card purple">
        <div class="roi-val">${paybackMonths > 0 ? paybackMonths + " mo" : "< 12 mo"}</div>
        <div class="roi-lbl">Payback Period</div>
        <div class="roi-sub">Before ongoing savings begin compounding</div>
      </div>
    </div>

    <h3>Current State — Human Labour Cost</h3>
    ${humanNodes.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Step</th><th>Time / Occurrence</th><th>Frequency</th><th>Annual Hours</th><th>Type</th>
        </tr>
      </thead>
      <tbody>${humanRows}</tbody>
    </table>` : `<p style="color:#6b7280">No human time data captured. Add time estimates in the Inspector to generate a full ROI breakdown.</p>`}
  </div>

<!-- ════════════════════════════════════════════ AUTOMATION BLUEPRINT ═══════════ -->
  <div class="section">
    <div class="section-label">03 — Blueprint</div>
    <h2>Automation Blueprint</h2>
    <p>
      Each AI skill below is governed by an output contract and autonomy level. Skills at Level 2+ run without human approval for routine inputs.
      The blast radius setting limits what each agent can modify, and retry policies handle transient failures automatically.
    </p>
    ${skillNodes.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Skill</th><th>Autonomy</th><th>Risk</th><th>Retry Policy</th><th>Output Contract</th>
        </tr>
      </thead>
      <tbody>${skillRows}</tbody>
    </table>` : `<p style="color:#6b7280">No AI skills defined yet. Use the PAI Studio canvas to add skills to this workflow.</p>`}

    ${artifactRows ? `
    <h3>Workflow Outputs</h3>
    <ul class="artifact-list">${artifactRows}</ul>` : ""}
  </div>

<!-- ══════════════════════════════════════════ INTEGRATION REQUIREMENTS ═══════════ -->
  ${integrationList.length > 0 ? `
  <div class="section">
    <div class="section-label">04 — Integrations</div>
    <h2>Integration Requirements</h2>
    <p>The following systems will be connected as part of this automation. Each integration requires API credentials to be provisioned during the setup phase.</p>
    <div class="integration-chips">
      ${integrationList.map(name => `<div class="chip"><span class="chip-icon">🔌</span>${esc(name)}</div>`).join("")}
    </div>
    <div class="callout">
      <strong>Security note:</strong> All API credentials are stored in environment variables and never embedded in workflow files.
      Access is scoped to the minimum permissions required for each integration.
    </div>
  </div>` : ""}

<!-- ══════════════════════════════════════════════ DEPLOYMENT TIMELINE ═══════════ -->
  <div class="section">
    <div class="section-label">05 — Delivery</div>
    <h2>Deployment Timeline</h2>

    <div class="timeline-row">
      ${phases.map((p, i) => `
      <div class="timeline-phase">
        <div class="phase-num">Phase ${i + 1}</div>
        <div class="phase-name">${esc(p.name)}</div>
        <div class="phase-weeks">${p.weeks}</div>
      </div>`).join("")}
    </div>

    <table style="margin-top:24px">
      <thead>
        <tr><th>Phase</th><th>Timeline</th><th>Deliverables</th></tr>
      </thead>
      <tbody>${phaseRows}</tbody>
    </table>
  </div>

<!-- ══════════════════════════════════════════════════ NEXT STEPS ═══════════════ -->
  <div class="section">
    <div class="section-label">06 — Action Plan</div>
    <h2>Next Steps</h2>
    <ol class="steps-list">
      <li>
        <div class="step-num">1</div>
        <div>
          <div class="step-content-title">Approve this proposal</div>
          <div class="step-content-desc">Sign-off from the project sponsor and IT security team. Confirm API access scope for integrations.</div>
        </div>
      </li>
      <li>
        <div class="step-num">2</div>
        <div>
          <div class="step-content-title">Provision environments</div>
          <div class="step-content-desc">Set up staging environment. Provision API keys for ${integrationList.length > 0 ? integrationList.slice(0, 3).join(", ") : "required integrations"}. Install Node 18+ and Claude Code.</div>
        </div>
      </li>
      <li>
        <div class="step-num">3</div>
        <div>
          <div class="step-content-title">Deploy Phase 1 — supervised</div>
          <div class="step-content-desc">Run the workflow in supervised mode for 2 weeks. Review all outputs. Tune prompts and contracts based on real data.</div>
        </div>
      </li>
      <li>
        <div class="step-num">4</div>
        <div>
          <div class="step-content-title">Incremental autonomy increase</div>
          <div class="step-content-desc">Graduate each skill to higher autonomy levels as confidence builds. Maintain full audit trail throughout.</div>
        </div>
      </li>
      <li>
        <div class="step-num">5</div>
        <div>
          <div class="step-content-title">Go-live & handoff</div>
          <div class="step-content-desc">Full production deployment. Handoff documentation, runbook, and on-call escalation guide to your team.</div>
        </div>
      </li>
    </ol>
  </div>

</div>

<!-- ════════════════════════════════════════════════ ENGAGEMENT FEES ════════════ -->
  <div class="section">
    <div class="section-label">07 — Engagement Fees</div>
    <h2>What to Charge for This Engagement</h2>
    <p>
      Based on ${skillNodes.length} AI skill${skillNodes.length !== 1 ? "s" : ""}, ${humanNodes.length} human touchpoint${humanNodes.length !== 1 ? "s" : ""},
      and ${integrationNodes.length} integration${integrationNodes.length !== 1 ? "s" : ""}, the recommended fee ranges below are calibrated to
      Australian mid-market and enterprise clients. Adjust based on your track record, client size, and urgency.
    </p>

    <div class="roi-grid" style="margin-top:24px">
      <div class="roi-card blue">
        <div class="roi-val">${fmtMoney(Math.round(implementationCost * 0.85 / 500) * 500)}</div>
        <div class="roi-lbl">Lean Engagement</div>
        <div class="roi-sub">Solo consultant · Tight scope · No change management</div>
      </div>
      <div class="roi-card purple" style="border-color:${accent}55">
        <div class="roi-val">${fmtMoney(implementationCost)}</div>
        <div class="roi-lbl">Recommended Fee ✦</div>
        <div class="roi-sub">${skillNodes.length} skill${skillNodes.length !== 1 ? "s" : ""} × $4k + $5k base · Full delivery</div>
      </div>
      <div class="roi-card green">
        <div class="roi-val">${fmtMoney(Math.round(implementationCost * 1.4 / 500) * 500)}</div>
        <div class="roi-lbl">Premium Engagement</div>
        <div class="roi-sub">Training, documentation, 60-day support retainer</div>
      </div>
    </div>

    <h3 style="margin-top:32px">Industry Benchmarks — AI Automation Consulting (AU)</h3>
    <table>
      <thead>
        <tr>
          <th>Engagement Type</th>
          <th>Typical Range (AUD)</th>
          <th>Duration</th>
          <th>What's Included</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Discovery & Scoping</strong></td>
          <td style="color:#3b82f6;font-weight:600">$3,000 – $8,000</td>
          <td>1–2 weeks</td>
          <td>Process mapping, ROI analysis, workflow design, proposal</td>
        </tr>
        <tr>
          <td><strong>Single-Process Automation</strong></td>
          <td style="color:#3b82f6;font-weight:600">$12,000 – $35,000</td>
          <td>4–8 weeks</td>
          <td>1–3 AI skills, integration setup, testing, handoff</td>
        </tr>
        <tr>
          <td><strong>Department Automation</strong></td>
          <td style="color:#3b82f6;font-weight:600">$40,000 – $120,000</td>
          <td>8–16 weeks</td>
          <td>4–10 skills, multi-system integrations, change management</td>
        </tr>
        <tr>
          <td><strong>Enterprise Programme</strong></td>
          <td style="color:#3b82f6;font-weight:600">$150,000 – $500,000+</td>
          <td>6–18 months</td>
          <td>Cross-department rollout, governance framework, training</td>
        </tr>
        <tr>
          <td><strong>Monthly Retainer (Ongoing)</strong></td>
          <td style="color:#22c55e;font-weight:600">$3,000 – $12,000/mo</td>
          <td>Rolling</td>
          <td>Monitoring, tuning, new skill development, priority support</td>
        </tr>
      </tbody>
    </table>

    <h3 style="margin-top:32px">Pricing Rationale for This Engagement</h3>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Unit Cost</th>
          <th>Qty</th>
          <th>Subtotal</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>AI Skill Development</strong></td>
          <td>$4,000 / skill</td>
          <td>${skillNodes.length}</td>
          <td style="font-weight:600">${fmtMoney(skillNodes.length * 4000)}</td>
          <td>Includes prompt engineering, contract design, testing</td>
        </tr>
        <tr>
          <td><strong>Base Setup & Project Management</strong></td>
          <td>$5,000</td>
          <td>1</td>
          <td style="font-weight:600">$5,000</td>
          <td>Discovery, scoping, client comms, documentation</td>
        </tr>
        ${integrationNodes.length > 0 ? `
        <tr>
          <td><strong>Integration Configuration</strong></td>
          <td>$1,500 / integration</td>
          <td>${integrationNodes.length}</td>
          <td style="font-weight:600">${fmtMoney(integrationNodes.length * 1500)}</td>
          <td>API setup, authentication, error handling, testing</td>
        </tr>` : ""}
        <tr style="background:#f0fdf4">
          <td colspan="3"><strong>Total Recommended Fee</strong></td>
          <td style="font-weight:700;font-size:16px;color:#16a34a">${fmtMoney(implementationCost + integrationNodes.length * 1500)}</td>
          <td style="color:#6b7280">Excluding GST</td>
        </tr>
        <tr>
          <td colspan="4" style="color:#6b7280;font-size:12px;padding-top:4px">
            ✦ Client ROI: ${annualSavingsDollars > 0 ? `${fmtMoney(annualSavingsDollars)} annual savings · ${paybackMonths > 0 ? paybackMonths + "-month" : "sub-12-month"} payback` : "Savings calculated once time data is captured in the workflow"}
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:24px;padding:16px 20px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;font-size:13px;color:#713f12">
      <strong>💡 Pricing Tip:</strong>
      Never lead with hourly rate. Anchor to the client's savings figure first (${annualSavingsDollars > 0 ? fmtMoney(annualSavingsDollars) + "/year" : "calculated from their process data"}).
      Your fee is then a fraction of that — a straightforward business decision, not a cost.
      Offer a fixed-price engagement with a clear scope, not time-and-materials — it builds trust and protects your margin.
    </div>
  </div>

<div class="page-footer">
  <span>${esc(workflow.name ?? "Automation Proposal")} — Confidential</span>
  <span>${esc(firmName)} · Prepared ${todayStr()}</span>
</div>

<!-- ══════════════════════════════════════════════════ BACK COVER ════════════════ -->
<div class="page-break"></div>
<div class="back-cover">
  <div class="back-cover-title">Let's build this together.</div>
  <div class="back-cover-sub">
    This proposal was built with PAI Studio — the AI workflow platform for operations teams who run on contracts, not vibes.
  </div>
  <div class="back-cover-contact">
    ${branding.email ? `<a href="mailto:${esc(branding.email)}">${esc(branding.email)}</a>` : ""}
    ${branding.websiteUrl ? `<br/><a href="${esc(branding.websiteUrl)}" target="_blank">${esc(branding.websiteUrl)}</a>` : ""}
  </div>
  <div style="margin-top:32px;position:relative;z-index:1">
    ${!branding.firmName ? `<div style="font-size:11px;color:#1e293b;opacity:0.3">Powered by PAI Studio — productionai.institute</div>` : ""}
  </div>
</div>

</div><!-- /.page -->
</body>
</html>`;
}

// ─── Open in new tab ──────────────────────────────────────────────────────────

export function openProposal(workflow: Workflow, branding?: ProposalBranding): void {
  const html = generateProposalHtml(workflow, branding ?? loadBranding());
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Revoke after a delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
