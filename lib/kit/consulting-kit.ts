/**
 * lib/kit/consulting-kit.ts
 *
 * The Consulting Business Kit — four print-ready HTML documents every
 * AI automation consultant needs but nobody else provides.
 *
 * 1. Statement of Work template
 * 2. Service Agreement (plain-English one-pager)
 * 3. Pricing Calculator guide
 * 4. Discovery Call question bank
 */

import { loadBranding, type ProposalBranding } from "@/lib/io/proposal-html";

// ─── Shared styles ────────────────────────────────────────────────────────────

function kitStyles(accent: string): string {
  return `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; font-size: 14px; }
  .print-bar { position: fixed; top: 0; left: 0; right: 0; height: 52px; background: #0f172a; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; z-index: 1000; }
  .print-bar span { color: #94a3b8; font-size: 13px; }
  .print-btn { background: linear-gradient(135deg, ${accent}, ${accent}cc); border: none; border-radius: 8px; padding: 9px 24px; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
  @media print { .print-bar { display: none !important; } body { padding-top: 0 !important; } }
  body { padding-top: 52px; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; box-shadow: 0 0 0 1px #e2e8f0, 0 8px 32px rgba(0,0,0,0.08); }
  @media print { .page { max-width: 100%; box-shadow: none; margin: 0; } .pb { page-break-before: always; } }
  .header { background: linear-gradient(160deg, #0f172a, #1e1b4b); padding: 48px 56px 40px; color: #f1f5f9; }
  .header-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ${accent}; margin-bottom: 10px; }
  .header-title { font-size: 34px; font-weight: 900; letter-spacing: -1px; line-height: 1.1; margin-bottom: 10px; }
  .header-sub { font-size: 14px; color: #64748b; }
  .content { padding: 48px 56px; }
  h2 { font-size: 18px; font-weight: 800; color: #0f172a; padding-bottom: 10px; border-bottom: 2px solid ${accent}22; margin-bottom: 16px; margin-top: 32px; letter-spacing: -0.3px; }
  h2:first-child { margin-top: 0; }
  h3 { font-size: 13px; font-weight: 700; color: #374151; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  p { color: #374151; line-height: 1.8; margin-bottom: 12px; font-size: 13px; }
  .field { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; min-height: 44px; background: #fafafa; }
  .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
  .field-hint { font-size: 12px; color: #cbd5e1; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #f1f5f9; padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .callout { background: ${accent}0f; border-left: 3px solid ${accent}; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 16px 0; font-size: 13px; color: #374151; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sig-line { border-top: 1px solid #1e293b; padding-top: 8px; font-size: 11px; color: #64748b; }
  ul { padding-left: 20px; margin-bottom: 12px; }
  li { margin-bottom: 6px; font-size: 13px; color: #374151; line-height: 1.7; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: ${accent}18; border: 1px solid ${accent}33; color: ${accent}; }
  .footer { border-top: 1px solid #f1f5f9; padding: 16px 56px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  `;
}

function printBar(title: string): string {
  return `<div class="print-bar"><span>${title}</span><button class="print-btn" onclick="window.print()">⬇ Save as PDF</button></div>`;
}

