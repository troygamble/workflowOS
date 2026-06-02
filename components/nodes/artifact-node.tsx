"use client";
import { Handle, Position } from "@xyflow/react";
import {
  handleStyle,
  issuesBadgeStyle,
  nodeBodyStyle,
  nodeHeaderStyle,
  nodeWrapperStyle,
  NODE_THEME,
  statusBadgeStyle,
  statusDotStyle,
  typeTagStyle,
} from "./node-utils";

export type ArtifactViewData = {
  name: string;
  fileName?: string;
  artifactType?: string;
  description?: string;
  derivedStatus?: string;
  hasIssues?: boolean;
};

export function ArtifactNode({
  data,
  selected,
}: {
  data: ArtifactViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.artifact;
  const status = data.derivedStatus ?? "unknown";

  const ext = data.artifactType ?? (data.fileName?.split(".").pop() ?? "");

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
        {ext && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: theme.border,
              opacity: 0.7,
              background: theme.border + "22",
              border: `1px solid ${theme.border}44`,
              borderRadius: 4,
              padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            {ext}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={nodeBodyStyle()}>
        <span style={typeTagStyle(theme.border)}>{theme.label}</span>
        <span style={statusBadgeStyle(status)}>
          <span style={statusDotStyle(status)} />
          {status}
        </span>
        {data.fileName && (
          <span
            style={{
              fontSize: 10,
              color: "#475569",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.fileName}
          </span>
        )}
      </div>
    </div>
  );
}
