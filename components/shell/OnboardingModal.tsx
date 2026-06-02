"use client";

import { useState, useCallback, useRef } from "react";
import { importFromWfos } from "@/lib/io/wfos-package";
import { openDemoEngagement } from "@/lib/demo/demo-engagement";
import { useWorkflowStore } from "@/store/workflow-store";

const ONBOARDING_KEY = "wfos-onboarded";

export function useOnboarding() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  }, []);

  const reopen = useCallback(() => setOpen(true), []);

  return { open, dismiss, reopen };
}

// ─── Path card ───────────────────────────────────────────────────────────────

function PathCard({
  icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(180deg, ${accent}22, rgba(10,15,30,0.96))`
          : "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(8,14,28,0.92))",
        border: `1px solid ${hovered ? accent : "rgba(148,163,184,0.18)"}`,
        borderRadius: 10,
        padding: "20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.16s ease",
        flex: 1,
        minWidth: 0,
        boxShadow: hovered
          ? `0 18px 40px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.08)`
          : "0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{description}</div>
    </button>
  );
}

// ─── Tour hotspot ─────────────────────────────────────────────────────────────

function TourStep({
  number,
  title,
  description,
  accent = "#7c3aed",
}: {
  number: number;
  title: string;
  description: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `${accent}33`,
          border: `1.5px solid ${accent}`,
          color: accent,
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{description}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OnboardingModalProps {
  onClose: () => void;
  onChooseWizard: () => void;
  onChooseTemplates: () => void;
}

export function OnboardingModal({
  onClose,
  onChooseWizard,
  onChooseTemplates,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);

  const handleWfosFile = async (file: File) => {
    try {
      const result = await importFromWfos(file);
      setWorkflow(result.workflow);
      setTimeout(() => applyAutoLayout(), 80);
      onClose();
    } catch (err) {
      window.alert("Failed to import .wfos: " + String(err));
    }
  };

  const next = () => setStep((s) => s + 1);

  const steps = [
    // ── Step 0: Welcome ──────────────────────────────────────────────────────
    <div key="welcome" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 40px 30px", textAlign: "center", gap: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(249,115,22,0.22))", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 18px 46px rgba(124,58,237,0.22), inset 0 1px 0 rgba(255,255,255,0.08)" }}>⚡</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px", marginBottom: 8 }}>
          Welcome to PAI Studio
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 460, lineHeight: 1.8 }}>
          Design AI automation workflows for businesses. Export a client proposal. Deploy on Claude. Charge for the engagement.
        </div>
      </div>

      {/* Business model in 3 steps */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", marginTop: 4 }}>
        {[
          { n: "1", icon: "🗺️", title: "Map & propose", desc: "Design their process, generate a before/after transformation, export a PDF proposal." },
          { n: "2", icon: "⚡", title: "Deploy on Claude", desc: "Export the workflow package. Your client runs it on Claude Teams (~$200/mo). You configure it." },
          { n: "3", icon: "💰", title: "Invoice & retain", desc: "Charge $8k–$25k per engagement. Add a $500–$2k/mo support retainer. Repeat." },
        ].map((s) => (
          <div key={s.n} style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(8,14,28,0.9))", border: "1px solid rgba(148,163,184,0.16)", borderRadius: 10, padding: "14px 14px", textAlign: "left", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>{s.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={next}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: "none",
            borderRadius: 10,
            padding: "13px 40px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 16px 38px #7c3aed44",
          }}
        >
          Get Started →
        </button>
        <button
          type="button"
          onClick={() => { onClose(); openDemoEngagement(); }}
          style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 8, padding: "9px 24px", color: "#94a3b8", fontSize: 12, cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
        >
          📄 See a complete client engagement first
        </button>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer" }}>
          I know what I&apos;m doing — skip tour
        </button>
      </div>
    </div>,

    // ── Step 1: Choose path ───────────────────────────────────────────────────
    <div key="path" style={{ display: "flex", flexDirection: "column", padding: "32px 32px 28px", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
          How do you want to start?
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          Pick a path — you can always switch later.
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <PathCard
          icon="🗺️"
          title="Map a process"
          description="Describe a manual process in plain English. PAI Studio builds the current-state diagram with time estimates."
          accent="#3b82f6"
          onClick={() => { onClose(); onChooseWizard(); }}
        />
        <PathCard
          icon="📋"
          title="Load a template"
          description="Start from one of 14 pre-built workflows — Invoice Approval, Employee Onboarding, Contract Review, and more."
          accent="#8b5cf6"
          onClick={() => { onClose(); onChooseTemplates(); }}
        />
        <PathCard
          icon="📦"
          title="Import a .wfos file"
          description="Open a workflow bundle shared by a teammate or downloaded from the PAI community."
          accent="#06b6d4"
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wfos"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleWfosFile(f);
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <button type="button" onClick={() => setStep(0)} style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 8, padding: "8px 20px", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={next}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: "none",
            borderRadius: 8,
            padding: "9px 28px",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Show me the canvas →
        </button>
      </div>
    </div>,

    // ── Step 2: Quick tour ────────────────────────────────────────────────────
    <div key="tour" style={{ display: "flex", flexDirection: "column", padding: "32px 32px 28px", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
          Quick canvas tour
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          5 things worth knowing before you dive in.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <TourStep
          number={1}
          title="Node Palette — left sidebar"
          description="Drag Skill, Human, Artifact, Integration, and System nodes onto the canvas to build your workflow."
          accent="#3b82f6"
        />
        <TourStep
          number={2}
          title="Inspector — right sidebar"
          description="Click any node to edit its name, description, autonomy level, output contracts, and risk settings."
          accent="#8b5cf6"
        />
        <TourStep
          number={3}
          title="AI Wizard — top bar ✨"
          description="Describe a process in natural language and PAI Studio maps it for you automatically."
          accent="#7c3aed"
        />
        <TourStep
          number={4}
          title="⚡ Automate This — top bar"
          description="Once you've mapped a current-state process, hit this to generate the AI-automated future-state version with full contracts."
          accent="#f59e0b"
        />
        <TourStep
          number={5}
          title="Export ZIP — top bar"
          description="Download your workflow as a ready-to-run Claude Code project: YAML specs, hook scripts, and integration adapters."
          accent="#22c55e"
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <button type="button" onClick={() => setStep(1)} style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 8, padding: "8px 20px", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: "none",
            borderRadius: 8,
            padding: "9px 28px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 14px 34px #7c3aed44",
          }}
        >
          🚀 Open PAI Studio
        </button>
      </div>
    </div>,
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background:
          "radial-gradient(circle at 50% 40%, rgba(59,130,246,0.12), transparent 34rem), rgba(5,10,20,0.72)",
        backdropFilter: "blur(10px) saturate(1.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 680,
          maxWidth: "96vw",
          background:
            "linear-gradient(180deg, rgba(10,15,30,0.98), rgba(6,11,22,0.98))",
          borderRadius: 16,
          border: "1px solid rgba(96,165,250,0.22)",
          boxShadow: "0 44px 110px #000000aa, 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Progress dots */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 6,
            zIndex: 1,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? "#7c3aed" : "rgba(148,163,184,0.18)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: 20,
            cursor: "pointer",
            zIndex: 1,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {steps[step]}
      </div>
    </div>
  );
}
