"use client";

import type { IngestionReport } from "@/lib/io/ingest-project";

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const modal: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  width: "100%",
  maxWidth: 680,
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #1e293b",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
};

const body: React.CSSProperties = {
  padding: "16px 20px",
  overflow: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const footer: React.CSSProperties = {
  padding: "12px 20px",
  borderTop: "1px solid #1e293b",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexShrink: 0,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: 6,
};

const pill = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: color + "18",
  border: "1px solid " + color + "44",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 11,
  color,
  fontWeight: 600,
  whiteSpace: "nowrap",
});

const card: React.CSSProperties = {
  background: "#0b1020",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
};

const btn = (primary?: boolean): React.CSSProperties => ({
  border: primary ? "none" : "1px solid #334155",
  borderRadius: 6,
  background: primary ? "#3b82f6" : "transparent",
  color: primary ? "#fff" : "#e2e8f0",
  padding: "7px 16px",
  fontSize: 13,
  fontWeight: primary ? 600 : 400,
  cursor: "pointer",
});

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={pill(color)}>
      {count} {label}
    </span>
  );
}

type Props = {
  report: IngestionReport;
  onConfirm: () => void;
  onCancel: () => void;
};

export function IngestionModal({ report, onConfirm, onCancel }: Props) {
  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
              Import Project: {report.workflowName}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Review what was found before adding to the canvas
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatPill label="skills" count={report.skillsFound.length} color="#3b82f6" />
            <StatPill label="artifacts" count={report.artifactsInferred.length} color="#8b5cf6" />
            <StatPill label="scripts" count={report.implementationFiles.length} color="#22c55e" />
            <StatPill label="unlinked" count={report.unlinkedFiles.length} color="#64748b" />
          </div>
        </div>

        {/* Body */}
        <div style={body}>
          {/* Warnings */}
          {report.warnings.length > 0 && (
            <div>
              <div style={sectionLabel}>Warnings ({report.warnings.length})</div>
              {report.warnings.map((w, i) => (
                <div key={i} style={{ ...card, borderColor: "#f59e0b44", background: "#f59e0b08", color: "#f59e0b", marginBottom: 4 }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {report.skillsFound.length > 0 && (
            <div>
              <div style={sectionLabel}>Skills found ({report.skillsFound.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {report.skillsFound.map((s) => (
                  <div key={s.fileName} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontWeight: 600, color: "#60a5fa" }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{s.fileName}</span>
                    </div>
                    {(s.inputs.length > 0 || s.outputs.length > 0) && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                        {s.inputs.length > 0 && <span>in: {s.inputs.join(", ")} </span>}
                        {s.outputs.length > 0 && <span>out: {s.outputs.join(", ")}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts */}
          {report.artifactsInferred.length > 0 && (
            <div>
              <div style={sectionLabel}>Artifacts inferred ({report.artifactsInferred.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {report.artifactsInferred.map((a) => (
                  <span key={a.fileName} style={pill(a.producers.length === 0 ? "#f59e0b" : "#8b5cf6")}>
                    {a.fileName}
                    {a.producers.length === 0 && " (no producer)"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Implementation files */}
          {report.implementationFiles.length > 0 && (
            <div>
              <div style={sectionLabel}>Implementation files linked ({report.implementationFiles.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {report.implementationFiles.map((f) => (
                  <div key={f.scriptPath} style={card}>
                    <span style={{ fontFamily: "monospace", color: "#22c55e", fontSize: 11 }}>{f.scriptPath}</span>
                    <span style={{ color: "#475569", fontSize: 11 }}> linked to </span>
                    <span style={{ color: "#60a5fa", fontSize: 11 }}>{f.linkedSkill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unlinked files */}
          {report.unlinkedFiles.length > 0 && (
            <div>
              <div style={sectionLabel}>
                Unlinked files ({report.unlinkedFiles.length}) — not mapped to any skill or artifact
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {report.unlinkedFiles.map((f) => (
                  <span key={f.path} style={pill("#475569")}>
                    {f.path}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
                These files exist in your project but are not referenced in any skill contract.
                They may be utilities, configs, or skills that need YAML definitions added.
              </div>
            </div>
          )}

          {report.skillsFound.length === 0 && (
            <div style={{ ...card, borderColor: "#ef444444", background: "#ef444408", color: "#ef4444" }}>
              No skill YAML files were found in this ZIP. Make sure your skill files have
              both a <code>name</code> field and at least one <code>inputs</code> or <code>outputs</code> array.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footer}>
          <button type="button" style={btn()} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={btn(true)}
            onClick={onConfirm}
            disabled={report.skillsFound.length === 0 && report.artifactsInferred.length === 0}
          >
            Import to Canvas ({report.skillsFound.length + report.artifactsInferred.length} nodes)
          </button>
        </div>
      </div>
    </div>
  );
}
