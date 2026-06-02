"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { exportAsWfos, downloadWfos, safeFilename } from "@/lib/io/wfos-package";
import type { WfosExportOptions } from "@/lib/io/wfos-package";

const DEPARTMENTS = ["Finance", "HR", "Legal", "IT", "Sales", "Operations", "Engineering", "Marketing", "PMO", "Knowledge"];
const LICENSES = ["MIT", "Commercial", "Personal"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0b1020",
  border: "1px solid #1e293b",
  borderRadius: 7,
  padding: "9px 12px",
  color: "#e2e8f0",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export function ExportWfosModal({ onClose }: { onClose: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);

  const [title, setTitle] = useState(workflow.name || "My Workflow");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [license, setLicense] = useState<"MIT" | "Commercial" | "Personal">("MIT");
  const [homepage, setHomepage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const skillCount = workflow.nodes.filter((n) => n.type === "skill").length;
  const humanCount = workflow.nodes.filter((n) => n.type === "human").length;
  const artifactCount = workflow.nodes.filter((n) => n.type === "artifact").length;

  const handleExport = async () => {
    if (!title.trim()) return;
    setExporting(true);
    try {
      const options: WfosExportOptions = {
        manifest: {
          title: title.trim(),
          description: description.trim(),
          author: author.trim() || "Anonymous",
          version,
          tags: selectedTags,
          license,
          homepage: homepage.trim() || undefined,
        },
      };
      const blob = await exportAsWfos(workflow, options);
      downloadWfos(blob, safeFilename(title));
      setDone(true);
    } catch (err) {
      window.alert("Export failed: " + String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "#0b102099", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 640, maxWidth: "96vw", maxHeight: "90vh", background: "#0a0f1e", borderRadius: 14, border: "1px solid #1e2d4a", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px #00000088" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "linear-gradient(90deg, #080e1c, #0d1a35)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>📦 Export as .wfos</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Portable workflow bundle — share with teammates or publish to the community marketplace.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>&times;</button>
        </div>

        {done ? (
          /* Success state */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0" }}>
              {safeFilename(title)}.wfos downloaded!
            </div>
            <div style={{ fontSize: 12, color: "#64748b", maxWidth: 380, lineHeight: 1.7 }}>
              Share the file with teammates, import it into any PAI Studio instance, or submit it to the community marketplace at{" "}
              <span style={{ color: "#7c3aed" }}>productionai.institute/studio</span>.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href="/community"
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: "none", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 20px", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none", display: "inline-block" }}
              >
                View Community ↗
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 8, padding: "10px 28px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Form */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", gap: 24 }}>
              {/* Left: form fields */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <Field label="Title *">
                  <input
                    style={inputStyle}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Invoice Approval Automation"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this workflow do? Who is it for?"
                  />
                </Field>
                <Field label="Author">
                  <input
                    style={inputStyle}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name or alias"
                  />
                </Field>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Field label="Version">
                      <input
                        style={inputStyle}
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        placeholder="1.0.0"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="License">
                      <select
                        style={{ ...inputStyle, cursor: "pointer" }}
                        value={license}
                        onChange={(e) => setLicense(e.target.value as typeof license)}
                      >
                        {LICENSES.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <Field label="Homepage / Community URL">
                  <input
                    style={inputStyle}
                    value={homepage}
                    onChange={(e) => setHomepage(e.target.value)}
                    placeholder="https://www.productionai.institute/studio/..."
                  />
                </Field>
                <Field label="Department tags">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {DEPARTMENTS.map((d) => {
                      const active = selectedTags.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleTag(d)}
                          style={{
                            background: active ? "#7c3aed33" : "#0f172a",
                            border: `1px solid ${active ? "#7c3aed" : "#1e293b"}`,
                            borderRadius: 6,
                            padding: "5px 12px",
                            fontSize: 11,
                            color: active ? "#a78bfa" : "#64748b",
                            cursor: "pointer",
                            transition: "all 0.1s",
                          }}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              {/* Right: preview */}
              <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bundle preview</div>
                <div style={{ background: "#080c18", border: "1px solid #1e293b", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10, fontSize: 11, color: "#475569" }}>
                  <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                    {safeFilename(title || "workflow")}.wfos
                  </div>
                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                    <FileRow name="manifest.json" color="#7c3aed" />
                    <FileRow name="workflow.json" color="#3b82f6" />
                    <FileRow name="hooks/" color="#22c55e" />
                  </div>
                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <Stat label="Nodes" value={workflow.nodes.length} />
                    <Stat label="Skills" value={skillCount} />
                    <Stat label="Human steps" value={humanCount} />
                    <Stat label="Artifacts" value={artifactCount} />
                    <Stat label="Edges" value={workflow.edges.length} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#334155", lineHeight: 1.6 }}>
                  The .wfos bundle is a ZIP file that can be imported into any PAI Studio installation or shared via the community marketplace.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #1e293b", display: "flex", gap: 10, justifyContent: "flex-end", background: "#080c18" }}>
              <button type="button" onClick={onClose} style={{ background: "none", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 20px", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting || !title.trim()}
                style={{
                  background: exporting ? "#1e293b" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 24px",
                  color: exporting ? "#475569" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: exporting || !title.trim() ? "not-allowed" : "pointer",
                  boxShadow: exporting ? "none" : "0 4px 16px #7c3aed44",
                }}
              >
                {exporting ? "Packaging…" : "📦 Export .wfos"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FileRow({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{name}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span style={{ color: "#94a3b8", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
