"use client";

import { useRuntimeStore } from "@/store/runtime-store";
import { useWorkflowStore } from "@/store/workflow-store";
import type { RuntimeEvent } from "@/lib/types/runtime";

const EVENT_META: Record<string, { color: string; icon: string; label?: string }> = {
  job_queued:                { color: "#64748b", icon: "o", label: "queued" },
  job_started:               { color: "#3b82f6", icon: ">", label: "started" },
  job_progress:              { color: "#60a5fa", icon: "~", label: "progress" },
  job_completed:             { color: "#22c55e", icon: "v", label: "done" },
  job_failed:                { color: "#ef4444", icon: "x", label: "failed" },
  artifact_created:          { color: "#a78bfa", icon: "+", label: "created" },
  artifact_updated:          { color: "#8b5cf6", icon: "*", label: "updated" },
  artifact_deleted:          { color: "#f97316", icon: "-", label: "deleted" },
  proposal_created:          { color: "#c084fc", icon: "?", label: "proposal" },
  proposal_approved:         { color: "#22c55e", icon: "v", label: "approved" },
  proposal_rejected:         { color: "#ef4444", icon: "x", label: "rejected" },
  drift_detected:            { color: "#f59e0b", icon: "!", label: "drift" },
  unknown_step_detected:     { color: "#f97316", icon: "?", label: "unknown step" },
  unknown_artifact_detected: { color: "#f97316", icon: "?", label: "unknown artifact" },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function EventRow({ event, onFocus }: { event: RuntimeEvent; onFocus: () => void }) {
  const meta = EVENT_META[event.type] ?? { color: "#64748b", icon: "-" };
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        display: "grid",
        gridTemplateColumns: "18px 80px 1fr auto",
        gap: 8,
        alignItems: "center",
        textAlign: "left",
        padding: "4px 8px",
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: "#e2e8f0",
        cursor: event.stepId ? "pointer" : "default",
        fontSize: 11,
      }}
    >
      <span style={{ color: meta.color, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
        {meta.icon}
      </span>
      <span style={{ color: "#475569", fontFamily: "monospace" }}>{formatTime(event.timestamp)}</span>
      <span>
        <span style={{ color: meta.color, fontWeight: 600, marginRight: 6 }}>
          {meta.label ?? event.type}
        </span>
        {event.stepId && <span style={{ color: "#94a3b8" }}>{event.stepId}</span>}
      </span>
      {event.jobId && (
        <span style={{ color: "#334155", fontFamily: "monospace", fontSize: 10 }}>
          {event.jobId.slice(0, 10)}
        </span>
      )}
    </button>
  );
}

export function TimelinePanel() {
  const events = useRuntimeStore((s) => s.events);
  const selectNode = useWorkflowStore((s) => s.selectNode);

  return (
    <section
      style={{
        borderTop: "1px solid #25304b",
        overflow: "auto",
        minHeight: 160,
        maxHeight: 240,
        background: "#080e1c",
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 12px",
          borderBottom: "1px solid #1e293b",
          background: "#080e1c",
        }}
      >
        <strong style={{ fontSize: 12 }}>Timeline</strong>
        <span style={{ fontSize: 11, color: "#475569" }}>
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          {(["job_completed", "job_failed", "drift_detected", "proposal_created"] as const).map((key) => {
            const m = EVENT_META[key];
            return (
              <span key={key} style={{ fontSize: 10, color: m.color, opacity: 0.8 }}>
                {m.icon} {m.label}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ overflow: "auto", padding: "4px 0" }}>
        {events.length === 0 ? (
          <div style={{ fontSize: 12, color: "#475569", padding: "12px 16px" }}>
            No events yet. Switch to Run mode to load samples, or simulate job execution from the Runs tab.
          </div>
        ) : (
          events
            .slice()
            .reverse()
            .map((ev) => (
              <EventRow
                key={ev.eventId + ev.timestamp}
                event={ev}
                onFocus={() => ev.stepId && selectNode(ev.stepId)}
              />
            ))
        )}
      </div>
    </section>
  );
}
