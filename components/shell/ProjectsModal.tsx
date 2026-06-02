"use client";
import { useEffect, useState, useCallback } from "react";
import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
  duplicateProject,
  getActiveProjectId,
  type ProjectMeta,
} from "@/lib/projects";
import type { Workflow } from "@/lib/types/workflow";

// ── Modal overlay + card styles ──────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24,
};

const card: React.CSSProperties = {
  background: "linear-gradient(160deg, #0c1526 0%, #080e1c 100%)",
  border: "1px solid #1e2d4a",
  borderRadius: 16,
  width: "100%", maxWidth: 680,
  maxHeight: "80vh",
  display: "flex", flexDirection: "column",
  boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isActive,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: ProjectMeta;
  isActive: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      style={{
        background: isActive ? "#0f1e3a" : "#090e1c",
        border: `1px solid ${isActive ? "#3b82f644" : "#1e293b"}`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = "#2e4060";
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = "#1e293b";
      }}
      onClick={onOpen}
    >
      {/* Icon */}
      <div style={{
        width: 40, height: 40, flexShrink: 0, borderRadius: 8,
        background: isActive ? "linear-gradient(135deg, #3b82f622, #6d28d922)" : "#0f172a",
        border: `1px solid ${isActive ? "#3b82f644" : "#1e293b"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>
        {project.clientName ? "🏢" : "🔄"}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </span>
          {isActive && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6", background: "#3b82f618", border: "1px solid #3b82f633", borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>
              OPEN
            </span>
          )}
        </div>
        {project.clientName && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{project.clientName}</div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#475569" }}>
          <span>{project.nodeCount} node{project.nodeCount !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>edited {timeAgo(project.updatedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 6, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate"
          style={{ background: "none", border: "1px solid #1e293b", borderRadius: 6, padding: "4px 8px", color: "#64748b", fontSize: 11, cursor: "pointer" }}
        >
          ⧉
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={() => { onDelete(); setConfirming(false); }}
            style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 6, padding: "4px 8px", color: "#ef4444", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="Delete"
            style={{ background: "none", border: "1px solid #1e293b", borderRadius: 6, padding: "4px 8px", color: "#64748b", fontSize: 11, cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export function ProjectsModal({
  currentWorkflow,
  onClose,
  onLoad,
  onNew,
}: {
  currentWorkflow: Workflow;
  onClose: () => void;
  onLoad: (workflow: Workflow, id: string) => void;
  onNew: () => void;
}) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    setProjects(listProjects());
    setActiveId(getActiveProjectId());
  }, []);

  useEffect(() => {
    // Auto-save current workflow as a project if it has nodes
    if (currentWorkflow.nodes.filter((n) => n.type !== "proposal").length > 0) {
      const existingId = getActiveProjectId();
      saveProject(currentWorkflow, existingId ?? undefined);
    }
    refresh();
  }, [currentWorkflow, refresh]);

  const handleOpen = (id: string) => {
    const wf = loadProject(id);
    if (wf) { onLoad(wf, id); onClose(); }
  };

  const handleDuplicate = (id: string) => {
    duplicateProject(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    refresh();
  };

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.clientName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #1a2540", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>Projects</h2>
              <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>
                {projects.length} saved workflow{projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onNew}
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
              >
                + New Project
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", color: "#64748b", fontSize: 13, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search */}
          {projects.length > 3 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or client…"
              style={{
                marginTop: 12, width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
                padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none",
              }}
            />
          )}
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#334155" }}>
              {search ? "No projects match your search." : "No saved projects yet. Save your current workflow to get started."}
            </div>
          )}
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={p.id === activeId}
              onOpen={() => handleOpen(p.id)}
              onDuplicate={() => handleDuplicate(p.id)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid #0d1520", flexShrink: 0, fontSize: 11, color: "#334155", textAlign: "center" }}>
          Projects are saved locally on this computer · Export as .wfos to share or back up
        </div>
      </div>
    </div>
  );
}
