"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { useAuth, useUser } from "@clerk/nextjs";
import { features } from "@/lib/platform";

// ─── Styles ───────────────────────────────────────────────────────────────────

const aside: React.CSSProperties = {
  borderRight: "1px solid rgba(148,163,184,0.14)",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  width: 224,
  flexShrink: 0,
  background: "linear-gradient(180deg, rgba(8,15,30,0.96) 0%, rgba(5,10,20,0.98) 100%)",
  overflow: "hidden auto",
  scrollbarWidth: "thin",
  scrollbarColor: "#1a2540 transparent",
  position: "relative",
  zIndex: 10,
  boxShadow: "inset -1px 0 0 rgba(255,255,255,0.025), 12px 0 36px rgba(0,0,0,0.18)",
};

const dividerLine: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.16), transparent)",
  marginInline: 0,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A primary node-type tile — the "4 pillars" */
function NodeTile({
  icon, name, description, accentColor,
  onClick, children,
}: {
  icon: string; name: string; description: string; accentColor: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasChildren = !!children;

  return (
    <div>
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (hasChildren) { setExpanded((v) => !v); }
          else if (onClick) { onClick(); }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "9px 14px",
          background: hovered ? `linear-gradient(90deg, ${accentColor}18, rgba(10,18,32,0.72))` : "transparent",
          border: "none",
          borderLeft: `2px solid ${hovered ? accentColor : accentColor + "55"}`,
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s",
          boxShadow: hovered ? `inset 0 1px 0 rgba(255,255,255,0.035), inset 0 -1px 0 ${accentColor}12` : "none",
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: hovered ? "#e2e8f0" : "#94a3b8", letterSpacing: "-0.01em" }}>{name}</span>
          <span style={{ display: "block", fontSize: 10, color: hovered ? "#64748b" : "#334155", marginTop: 1, lineHeight: 1.35 }}>
            {description}
          </span>
        </span>
        {hasChildren && (
          <span style={{ fontSize: 9, color: "#334155", flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
        )}
      </button>
      {hasChildren && expanded && (
        <div style={{ background: "rgba(3,7,16,0.78)", borderTop: "1px solid rgba(148,163,184,0.08)", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Indented sub-item under an expanded node tile */
function SubItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 14px 6px 36px",
        background: hovered ? "rgba(59,130,246,0.08)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 11, color: hovered ? "#94a3b8" : "#475569" }}>{label}</span>
    </button>
  );
}

/** Collapsible section header */
function Section({
  label, badge, defaultOpen = false, children,
}: {
  label: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "7px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#48617f", flex: 1, textAlign: "left" }}>
          {label}
        </span>
        {badge}
        <span style={{ fontSize: 9, color: "#48617f" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

/** Flat action button (for quick-start actions) */
function ActionBtn({ icon, label, sub, onClick, accent }: { icon: string; label: string; sub?: string; onClick: () => void; accent?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 14px",
        background: hovered ? (accent ? `linear-gradient(90deg, ${accent}14, rgba(10,18,32,0.72))` : "rgba(59,130,246,0.08)") : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        borderLeft: `2px solid ${hovered && accent ? accent : "transparent"}`,
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: accent && hovered ? accent : "#64748b" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 10, color: "#334155", marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function NodePalette({
  onOpenWizard,
  onOpenTemplates,
}: {
  onOpenWizard?: () => void;
  onOpenTemplates?: () => void;
}) {
  const { addNode, validation, selectNode, workflow } = useWorkflowStore();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const userPlan = user?.publicMetadata?.plan as string | undefined;
  const isPro = isSignedIn && (userPlan === "pro" || userPlan === "agency");
  const isEmpty = workflow.nodes.length === 0;
  const [search, setSearch] = useState("");
  const q = search.toLowerCase().trim();

  // Helper: does a node tile match the search query?
  const matches = (...terms: string[]) => !q || terms.some((t) => t.toLowerCase().includes(q));
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");

  return (
    <aside id="wfos-palette" style={aside}>

      {/* ── Search ─────────────────────────────────────────────── */}
      {!isEmpty && (
        <div style={{ padding: "10px 10px 4px" }}>
          <input
            type="text"
            placeholder="Filter nodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#0a0f1e", border: "1px solid #1a2540",
              borderRadius: 7, padding: "6px 10px",
              fontSize: 11, color: "#cbd5e1", outline: "none",
            }}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#3b82f644"; }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#1a2540"; }}
          />
        </div>
      )}

      {/* ── Empty canvas quick-start ─────────────────────────── */}
      {isEmpty && (
        <>
          <div style={{ padding: "16px 14px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4, letterSpacing: "-0.02em" }}>
              How do you want to start?
            </div>
            <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.5 }}>
              Every workflow is <span style={{ color: "#93c5fd" }}>Skills</span> · <span style={{ color: "#fcd34d" }}>Humans</span> · <span style={{ color: "#7dd3fc" }}>Integrations</span> · <span style={{ color: "#94a3b8" }}>Artifacts</span>
            </div>
          </div>

          <div style={{ padding: "0 10px 10px" }}>
            <button
              type="button"
              onClick={onOpenWizard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 14px",
                background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(14,165,233,0.1))",
                border: "1px solid rgba(167,139,250,0.34)",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                marginBottom: 6,
                boxShadow: "0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: 18 }}>✨</span>
              <span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>AI Wizard</span>
                <span style={{ display: "block", fontSize: 10, color: "#7c3aed99", marginTop: 1 }}>Describe it, AI builds it</span>
              </span>
              {/* Pro badge removed 2026-05-16: Studio is the free reference implementation. */}
            </button>
            <button
              type="button"
              onClick={onOpenTemplates}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 14px",
                background: "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(8,15,30,0.72))",
                border: "1px solid rgba(148,163,184,0.16)",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
              }}
            >
              <span style={{ fontSize: 15 }}>📁</span>
              <span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Templates</span>
                <span style={{ display: "block", fontSize: 10, color: "#334155", marginTop: 1 }}>Start from a real process</span>
              </span>
            </button>
          </div>

          <div style={dividerLine} />
          <div style={{ padding: "6px 14px 2px", fontSize: 9, fontWeight: 700, color: "#2e4060", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Or build manually
          </div>
        </>
      )}

      {/* ── 4 Pillars ────────────────────────────────────────── */}
      <div style={{ paddingTop: isEmpty ? 2 : 8 }}>
        {matches("skill", "ai", "agent", "script", "automated", "runs") && (
          <NodeTile
            icon="⚡" name="Skill" description="AI or script — runs automatically"
            accentColor="#3b82f6"
            onClick={() => addNode("skill")}
          />
        )}

        {matches("human", "person", "approval", "judgment", "data entry", "decision") && (
          <NodeTile
            icon="👤" name="Human" description="Needs a person — tap to choose type"
            accentColor="#f59e0b"
          >
            <SubItem icon="✓" label="Approval — review & sign off"        onClick={() => addNode("human", "approval")} />
            <SubItem icon="◉" label="Decision — judgment call"             onClick={() => addNode("human", "judgment")} />
            <SubItem icon="⌨" label="Data Entry — type into a system"     onClick={() => addNode("human", "data_entry")} />
            <SubItem icon="📁" label="File Move — copy or forward a file"  onClick={() => addNode("human", "file_movement")} />
            <SubItem icon="✉" label="Message — email, Teams, Slack"        onClick={() => addNode("human", "communication")} />
          </NodeTile>
        )}

        {matches("integration", "external", "app", "email", "sharepoint", "api", "sap") && (
          <NodeTile
            icon="🔗" name="Integration" description="External app — email, SharePoint, SAP…"
            accentColor="#0ea5e9"
            onClick={() => addNode("integration")}
          />
        )}

        {matches("artifact", "file", "data", "document", "output", "passed") && (
          <NodeTile
            icon="📄" name="Artifact" description="File or data passed between steps"
            accentColor="#64748b"
            onClick={() => addNode("artifact")}
          />
        )}

        {matches("condition", "branch", "routing", "rule", "decision", "yes", "no") && (
          <NodeTile
            icon="⋈" name="Condition" description="Branch on a rule — yes/no routing"
            accentColor="#f97316"
            onClick={() => addNode("conditional")}
          />
        )}

        {/* No results message */}
        {q && !matches("skill","ai","human","person","integration","external","artifact","file","condition","branch") && (
          <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 12, color: "#334155" }}>
            No nodes match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      <div style={{ ...dividerLine, marginTop: 4 }} />

      {/* ── Trigger ───────────────────────────────────────────── */}
      <Section label="Start trigger" defaultOpen={isEmpty}>
        <ActionBtn icon="🚀" label="Add Trigger" sub="What kicks this off? Email, form, schedule…" onClick={() => addNode("integration", "email_receive")} />
      </Section>

      {/* ── Advanced ──────────────────────────────────────────── */}
      <Section label="Advanced">
        <ActionBtn icon="📋" label="Proposal node"   sub="For governance workflows" onClick={() => addNode("proposal")} />
        <ActionBtn icon="⚙"  label="System node"     sub="Internal service calls"  onClick={() => addNode("system")} />
      </Section>

      <div style={{ flex: 1 }} />
      <div style={dividerLine} />

      {/* ── Validation ────────────────────────────────────────── */}
      <Section
        label="Issues"
        defaultOpen={errors.length > 0}
        badge={
          errors.length > 0 ? (
            <span style={{ fontSize: 10, background: "#7f1d1d", color: "#fca5a5", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>{errors.length}</span>
          ) : warnings.length > 0 ? (
            <span style={{ fontSize: 10, background: "#451a03", color: "#fcd34d", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>{warnings.length}</span>
          ) : (
            <span style={{ fontSize: 10, color: "#22c55e" }}>✓</span>
          )
        }
      >
        {validation.valid ? (
          <div style={{ padding: "6px 14px 10px", fontSize: 11, color: "#22c55e" }}>All good — no blocking issues.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 10px 10px" }}>
            {validation.issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => issue.nodeId && selectNode(issue.nodeId)}
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  padding: "6px 8px",
                  background: issue.severity === "error" ? "#7f1d1d22" : "#451a0322",
                  border: `1px solid ${issue.severity === "error" ? "#7f1d1d" : "#451a03"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  textAlign: "left",
                  color: issue.severity === "error" ? "#fca5a5" : "#fcd34d",
                  fontSize: 10,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>{issue.severity === "error" ? "✗" : "!"}</span>
                <span>{issue.message}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <div style={{ height: 8 }} />
    </aside>
  );
}
