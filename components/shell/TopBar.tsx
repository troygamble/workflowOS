"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Mode } from "@/lib/types/workflow";
import { LS_KEY, useWorkflowStore } from "@/store/workflow-store";
import { useRuntimeStore } from "@/store/runtime-store";
import { deriveState } from "@/lib/state/state-engine";
import { buildShareUrl } from "@/lib/io/share-link";
import { ExportWfosModal } from "@/components/shell/ExportWfosModal";
import { CommunityBrowserModal } from "@/components/community/CommunityBrowserModal";
import { BrandingModal } from "@/components/shell/BrandingModal";
import { ProjectsModal } from "@/components/shell/ProjectsModal";
import { saveProject, getActiveProjectId } from "@/lib/projects";
import UpgradeModal, { type UpgradeMode } from "@/components/shell/UpgradeModal";
import { useAuth, useUser, UserButton, SignInButton } from "@clerk/nextjs";
import { AboutModal } from "@/components/shell/AboutModal";
import { openProposal, loadBranding } from "@/lib/io/proposal-html";
import { openDemoEngagement } from "@/lib/demo/demo-engagement";
import { openSOW, openServiceAgreement, openPricingGuide, openDiscoveryQuestions } from "@/lib/kit/consulting-kit";
import { features } from "@/lib/platform";
import { hasStudioOpenAiKey } from "@/lib/studio/openai-key-client";
import type { toPng as ToPng } from "html-to-image";

// ─── Styles ───────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(148,163,184,0.14)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 12px",
  height: 56,
  flexShrink: 0,
  background: "linear-gradient(180deg, rgba(9,18,34,0.96) 0%, rgba(5,10,20,0.94) 100%)",
  position: "relative",
  zIndex: 200,
  overflowX: "clip",
  boxShadow: "0 16px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
  backdropFilter: "blur(18px) saturate(1.2)",
  WebkitBackdropFilter: "blur(18px) saturate(1.2)",
};

const btn: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 8,
  background: "rgba(15,23,42,0.34)",
  color: "#9aa8bd",
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

// Grouped button container — wraps related controls in a subtle pill
const btnGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  background: "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(7,13,26,0.72))",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 9,
  padding: "3px 4px",
  flexShrink: 0,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 22px rgba(0,0,0,0.16)",
};

const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "linear-gradient(180deg, transparent, rgba(148,163,184,0.24), transparent)",
  flexShrink: 0,
  marginInline: 2,
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid #7c3aed55",
  color: "#c4b5fd",
  fontWeight: 600,
  background: "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(14,165,233,0.08))",
  boxShadow: "0 0 0 1px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** Compact health summary — shows a single status dot, expands on hover */
