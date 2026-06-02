"use client";
import { Handle, Position } from "@xyflow/react";
import {
  handleStyle,
  issuesBadgeStyle,
  nodeBodyStyle,
  nodeHeaderStyle,
  nodeWrapperStyle,
  NODE_THEME,
  typeTagStyle,
} from "./node-utils";
import type { IntegrationSubtype } from "@/lib/types/workflow";

export type IntegrationViewData = {
  name: string;
  description?: string;
  subtype: IntegrationSubtype;
  system?: string;
  direction: "inbound" | "outbound" | "bidirectional";
  automated?: boolean;
  estimatedTime?: string;
  hasIssues?: boolean;
  inputCount?: number;
  outputCount?: number;
  team?: string;
  owner?: string;
};

const SUBTYPE_LABELS: Record<IntegrationSubtype, string> = {
  email_send:    "email out",
  email_receive: "email in",
  form_submit:   "form",
  legacy_system: "legacy system",
  webhook:       "webhook",
  file_transfer: "file transfer",
  notification:  "notification",
  other:         "integration",
};

const DIRECTION_ICON: Record<string, string> = {
  inbound:       "↓",
  outbound:      "↑",
  bidirectional: "↕",
};

export function IntegrationNode({
  data,
  selected,
}: {
  data: IntegrationViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.integration;

  return (
    <div style={nodeWrapperStyle(theme.border, selected)}>
      <Handle type="target" position={Position.Left} style={handleStyle(theme.border)} />
      <Handle type="source" position={Position.Right} style={handleStyle(theme.border)} />

      {data.hasIssues && <div style={issuesBadgeStyle()}>!</div>}

      {/* Header */}
      <div style={nodeHeaderStyle(theme.headerBg)}>
        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{theme.icon}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "#e2e8f0",
          }}
        >
          {data.name}
        </span>
        {data.automated === false && (
          <span style={{ fontSize: 9, color: "#f97316", flexShrink: 0 }} title="Manual step">M</span>
        )}
      </div>

      {/* Body */}
      <div style={nodeBodyStyle()}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center" }}>
          <span style={typeTagStyle(theme.border)}>{theme.label}</span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: theme.border, opacity: 0.7,
          }}>
            {DIRECTION_ICON[data.direction]}
          </span>
        </div>

        {/* Subtype + system */}
        <span style={{
          fontSize: 10,
          color: theme.border,
          background: theme.border + "18",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: theme.border + "44",
          borderRadius: 999,
          padding: "2px 8px",
          display: "inline-block",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}>
          {SUBTYPE_LABELS[data.subtype]}{data.system ? ` · ${data.system}` : ""}
        </span>

        {((data.inputCount ?? 0) > 0 || (data.outputCount ?? 0) > 0) && (
          <span style={{ fontSize: 10, color: "#64748b" }}>
            {data.inputCount ?? 0} in · {data.outputCount ?? 0} out
          </span>
        )}

        {data.estimatedTime && (
          <span style={{ fontSize: 9, color: "#64748b" }}>⏱ {data.estimatedTime}</span>
        )}

        {(data.team ?? data.owner) && (
          <span style={{
            fontSize: 9, color: "#94a3b8",
            background: "#1e293b",
            borderWidth: 1, borderStyle: "solid", borderColor: "#334155",
            borderRadius: 4, padding: "1px 6px",
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const, maxWidth: "100%",
          }}>
            {data.team ?? data.owner}
          </span>
        )}
      </div>
    </div>
  );
}
