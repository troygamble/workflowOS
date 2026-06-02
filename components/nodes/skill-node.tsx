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

const RUNTIME_LABELS: Record<string, string> = {
  claude:       "Claude",
  openai:       "OpenAI",
  ollama_local: "🖥 Local",
  azure_openai: "Azure",
  bedrock:      "Bedrock",
  custom:       "Custom",
};

const RUNTIME_COLORS: Record<string, string> = {
  claude:       "#c084fc",
  openai:       "#22c55e",
  ollama_local: "#f97316",
  azure_openai: "#0ea5e9",
  bedrock:      "#f59e0b",
  custom:       "#64748b",
};

export type SkillViewData = {
  name: string;
  description?: string;
  enabled?: boolean;
  version?: number;
  derivedStatus?: string;
  hasIssues?: boolean;
  inputCount?: number;
  outputCount?: number;
  implementationFile?: string;
  presenterNote?: string;
  team?: string;
  owner?: string;
  runtimeTarget?: string;
  modelName?: string;
};

export function SkillNode({
  data,
  selected,
}: {
  data: SkillViewData;
  selected?: boolean;
}) {
  const theme = NODE_THEME.skill;
  const status = data.derivedStatus ?? "idle";
  const isRunning = status === "running";
  const rt = data.runtimeTarget;
  const rtColor = rt ? (RUNTIME_COLORS[rt] ?? "#64748b") : null;
  const rtLabel = rt ? (RUNTIME_LABELS[rt] ?? rt) : null;

  return (
    <div
      className={isRunning ? "node-running" : undefined}
      style={nodeWrapperStyle(theme.border, selected)}
    >
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
        {!data.enabled && <span style={{ fontSize: 9, color: "#94a3b8", flexShrink: 0 }}>off</span>}
      </div>

      {/* Body */}
      <div style={nodeBodyStyle()}>
        <span style={typeTagStyle(theme.border)}>{theme.label}</span>
        <span style={statusBadgeStyle(status)}>
          <span
            className={isRunning ? "status-dot-running" : undefined}
            style={statusDotStyle(status)}
          />
          {status}
        </span>
        {((data.inputCount ?? 0) > 0 || (data.outputCount ?? 0) > 0) && (
          <span style={{ fontSize: 10, color: "#64748b" }}>
            {data.inputCount ?? 0} in &middot; {data.outputCount ?? 0} out
          </span>
        )}
        {data.implementationFile && (
          <span
            style={{
              fontSize: 9,
              color: "#22c55e",
              background: "#22c55e12",
              border: "1px solid #22c55e33",
              borderRadius: 4,
              padding: "1px 5px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
              fontFamily: "monospace",
            }}
            title={data.implementationFile}
          >
            {data.implementationFile.split("/").pop()}
          </span>
        )}
        {rt && rt !== "claude" && rtColor && rtLabel && (
          <span
            title={data.modelName ? `${rtLabel} · ${data.modelName}` : rtLabel}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: rtColor,
              background: rtColor + "18",
              border: `1px solid ${rtColor}44`,
              borderRadius: 4,
              padding: "1px 6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {rtLabel}{data.modelName ? ` · ${data.modelName}` : ""}
          </span>
        )}
        {(data.team ?? data.owner) && (
          <span
            style={{
              fontSize: 9,
              color: "#94a3b8",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 4,
              padding: "1px 6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {data.team ?? data.owner}
          </span>
        )}
      </div>
    </div>
  );
}
