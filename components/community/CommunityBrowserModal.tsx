"use client";

import { useState, useMemo } from "react";
import featuredRaw from "@/lib/community/featured.json";
import { useWorkflowStore } from "@/store/workflow-store";
import { WORKFLOW_TEMPLATES } from "@/lib/templates";

interface FeaturedTemplate {
  slug: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  department: string;
  downloads: number;
  autonomyLevel: number;
  nodeCount: number;
  workflowType: string;
  license: string;
  version: string;
  createdAt: string;
}

const featured = featuredRaw as FeaturedTemplate[];

const DEPARTMENTS = ["All", "Finance", "HR", "Legal", "IT", "Sales", "Marketing", "Knowledge"];

const DEPT_COLORS: Record<string, string> = {
  Finance: "#3b82f6", HR: "#8b5cf6", Legal: "#f59e0b", IT: "#22c55e",
  Sales: "#ec4899", Marketing: "#f97316", Knowledge: "#a78bfa",
};

const AUTONOMY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Human", color: "#64748b" },
  1: { label: "Supervised", color: "#3b82f6" },
  2: { label: "Automated", color: "#22c55e" },
  3: { label: "Full auto", color: "#f59e0b" },
};

// Map community slugs → template IDs in the templates library
const SLUG_TO_TEMPLATE_ID: Record<string, string> = {
  "invoice-approval-automation": "invoice-approval-fs",
  "employee-onboarding-automation": "employee-onboarding-fs",
  "contract-review-automation": "contract-review-fs",
  "it-support-triage": "it-support-fs",
  "sales-quote-automation": "sales-quote-fs",
  "pdf-to-obsidian": "pdf-to-obsidian",
  "email-triage-routing": "email-triage-fs",
};

export function CommunityBrowserModal({ onClose }: { onClose: () => void }) {
  const [activeDept, setActiveDept] = useState("All");
  const [search, setSearch] = useState("");
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);
  const workflow = useWorkflowStore((s) => s.workflow);

  const filtered = useMemo(() => {
    return featured.filter((t) => {
      const deptMatch = activeDept === "All" || t.department === activeDept;
      const q = search.toLowerCase().trim();
      const searchMatch = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q));
      return deptMatch && searchMatch;
    });
  }, [activeDept, search]);

  const install = (tpl: FeaturedTemplate) => {
    const templateId = SLUG_TO_TEMPLATE_ID[tpl.slug];
    const template = templateId ? WORKFLOW_TEMPLATES.find((t) => t.id === templateId) : null;

    if (!template) {
      window.alert(`Template "${tpl.title}" is not yet available for local install. Visit productionai.institute/studio to get started.`);
      return;
    }

    if (workflow.nodes.length > 0 && !window.confirm(`Load "${tpl.title}"? This will replace the current canvas.`)) return;

    const w = template.build();
    setWorkflow(w);
    setTimeout(() => applyAutoLayout(), 80);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0b102099", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 900, maxWidth: "96vw", maxHeight: "90vh", background: "#0a0f1e", borderRadius: 16, border: "1px solid #1e2d4a", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 100px #00000099" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "linear-gradient(90deg, #080e1c, #0d1a35)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>🌐 Community Workflows</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Contract-ready AI workflows from the PAI community. Install directly into your studio.
            </div>
          </div>
          <a
            href="/community"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#7c3aed", textDecoration: "none", padding: "4px 12px", borderRadius: 6, border: "1px solid #7c3aed44", marginRight: 8 }}
          >
            Open website ↗
          </a>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>&times;</button>
        </div>

        {/* Search + filter bar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e293b", background: "#080c18", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#334155", fontSize: 12 }}>🔍</span>
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", background: "#0b1020", border: "1px solid #1e293b", borderRadius: 8, padding: "7px 10px 7px 30px", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {DEPARTMENTS.map((dept) => {
              const active = activeDept === dept;
              const color = DEPT_COLORS[dept] ?? "#7c3aed";
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setActiveDept(dept)}
                  style={{
                    background: active ? color + "22" : "transparent",
                    border: `1px solid ${active ? color : "#1e293b"}`,
                    borderRadius: 6,
                    padding: "4px 12px",
                    color: active ? color : "#64748b",
                    fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  {dept}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#334155", marginLeft: "auto" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Cards grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, alignContent: "start" }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0", color: "#334155" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13 }}>No workflows match your search.</div>
            </div>
          ) : (
            filtered.map((tpl) => {
              const deptColor = DEPT_COLORS[tpl.department] ?? "#64748b";
              const autonomy = AUTONOMY_LABELS[tpl.autonomyLevel] ?? AUTONOMY_LABELS[1];
              return (
                <div
                  key={tpl.slug}
                  style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${deptColor}, transparent)` }} />

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", lineHeight: 1.3 }}>{tpl.title}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                        by <span style={{ color: "#64748b" }}>{tpl.author}</span>
                        {" · "}↓ {tpl.downloads.toLocaleString()}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: autonomy.color + "22", border: `1px solid ${autonomy.color}55`, color: autonomy.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {autonomy.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, flex: 1 }}>
                    {tpl.description}
                  </div>

                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {tpl.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "#1e293b", color: "#475569" }}>{tag}</span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => install(tpl)}
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 7, padding: "8px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", boxShadow: "0 2px 12px #7c3aed44" }}
                  >
                    ↓ Install in Studio
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #1e293b", background: "#060b17", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#334155" }}>
            More workflows at{" "}
            <a href="/community" target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed", textDecoration: "none" }}>
              productionai.institute/studio
            </a>
          </span>
          <span style={{ fontSize: 10, color: "#334155" }}>
            Want to share your workflow? Use <strong style={{ color: "#64748b" }}>Export .wfos</strong> in the top bar.
          </span>
        </div>
      </div>
    </div>
  );
}