function HealthSummary({ health }: { health: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const issues = health.errors + health.blocked + health.missing + health.stale;
  const running = health.running;
  const color = issues > 0 ? "#ef4444" : running > 0 ? "#3b82f6" : "#22c55e";
  const label = issues > 0 ? `${issues} issue${issues !== 1 ? "s" : ""}` : running > 0 ? `${running} running` : "healthy";

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        style={{ ...btn, display: "flex", alignItems: "center", gap: 5, borderColor: color + "44", color }}
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((o) => !o)}
        title="Workflow health — hover for details"
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: running > 0 ? `0 0 6px ${color}` : "none" }} />
        <span style={{ fontSize: 11 }}>{label}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(8,14,28,0.96))", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "10px 14px", minWidth: 180, zIndex: 500, boxShadow: "0 18px 48px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.05)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
          {[
            { label: "Ready",     count: health.ready,     color: "#22c55e" },
            { label: "Blocked",   count: health.blocked,   color: "#ef4444" },
            { label: "Running",   count: health.running,   color: "#3b82f6" },
            { label: "Stale",     count: health.stale,     color: "#f59e0b" },
            { label: "Missing",   count: health.missing,   color: "#f97316" },
            { label: "Proposals", count: health.proposals, color: "#a855f7" },
            { label: "Errors",    count: health.errors,    color: "#ef4444" },
          ].map(({ label, count, color: c }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: 12, padding: "3px 0", color: count > 0 ? c : "#334155" }}>
              <span>{label}</span>
              <span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ⋯ More dropdown — secondary/occasional actions */
function MoreMenu({
  onCommunity, onBranding, onWfos, onShare, onSave, onTutorial, onAbout, onExportDiagram,
  onOpenApiKey,
  hasDesktop,
  onUpgrade,
}: {
  onCommunity: () => void;
  onBranding: () => void;
  onWfos: () => void;
  onShare: () => void;
  onSave: () => void;
  onTutorial: () => void;
  onAbout: () => void;
  onExportDiagram: () => void;
  onOpenApiKey: () => void;
  hasDesktop: boolean;
  onUpgrade: (feature: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);

  const item = (icon: string, label: string, action: () => void, sub?: boolean) => (
    <button
      key={label}
      type="button"
      onClick={() => { action(); if (!sub) setOpen(false); }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: sub ? "7px 14px 7px 30px" : "9px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "#94a3b8", fontSize: 12 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onMouseLeave={() => { setOpen(false); setKitOpen(false); }}>
      <button
        type="button"
        style={{ ...btn, fontSize: 14, padding: "4px 8px", letterSpacing: "0.05em" }}
        onClick={() => setOpen((o) => !o)}
        title="More actions"
      >
        ⋯
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "linear-gradient(180deg, rgba(10,15,30,0.98), rgba(5,10,20,0.98))", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, padding: "6px 0", minWidth: 210, zIndex: 600, boxShadow: "0 24px 68px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.05)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>

          {item("✦", "Demo Engagement", () => openDemoEngagement())}
          <div style={{ height: 1, background: "#1e293b", margin: "4px 0" }} />

          {/* Consulting Kit submenu */}
          <button
            type="button"
            onClick={() => setKitOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", color: hasDesktop ? "#94a3b8" : "#475569", fontSize: 12 }}
            onMouseEnter={(e) => { if (hasDesktop) { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = hasDesktop ? "#94a3b8" : "#475569"; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>💼</span>
              <span>Consulting Kit</span>
              {!hasDesktop && <span style={{ fontSize: 10, background: "#7c3aed22", color: "#7c3aed", border: "1px solid #7c3aed44", borderRadius: 4, padding: "1px 5px" }}>Desktop</span>}
            </span>
            <span style={{ color: "#475569", fontSize: 10 }}>▾</span>
          </button>
          {kitOpen && hasDesktop && (
            <>
              {item("📋", "Statement of Work",    () => { openSOW();                  setOpen(false); setKitOpen(false); }, true)}
              {item("🤝", "Service Agreement",    () => { openServiceAgreement();     setOpen(false); setKitOpen(false); }, true)}
              {item("💰", "Pricing Guide",        () => { openPricingGuide();         setOpen(false); setKitOpen(false); }, true)}
              {item("🔍", "Discovery Questions",  () => { openDiscoveryQuestions();   setOpen(false); setKitOpen(false); }, true)}
            </>
          )}
          {kitOpen && !hasDesktop && (
            <div style={{ padding: "6px 30px 10px", fontSize: 11, color: "#475569" }}>Available in desktop app</div>
          )}

          <div style={{ height: 1, background: "#1e293b", margin: "4px 0" }} />

          {item("🌐", "Community Templates", onCommunity)}
          {item("📦", "Export .wfos Bundle",
            hasDesktop ? onWfos : () => onUpgrade("Export .wfos")
          )}
          <div style={{ height: 1, background: "#1e293b", margin: "4px 0" }} />
          {item("🎨", "Branding Settings", onBranding)}
          {item("🔑", "OpenAI API key", onOpenApiKey)}
          {item("🔗", "Copy Share Link", onShare)}
          {item("🖼", "Export Diagram PNG", onExportDiagram)}
          {item("💾", "Save to Browser",   onSave)}
          {item("🎯", "Take the Tour",     onTutorial)}
          <div style={{ height: 1, background: "#1e293b", margin: "4px 0" }} />
          {item("ℹ", "About PAI Studio",  () => { onAbout(); setOpen(false); })}
        </div>
      )}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  mode: Mode;
  onMode: (m: Mode) => void;
  onPresent: () => void;
  onImportProject: (file: File) => void;
  onOpenHealer?: () => void;
  onOpenExecBrief?: () => void;
  onOpenAutomate?: () => void;
  onOpenTemplates?: () => void;
  onOpenPSFAnalyzer?: () => void;
  onOpenApiKey?: () => void;
};

// ─── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar({ mode, onMode, onImportProject, onOpenHealer, onOpenExecBrief, onOpenAutomate, onOpenTemplates, onOpenPSFAnalyzer, onOpenApiKey }: Props) {
  const [wfosOpen,     setWfosOpen]     = useState(false);
  const [communityOpen,setCommunityOpen]= useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [cpapNudge,    setCpapNudge]    = useState(false);

  const handleExportDiagram = async () => {
    const el = document.querySelector(".react-flow") as HTMLElement | null;
    if (!el) { alert("Canvas not ready — open a workflow first."); return; }
    try {
      const { toPng } = await import("html-to-image") as { toPng: typeof ToPng };
      const dataUrl = await toPng(el, {
        backgroundColor: "#070d1a",
        pixelRatio: 2,
        filter: (node: Element) => {
          if (node.classList?.contains("react-flow__controls")) return false;
          if (node.classList?.contains("react-flow__attribution")) return false;
          if (node.classList?.contains("react-flow__minimap")) return false;
          return true;
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(workflow.name || "workflow").replace(/\s+/g, "_")}_diagram.png`;
      a.click();
    } catch (e) {
      console.error("Diagram export failed:", e);
      alert("Diagram export failed. Try zooming to fit first (Cmd/Ctrl+Shift+F).");
    }
  };
  const [upgradeMode, setUpgradeMode] = useState<UpgradeMode>(null);
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const userPlan = user?.publicMetadata?.plan as string | undefined;
  const isPro = isSignedIn && (userPlan === "pro" || userPlan === "agency");
  const [aboutOpen, setAboutOpen] = useState(false);

  const hasDesktop = isPro || features.proposal(userPlan); // Pro subscribers OR desktop app

  const {
    workflow, validation, setWorkflowName, setWorkflow, runValidation,
    getNextStep, selectNode, exportZip, undo, redo,
    canUndo, canRedo, applyAutoLayout, newWorkflow,
  } = useWorkflowStore();

  const jobs   = useRuntimeStore((s) => s.jobs);
  const nameRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);
  const next = getNextStep(jobs);
  const isEmpty = workflow.nodes.filter((n) => n.type !== "proposal").length === 0;

  const running = useMemo(
    () => new Set(jobs.filter((j) => j.status === "running").map((j) => j.stepId)),
    [jobs],
  );
  const failed = useMemo(
    () => new Set(jobs.filter((j) => j.status === "failed").map((j) => j.stepId)),
    [jobs],
  );
  const derived = useMemo(() => deriveState(workflow, running, failed), [workflow, running, failed]);

  const health = useMemo(() => {
    const sv = Object.values(derived.skills);
    const av = Object.values(derived.artifacts);
    return {
      ready:     sv.filter((s) => s.status === "ready").length,
      blocked:   sv.filter((s) => s.status === "blocked").length,
      running:   sv.filter((s) => s.status === "running").length,
      stale:     av.filter((a) => a.status === "stale").length,
      missing:   av.filter((a) => a.status === "missing").length,
      proposals: workflow.nodes.filter((n) => n.type === "proposal" && n.data.status === "pending").length,
      errors:    validation.issues.filter((i) => i.severity === "error").length,
    };
  }, [derived, workflow.nodes, validation]);

  const modeColors: Record<Mode, string> = { design: "#475569", state: "#f59e0b", run: "#3b82f6" };

  const shareWorkflow = async () => {
    try {
      const url = await buildShareUrl(useWorkflowStore.getState().workflow);
      await navigator.clipboard.writeText(url);
      window.alert("Share link copied!\n\n" + url);
    } catch { window.alert("Failed to build share link."); }
  };

  const guard = (_featureName: string, action: () => void, flag: () => boolean) => () => {
    if (!isSignedIn) { setUpgradeMode("auth"); return; }
    if (!hasStudioOpenAiKey()) { onOpenApiKey?.(); return; }
    if (!flag()) { setUpgradeMode("pro"); return; }
    action();
  };

  return (
    <header style={headerStyle}>

      {/* ── Brand ── */}
      <Link href="/studio" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0, marginRight: 4 }} title="WorkflowOS home">
        <svg viewBox="0 0 64 64" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="13" fill="#070d1a" stroke="#1e2d4a" strokeWidth="1"/>
          <line x1="12" y1="12" x2="22" y2="42" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="22" y1="42" x2="32" y2="22" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="32" y1="22" x2="42" y2="42" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="42" y1="42" x2="52" y2="12" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="4.5" fill="#6d28d9"/>
          <circle cx="22" cy="42" r="4.5" fill="#6d28d9"/>
          <circle cx="32" cy="22" r="6" fill="#a78bfa"/>
          <circle cx="42" cy="42" r="4.5" fill="#6d28d9"/>
          <circle cx="52" cy="12" r="4.5" fill="#6d28d9"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Workflow<span style={{ color: "#a78bfa" }}>OS</span></span>
      </Link>

      <div style={divider} />

      {/* ── File actions group ── */}
      <div style={btnGroup}>
        <button
          type="button"
          style={{ ...btn, color: "#475569", fontSize: 11, border: "none", background: "transparent" }}
          onClick={() => {
            if (workflow.nodes.length === 0 || window.confirm("Start a new workflow?")) newWorkflow();
          }}
          title="New workflow"
        >New</button>
        <button type="button" style={{ ...btn, border: "none", background: "transparent" }} onClick={onOpenTemplates} title="Load a template">
          📁 Templates
        </button>
        <button
          type="button"
          style={{ ...btn, border: "none", background: "transparent" }}
          onClick={() => setProjectsOpen(true)}
          title="Open a saved project"
        >
          🗂 Projects
        </button>
      </div>

      {/* Workflow name */}
      <input
        ref={nameRef}
        key={workflow.id}
        defaultValue={workflow.name}
        onBlur={() => {
          if (nameRef.current?.value) {
            setWorkflowName(nameRef.current.value);
            // Auto-save to project store
            const wf = { ...workflow, name: nameRef.current.value };
            saveProject(wf, getActiveProjectId() ?? undefined);
          }
        }}
        style={{ minWidth: 100, maxWidth: 200, fontWeight: 600, fontSize: 12, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis" }}
        aria-label="Workflow name"
      />

      <div style={divider} />

      {/* ── Mode switcher ── */}
      <div style={{ display: "flex", gap: 1, border: "1px solid #1a2540", borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
        {(["design", "state", "run"] as Mode[]).map((m) => {
          const modeDisabled = isEmpty && m !== "design";
          return (
            <button key={m} type="button"
              disabled={modeDisabled}
              onClick={() => { if (!modeDisabled) onMode(m); }}
              style={{
                ...btn, border: "none", borderRadius: 0, padding: "4px 10px",
                background: mode === m ? modeColors[m] + "22" : "transparent",
                color: modeDisabled ? "#1e2d3a" : mode === m ? modeColors[m] : "#334155",
                borderBottom: mode === m ? `2px solid ${modeColors[m]}` : "2px solid transparent",
                fontWeight: mode === m ? 700 : 400,
                textTransform: "capitalize",
                cursor: modeDisabled ? "not-allowed" : "pointer",
                opacity: modeDisabled ? 0.4 : 1,
              }}
            >{m}</button>
          );
        })}
      </div>

      <div style={divider} />

      {/* ── Edit controls group ── */}
      <div style={btnGroup}>
        <button type="button" style={{ ...btn, border: "none", background: "transparent", opacity: canUndo() ? 1 : 0.25 }} disabled={!canUndo()} onClick={undo} title="Undo (Cmd+Z)">↩</button>
        <button type="button" style={{ ...btn, border: "none", background: "transparent", opacity: canRedo() ? 1 : 0.25 }} disabled={!canRedo()} onClick={redo} title="Redo (Cmd+Shift+Z)">↪</button>
        <button type="button"
          style={{ ...btn, border: "none", background: "transparent", opacity: isEmpty ? 0.2 : 1, cursor: isEmpty ? "not-allowed" : "pointer" }}
          disabled={isEmpty}
          onClick={applyAutoLayout}
          title={isEmpty ? "Add nodes to auto-layout" : "Auto-layout (arrange nodes)"}
        >⊞</button>
      </div>

      <div style={divider} />

      {/* ── AI + Validation actions group ── */}
      <div style={btnGroup}>
        <button
          type="button"
          style={{ ...btn, border: "none", background: "transparent",
            color: isEmpty ? "#1e2d3a" : health.errors > 0 ? "#ef4444" : "#64748b",
            opacity: isEmpty ? 0.4 : 1,
            cursor: isEmpty ? "not-allowed" : "pointer",
          }}
          disabled={isEmpty}
          onClick={runValidation}
          title={isEmpty ? "Add nodes first" : "Validate workflow"}
        >Validate</button>

        <button type="button"
          style={{ ...btn, border: "none", background: "transparent", color: isEmpty ? "#1e2d3a" : "#a78bfa", opacity: isEmpty ? 0.3 : 1, cursor: isEmpty ? "not-allowed" : "pointer" }}
          disabled={isEmpty}
          onClick={isEmpty ? undefined : guard("AI Heal", onOpenHealer ?? (() => {}), features.aiHeal.bind(null, userPlan))}
          title={isEmpty ? "Add nodes first" : "AI-assisted workflow repair"}
        >⚕ Heal</button>

        <button type="button"
          style={{ ...btn, border: "none", background: "transparent", color: isEmpty ? "#1e2d3a" : "#60a5fa", opacity: isEmpty ? 0.3 : 1, cursor: isEmpty ? "not-allowed" : "pointer" }}
          disabled={isEmpty}
          onClick={isEmpty ? undefined : (onOpenPSFAnalyzer ?? (() => {}))}
          title={isEmpty ? "Add nodes first" : "Analyse workflow against PSF 8 domains"}
        >🛡️ PSF</button>

        <button type="button"
          style={{ ...btn, border: "none", background: "transparent", color: isEmpty ? "#1e2d3a" : "#67e8f9", opacity: isEmpty ? 0.3 : 1, cursor: isEmpty ? "not-allowed" : "pointer" }}
          disabled={isEmpty}
          data-tour-id="brief-btn"
        onClick={isEmpty ? undefined : guard("Executive Brief", onOpenExecBrief ?? (() => {}), features.aiExecBrief.bind(null, userPlan))}
          title={isEmpty ? "Add nodes first" : "Generate executive brief"}
        >📋 Brief</button>
      </div>

      {workflow.workflowType === "current_state" && (
        <button type="button"
          style={{ ...primaryBtn, borderColor: "#7c3aed66", color: "#c4b5fd" }}
          onClick={guard("Automate This", onOpenAutomate ?? (() => {}), features.aiAutomate.bind(null, userPlan))}
          title="Generate the automated future-state version"
        >⚡ Automate</button>
      )}

      {next && (
        <button
          type="button"
          style={{ ...btn, borderColor: "#22c55e44", color: "#22c55e", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
          onClick={() => selectNode(next.stepId)}
          title={`Next: ${next.stepId} — ${next.reason}`}
        >▶ {next.stepId}</button>
      )}

      {/* ── Health summary (collapsible) ── */}
      <HealthSummary health={health} />

      {/* ── Right side — primary export actions ── */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>

        <button
          type="button"
          style={{
            ...btn,
            borderColor: isEmpty ? "#131e30" : "#22c55e44",
            color: isEmpty ? "#1e2d3a" : "#4ade80",
            fontWeight: 700,
            opacity: isEmpty ? 0.3 : 1,
            cursor: isEmpty ? "not-allowed" : "pointer",
            background: isEmpty ? "transparent" : "#22c55e0c",
            padding: "5px 11px",
          }}
          disabled={isEmpty}
          data-tour-id="proposal-btn"
          onClick={isEmpty ? undefined : guard("Client Proposal", () => openProposal(workflow, loadBranding()), features.proposal.bind(null, userPlan))}
          title={isEmpty ? "Add nodes first" : "Generate client-ready proposal PDF"}
        >📄 Proposal</button>

        <button
          type="button"
          style={{
            ...primaryBtn,
            borderColor: isEmpty ? "#131e30" : "#3b82f644",
            color: isEmpty ? "#1e2d3a" : "#93c5fd",
            opacity: isEmpty ? 0.3 : 1,
            cursor: isEmpty ? "not-allowed" : "pointer",
            background: isEmpty ? "transparent" : "#3b82f60c",
            padding: "5px 11px",
          }}
          disabled={isEmpty}
          data-tour-id="export-btn"
          onClick={isEmpty ? undefined : guard("Export ZIP", () => { void exportZip(); setTimeout(() => setCpapNudge(true), 1200); }, features.exportZip.bind(null, userPlan))}
          title={isEmpty ? "Add nodes first" : "Export deployment ZIP with skill contracts"}
        >⬇ Export</button>

        {/* Hidden file import */}
        <input ref={projectImportRef} type="file" accept=".zip,.wfos" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportProject(f); e.target.value = ""; }}
        />

        {isSignedIn && !hasStudioOpenAiKey() && (
          <button
            type="button"
            onClick={() => onOpenApiKey?.()}
            style={{ ...btn, borderColor: "#f59e0b66", color: "#fcd34d", padding: "5px 11px" }}
            title="AI features need your OpenAI API key"
          >
            Add API key
          </button>
        )}

        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <SignInButton mode="modal">
            <button
              type="button"
              style={{ ...btn, borderColor: "#3b82f644", color: "#93c5fd", padding: "5px 11px" }}
            >Sign in</button>
          </SignInButton>
        )}

        <MoreMenu
          onCommunity={() => setCommunityOpen(true)}
          onBranding={() => setBrandingOpen(true)}
          onExportDiagram={handleExportDiagram}
          onWfos={() => setWfosOpen(true)}
          onShare={() => void shareWorkflow()}
          onSave={() => localStorage.setItem(LS_KEY, JSON.stringify(useWorkflowStore.getState().workflow))}
          onTutorial={() => { const fn = (window as unknown as Record<string, unknown>).__wfosStartTutorial; if (typeof fn === "function") (fn as () => void)(); }}
          onAbout={() => setAboutOpen(true)}
          onOpenApiKey={() => onOpenApiKey?.()}
          hasDesktop={hasDesktop}
          onUpgrade={() => setUpgradeMode(isSignedIn ? "pro" : "auth")}
        />
      </div>

      {/* ── CPAP portfolio nudge ── */}
      {cpapNudge && !isEmpty && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "linear-gradient(135deg, #4c1d95, #2e1065)",
          border: "1px solid #7c3aed66",
          borderRadius: 12, padding: "14px 18px",
          boxShadow: "0 8px 32px #0008",
          display: "flex", alignItems: "center", gap: 14,
          maxWidth: 360, animation: "fadeInUp 0.3s ease",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              Portfolio-ready deployment?
            </div>
            <div style={{ fontSize: 13, color: "#e9d5ff", lineHeight: 1.4 }}>
              Submit this workflow for <strong style={{ color: "white" }}>CPAP certification</strong> — your real deployment, professionally assessed.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <a href="https://www.productionai.institute/certify/cpap" target="_blank" rel="noopener noreferrer"
              style={{ background: "#7c3aed", color: "white", fontWeight: 700, fontSize: 11, padding: "7px 12px", borderRadius: 7, textDecoration: "none", textAlign: "center", whiteSpace: "nowrap" }}>
              CPAP $297 →
            </a>
            <button onClick={() => setCpapNudge(false)}
              style={{ background: "transparent", border: "none", color: "#7c3aed99", fontSize: 11, cursor: "pointer", padding: "2px 0" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {wfosOpen      && <ExportWfosModal      onClose={() => setWfosOpen(false)} />}
      {communityOpen && <CommunityBrowserModal onClose={() => setCommunityOpen(false)} />}
      {brandingOpen  && <BrandingModal         onClose={() => setBrandingOpen(false)} />}
      {projectsOpen && (
        <ProjectsModal
          currentWorkflow={workflow}
          onClose={() => setProjectsOpen(false)}
          onLoad={(wf, id) => {
            import("@/lib/projects").then(({ setActiveProjectId }) => setActiveProjectId(id));
            setWorkflow(wf, true);
            setProjectsOpen(false);
          }}
          onNew={() => {
            if (workflow.nodes.length === 0 || window.confirm("Save current work and start a new project?")) {
              saveProject(workflow, getActiveProjectId() ?? undefined);
              newWorkflow();
              setProjectsOpen(false);
            }
          }}
        />
      )}
      <UpgradeModal
        open={upgradeMode !== null}
        mode={upgradeMode}
        onClose={() => setUpgradeMode(null)}
      />
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </header>
  );
}
