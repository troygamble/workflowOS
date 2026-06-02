import type { ExecutiveBriefResponse } from "@/app/api/executive-brief/route";

// ─── Palette ──────────────────────────────────────────────────────────────────


// ─── ROI helpers ──────────────────────────────────────────────────────────────

const HOURLY_RATE = 80;
const PS_DAY_RATE = 1500;

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

const PHASE_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#22c55e","#f59e0b","#ec4899"];

// ─── HTML generator ───────────────────────────────────────────────────────────

export function generateFlowViewHtml(brief: ExecutiveBriefResponse): string {
  const readinessColor =
    brief.readinessScore >= 75 ? "#22c55e"
    : brief.readinessScore >= 50 ? "#f59e0b"
    : "#ef4444";

  const readinessLabel =
    brief.readinessScore >= 75 ? "Execution Ready"
    : brief.readinessScore >= 50 ? "Needs Refinement"
    : "Significant Gaps";

  // Build sequence (same logic as ExecutiveFlowView.tsx)
  type SeqItem =
    | { type: "trigger" }
    | { type: "phase"; phaseIndex: number }
    | { type: "gate"; humanIndex: number }
    | { type: "outputs" };

  const phases = brief.phases;
  const humans = brief.humanTouchpoints;
  const afterPhase = new Map<number, number[]>();

  for (let j = 0; j < humans.length; j++) {
    const words = humans[j].name.toLowerCase().replace(/_/g," ").split(" ").filter(w => w.length > 3);
    let best = -1;
    for (let i = 0; i < phases.length; i++) {
      const text = (phases[i].name + " " + phases[i].steps.join(" ")).toLowerCase();
      if (words.some(w => text.includes(w))) { best = i; break; }
    }
    if (best === -1) best = Math.min(phases.length - 1, Math.floor((j / humans.length) * phases.length));
    const arr = afterPhase.get(best) ?? [];
    arr.push(j);
    afterPhase.set(best, arr);
  }

  const seq: SeqItem[] = [{ type: "trigger" }];
  for (let i = 0; i < phases.length; i++) {
    seq.push({ type: "phase", phaseIndex: i });
    for (const hIdx of afterPhase.get(i) ?? []) {
      seq.push({ type: "gate", humanIndex: hIdx });
    }
  }
  if (brief.keyOutputs.length > 0) seq.push({ type: "outputs" });

  // ─── Render helpers ────────────────────────────────────────────────────────

  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const clean = (s: string) => esc(s.replace(/_/g," "));

  function connector(color = "#1e293b") {
    return `<div style="width:2px;height:22px;background:${color};margin:0 auto;"></div>`;
  }

  function triggerBlock(): string {
    // Extract trigger hint from first phase steps or summary
    const hint = brief.summary.split(".")[0] ?? "Workflow initiated";
    return `
      <div style="background:linear-gradient(135deg,#0c1a2e,#0d2040);border:1.5px solid #1e3a5f;border-radius:12px;padding:18px 22px;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#67e8f9;text-transform:uppercase;margin-bottom:8px;">⚡ Workflow Trigger</div>
        <div style="font-size:15px;font-weight:800;color:#f1f5f9;margin-bottom:6px;">${esc(brief.title)}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.5;">${esc(hint)}.</div>
      </div>`;
  }

  function phaseBlock(idx: number, isLast: boolean): string {
    const phase = phases[idx];
    const color = PHASE_COLORS[idx % PHASE_COLORS.length];
    const looksAutomated = !phase.steps.some(s => /human|review|approv|decision|judgment|manual|director|sponsor/i.test(s));
    const stepsHtml = phase.steps.slice(0, 4).map(s =>
      `<div style="display:flex;gap:8px;font-size:12px;color:#94a3b8;margin-bottom:3px;">
        <span style="color:${color}99;flex-shrink:0;">›</span><span>${esc(s)}</span>
      </div>`
    ).join("");

    return `
      <div style="background:#0f172a;border:1px solid ${color}33;border-left:4px solid ${color};border-radius:0 10px 10px 0;padding:16px 20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${color}20;border:1.5px solid ${color};color:${color};font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx+1}</div>
          <div style="font-size:14px;font-weight:700;color:#f1f5f9;flex:1;">${clean(phase.name)}</div>
          ${looksAutomated ? `<span style="font-size:10px;font-weight:700;background:#052e16;border:1px solid #166534;color:#86efac;border-radius:999px;padding:2px 8px;white-space:nowrap;">⚡ Automated</span>` : ""}
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:10px;line-height:1.5;">${esc(phase.description)}</div>
        ${stepsHtml}
      </div>`;
  }

  function gateBlock(hIdx: number): string {
    const h = humans[hIdx];
    return `
      ${connector("#7c3aed44")}
      <div style="width:82%;margin:0 auto;background:#1a1020;border:1.5px solid #7c3aed66;border-radius:10px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
        <div style="width:40px;height:40px;border-radius:50%;background:#7c3aed20;border:1.5px solid #7c3aed;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">👤</div>
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:800;letter-spacing:0.12em;color:#a78bfa;text-transform:uppercase;margin-bottom:5px;">Decision Required</div>
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:4px;">${clean(h.name)}</div>
          <div style="font-size:10px;color:#7c3aed;background:#7c3aed18;border:1px solid #7c3aed33;border-radius:999px;padding:1px 8px;display:inline-block;margin-bottom:6px;">${esc(h.role)}</div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;">${esc(h.decision)}</div>
        </div>
      </div>
      ${connector("#7c3aed44")}`;
  }

  function outputsBlock(): string {
    const chips = brief.keyOutputs.map(o => `
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:8px 14px;display:inline-block;margin:4px;">
        <div style="font-size:12px;font-weight:700;color:#86efac;">📄 ${clean(o.name.replace(/\.\w+$/,""))}</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">${esc(o.value)}</div>
      </div>`).join("");
    return `
      <div style="background:#0a1a12;border:1px solid #166534;border-radius:10px;padding:14px 18px;">
        <div style="font-size:9px;font-weight:700;color:#22c55e;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">What this workflow produces</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${chips}</div>
      </div>`;
  }

  function readinessFooter(): string {
    const deg = brief.readinessScore * 3.6;
    return `
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 18px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;">
        <div style="position:relative;width:52px;height:52px;flex-shrink:0;">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#1e293b" stroke-width="6"/>
            <circle cx="26" cy="26" r="22" fill="none" stroke="${readinessColor}" stroke-width="6"
              stroke-dasharray="${2*Math.PI*22}" stroke-dashoffset="${2*Math.PI*22*(1-brief.readinessScore/100)}"
              stroke-linecap="round" transform="rotate(-90 26 26)"/>
            <text x="26" y="28" text-anchor="middle" fill="${readinessColor}" font-size="12" font-weight="800">${brief.readinessScore}</text>
          </svg>
        </div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;color:${readinessColor};margin-bottom:4px;">${readinessLabel}</div>
          <div style="font-size:11px;color:#475569;line-height:1.6;">${esc(brief.readinessRationale)}</div>
        </div>
      </div>`;
  }

  // ─── Assemble sequence ─────────────────────────────────────────────────────

  const seqHtml = seq.map((item, i) => {
    const isLast = i === seq.length - 1;
    switch (item.type) {
      case "trigger":
        return triggerBlock() + (!isLast ? connector() : "");
      case "phase":
        return phaseBlock(item.phaseIndex, isLast) + (!isLast ? connector() : "");
      case "gate":
        return gateBlock(item.humanIndex);
      case "outputs":
        return connector() + outputsBlock();
    }
  }).join("\n");

  // ─── Automation summary bar ───────────────────────────────────────────────

  const bd = brief.automationBreakdown;
  const total = bd.automatedCount + bd.automatableSteps.length + bd.staysHumanSteps.length;
  const autoPct = total > 0 ? Math.round(((bd.automatedCount + bd.automatableSteps.length) / total) * 100) : 0;
  const alreadyPct = total > 0 ? Math.round((bd.automatedCount / total) * 100) : 0;

  const statsHtml = `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#3b82f6;text-transform:uppercase;margin-bottom:12px;">Automation Snapshot</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px;">
        ${bd.automatedCount > 0 ? `<div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:#22c55e;">${bd.automatedCount}</div><div style="font-size:10px;color:#64748b;text-transform:uppercase;">Already automated</div></div>` : ""}
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:#3b82f6;">${bd.automatableSteps.length}</div><div style="font-size:10px;color:#64748b;text-transform:uppercase;">Can automate</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:#f59e0b;">${bd.staysHumanSteps.length}</div><div style="font-size:10px;color:#64748b;text-transform:uppercase;">Stays human</div></div>
        ${bd.weeklySavedHours != null ? `<div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:#a78bfa;">${bd.weeklySavedHours}h</div><div style="font-size:10px;color:#64748b;text-transform:uppercase;">Saved/week</div></div>` : ""}
        ${bd.psDaysEstimate != null ? `<div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:#0891b2;">${bd.psDaysEstimate}d</div><div style="font-size:10px;color:#64748b;text-transform:uppercase;">PS to implement</div></div>` : ""}
      </div>
      <div style="background:#1e293b;border-radius:999px;height:6px;overflow:hidden;">
        <div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e ${alreadyPct}%,#3b82f6 ${alreadyPct}% ${autoPct}%,#1e293b ${autoPct}%);width:100%;"></div>
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">${autoPct}% automatable (today + with PS work)</div>
    </div>`;


  // ─── ROI section ─────────────────────────────────────────────────────────

  let roiHtml = "";
  if (bd.weeklySavedHours && bd.psDaysEstimate) {
    const annualSavings = Math.round(bd.weeklySavedHours * 52 * HOURLY_RATE);
    const psCost = Math.round(bd.psDaysEstimate * PS_DAY_RATE);
    const paybackMonths = psCost > 0 ? Math.ceil(psCost / (annualSavings / 12)) : 0;
    const threeYearNet = annualSavings * 3 - psCost;
    const roiPct = psCost > 0 ? Math.round((threeYearNet / psCost) * 100) : 0;

    const roiItems = [
      { label: "Hours saved / week", value: `${bd.weeklySavedHours}h`, color: "#a78bfa" },
      { label: "Annual savings", value: fmtMoney(annualSavings), color: "#22c55e" },
      { label: "PS cost to implement", value: fmtMoney(psCost), color: "#0891b2" },
      { label: "Payback period", value: `${paybackMonths} months`, color: "#f59e0b" },
      { label: "3-year net benefit", value: fmtMoney(threeYearNet), color: "#22c55e" },
      { label: "3-year ROI", value: `${roiPct}%`, color: "#86efac" },
    ];

    const roiCells = roiItems.map((item, i) => `
      <div style="flex:1 1 30%;min-width:100px;padding:10px 12px;${i % 3 !== 2 ? "border-right:1px solid #1a2e1a;" : ""}${i < 3 ? "border-bottom:1px solid #1a2e1a;" : ""}">
        <div style="font-size:20px;font-weight:800;color:${item.color};line-height:1;margin-bottom:4px;">${item.value}</div>
        <div style="font-size:10px;color:#4ade80;text-transform:uppercase;letter-spacing:0.06em;">${item.label}</div>
      </div>`).join("");

    roiHtml = `
      <div style="margin-bottom:24px;padding:16px 20px;background:linear-gradient(135deg,#0a1a0a,#061a0c);border:1.5px solid #166534;border-radius:10px;">
        <div style="font-size:10px;font-weight:700;color:#22c55e;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">Business Case — Automation ROI</div>
        <div style="display:flex;flex-wrap:wrap;">${roiCells}</div>
        <div style="margin-top:12px;font-size:10px;color:#166534;line-height:1.5;">
          Assumptions: $${HOURLY_RATE}/hr avg. knowledge-worker cost &middot; $${PS_DAY_RATE.toLocaleString()}/day PS rate &middot; ${bd.weeklySavedHours}h/week freed from manual work
        </div>
      </div>`;
  }

  // ─── Full document ─────────────────────────────────────────────────────────

  const now = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(brief.title)} — Executive Brief</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#060d1c;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:0;}
  @media print{
    .no-print{display:none!important;}
    body{background:#fff;color:#111;}
  }
</style>
</head>
<body>

<div style="max-width:680px;margin:0 auto;padding:32px 20px 60px;">

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #1e293b;">
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;margin-bottom:6px;">Executive Brief</div>
      <div style="font-size:11px;color:#334155;">Generated ${now}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="background:#0f172a;border:1px solid #1e293b;color:#94a3b8;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>

  <!-- Title + summary -->
  <div style="margin-bottom:24px;padding:18px 22px;background:linear-gradient(135deg,#060d1f,#0d1a35);border:1px solid #1e3a5f;border-radius:12px;">
    <div style="font-size:22px;font-weight:800;color:#f1f5f9;line-height:1.3;margin-bottom:10px;">${esc(brief.title)}</div>
    <div style="font-size:13px;color:#94a3b8;line-height:1.7;">${esc(brief.summary)}</div>
  </div>

  <!-- Problem -->
  <div style="margin-bottom:24px;padding:14px 18px;background:#0f172a;border:1px solid #1e3a5f;border-radius:10px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#3b82f6;text-transform:uppercase;margin-bottom:8px;">Problem Being Solved</div>
    <div style="font-size:13px;color:#94a3b8;line-height:1.7;">${esc(brief.problem)}</div>
  </div>

  <!-- Automation stats -->
  ${statsHtml}

  <!-- ROI -->
  ${roiHtml}

  <!-- Flow sequence -->
  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#3b82f6;text-transform:uppercase;margin-bottom:12px;">How It Works</div>
  <div style="display:flex;flex-direction:column;margin-bottom:24px;">
    ${seqHtml}
  </div>

  <!-- Readiness -->
  ${readinessFooter()}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;font-size:10px;color:#334155;text-align:center;">
    Generated by PAI Studio &mdash; Confidential
  </div>

</div>
</body>
</html>`;
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadFlowViewHtml(brief: ExecutiveBriefResponse, filename?: string): void {
  const html = generateFlowViewHtml(brief);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = brief.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  a.href = url;
  a.download = filename ?? `exec-brief-${slug}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
