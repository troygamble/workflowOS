"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { NodePalette } from "@/components/shell/NodePalette";
import { WorkflowCanvas } from "@/components/graph/WorkflowCanvas";
import { ProcessView } from "@/components/views/ProcessView";
import { RunLogView } from "@/components/views/RunLogView";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { TimelinePanel } from "@/components/shell/TimelinePanel";
import { IngestionModal } from "@/components/shell/IngestionModal";
import { PresentationMode } from "@/components/shell/PresentationMode";
import { WorkflowWizard } from "@/components/ai/WorkflowWizard";
import UpgradeModal from "@/components/shell/UpgradeModal";
import { OpenAiKeyModal } from "@/components/shell/OpenAiKeyModal";
import { hasStudioOpenAiKey } from "@/lib/studio/openai-key-client";
import { useAuth, useUser } from "@clerk/nextjs";
import { features } from "@/lib/platform";
import { HealModal } from "@/components/ai/HealModal";
import { ExecutiveBriefModal } from "@/components/ai/ExecutiveBriefModal";
import { AutomateModal } from "@/components/ai/AutomateModal";
import { PSFAnalyzerPanel } from "@/components/ai/PSFAnalyzerPanel";
import { TemplatesModal } from "@/components/ai/TemplatesModal";
import { OnboardingModal, useOnboarding } from "@/components/shell/OnboardingModal";
import { GuidedTour, useGuidedTour } from "@/components/shell/GuidedTour";
import type { Mode, Workflow } from "@/lib/types/workflow";
import type { IngestionReport } from "@/lib/io/ingest-project";
import { LS_KEY, useWorkflowStore } from "@/store/workflow-store";
import { useRuntimeStore } from "@/store/runtime-store";

