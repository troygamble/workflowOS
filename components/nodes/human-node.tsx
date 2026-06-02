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

export type HumanViewData = {
  name: string;
  approverRole?: string;
  instructions?: string;
  description?: string;
  hasIssues?: boolean;
  requiredInputCount?: number;
  producedArtifactCount?: number;
  team?: string;
  owner?: string;
  minutesPerOccurrence?: number;
};

export function HumanNode({
  data,
  selected,
}: {
  data: HumanViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.human;

  return (
    <div style={nodeWrapperStyle(theme.border, selected)}>
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

      {data.hasIssues && (
        <div style={issuesBadgeStyle()}>!</div>
      )}

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
        <span style={typeTagStyle(theme.border)}>{theme.label}</span>
        {data.approverRole && (
          <span
            style={{
              fontSize: 10,
              color: theme.border,
              background: theme.border + "18",
              border: `1px solid ${theme.border}44`,
              borderRadius: 999,
              padding: "2px 8px",
              display: "inline-block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.approverRole}
          </span>
        )}
        {((data.requiredInputCount ?? 0) > 0 || (data.producedArtifactCount ?? 0) > 0) && (
          <span style={{ fontSize: 10, color: "#64748b" }}>
            {data.requiredInputCount ?? 0} req · {data.producedArtifactCount ?? 0} produces
          </span>
        )}
        {(data.team ?? data.owner) && (
          <span
            style={{
              fontSize: 9,
              color: '#94a3b8',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: '1px 6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {data.team ?? data.owner}
          </span>
        )}
        {data.minutesPerOccurrence != null && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#f59e0b",
            background: "#f59e0b18", border: "1px solid #f59e0b44",
            borderRadius: 999, padding: "1px 6px", whiteSpace: "nowrap",
          }}>
            {String.fromCodePoint(0x23F1)} {data.minutesPerOccurrence < 60
              ? `${data.minutesPerOccurrence}m`
              : `${(data.minutesPerOccurrence / 60).toFixed(1)}h`}
          </span>
        )}
      </div>
    </div>
  );
}
