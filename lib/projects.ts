/**
 * lib/projects.ts
 *
 * Multi-workflow project management stored in localStorage.
 * Each project is a saved Workflow snapshot with metadata.
 */
import type { Workflow } from "@/lib/types/workflow";

export const PROJECTS_LS_KEY = "wfos-projects";
export const ACTIVE_PROJECT_LS_KEY = "wfos-active-project";

export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  nodeCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface Project extends ProjectMeta {
  workflow: Workflow;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function safeProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function save(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_LS_KEY, JSON.stringify(projects));
}

export function listProjects(): ProjectMeta[] {
  return safeProjects().map(({ id, name, description, clientName, nodeCount, updatedAt, createdAt }) => ({
    id, name, description, clientName, nodeCount, updatedAt, createdAt,
  }));
}

export function loadProject(id: string): Workflow | null {
  const p = safeProjects().find((x) => x.id === id);
  return p?.workflow ?? null;
}

export function saveProject(workflow: Workflow, id?: string): ProjectMeta {
  const projects = safeProjects();
  const existingIdx = id ? projects.findIndex((p) => p.id === id) : -1;
  const now = new Date().toISOString();

  const meta: Project = {
    id: id ?? uid(),
    name: workflow.name || "Untitled Workflow",
    description: workflow.description,
    clientName: (workflow as { clientName?: string }).clientName,
    nodeCount: workflow.nodes.filter((n) => n.type !== "proposal").length,
    updatedAt: now,
    createdAt: existingIdx >= 0 ? projects[existingIdx].createdAt : now,
    workflow,
  };

  if (existingIdx >= 0) {
    projects[existingIdx] = meta;
  } else {
    projects.unshift(meta); // newest first
  }

  save(projects);
  localStorage.setItem(ACTIVE_PROJECT_LS_KEY, meta.id);
  return meta;
}

export function deleteProject(id: string): void {
  const projects = safeProjects().filter((p) => p.id !== id);
  save(projects);
  if (localStorage.getItem(ACTIVE_PROJECT_LS_KEY) === id) {
    localStorage.removeItem(ACTIVE_PROJECT_LS_KEY);
  }
}

export function duplicateProject(id: string): ProjectMeta | null {
  const p = safeProjects().find((x) => x.id === id);
  if (!p) return null;
  const now = new Date().toISOString();
  const copy: Project = {
    ...p,
    id: uid(),
    name: `${p.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    workflow: { ...p.workflow, id: uid(), name: `${p.workflow.name} (copy)` },
  };
  const projects = safeProjects();
  projects.unshift(copy);
  save(projects);
  return copy;
}

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_LS_KEY);
}

export function setActiveProjectId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROJECT_LS_KEY, id);
}