export function StudioApp() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const [mode, setMode] = useState<Mode>("design");
  const [presenting, setPresenting] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const userPlan = user?.publicMetadata?.plan as string | undefined;
  const isPro = isSignedIn && (userPlan === "pro" || userPlan === "agency");
  const searchParams = useSearchParams();

  // Auto-open upgrade modal when redirected from /pricing with ?upgrade=1
  useEffect(() => {
    if (searchParams.get("upgrade") === "1") {
      const id = window.setTimeout(() => setUpgradeFeature("Pro"), 0);
      return () => window.clearTimeout(id);
    }
  }, [searchParams]);

  useEffect(() => {
    const open = () => setApiKeyOpen(true);
    window.addEventListener("wfos:open-api-key", open);
    return () => window.removeEventListener("wfos:open-api-key", open);
  }, []);

  const [healOpen, setHealOpen] = useState(false);
  const [psfOpen, setPsfOpen] = useState(false);
  const [execBriefOpen, setExecBriefOpen] = useState(false);
  const [automateOpen, setAutomateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [canvasView, setCanvasView] = useState<"canvas" | "process" | "runs">("canvas");
  const { open: onboardingOpen, dismiss: dismissOnboarding } = useOnboarding();
  const { open: tourOpen, start: startTour, finish: finishTour } = useGuidedTour();
  const [ingestionPending, setIngestionPending] = useState<{
    workflow: Workflow;
    report: IngestionReport;
  } | null>(null);

  const hydrateFromLocalStorage = useWorkflowStore((s) => s.hydrateFromLocalStorage);
  const setModeStore = useWorkflowStore((s) => s.setMode);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const runValidation = useWorkflowStore((s) => s.runValidation);
  const startSamplePolling = useRuntimeStore((s) => s.startSamplePolling);
  const stopSamplePolling = useRuntimeStore((s) => s.stopSamplePolling);
  const loadSampleFiles = useRuntimeStore((s) => s.loadSampleFiles);

  // Sync mode to store
  useEffect(() => {
    setModeStore(mode);
  }, [mode, setModeStore]);

  // Hydrate from localStorage on first render
  useEffect(() => {
    hydrateFromLocalStorage();
  }, [hydrateFromLocalStorage]);

  // Start/stop runtime polling when entering/leaving run mode
  useEffect(() => {
    if (mode === "run") {
      void loadSampleFiles();
      startSamplePolling();
    } else {
      stopSamplePolling();
    }
  }, [mode, loadSampleFiles, startSamplePolling, stopSamplePolling]);

  const openWizard = useCallback(() => {
    // Studio is the free reference implementation; features.aiWizard now
    // always returns true (2026-05-16). The setUpgradeFeature branch is
    // retained as defensive code in case gating returns in future.
    if (!features.aiWizard(userPlan)) { setUpgradeFeature("AI Workflow Wizard"); return; }
    if (!hasStudioOpenAiKey()) { setApiKeyOpen(true); return; }
    setWizardOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, userPlan]);

  // Expose tutorial launcher globally (for TopBar Help button + onboarding)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfosStartTutorial = startTour;

  return () => { delete (window as unknown as Record<string, unknown>).__wfosStartTutorial; };
  }, [startTour]);

  // Autosave to localStorage every 2 s
  useEffect(() => {
    const id = window.setInterval(() => {
      const w = useWorkflowStore.getState().workflow;
      localStorage.setItem(LS_KEY, JSON.stringify(w));
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const meta = e.metaKey || e.ctrlKey;

      // Escape closes overlays in priority order
      if (e.key === "Escape") {
        if (wizardOpen) { setWizardOpen(false); return; }
        if (presenting) { setPresenting(false); return; }
        useWorkflowStore.getState().selectNode(undefined);
        return;
      }

      // Cmd/Ctrl+Z -> undo
      if (meta && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        useWorkflowStore.getState().undo();
        return;
      }

      // Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y -> redo
      if ((meta && e.shiftKey && e.key === "z") || (meta && e.key === "y")) {
        e.preventDefault();
        useWorkflowStore.getState().redo();
        return;
      }

      if (typing) return;

      // Delete / Backspace -> delete selected node
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedNodeId, deleteNode } = useWorkflowStore.getState();
        if (selectedNodeId) {
          e.preventDefault();
          deleteNode(selectedNodeId);
        }
        return;
      }

      // D / S / R -> quick mode switch
      if (e.key === "d" || e.key === "D") { setMode("design"); return; }
      if (e.key === "s" || e.key === "S") { setMode("state"); return; }
      if (e.key === "r" || e.key === "R") { setMode("run"); return; }

      // P -> present
      if (e.key === "p" || e.key === "P") { setPresenting(true); return; }

      // W -> wizard
      if (e.key === "w" || e.key === "W") { setWizardOpen(true); return; }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presenting, wizardOpen]);

  // Handle project ZIP import
  const handleImportProject = async (file: File) => {
    try {
      const { ingestProjectZip } = await import("@/lib/io/ingest-project");
      const result = await ingestProjectZip(file);
      setIngestionPending(result);
    } catch (err) {
      window.alert("Failed to parse project ZIP: " + String(err));
    }
  };

  // Commit ingested workflow to the store
  const confirmIngestion = () => {
    if (!ingestionPending) return;
    setWorkflow(ingestionPending.workflow);
    runValidation();
    setIngestionPending(null);
  };

  return (
    <div
      id="studio-root"
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        background:
          "radial-gradient(circle at 18% 8%, rgba(59,130,246,0.15), transparent 30rem), radial-gradient(circle at 86% 16%, rgba(16,185,129,0.08), transparent 30rem), linear-gradient(180deg, #050a14 0%, #08111f 48%, #060b16 100%)",
        color: "#e6e8ef",
      }}
    >
      <TopBar
        mode={mode}
        onMode={setMode}
        onPresent={() => setPresenting(true)}
        onImportProject={(f) => void handleImportProject(f)}
        onOpenHealer={() => setHealOpen(true)}
        onOpenPSFAnalyzer={() => setPsfOpen(true)}
        onOpenExecBrief={() => setExecBriefOpen(true)}
        onOpenAutomate={() => setAutomateOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenApiKey={() => setApiKeyOpen(true)}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "224px minmax(0, 1fr) 388px",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <NodePalette onOpenWizard={() => openWizard()} onOpenTemplates={() => setTemplatesOpen(true)} />
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, position: "relative" }}>
          {/* View toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 12px", height: 38, background: "linear-gradient(180deg, rgba(8,15,30,0.88), rgba(5,10,20,0.88))", borderBottom: "1px solid rgba(148,163,184,0.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 0, background: "rgba(3,7,16,0.72)", border: "1px solid rgba(148,163,184,0.16)", borderRadius: 7, padding: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)" }}>
              <button
                type="button"
                onClick={() => setCanvasView("canvas")}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: canvasView === "canvas" ? "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(14,165,233,0.12))" : "transparent", color: canvasView === "canvas" ? "#e2e8f0" : "#64748b", transition: "all 0.15s", boxShadow: canvasView === "canvas" ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none" }}
              >
                ⬡ Canvas
              </button>
              <button
                type="button"
                onClick={() => setCanvasView("process")}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: canvasView === "process" ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(59,130,246,0.1))" : "transparent", color: canvasView === "process" ? "#e2e8f0" : "#64748b", transition: "all 0.15s", boxShadow: canvasView === "process" ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none" }}
              >
                📋 Process View
              </button>
              <button
                type="button"
                onClick={() => setCanvasView("runs")}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: canvasView === "runs" ? "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.1))" : "transparent", color: canvasView === "runs" ? "#e2e8f0" : "#64748b", transition: "all 0.15s", boxShadow: canvasView === "runs" ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none" }}
              >
                📊 Runs
              </button>
            </div>
            <div style={{ flex: 1 }} />
            {canvasView === "process" && (
              <span style={{ fontSize: 10, color: "#334155" }}>Plain-English view · updates live as you build</span>
            )}
            {canvasView === "runs" && (
              <span style={{ fontSize: 10, color: "#334155" }}>Provenance trail · drop a .ndjson run log to inspect</span>
            )}
          </div>
          {/* View content — unmount hidden view so React Flow never sits under display:none (0×0 → RF #004) */}
          {canvasView === "canvas" ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <WorkflowCanvas mode={mode} onOpenWizard={() => openWizard()} onOpenTemplates={() => setTemplatesOpen(true)} />
            </div>
          ) : canvasView === "process" ? (
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "auto" }}>
              <ProcessView />
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <RunLogView />
            </div>
          )}
        </div>
        <InspectorPanel />
      </div>
      <TimelinePanel />

      {/* Ingestion review modal */}
      {ingestionPending && (
        <IngestionModal
          report={ingestionPending.report}
          onConfirm={confirmIngestion}
          onCancel={() => setIngestionPending(null)}
        />
      )}

      {/* Presentation mode overlay */}
      {presenting && <PresentationMode onExit={() => setPresenting(false)} />}

      {/* Workflow wizard overlay */}
      {upgradeFeature && (
        <UpgradeModal open={!!upgradeFeature} mode="pro" onClose={() => setUpgradeFeature(null)} />
      )}
      <OpenAiKeyModal open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      {wizardOpen && <WorkflowWizard onClose={() => setWizardOpen(false)} onOpenExecBrief={() => { setWizardOpen(false); setExecBriefOpen(true); }} />}

      {/* Workflow healer overlay */}
      {healOpen && <HealModal onClose={() => setHealOpen(false)} />}

      {/* PSF Compliance Analyzer panel */}
      {psfOpen && <PSFAnalyzerPanel onClose={() => setPsfOpen(false)} />}

      {/* Executive brief overlay */}
      {execBriefOpen && <ExecutiveBriefModal onClose={() => setExecBriefOpen(false)} />}
      {automateOpen && <AutomateModal onClose={() => setAutomateOpen(false)} />
      }
      {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} />}

      {/* First-run onboarding modal */}
      {onboardingOpen && (
        <OnboardingModal
          onClose={() => {
            dismissOnboarding();
            // Auto-start the tour on first run so users get the guided experience
            if (!localStorage.getItem("wfos-tour-done")) {
              setTimeout(() => startTour(), 400);
            }
          }}
          onChooseWizard={() => openWizard()}
          onChooseTemplates={() => setTemplatesOpen(true)}
        />
      )}

      {/* Guided tour spotlight overlay */}
      {tourOpen && <GuidedTour onClose={finishTour} />}

      {/* Persistent floating tour button — always accessible */}
      {!tourOpen && (
        <button
          type="button"
          onClick={startTour}
          title="Take the tour"
          style={{
            position: "fixed",
            bottom: 72,
            right: 16,
            zIndex: 300,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(37,99,235,0.28) 0%, rgba(8,14,28,0.96) 100%)",
            border: "1px solid rgba(96,165,250,0.34)",
            color: "#bfdbfe",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 32px rgba(0,0,0,0.42), 0 0 24px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(125,211,252,0.72)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 3px #3b82f622, 0 18px 44px rgba(0,0,0,0.44), 0 0 30px rgba(59,130,246,0.26)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(96,165,250,0.34)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(0,0,0,0.42), 0 0 24px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.08)";
          }}
        >
          ?
        </button>
      )}
    </div>
  );
}
