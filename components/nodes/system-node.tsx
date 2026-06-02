"use client";
import { Handle, Position } from "@xyflow/react";
import {
  handleStyle,
  nodeBodyStyle,
  nodeHeaderStyle,
  nodeWrapperStyle,
  NODE_THEME,
  typeTagStyle,
} from "./node-utils";

export type SystemViewData = {
  name: string;
  systemRole?: string;
  description?: string;
  hasIssues?: boolean;
};

export function SystemNode({
  data,
  selected,
}: {
  data: SystemViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.system;

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
        {data.systemRole && (
          <span
            style={{
              fontSize: 10,
              color: theme.border,
              opacity: 0.85,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.systemRole}
          </span>
        )}
      </div>
    </div>
  );
}
