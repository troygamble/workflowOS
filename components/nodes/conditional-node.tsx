"use client";
import { Handle, Position } from "@xyflow/react";
import { handleStyle } from "./node-utils";

export type ConditionalViewData = {
  name: string;
  condition: string;
  trueLabel?: string;
  falseLabel?: string;
  notes?: string;
  hasIssues?: boolean;
};

const BORDER = "#f97316";   // orange
const BG     = "#0b1220";
const HEADER_BG = "linear-gradient(135deg, #7c2d0ecc 0%, #9a3412 60%, #0b1220 100%)";

export function ConditionalNode({
  data,
  selected,
}: {
  data: ConditionalViewData;
  selected?: boolean;
}) {
  const SIZE = 110;  // diamond is square-ish
  const boxShadow = selected
    ? `0 0 0 2px ${BORDER}44, 0 8px 32px rgba(0,0,0,0.6)`
    : "0 4px 16px rgba(0,0,0,0.5)";

  return (
    <div style={{ position: "relative", width: SIZE + 24, height: SIZE + 24, display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* Diamond shape — rotated square */}
      <div style={{
        width: SIZE, height: SIZE,
        background: BG,
        border: `${selected ? 2 : 1.5}px solid ${BORDER}${selected ? "" : "88"}`,
        transform: "rotate(45deg)",
        boxShadow,
        flexShrink: 0,
        overflow: "hidden",
      }}>
        {/* Header gradient inside diamond */}
        <div style={{
          position: "absolute", inset: 0,
          background: HEADER_BG,
          opacity: 0.6,
        }} />
      </div>

      {/* Inner content — not rotated */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 4px",
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 16, lineHeight: 1, marginBottom: 3 }}>⋈</div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: BORDER, letterSpacing: "0.08em",
          textTransform: "uppercase", lineHeight: 1, marginBottom: 4,
        }}>IF</div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: "#e2e8f0",
          textAlign: "center", lineHeight: 1.3,
          maxWidth: 78,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {data.condition || data.name}
        </div>
      </div>

      {/* Handles — on the 4 points of the diamond */}
      {/* Input — left point */}
      <Handle type="target" position={Position.Left}
        style={{ ...handleStyle(BORDER), left: 2, top: "50%", transform: "translateY(-50%)" }} />

      {/* True — right point — labelled */}
      <Handle type="source" position={Position.Right} id="true"
        style={{ ...handleStyle("#22c55e"), right: 2, top: "50%", transform: "translateY(-50%)" }} />

      {/* False — bottom point */}
      <Handle type="source" position={Position.Bottom} id="false"
        style={{ ...handleStyle("#ef4444"), bottom: 2, left: "50%", transform: "translateX(-50%)" }} />

      {/* Edge labels */}
      <div style={{ position: "absolute", right: -28, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap" }}>
        {data.trueLabel ?? "yes"}
      </div>
      <div style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap" }}>
        {data.falseLabel ?? "no"}
      </div>
    </div>
  );
}
