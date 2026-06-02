"use client";

import { useState, useCallback, useRef } from "react";
import type { RunLogEntry, RunEventType, ContractCheckResult } from "@/lib/types/run-log";

// ── Event type metadata ────────────────────────────────────────────────────────

const EVENT_META: Record<RunEventType, { icon: string; color: string; label: string }> = {
  run_start:          { icon: "▶",  color: "#3b82f6", label: "Run started" },
  skill_start:        { icon: "⚡", color: "#818cf8", label: "Skill started" },
  tool_use:           { icon: "🔧", color: "#64748b", label: "Tool use" },
  blast_radius_ok:    { icon: "🛡", color: "#22c55e", label: "Blast radius OK" },
  blast_radius_block: { icon: "🚫", color: "#ef4444", label: "Blast radius blocked" },
  contract_check:     { icon: "📋", color: "#f59e0b", label: "Contract check" },
  contract_pass:      { icon: "✓",  color: "#22c55e", label: "Contract passed" },
  contract_fail:      { icon: "✗",  color: "#ef4444", label: "Contract failed" },
  retry:              { icon: "↺",  color: "#f97316", label: "Retry" },
  approval_pending:   { icon: "⏳", color: "#eab308", label: "Awaiting approval" },
  approval_granted:   { icon: "✓",  color: "#22c55e", label: "Approved" },
  approval_rejected:  { icon: "✗",  color: "#ef4444", label: "Rejected" },
  escalation:         { icon: "⬆",  color: "#f97316", label: "Escalated" },
  skill_complete:     { icon: "✓",  color: "#22c55e", label: "Skill complete" },
  run_complete:       { icon: "✓✓", color: "#22c55e", label: "Run complete" },
  run_failed:         { icon: "✗",  color: "#ef4444", label: "Run failed" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseNdjson(text: string): RunLogEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as RunLogEntry; }
      catch { return null; }
    })
    .filter(Boolean) as RunLogEntry[];
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
  } catch {
    return ts;
  }
}

function elapsed(a: string, b: string): string {
  try {
    const ms = new Date(b).getTime() - new Date(a).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  } catch { return ""; }
}

function groupByRun(entries: RunLogEntry[]): Map<string, RunLogEntry[]> {
  const map = new Map<string, RunLogEntry[]>();
  for (const e of entries) {
    if (!map.has(e.runId)) map.set(e.runId, []);
    map.get(e.runId)!.push(e);
  }
  return map;
}

// ── Contract result detail ─────────────────────────────────────────────────────

function ContractDetail({ result }: { result: ContractCheckResult }) {
  return (
    <div style={{ marginTop: 8, padding: "8px 12px", background: "#0a0f1e", borderRadius: 6, border: `1px solid ${result.passed ? "#16a34a33" : "#dc262633"}` }}>
      {result.artifactName && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
          Artifact: <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{result.artifactName}</span>
        </div>
      )}
      {result.validationNote && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontStyle: "italic" }}>{result.validationNote}</div>
      )}
      {result.violations && result.violations.length > 0 && (
        <div>
          {result.violations.map((v, i) => (
            <div key={i} style={{ fontSize: 11, color: "#fca5a5", marginBottom: 2 }}>
              ✗ {v}
            </div>
          ))}
        </div>
      )}
      {result.missingFields && result.missingFields.length > 0 && (
        <div style={{ fontSize: 11, color: "#fbbf24" }}>
          Missing fields: {result.missingFields.map((f) => (
            <span key={f} style={{ fontFamily: "monospace", background: "#1e293b", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{f}</span>
          ))}
        </div>
      )}
      {result.passed && !result.violations?.length && (
        <div style={{ fontSize: 11, color: "#86efac" }}>All contract requirements satisfied ✓</div>
      )}
    </div>
  );
}

// ── Single log entry row ───────────────────────────────────────────────────────

