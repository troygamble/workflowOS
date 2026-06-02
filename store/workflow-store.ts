"use client";

import { create } from "zustand";
import { buildInferredEdge, syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import { exampleWorkflow, starterWorkflow } from "@/lib/graph/template-loader";
import { buildWorkflowZip, type ExportOptions } from "@/lib/io/export-package";
import { importWorkflowFromGraph, importWorkflowFromZip } from "@/lib/io/import-package";
import { mergeAllApprovedProposals, mergeApprovedProposalIntoWorkflow } from "@/lib/proposals/merge-proposal";
import { getNextRecommendedStep } from "@/lib/state/next-step-engine";
import { propagateStaleness } from "@/lib/state/staleness-engine";
import { validateWorkflow } from "@/lib/validation/validate-workflow";
import type {
  Mode,
  NodeType,
  ProposalNode,
  ValidationResult,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

export const LS_KEY = "workflow-studio";

const HISTORY_LIMIT = 50;

type WorkflowStore = {
  mode: Mode;
  workflow: Workflow;
  selectedNodeId?: string;
  validation: ValidationResult;
  // Undo / redo
  past: Workflow[];
  future: Workflow[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Actions
  setMode: (mode: Mode) => void;
  selectNode: (id?: string) => void;
  addNode: (type: NodeType, subtype?: string) => void;
  updateNode: (id: string, patch: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  /** Pass skipHistory=true for programmatic position syncs / import / hydrate */
  setWorkflow: (workflow: Workflow, skipHistory?: boolean) => void;
  setWorkflowName: (name: string) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addEdge: (edge: WorkflowEdge) => void;
  connectNodes: (sourceId: string, targetId: string) => boolean;
  runValidation: () => void;
  markArtifactChanged: (artifactId: string) => void;
  exportZip: (opts?: ExportOptions) => Promise<void>;
  importFile: (file: File) => Promise<void>;
  getNextStep: (
    jobs?: { stepId: string; status: string }[]
  ) => { stepId: string; reason: string } | null;
  loadExample: () => void;
  /** Clear the canvas and start fresh — also wipes localStorage */
  newWorkflow: () => void;
  /** Update the workflow-level business objective */
  setObjective: (objective: string) => void;
  setEnvironment: (env: import("@/lib/types/workflow").WorkflowEnvironment) => void;
  mergeProposal: (proposalId: string) => void;
  /** Approve all pending proposals and bulk-merge them, then auto-layout. */
  approveAndMergeAll: () => { mergedCount: number; errors: string[] };
  addProposalNodes: (nodes: ProposalNode[]) => void;
  hydrateFromLocalStorage: () => void;
  applyAutoLayout: () => void;
  /** Snapshot of the current-state workflow before automation transformation */
  currentStateSnapshot?: Workflow;
  saveCurrentStateSnapshot: () => void;
  clearCurrentStateSnapshot: () => void;
};

const uid = () => crypto.randomUUID().slice(0, 8);

function finalize(workflow: Workflow): Workflow {
  return {
    ...syncSkillContractsFromGraph(workflow),
    updatedAt: new Date().toISOString(),
  };
}

/** Produce a partial state update that includes undo history bookkeeping */
function withHistory(
  current: Workflow,
  past: Workflow[],
  newWorkflow: Workflow
): Pick<WorkflowStore, "workflow" | "past" | "future"> {
  return {
    workflow: newWorkflow,
    past: [...past.slice(-HISTORY_LIMIT + 1), current],
    future: [],
  };
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  mode: "design",
  workflow: finalize(starterWorkflow),
  validation: { valid: true, issues: [] },
  past: [],
  future: [],
  currentStateSnapshot: undefined,

  // Undo / redo

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const { past, workflow, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      workflow: prev,
      future: [workflow, ...future.slice(0, HISTORY_LIMIT - 1)],
      selectedNodeId: undefined,
    });
  },

  redo: () => {
    const { future, workflow, past } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      future: future.slice(1),
      workflow: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), workflow],
      selectedNodeId: undefined,
    });
  },

  // Core actions

  setMode: (mode) => set({ mode }),

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (type, subtype) =>
    set((state) => {
      const baseNode: WorkflowNode =
        type === "skill"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 120, y: 120 },
              data: {
                name: "new_skill",
                fileName: "new_skill.yaml",
                inputs: [],
                outputs: [],
                requires: [],
                produces: [],
                validations: [],
                tags: [],
                enabled: true,
                version: 1,
              },
            }
          : type === "artifact"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 220, y: 220 },
              data: {
                name: "new_artifact.md",
                fileName: "new_artifact.md",
                artifactType: "md" as const,
                status: "unknown" as const,
              },
            }
          : type === "human"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 200, y: 200 },
              data: {
                name: subtype ? `${subtype}_checkpoint` : "human_checkpoint",
                subtype: (subtype ?? "judgment") as import("@/lib/types/workflow").HumanSubtype,
                requiredInputs: [],
                producedArtifacts: [],
              },
            }
          : type === "proposal"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 420, y: 220 },
              data: {
                proposalType: "proposed_artifact" as const,
                name: "New Proposal",
                status: "pending" as const,
                createdAt: new Date().toISOString(),
                source: "manual",
              },
            }
          : type === "integration"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 320, y: 320 },
              data: {
                name: "new_integration",
                subtype: "other" as const,
                direction: "outbound" as const,
                inputs: [],
                outputs: [],
              },
            }
          : type === "conditional"
          ? {
              id: `${type}_${uid()}`,
              type,
              position: { x: 320, y: 120 },
              data: {
                name: "Condition",
                condition: "Define your branching condition",
                trueLabel: "Yes",
                falseLabel: "No",
              },
            }
          : {
              id: `${type}_${uid()}`,
              type,
              position: { x: 520, y: 220 },
              data: { name: "system_node", systemRole: "helper" },
            };

      const newWorkflow = finalize({
        ...state.workflow,
        nodes: [...state.workflow.nodes, baseNode],
      });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  updateNode: (id, patch) =>
    set((state) => {
      const newWorkflow = finalize({
        ...state.workflow,
        nodes: state.workflow.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        ) as Workflow["nodes"],
      });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  deleteNode: (id) =>
    set((state) => {
      const newWorkflow = finalize({
        ...state.workflow,
        nodes: state.workflow.nodes.filter((n) => n.id !== id),
        edges: state.workflow.edges.filter((e) => e.source !== id && e.target !== id),
      });
      return {
        ...withHistory(state.workflow, state.past, newWorkflow),
        selectedNodeId: state.selectedNodeId === id ? undefined : state.selectedNodeId,
      };
    }),

  duplicateNode: (id) =>
    set((state) => {
      const n = state.workflow.nodes.find((x) => x.id === id);
      if (!n) return state;
      const copy = structuredClone(n) as WorkflowNode;
      copy.id = `${n.type}_${uid()}`;
      copy.position = { x: n.position.x + 40, y: n.position.y + 40 };
      const newWorkflow = finalize({
        ...state.workflow,
        nodes: [...state.workflow.nodes, copy],
      });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  setWorkflow: (workflow, skipHistory = false) => {
    if (skipHistory) {
      set({ workflow: finalize(workflow), future: [] });
    } else {
      set((state) => withHistory(state.workflow, state.past, finalize(workflow)));
    }
  },

  setWorkflowName: (name) =>
    set((state) => {
      const newWorkflow = finalize({ ...state.workflow, name });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  setEdges: (edges) =>
    set((state) => {
      const newWorkflow = finalize({ ...state.workflow, edges });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  addEdge: (edge) =>
    set((state) => {
      const newWorkflow = finalize({
        ...state.workflow,
        edges: [...state.workflow.edges, edge],
      });
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  connectNodes: (sourceId, targetId) => {
    const s = get().workflow;
    const id = `e_${uid()}`;
    const e = buildInferredEdge(s, sourceId, targetId, id);
    if (!e) return false;
    if (s.edges.some((x) => x.source === e.source && x.target === e.target)) return false;
    set((state) => {
      const newWorkflow = finalize({
        ...state.workflow,
        edges: [...state.workflow.edges, e],
      });
      return withHistory(state.workflow, state.past, newWorkflow);
    });
    return true;
  },

  runValidation: () =>
    set((state) => ({ validation: validateWorkflow(state.workflow) })),

  markArtifactChanged: (artifactId) =>
    set((state) => {
      const newWorkflow = propagateStaleness(state.workflow, artifactId);
      return withHistory(state.workflow, state.past, newWorkflow);
    }),

  exportZip: async (opts) => {
    const { workflow, validation } = get();

    // Warn (but don't block) if there are validation errors.
    // Partial / draft exports are still useful for iteration.
    if (!validation.valid) {
      const errorIssues = validation.issues.filter((i) => i.severity === "error");
      const count = errorIssues.length;
      const examples = errorIssues
        .slice(0, 2)
        .map((i) => i.message)
        .join("; ");
      const proceed = window.confirm(
        `This workflow has ${count} validation error${count !== 1 ? "s" : ""}:\n\n${examples}${count > 2 ? `\n…and ${count - 2} more` : ""}\n\nThe export ZIP may be incomplete or unusable. Export anyway?`
      );
      if (!proceed) return;
    }

    const blob = await buildWorkflowZip(workflow, opts);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(workflow.name || "workflow").replace(/\s+/g, "_")}_package.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importFile: async (file) => {
    const workflow = file.name.endsWith(".zip")
      ? await importWorkflowFromZip(file)
      : await importWorkflowFromGraph(file);
    // Import replaces everything - no undo history kept
    set({ workflow: finalize(workflow), past: [], future: [] });
  },

  getNextStep: (jobs) =>
    getNextRecommendedStep(get().workflow, jobs ?? []),

  loadExample: () =>
    set({ workflow: finalize(exampleWorkflow), past: [], future: [] }),

  newWorkflow: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
    const uid = () => crypto.randomUUID().slice(0, 8);
    set({
      workflow: {
        ...starterWorkflow,
        id: 'wf_' + uid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      past: [],
      future: [],
      selectedNodeId: undefined,
      validation: { valid: true, issues: [] },
    });
  },

  setObjective: (objective) =>
    set((state) => {
      const updated = finalize({ ...state.workflow, objective });
      return withHistory(state.workflow, state.past, updated);
    }),

  setEnvironment: (env) => {
    const newWorkflow = finalize({ ...get().workflow, environment: env });
    set({ workflow: newWorkflow });
  },

  mergeProposal: (proposalId) => {
    const { workflow, past } = get();
    const r = mergeApprovedProposalIntoWorkflow(workflow, proposalId);
    if (r.ok) {
      set(withHistory(workflow, past, finalize(r.workflow)));
    } else if (typeof window !== "undefined") {
      window.alert(r.error);
    }
  },

  approveAndMergeAll: () => {
    const { workflow, past } = get();

    // First, stamp all pending proposals as approved so mergeAllApprovedProposals picks them up
    const withAllApproved: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.type === "proposal" && n.data.status === "pending"
          ? { ...n, data: { ...n.data, status: "approved" as const } }
          : n
      ) as Workflow["nodes"],
    };

    const result = mergeAllApprovedProposals(withAllApproved);
    set(withHistory(workflow, past, finalize(result.workflow)));

    // Trigger auto-layout after state settles
    setTimeout(() => get().applyAutoLayout(), 0);

    return { mergedCount: result.mergedCount, errors: result.errors };
  },

  addProposalNodes: (nodes) =>
    set((state) => {
      if (!nodes.length) return state;
      const newWorkflow = finalize({
        ...state.workflow,
        nodes: [...state.workflow.nodes, ...nodes],
      });
      return {
        ...withHistory(state.workflow, state.past, newWorkflow),
        selectedNodeId: nodes[0]?.id ?? state.selectedNodeId,
      };
    }),

  hydrateFromLocalStorage: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const w = JSON.parse(raw) as Workflow;
      if (w?.nodes && w?.edges) {
        set({ workflow: finalize(w), past: [], future: [] });
      }
    } catch {
      /* ignore corrupt storage */
    }
  },

  saveCurrentStateSnapshot: () => {
    set({ currentStateSnapshot: get().workflow });
  },

  clearCurrentStateSnapshot: () => {
    set({ currentStateSnapshot: undefined });
  },

  applyAutoLayout: () => {
    // Lazy import to avoid circular deps at module init time
    import("@/lib/graph/auto-layout").then(({ applyAutoLayout }) => {
      const { workflow, past } = get();
      const laid = applyAutoLayout(workflow);
      set(withHistory(workflow, past, finalize(laid)));
    });
  },
}));

// ── Project auto-save ──────────────────────────────────────────────────────────
// Debounced subscribe: whenever the workflow changes and has real nodes,
// save it to the project store. This powers the multi-project browser.
if (typeof window !== "undefined") {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWorkflowId: string | null = null;
  useWorkflowStore.subscribe((state) => {
    const { workflow } = state;
    const realNodes = workflow.nodes.filter((n) => n.type !== "proposal").length;
    if (realNodes === 0) return;
    // Only save when workflow content actually changes (not just selectedNodeId etc.)
    if (workflow.updatedAt === lastWorkflowId) return;
    lastWorkflowId = workflow.updatedAt ?? null;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      import("@/lib/projects").then(({ saveProject, getActiveProjectId }) => {
        saveProject(workflow, getActiveProjectId() ?? undefined);
      });
    }, 1500); // debounce 1.5s so rapid edits don't thrash localStorage
  });
}