function today(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── 1. Statement of Work ─────────────────────────────────────────────────────

export function generateSOW(branding: ProposalBranding = {}): string {
  const accent = branding.accentColor ?? "#6d28d9";
  const firm = branding.firmName ?? "Your Consulting Firm";
  const consultant = branding.consultantName ?? "Consultant Name";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Statement of Work — ${firm}</title><style>${kitStyles(accent)}</style></head><body>
${printBar("Statement of Work")}
<div class="page">
  <div class="header">
    <div class="header-label">Consulting Agreement</div>
    <div class="header-title">Statement of Work</div>
    <div class="header-sub">AI Workflow Automation Engagement</div>
  </div>
  <div class="content">
    <h2>Parties</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div>
        <h3>Service Provider</h3>
        <div class="field"><div class="field-label">Firm Name</div><div class="field-hint">${firm}</div></div>
        <div class="field"><div class="field-label">Consultant</div><div class="field-hint">${consultant}</div></div>
        <div class="field"><div class="field-label">Email</div><div class="field-hint">${branding.email ?? "your@email.com"}</div></div>
      </div>
      <div>
        <h3>Client</h3>
        <div class="field"><div class="field-label">Company Name</div><div class="field-hint">Enter client company name</div></div>
        <div class="field"><div class="field-label">Contact Name</div><div class="field-hint">Enter project sponsor name</div></div>
        <div class="field"><div class="field-label">Email</div><div class="field-hint">Enter client email</div></div>
      </div>
    </div>

    <h2>Project Overview</h2>
    <div class="field" style="min-height:80px"><div class="field-label">Process Being Automated</div><div class="field-hint">Describe the specific business process — e.g. "Accounts Payable invoice approval workflow from receipt to ERP posting"</div></div>
    <div class="field" style="min-height:60px"><div class="field-label">Business Objective</div><div class="field-hint">What does success look like? e.g. "Reduce invoice processing time from 3 days to 4 hours and eliminate manual data entry errors"</div></div>

    <h2>Scope of Work</h2>
    <p>The Service Provider will deliver the following:</p>
    <table>
      <thead><tr><th>#</th><th>Deliverable</th><th>Description</th><th>Format</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Process Map</td><td>Current-state workflow diagram with time estimates at each step</td><td>PAI Studio canvas + PDF export</td></tr>
        <tr><td>2</td><td>Automation Blueprint</td><td>Future-state AI workflow with output contracts, blast radius, and escalation policies per skill</td><td>PAI Studio canvas + PDF proposal</td></tr>
        <tr><td>3</td><td>Deployment Package</td><td>Claude Code project ZIP: YAML specs, hook scripts, integration adapters, GETTING_STARTED.md</td><td>.zip file</td></tr>
        <tr><td>4</td><td>Test Run</td><td>Supervised execution of the workflow on sample data with client sign-off</td><td>Run log + approval</td></tr>
        <tr><td>5</td><td>Handoff Session</td><td>60-minute walkthrough with client's IT team covering deployment, monitoring, and escalation</td><td>Video call + recording</td></tr>
      </tbody>
    </table>

    <h2>Out of Scope</h2>
    <ul>
      <li>Changes to existing ERP, CRM, or other systems</li>
      <li>Ongoing maintenance beyond 30 days post go-live (covered by retainer — see below)</li>
      <li>Licensing fees for third-party APIs or services</li>
      <li>Data migration or historical data processing</li>
    </ul>

    <h2>Timeline</h2>
    <table>
      <thead><tr><th>Phase</th><th>Duration</th><th>Deliverable</th></tr></thead>
      <tbody>
        <tr><td>Discovery</td><td>Week 1</td><td>Process map + current-state assessment</td></tr>
        <tr><td>Design</td><td>Week 2</td><td>Automation blueprint + client review</td></tr>
        <tr><td>Build</td><td>Weeks 3–4</td><td>Deployment package + integration testing</td></tr>
        <tr><td>Go-live</td><td>Week 5</td><td>Supervised launch + handoff session</td></tr>
      </tbody>
    </table>

    <h2>Fees & Payment</h2>
    <table>
      <thead><tr><th>Item</th><th>Amount</th><th>Due</th></tr></thead>
      <tbody>
        <tr><td>Discovery & Design (Phases 1–2)</td><td class="field-hint">$____</td><td>On signing</td></tr>
        <tr><td>Build & Go-live (Phases 3–4)</td><td class="field-hint">$____</td><td>On delivery</td></tr>
        <tr><td>Optional: Monthly Retainer (monitoring + updates)</td><td class="field-hint">$____/month</td><td>Monthly</td></tr>
      </tbody>
    </table>
    <div class="callout">
      <strong>Payment terms:</strong> Invoices due net-14. Late payments accrue 1.5% per month. Client may pause work (not cancel) pending payment disputes.
    </div>

    <h2>Intellectual Property</h2>
    <p>All workflow designs, automation blueprints, and deployment packages created under this SOW are owned by the Client upon full payment. The Service Provider retains the right to use anonymised, non-client-identifiable workflow patterns in future engagements and templates.</p>

    <h2>Confidentiality</h2>
    <p>Both parties agree to keep Confidential Information private for 3 years from disclosure. "Confidential Information" means business processes, pricing, client data, and technical implementations shared under this engagement.</p>

    <h2>Limitation of Liability</h2>
    <p>Service Provider's total liability under this SOW is limited to fees paid in the 3 months preceding the claim. Neither party is liable for indirect or consequential damages. AI automation results may vary — the Service Provider makes no guarantee of specific ROI outcomes.</p>

    <h2>Signatures</h2>
    <p>By signing, both parties agree to the terms above. This SOW is effective on the date of last signature.</p>
    <div class="sig-block">
      <div>
        <div style="height:48px"></div>
        <div class="sig-line">Signature — Service Provider</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b">${consultant} · ${today()}</div>
      </div>
      <div>
        <div style="height:48px"></div>
        <div class="sig-line">Signature — Client</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b">Name · Date</div>
      </div>
    </div>
  </div>
  <div class="footer"><span>Statement of Work — ${firm}</span><span>Prepared ${today()}</span></div>
</div></body></html>`;
}

// ─── 2. Service Agreement ─────────────────────────────────────────────────────

export function generateServiceAgreement(branding: ProposalBranding = {}): string {
  const accent = branding.accentColor ?? "#6d28d9";
  const firm = branding.firmName ?? "Your Consulting Firm";
  const consultant = branding.consultantName ?? "Consultant Name";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Service Agreement — ${firm}</title><style>${kitStyles(accent)}</style></head><body>
${printBar("Service Agreement")}
<div class="page">
  <div class="header">
    <div class="header-label">Legal Document</div>
    <div class="header-title">AI Consulting Service Agreement</div>
    <div class="header-sub">Plain-English one-page agreement for AI automation engagements</div>
  </div>
  <div class="content">
    <div class="callout" style="margin-top:0">
      <strong>About this document:</strong> This is a plain-English service agreement designed for small-to-medium consulting engagements. For large enterprise clients or complex IP arrangements, have a lawyer review before using.
    </div>

    <p>This agreement is between <strong>${firm}</strong> ("Consultant") and the client named in the accompanying Statement of Work ("Client"). It applies to all AI workflow automation services provided by Consultant to Client.</p>

    <h2>What the Consultant will do</h2>
    <ul>
      <li>Map Client's business processes and design AI-powered automations</li>
      <li>Deliver a deployment-ready package the Client's team can run</li>
      <li>Provide a handoff session to ensure the Client can operate the automation independently</li>
      <li>Be available for questions for 14 days after go-live at no extra charge</li>
    </ul>

    <h2>What the Client will do</h2>
    <ul>
      <li>Provide honest information about the process being automated</li>
      <li>Make a relevant team member available for the discovery session (approx. 2 hours)</li>
      <li>Review and approve the automation blueprint before build starts</li>
      <li>Pay invoices within 14 days of issue</li>
      <li>Take responsibility for the automation once it's running in their environment</li>
    </ul>

    <h2>AI and automation — what to expect</h2>
    <p>AI-powered automations are powerful but not perfect. Outputs depend on the quality of inputs, the clarity of instructions, and the inherent variability of large language models. The Consultant will design guardrails (output contracts, blast radius limits, escalation policies) to minimise risk, but cannot guarantee 100% accuracy on every run.</p>
    <p>The Client agrees to run the automation in supervised mode initially, review outputs, and only increase autonomy levels as confidence is established.</p>

    <h2>Fees</h2>
    <p>Fees are set in the accompanying Statement of Work. The Consultant will invoice at milestones specified in the SOW. All fees are in USD unless otherwise agreed. Expenses (API costs, third-party tools) are billed at cost with prior approval.</p>

    <h2>Who owns what</h2>
    <p>The Client owns everything Consultant creates specifically for this engagement once fully paid. The Consultant may reuse general approaches, template patterns, and anonymised workflow designs — but never the Client's specific business logic or data.</p>

    <h2>Keeping things confidential</h2>
    <p>Both parties agree not to share the other's confidential information with outsiders for 3 years. This includes business processes, pricing, client lists, and technical systems. It does not include information that was already public or that a party developed independently.</p>

    <h2>If something goes wrong</h2>
    <p>The Consultant will fix bugs and issues discovered within 30 days of go-live at no charge. Beyond that, fixes are billed at the retainer rate. The Consultant is not liable for losses caused by the automation acting on bad data provided by the Client, or for downstream system failures outside the Consultant's control.</p>
    <p>Total liability under this agreement is capped at the fees paid in the prior 3 months.</p>

    <h2>Ending the agreement</h2>
    <p>Either party may end this agreement with 14 days written notice. The Client pays for work completed to date. If the Client ends the agreement mid-phase, the Consultant delivers whatever has been completed.</p>

    <h2>Signatures</h2>
    <div class="sig-block">
      <div>
        <div style="height:48px"></div>
        <div class="sig-line">Consultant: ${consultant}</div>
        <div style="margin-top:6px;font-size:12px;color:#64748b">${firm} · ${today()}</div>
      </div>
      <div>
        <div style="height:48px"></div>
        <div class="sig-line">Client: ___________________________</div>
        <div style="margin-top:6px;font-size:12px;color:#64748b">Name · Title · Date</div>
      </div>
    </div>
  </div>
  <div class="footer"><span>Service Agreement — ${firm}</span><span>${today()}</span></div>
</div></body></html>`;
}

// ─── 3. Pricing Guide ─────────────────────────────────────────────────────────

export function generatePricingGuide(branding: ProposalBranding = {}): string {
  const accent = branding.accentColor ?? "#6d28d9";
  const firm = branding.firmName ?? "PAI Consulting";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Pricing Guide — ${firm}</title><style>${kitStyles(accent)}
  .tier { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .tier-price { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
  .tier-name { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; margin-bottom: 6px; }
  .matrix td { font-size: 12px; }
  .matrix .val { font-weight: 700; color: #0f172a; }
  </style></head><body>
${printBar("Pricing Guide — What to Charge")}
<div class="page">
  <div class="header">
    <div class="header-label">Business Toolkit</div>
    <div class="header-title">What to Charge for AI Automation</div>
    <div class="header-sub">A practical pricing framework for AI workflow consulting engagements</div>
  </div>
  <div class="content">
    <div class="callout" style="margin-top:0">
      <strong>The core principle:</strong> Price based on the value you create, not the hours you work. A workflow that saves a client $60K/year is worth $8K–$12K to build — regardless of whether it takes you 8 hours or 40.
    </div>

    <h2>Engagement Types & Price Ranges</h2>
    <div class="tier">
      <div class="tier-name">Starter Engagement</div>
      <div class="tier-price">$3,000 – $6,000</div>
      <p style="margin-top:8px;color:#64748b">Single process, 5–8 nodes, 1–2 integrations. Discovery + design + deployment package + handoff session. Ideal for: first engagement with a new client, simple approval workflows, single-department automation.</p>
    </div>
    <div class="tier">
      <div class="tier-name">Standard Engagement</div>
      <div class="tier-price" style="color:${accent}">$6,000 – $12,000</div>
      <p style="margin-top:8px;color:#64748b">Multi-step process, 8–15 nodes, 3–5 integrations, human approval gates. Full future-state with contracts + phased deployment. Ideal for: Finance ops, HR onboarding, contract review, IT triage.</p>
    </div>
    <div class="tier">
      <div class="tier-name">Complex Engagement</div>
      <div class="tier-price">$12,000 – $25,000+</div>
      <p style="margin-top:8px;color:#64748b">Enterprise process, 15+ nodes, custom integrations, multi-department approval chains, compliance requirements. Phased delivery over 6–12 weeks. Ideal for: Large enterprise, regulated industries, cross-system workflows.</p>
    </div>

    <h2>The Value-Based Pricing Formula</h2>
    <div class="callout">Use this formula to anchor your fee: <strong>Fee = (Annual Labour Savings × 15%) + Complexity Premium</strong><br/>
    Example: Client saves $60K/year → 15% = $9,000 base. Add $2,000 complexity premium = <strong>$11,000</strong>.</div>
    <table class="matrix">
      <thead><tr><th>Annual Saving</th><th>15% Base Fee</th><th>Suggested Range</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>$20,000</td><td class="val">$3,000</td><td>$3K–$5K</td><td>Starter engagement</td></tr>
        <tr><td>$40,000</td><td class="val">$6,000</td><td>$6K–$9K</td><td>Standard engagement</td></tr>
        <tr><td>$60,000</td><td class="val">$9,000</td><td>$8K–$12K</td><td>Standard engagement</td></tr>
        <tr><td>$100,000</td><td class="val">$15,000</td><td>$12K–$20K</td><td>Complex engagement</td></tr>
        <tr><td>$200,000+</td><td class="val">$30,000+</td><td>$20K–$40K</td><td>Enterprise — add phases</td></tr>
      </tbody>
    </table>

    <h2>Monthly Retainer Model</h2>
    <p>After the initial engagement, offer a retainer for ongoing monitoring, updates, and new automations. This creates recurring revenue and keeps you close to the client.</p>
    <table>
      <thead><tr><th>Tier</th><th>Monthly Fee</th><th>Includes</th></tr></thead>
      <tbody>
        <tr><td>Monitoring</td><td class="val">$500–$1,000/mo</td><td>Monthly run log review, issue alerts, minor prompt tuning</td></tr>
        <tr><td>Maintenance</td><td class="val">$1,500–$3,000/mo</td><td>Above + up to 4 hours changes, priority response within 48h</td></tr>
        <tr><td>Growth</td><td class="val">$3,000–$5,000/mo</td><td>Above + 1 new automation per quarter, team training session</td></tr>
      </tbody>
    </table>

    <h2>How to Present Pricing</h2>
    <ul>
      <li><strong>Always anchor to ROI first.</strong> Show the $60K annual saving before you mention your $9K fee. The ratio makes the fee feel trivial.</li>
      <li><strong>Give three options.</strong> A starter option (they feel in control), a standard option (the one you want), and a premium option (makes standard look reasonable).</li>
      <li><strong>Don't discount — add value instead.</strong> If they push back on price, add a month of monitoring retainer rather than cutting the project fee.</li>
      <li><strong>Milestone payments reduce risk for both sides.</strong> 50% on signing, 50% on delivery is standard. For larger engagements: 30% / 40% / 30% across phases.</li>
    </ul>

    <h2>Common Objections & Responses</h2>
    <table>
      <thead><tr><th>Objection</th><th>Response</th></tr></thead>
      <tbody>
        <tr><td>"That's expensive"</td><td>"At $60K in annual savings, you'll recover this fee in 8 weeks. After that it's pure profit every year."</td></tr>
        <tr><td>"Can you do it cheaper?"</td><td>"I can scope a smaller Phase 1 at $X that delivers the core automation, then we expand from there."</td></tr>
        <tr><td>"We could build this ourselves"</td><td>"Absolutely — I can also give you the deployment package so your team runs it. The fee covers the design and delivery, not a licence."</td></tr>
        <tr><td>"What if it doesn't work?"</td><td>"The workflow runs in supervised mode — every output is reviewed before anything is posted or sent. You control when to increase autonomy."</td></tr>
      </tbody>
    </table>
  </div>
  <div class="footer"><span>Pricing Guide — ${firm}</span><span>For internal use only · ${today()}</span></div>
</div></body></html>`;
}

// ─── 4. Discovery Call Questions ──────────────────────────────────────────────

export function generateDiscoveryQuestions(branding: ProposalBranding = {}): string {
  const accent = branding.accentColor ?? "#6d28d9";
  const firm = branding.firmName ?? "PAI Consulting";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Discovery Questions — ${firm}</title><style>${kitStyles(accent)}
  .q-block { border-left: 3px solid ${accent}; padding: 14px 18px; margin-bottom: 12px; background: #fafafa; border-radius: 0 8px 8px 0; }
  .q-text { font-weight: 600; font-size: 13px; color: #0f172a; margin-bottom: 5px; }
  .q-note { font-size: 11px; color: #64748b; font-style: italic; line-height: 1.5; }
  .q-space { height: 40px; border-bottom: 1px dashed #e2e8f0; margin-top: 6px; }
  </style></head><body>
${printBar("Discovery Call Questions")}
<div class="page">
  <div class="header">
    <div class="header-label">Discovery Toolkit</div>
    <div class="header-title">Client Discovery Questions</div>
    <div class="header-sub">20 questions to run a 90-minute discovery session and map any business process</div>
  </div>
  <div class="content">
    <div class="callout" style="margin-top:0">
      <strong>How to use this:</strong> Print this sheet and bring it to your discovery call. You won't ask every question — use it as a guide. The goal is to understand the process well enough to map it in PAI Studio and identify where AI automation adds the most value.
    </div>

    <h2>1. Context & Process Overview</h2>
    ${[
      { q: "Walk me through this process from start to finish — pretend I'm a new employee shadowing you.", note: "Let them talk. Don't interrupt. You're mapping the real process, not the documented one." },
      { q: "How often does this process run? Daily, weekly, per transaction?", note: "This feeds directly into your ROI calculation — occurrences × time = annual cost." },
      { q: "How many people are involved? What are their roles?", note: "Each person = a Human node. Understand if they're approvers, doers, or just observers." },
      { q: "Where does it start? What triggers the process?", note: "This becomes your trigger node in PAI Studio — email, form submission, calendar event, etc." },
      { q: "Where does it end? What's the final output or action?", note: "What does 'done' look like? What system gets updated, what gets sent, what gets filed?" },
    ].map((item) => `<div class="q-block"><div class="q-text">${item.q}</div><div class="q-note">${item.note}</div><div class="q-space"></div></div>`).join("")}

    <h2>2. Time & Cost</h2>
    ${[
      { q: "Roughly how long does each step take when things go normally?", note: "Get a number. Even a rough estimate. 5 minutes, 30 minutes, 2 hours. This is your ROI data." },
      { q: "What's the most time-consuming part of this process for your team?", note: "That's your highest-value automation target." },
      { q: "Does this process ever create backlogs or bottlenecks? When?", note: "Pain points = selling points. This belongs in the proposal." },
      { q: "How many hours per week does your team spend on this process in total?", note: "Multiply by fully-loaded salary rate to get annual cost. That's your ROI anchor." },
    ].map((item) => `<div class="q-block"><div class="q-text">${item.q}</div><div class="q-note">${item.note}</div><div class="q-space"></div></div>`).join("")}

    <h2>3. Systems & Data</h2>
    ${[
      { q: "What systems do you use in this process? (Email, ERP, CRM, spreadsheets, etc.)", note: "Each system is a potential integration node. Check if they have APIs or if you'll need workarounds." },
      { q: "Where does the data come from? Is it structured (forms, databases) or unstructured (emails, PDFs)?", note: "Unstructured = AI extraction skill. Structured = direct API call. Very different complexity." },
      { q: "Are there any documents involved — forms, PDFs, emails, spreadsheets?", note: "Documents to process = big opportunity. PDF extraction and email parsing are high-ROI automations." },
      { q: "Where does the final output go? Which system does it need to end up in?", note: "The write-back step is often where the most friction is. This is where blast radius matters." },
    ].map((item) => `<div class="q-block"><div class="q-text">${item.q}</div><div class="q-note">${item.note}</div><div class="q-space"></div></div>`).join("")}

    <h2>4. Exceptions & Approvals</h2>
    ${[
      { q: "Does this process always follow the same path, or are there exceptions?", note: "Exceptions = Human nodes in the future state. 'When amount > $10K, finance director approves' is a perfect human gate." },
      { q: "Who has approval authority at each step? Can anyone approve, or specific people?", note: "Named approvers become escalation targets in the contract." },
      { q: "What happens when something goes wrong? What's the fallback process?", note: "This becomes your escalation policy — who gets notified, what's the manual override." },
      { q: "Are there regulatory or compliance requirements that affect this process?", note: "Compliance requirements = lower autonomy levels + stricter output contracts. Adjust pricing up." },
    ].map((item) => `<div class="q-block"><div class="q-text">${item.q}</div><div class="q-note">${item.note}</div><div class="q-space"></div></div>`).join("")}

    <h2>5. Readiness & Buy-In</h2>
    ${[
      { q: "Who will own this automation after it's deployed — IT, operations, or the business team?", note: "This tells you who to train in the handoff session and whose sign-off you need." },
      { q: "Has your team tried to automate this before? What happened?", note: "Previous failure = objection to handle. Previous attempt = you'll know the blockers." },
      { q: "What would need to be true for this to be a success — for you personally?", note: "This is the success metric. Reference it in the proposal and the go-live checklist." },
      { q: "Is there anything about this process that definitely can't be touched by automation?", note: "Scope the blast radius. Some things are sacred — legal holds, personal data, regulated outputs." },
    ].map((item) => `<div class="q-block"><div class="q-text">${item.q}</div><div class="q-note">${item.note}</div><div class="q-space"></div></div>`).join("")}

    <div class="callout" style="margin-top:32px">
      <strong>After the call:</strong> Open PAI Studio, load the closest template, and spend 20 minutes customising it to what you heard. Export the proposal. Send it within 24 hours of the discovery call — while the conversation is still fresh in their mind and yours.
    </div>
  </div>
  <div class="footer"><span>Discovery Questions — ${firm}</span><span>${today()}</span></div>
</div></body></html>`;
}

// ─── Open helpers ─────────────────────────────────────────────────────────────

function openDoc(html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function openSOW(branding?: ProposalBranding): void { openDoc(generateSOW(branding ?? loadBranding())); }
export function openServiceAgreement(branding?: ProposalBranding): void { openDoc(generateServiceAgreement(branding ?? loadBranding())); }
export function openPricingGuide(branding?: ProposalBranding): void { openDoc(generatePricingGuide(branding ?? loadBranding())); }
export function openDiscoveryQuestions(branding?: ProposalBranding): void { openDoc(generateDiscoveryQuestions(branding ?? loadBranding())); }