function LogEntryRow({ entry, isFirst, refTs }: { entry: RunLogEntry; isFirst: boolean; refTs: string }) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[entry.event] ?? { icon: "•", color: "#64748b", label: entry.event };
  const hasDetail = !!(entry.contractResult || entry.toolInputSummary || entry.approachSummary);

  const isHighlight = ["contract_fail", "blast_radius_block", "run_failed", "approval_pending", "escalation"].includes(entry.event);
  const isMuted = ["tool_use", "blast_radius_ok"].includes(entry.event);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "6px 12px",
        borderBottom: "1px solid #0d1829",
        background: isHighlight ? `${meta.color}08` : "transparent",
        cursor: hasDetail ? "pointer" : "default",
        transition: "background 0.1s",
      }}
      onClick={() => hasDetail && setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Timeline connector */}
        <div style={{ width: 20, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div
            style={{
              width: 22, height: 22,
              borderRadius: "50%",
              background: `${meta.color}22`,
              border: `1.5px solid ${meta.color}66`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: meta.color, fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </div>
        </div>

        {/* Event type pill */}
        <div
          style={{
            fontSize: 10, fontWeight: 700,
            color: meta.color,
            background: `${meta.color}15`,
            border: `1px solid ${meta.color}30`,
            borderRadius: 4,
            padding: "2px 6px",
            flexShrink: 0,
            fontFamily: "monospace",
            opacity: isMuted ? 0.6 : 1,
          }}
        >
          {entry.event}
        </div>

        {/* Skill / node name */}
        {(entry.skillName || entry.nodeId) && (
          <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
            {entry.skillName && <span style={{ color: "#c4b5fd" }}>{entry.skillName}</span>}
            {entry.nodeId && !entry.skillName && <span style={{ color: "#64748b", fontFamily: "monospace" }}>{entry.nodeId}</span>}
          </div>
        )}

        {/* Message */}
        <div style={{ fontSize: 11, color: isMuted ? "#475569" : "#cbd5e1", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.message}
        </div>

        {/* Timestamp + elapsed */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
          {!isFirst && (
            <span style={{ fontSize: 10, color: "#334155" }}>+{elapsed(refTs, entry.ts)}</span>
          )}
          <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>{formatTs(entry.ts)}</span>
        </div>

        {/* Expand indicator */}
        {hasDetail && (
          <span style={{ fontSize: 10, color: "#334155", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
        )}

        {/* Retry badge */}
        {entry.retryAttempt && (
          <span style={{ fontSize: 10, background: "#7c3aed22", border: "1px solid #7c3aed44", color: "#a78bfa", borderRadius: 4, padding: "1px 5px" }}>
            retry #{entry.retryAttempt}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginLeft: 36, marginTop: 4 }}>
          {entry.approachSummary && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontStyle: "italic" }}>
              &quot;{entry.approachSummary}&quot;
            </div>
          )}
          {entry.toolInputSummary && (
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", background: "#0a0f1e", padding: "4px 8px", borderRadius: 4, marginBottom: 4 }}>
              {entry.toolInputSummary}
            </div>
          )}
          {entry.contractResult && <ContractDetail result={entry.contractResult} />}
          {entry.escalationTarget && (
            <div style={{ fontSize: 11, color: "#fb923c" }}>Escalated to: <strong>{entry.escalationTarget}</strong></div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Run summary header ─────────────────────────────────────────────────────────

function RunSummaryHeader({ entries }: { entries: RunLogEntry[] }) {
  const first = entries[0];
  const last = entries[entries.length - 1];
  const runId = first.runId;
  const isComplete = entries.some((e) => e.event === "run_complete");
  const isFailed = entries.some((e) => e.event === "run_failed");
  const contracts_passed = entries.filter((e) => e.event === "contract_pass").length;
  const contracts_failed = entries.filter((e) => e.event === "contract_fail").length;
  const retries = entries.filter((e) => e.event === "retry").length;
  const approvals = entries.filter((e) => e.event === "approval_pending").length;
  const toolUses = entries.filter((e) => e.event === "tool_use").length;

  const statusColor = isFailed ? "#ef4444" : isComplete ? "#22c55e" : "#f59e0b";
  const statusLabel = isFailed ? "FAILED" : isComplete ? "COMPLETE" : "IN PROGRESS";

  return (
    <div style={{ padding: "12px 16px", background: "#080c18", borderBottom: "1px solid #1e293b" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11, fontWeight: 700,
            color: statusColor,
            background: `${statusColor}15`,
            border: `1px solid ${statusColor}40`,
            borderRadius: 4, padding: "2px 8px",
          }}
        >
          {statusLabel}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#475569" }}>
          run/{runId}
        </div>
        <div style={{ fontSize: 11, color: "#334155" }}>
          {formatTs(first.ts)} · {elapsed(first.ts, last.ts)} total
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#334155" }}>
          {entries.length} events
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatChip label="Tool calls" value={toolUses} color="#64748b" />
        {contracts_passed > 0 && <StatChip label="Contracts ✓" value={contracts_passed} color="#22c55e" />}
        {contracts_failed > 0 && <StatChip label="Contracts ✗" value={contracts_failed} color="#ef4444" />}
        {retries > 0 && <StatChip label="Retries" value={retries} color="#f97316" />}
        {approvals > 0 && <StatChip label="Approvals" value={approvals} color="#eab308" />}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "#475569" }}>{label}:</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  { label: "All", types: null },
  { label: "Contracts", types: ["contract_check", "contract_pass", "contract_fail"] as RunEventType[] },
  { label: "Tools", types: ["tool_use"] as RunEventType[] },
  { label: "Blast Radius", types: ["blast_radius_ok", "blast_radius_block"] as RunEventType[] },
  { label: "Approvals", types: ["approval_pending", "approval_granted", "approval_rejected"] as RunEventType[] },
  { label: "Errors", types: ["contract_fail", "blast_radius_block", "run_failed", "escalation"] as RunEventType[] },
];

function FilterBar({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "6px 12px", background: "#080c18", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
      {FILTER_GROUPS.map((g) => (
        <button
          key={g.label}
          type="button"
          onClick={() => onChange(g.label)}
          style={{
            fontSize: 10, fontWeight: 700,
            padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer",
            background: active === g.label ? "#1e293b" : "transparent",
            color: active === g.label ? "#e2e8f0" : "#475569",
            transition: "all 0.15s",
          }}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

// ── Drop zone ──────────────────────────────────────────────────────────────────

function DropZone({ onLoad }: { onLoad: (entries: RunLogEntry[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onLoad(parseNdjson(text));
    };
    reader.readAsText(file);
  }, [onLoad]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onLoad(parseNdjson(text));
    };
    reader.readAsText(file);
  };

  return (
    <div
      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 40 }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div
        style={{
          border: `2px dashed ${dragging ? "#3b82f6" : "#1e293b"}`,
          borderRadius: 16,
          padding: "48px 64px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          transition: "all 0.2s",
          background: dragging ? "#1e293b20" : "transparent",
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{ fontSize: 40 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
          {dragging ? "Drop to load run log" : "Load a run log"}
        </div>
        <div style={{ fontSize: 12, color: "#475569", textAlign: "center", maxWidth: 280 }}>
          Drop a <span style={{ fontFamily: "monospace", color: "#818cf8" }}>.ndjson</span> file exported from your workflow run,
          or click to browse.
        </div>
        <div style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
          Run logs are written to <span style={{ fontFamily: "monospace" }}>.workflow-os/runs/</span> in your project directory
        </div>
        <input ref={inputRef} type="file" accept=".ndjson,.jsonl,.json" onChange={handleFile} style={{ display: "none" }} />
      </div>

      {/* Sample / demo row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#334155" }}>or load a demo run:</div>
        <button
          type="button"
          onClick={() => onLoad(DEMO_ENTRIES)}
          style={{
            fontSize: 11, fontWeight: 700, padding: "4px 12px",
            borderRadius: 4, border: "1px solid #1e293b",
            background: "transparent", color: "#818cf8", cursor: "pointer",
          }}
        >
          ⚡ Demo: Invoice Processing run
        </button>
      </div>
    </div>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────────

const DEMO_RUNID = "a3f8e2c1b9";
const NOW = new Date("2026-04-24T09:15:00.000Z");
function t(offsetMs: number) { return new Date(NOW.getTime() + offsetMs).toISOString(); }

const DEMO_ENTRIES: RunLogEntry[] = [
  { ts: t(0),    runId: DEMO_RUNID, event: "run_start",       message: "Starting invoice processing workflow", nodeId: undefined },
  { ts: t(120),  runId: DEMO_RUNID, event: "skill_start",     nodeId: "extract-01",  skillName: "PDF Extraction",       message: "Extracting text from invoice PDF" },
  { ts: t(350),  runId: DEMO_RUNID, event: "tool_use",        nodeId: "extract-01",  skillName: "PDF Extraction",       toolName: "Bash", toolInputSummary: "python3 extract.py input/invoice.pdf", message: "Running pymupdf extraction" },
  { ts: t(1200), runId: DEMO_RUNID, event: "blast_radius_ok", nodeId: "extract-01",  skillName: "PDF Extraction",       message: "Write path working/extracted.md is within allowed paths" },
  { ts: t(1250), runId: DEMO_RUNID, event: "contract_check",  nodeId: "extract-01",  skillName: "PDF Extraction",       message: "Checking output contract for extracted.md" },
  { ts: t(1280), runId: DEMO_RUNID, event: "contract_pass",   nodeId: "extract-01",  skillName: "PDF Extraction",       message: "Contract satisfied: extracted.md has all required fields",
    contractResult: { passed: true, artifactName: "extracted.md", requiredFields: ["source_sha256", "page_count", "extractor_used"], validationNote: "All required frontmatter fields present" } },
  { ts: t(1350), runId: DEMO_RUNID, event: "skill_complete",  nodeId: "extract-01",  skillName: "PDF Extraction",       message: "PDF extraction complete" },
  { ts: t(1400), runId: DEMO_RUNID, event: "skill_start",     nodeId: "validate-02", skillName: "Data Validation",      message: "Validating extracted invoice data" },
  { ts: t(1600), runId: DEMO_RUNID, event: "tool_use",        nodeId: "validate-02", skillName: "Data Validation",      toolName: "Bash", toolInputSummary: "python3 validate.py working/extracted.md", message: "Running validation schema check" },
  { ts: t(2400), runId: DEMO_RUNID, event: "contract_check",  nodeId: "validate-02", skillName: "Data Validation",      message: "Checking output contract for validation-report.json" },
  { ts: t(2450), runId: DEMO_RUNID, event: "contract_fail",   nodeId: "validate-02", skillName: "Data Validation",      message: "Contract violation: validation-report.json missing required field 'confidence_score'",
    contractResult: { passed: false, artifactName: "validation-report.json", requiredFields: ["vendor_name", "amount", "currency", "confidence_score"], missingFields: ["confidence_score"], violations: ["Required field 'confidence_score' not found in output"] } },
  { ts: t(2500), runId: DEMO_RUNID, event: "retry",           nodeId: "validate-02", skillName: "Data Validation",      message: "Retry attempt 1 — injecting corrective guidance", retryAttempt: 1 },
  { ts: t(2550), runId: DEMO_RUNID, event: "tool_use",        nodeId: "validate-02", skillName: "Data Validation",      toolName: "Bash", toolInputSummary: "python3 validate.py --include-confidence working/extracted.md", message: "Re-running validation with confidence scoring" },
  { ts: t(3600), runId: DEMO_RUNID, event: "contract_pass",   nodeId: "validate-02", skillName: "Data Validation",      message: "Contract satisfied on retry",
    contractResult: { passed: true, artifactName: "validation-report.json", requiredFields: ["vendor_name", "amount", "currency", "confidence_score"], validationNote: "All fields present after retry" } },
  { ts: t(3650), runId: DEMO_RUNID, event: "skill_complete",  nodeId: "validate-02", skillName: "Data Validation",      message: "Data validation complete" },
  { ts: t(3700), runId: DEMO_RUNID, event: "skill_start",     nodeId: "approve-03",  skillName: "Finance Approval",     message: "Approval required — Level 1 autonomy (financial)" },
  { ts: t(3750), runId: DEMO_RUNID, event: "approval_pending", nodeId: "approve-03", skillName: "Finance Approval",     message: "Waiting for human sign-off on invoice posting ($14,280.00 to Acme Corp)" },
  { ts: t(18000),runId: DEMO_RUNID, event: "approval_granted", nodeId: "approve-03", skillName: "Finance Approval",     message: "Approval granted by finance@company.com" },
  { ts: t(18050),runId: DEMO_RUNID, event: "skill_complete",  nodeId: "approve-03",  skillName: "Finance Approval",     message: "Approval step complete" },
  { ts: t(18100),runId: DEMO_RUNID, event: "skill_start",     nodeId: "post-04",     skillName: "ERP Posting",          message: "Posting approved invoice to ERP" },
  { ts: t(18400),runId: DEMO_RUNID, event: "tool_use",        nodeId: "post-04",     skillName: "ERP Posting",          toolName: "Bash", toolInputSummary: "curl -X POST https://erp.company.com/api/invoices ...", message: "Sending invoice to ERP via REST API" },
  { ts: t(19200),runId: DEMO_RUNID, event: "contract_pass",   nodeId: "post-04",     skillName: "ERP Posting",          message: "ERP posting confirmed — invoice #INV-2024-089 created",
    contractResult: { passed: true, artifactName: "erp-confirmation.json", validationNote: "ERP returned 201 with invoice ID" } },
  { ts: t(19250),runId: DEMO_RUNID, event: "skill_complete",  nodeId: "post-04",     skillName: "ERP Posting",          message: "ERP posting complete" },
  { ts: t(19300),runId: DEMO_RUNID, event: "run_complete",    message: "Invoice processing workflow complete — 4/4 skills satisfied contracts" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export function RunLogView() {
  const [allEntries, setAllEntries] = useState<RunLogEntry[]>([]);
  const [filter, setFilter] = useState("All");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const runGroups = groupByRun(allEntries);
  const runIds = Array.from(runGroups.keys());

  // Auto-select first run on load
  const handleLoad = useCallback((entries: RunLogEntry[]) => {
    setAllEntries(entries);
    const ids = Array.from(groupByRun(entries).keys());
    if (ids.length > 0) setActiveRunId(ids[0]);
    setFilter("All");
  }, []);

  const currentEntries = activeRunId ? (runGroups.get(activeRunId) ?? []) : [];

  // Apply filter
  const filterGroup = FILTER_GROUPS.find((g) => g.label === filter);
  const visibleEntries = filterGroup?.types
    ? currentEntries.filter((e) => filterGroup.types!.includes(e.event))
    : currentEntries;

  const refTs = currentEntries[0]?.ts ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0b1020", color: "#e6e8ef" }}>
      {allEntries.length === 0 ? (
        <DropZone onLoad={handleLoad} />
      ) : (
        <>
          {/* Header bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 36, background: "#080c18", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>RUN LOG</span>

            {/* Run selector (multiple runs in one file) */}
            {runIds.length > 1 && (
              <div style={{ display: "flex", gap: 4 }}>
                {runIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveRunId(id)}
                    style={{
                      fontSize: 10, fontFamily: "monospace",
                      padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                      background: activeRunId === id ? "#1e293b" : "transparent",
                      color: activeRunId === id ? "#e2e8f0" : "#475569",
                    }}
                  >
                    {id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Load another */}
            <button
              type="button"
              onClick={() => { setAllEntries([]); setActiveRunId(null); }}
              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid #1e293b", background: "transparent", color: "#475569", cursor: "pointer" }}
            >
              ↩ Load different log
            </button>
          </div>

          {/* Run summary */}
          {activeRunId && runGroups.get(activeRunId) && (
            <RunSummaryHeader entries={runGroups.get(activeRunId)!} />
          )}

          {/* Filter bar */}
          <FilterBar active={filter} onChange={setFilter} />

          {/* Event list */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {visibleEntries.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#334155", fontSize: 12 }}>
                No events match this filter
              </div>
            ) : (
              visibleEntries.map((entry, i) => (
                <LogEntryRow
                  key={`${entry.runId}-${i}`}
                  entry={entry}
                  isFirst={i === 0}
                  refTs={refTs}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
