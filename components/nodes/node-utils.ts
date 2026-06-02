import type React from "react";
import type { HumanSubtype, AutomationPotential } from "@/lib/types/workflow";

// ── Colour palettes ────────────────────────────────────────────────────────────────────────────

export const NODE_THEME = {
  skill: {
    // Blue — AI automation
    headerBg: "linear-gradient(135deg, #1e3a8acc 0%, #1d4ed877 60%, #0b1220 100%)",
    border: "#3b82f6",
    icon: "⚡",
    label: "SKILL",
  },
  artifact: {
    // Slate — data/files
    headerBg: "linear-gradient(135deg, #1e293bcc 0%, #33415566 60%, #0b1220 100%)",
    border: "#64748b",
    icon: "◇",
    label: "ARTIFACT",
  },
  human: {
    // Amber — people
    headerBg: "linear-gradient(135deg, #78350fcc 0%, #92400e77 60%, #0b1220 100%)",
    border: "#f59e0b",
    icon: "◎",
    label: "HUMAN",
  },
  proposal: {
    // Purple — governance
    headerBg: "linear-gradient(135deg, #4c1d95cc 0%, #5b21b677 60%, #0b1220 100%)",
    border: "#a855f7",
    icon: "◈",
    label: "PROPOSAL",
  },
  system: {
    // Teal — services
    headerBg: "linear-gradient(135deg, #134e4acc 0%, #115e5977 60%, #0b1220 100%)",
    border: "#14b8a6",
    icon: "⚙",
    label: "SYSTEM",
  },
  integration: {
    // Sky — external apps
    headerBg: "linear-gradient(135deg, #0c4a6ecc 0%, #07598577 60%, #0b1220 100%)",
    border: "#0ea5e9",
    icon: "⇌",
    label: "INTEGRATION",
  },
  conditional: {
    // Orange — decision / branching
    headerBg: "linear-gradient(135deg, #7c2d0ecc 0%, #9a341277 60%, #0b1220 100%)",
    border: "#f97316",
    icon: "⋈",
    label: "CONDITION",
  },
} as const;

export const STATUS_COLORS: Record<string, string> = {
  // Skill statuses
  idle: "#64748b",
  ready: "#22c55e",
  blocked: "#ef4444",
  running: "#3b82f6",
  failed: "#dc2626",
  // Artifact statuses
  updated: "#22c55e",
  stale: "#f59e0b",
  missing: "#f97316",
  unknown: "#64748b",
  // Proposal statuses
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
  modified: "#60a5fa",
};

export const HUMAN_SUBTYPE_META: Record<HumanSubtype, {
  icon: string;
  label: string;
  defaultAutomationPotential: AutomationPotential;
  potentialColor: string;
  description: string;
}> = {
  file_movement: { icon: "📁", label: "File Movement",  defaultAutomationPotential: "very_high", potentialColor: "#22c55e", description: "Move/copy files between locations" },
  communication: { icon: "💬", label: "Communication",  defaultAutomationPotential: "high",      potentialColor: "#3b82f6", description: "Send message, email, or report" },
  data_entry:    { icon: "⌨",  label: "Data Entry",     defaultAutomationPotential: "high",      potentialColor: "#3b82f6", description: "Input data into a system" },
  approval:      { icon: "✓",  label: "Approval",       defaultAutomationPotential: "medium",    potentialColor: "#f59e0b", description: "Review and approve or reject" },
  judgment:      { icon: "◉",  label: "Judgment",       defaultAutomationPotential: "low",       potentialColor: "#f97316", description: "Contextual decision requiring expertise" },
  physical:      { icon: "◻",  label: "Physical",       defaultAutomationPotential: "none",      potentialColor: "#ef4444", description: "Real-world action — cannot be automated" },
};

export const AUTOMATION_POTENTIAL_LABEL: Record<AutomationPotential, string> = {
  very_high: "Very High",
  high:      "High",
  medium:    "Medium",
  low:       "Low",
  none:      "None",
};

// ── Shared style helpers ────────────────────────────────────────────────────────────────────────────

export function statusBadgeStyle(status: string): React.CSSProperties {
  const color = STATUS_COLORS[status] ?? "#64748b";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: color + "18",
    border: `1px solid ${color}55`,
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 9,
    color,
    fontWeight: 600,
    letterSpacing: "0.04em",
    lineHeight: 1.6,
    textTransform: "uppercase" as const,
  };
}

export function statusDotStyle(status: string): React.CSSProperties {
  const color = STATUS_COLORS[status] ?? "#64748b";
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  };
}

export function nodeWrapperStyle(
  borderColor: string,
  selected?: boolean,
  extraClass?: string
): React.CSSProperties {
  return {
    borderRadius: 8,
    border: `1px solid ${selected ? borderColor + "cc" : "rgba(148,163,184,0.14)"}`,
    borderLeft: `3px solid ${borderColor}`,    // accent bar — the premium touch
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(8,14,28,0.98) 100%)",
    boxShadow: selected
      ? `0 0 0 1px ${borderColor}aa, 0 0 28px ${borderColor}40, 0 18px 42px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.06)`
      : "0 12px 28px rgba(0,0,0,0.48), 0 1px 6px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04)",
    minWidth: 170,
    maxWidth: 230,
    overflow: "hidden",
    position: "relative",
    cursor: "default",
  };
}

export function nodeHeaderStyle(headerBg: string): React.CSSProperties {
  return {
    background: headerBg,
    padding: "8px 10px 7px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

export function nodeBodyStyle(): React.CSSProperties {
  return {
    padding: "6px 10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  };
}

export function handleStyle(color: string): React.CSSProperties {
  return {
    background: "#0b1220",
    border: `2px solid ${color}`,
    width: 10,
    height: 10,
    boxShadow: `0 0 4px ${color}66`,
  };
}

export function issuesBadgeStyle(): React.CSSProperties {
  return {
    position: "absolute",
    top: -7,
    right: -7,
    background: "#ef4444",
    color: "#fff",
    borderRadius: "50%",
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: "bold",
    boxShadow: "0 0 0 2px #0f172a",
    zIndex: 10,
  };
}

export function typeTagStyle(borderColor: string): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: borderColor,
    opacity: 0.9,
    lineHeight: 1,
    textTransform: "uppercase" as const,
  };
}
