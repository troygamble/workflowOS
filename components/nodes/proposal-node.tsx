"use client";
import { Handle, Position } from "@xyflow/react";
import {
  handleStyle,
  nodeBodyStyle,
  nodeHeaderStyle,
  nodeWrapperStyle,
  NODE_THEME,
  statusBadgeStyle,
  statusDotStyle,
  typeTagStyle,
} from "./node-utils";

export type ProposalViewData = {
  name: string;
  proposalType?: string;
  status?: string;
  reason?: string;
  source?: string;
  description?: string;
};

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  proposed_skill: "Skill",
  proposed_artifact: "Artifact",
  proposed_contract_change: "Contract",
  proposed_edge_change: "Edge",
};

export function ProposalNode({
  data,
  selected,
}: {
  data: ProposalViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.proposal;
  const status = data.status ?? "pending";
  const typeLabel = PROPOSAL_TYPE_LABELS[data.proposalType ?? ""] ?? data.proposalType ?? "";

  return (
    <div
      style={{
        ...nodeWrapperStyle(theme.border, selected),
        // Dashed border for proposals (pending)
        borderStyle: status === "pending" ? "dashed" : "solid",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle(theme.border)}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle(theme.border)}
      />

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
      </div>

      {/* Body */}
      <div style={nodeBodyStyle()}>
        <span style={typeTagStyle(theme.border)}>
          {theme.label}{typeLabel ? ` · ${typeLabel}` : ""}
        </span>
        <span style={statusBadgeStyle(status)}>
          <span style={statusDotStyle(status)} />
          {status}
        </span>
        {data.source && (
          <span style={{ fontSize: 10, color: "#475569" }}>
            from {data.source}
          </span>
        )}
      </div>
    </div>
  );
}
