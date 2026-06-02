"use client";

import { create } from "zustand";
import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import { applyStateJsonToWorkflow } from "@/lib/io/runtime-snapshot";
import { detectRuntimeDrift } from "@/lib/runtime/drift-detector";
import { applyJobResultToWorkflow, eventForJob, queueJob, transitionJob } from "@/lib/runtime/run-simulator";
import { createProposalNodeFromEvent } from "@/lib/proposals/proposal-engine";
import type { RuntimeEvent, RuntimeJob } from "@/lib/types/runtime";
import type { Workflow } from "@/lib/types/workflow";
import { useWorkflowStore } from "@/store/workflow-store";

const SAMPLE_BASE = "/runtime-samples/";

type RuntimeStore = {
  jobs: RuntimeJob[];
  events: RuntimeEvent[];
  lastEventsLog: string;
  pollId: number | null;
  queue: (stepId: string) => void;
  start: (jobId: string) => void;
  complete: (jobId: string) => void;
  fail: (jobId: string) => void;
  processDriftForEvent: (event: RuntimeEvent) => void;
  loadSampleFiles: () => Promise<void>;
  startSamplePolling: () => void;
  stopSamplePolling: () => void;
};

function wfFinalize(w: Workflow): Workflow {
  return { ...syncSkillContractsFromGraph(w), updatedAt: new Date().toISOString() };
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  jobs: [],
  events: [],
  lastEventsLog: "",
  pollId: null,
  processDriftForEvent: (event) => {
    const workflow = useWorkflowStore.getState().workflow;
    const drifts = detectRuntimeDrift(workflow, event);
    for (const d of drifts) {
      set((s) => ({ events: [...s.events, d] }));
      if (d.type === "unknown_artifact_detected" || d.type === "unknown_step_detected") {
        const p = createProposalNodeFromEvent(d);
        const wf0 = useWorkflowStore.getState().workflow;
        const exists = wf0.nodes.some(
          (n) => n.type === "proposal" && n.data.name === p.data.name && n.data.status === "pending"
        );
        if (!exists) {
          useWorkflowStore.setState((st) => ({ workflow: wfFinalize({ ...st.workflow, nodes: [...st.workflow.nodes, p] }) }));
        }
      }
    }
  },
  queue: (stepId) => {
    const job = queueJob(stepId);
    const ev = eventForJob("job_queued", job);
    set((state) => ({ jobs: [...state.jobs, job], events: [...state.events, ev] }));
    get().processDriftForEvent(ev);
  },
  start: (jobId) => {
    const job = get().jobs.find((j) => j.jobId === jobId);
    if (!job) return;
    const next = transitionJob(job, "running");
    const ev = eventForJob("job_started", next);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.jobId === jobId ? next : j)),
      events: [...state.events, ev],
    }));
    get().processDriftForEvent(ev);
  },
  complete: (jobId) => {
    const job = get().jobs.find((j) => j.jobId === jobId);
    if (!job) return;
    const next = transitionJob(job, "success");
    const ev = eventForJob("job_completed", next);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.jobId === jobId ? next : j)),
      events: [...state.events, ev],
    }));
    get().processDriftForEvent(ev);
    const workflowStore = useWorkflowStore.getState();
    workflowStore.setWorkflow(applyJobResultToWorkflow(workflowStore.workflow, next));
  },
  fail: (jobId) => {
    const job = get().jobs.find((j) => j.jobId === jobId);
    if (!job) return;
    const next = transitionJob(job, "failed");
    const ev = eventForJob("job_failed", next);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.jobId === jobId ? next : j)),
      events: [...state.events, ev],
    }));
    get().processDriftForEvent(ev);
  },
  loadSampleFiles: async () => {
    try {
      const [st, runs, logText] = await Promise.all([
        fetch(SAMPLE_BASE + "state.json").then((r) => r.json()),
        fetch(SAMPLE_BASE + "runs.json").then((r) => r.json()),
        fetch(SAMPLE_BASE + "events.log").then((r) => r.text()),
      ]);
      const w0 = useWorkflowStore.getState().workflow;
      const w1 = applyStateJsonToWorkflow(w0, { artifacts: st.artifacts, updatedAt: st.updatedAt });
      useWorkflowStore.getState().setWorkflow(wfFinalize(w1));
      if (Array.isArray(runs)) {
        set({ jobs: runs as RuntimeJob[] });
      }
      const prev = get().lastEventsLog;
      if (logText !== prev) {
        const newPart = logText.length > prev.length && logText.startsWith(prev) ? logText.slice(prev.length) : logText;
        set({ lastEventsLog: logText });
        for (const line of newPart.split("\n").map((l) => l.trim()).filter(Boolean)) {
          try {
            const ev = JSON.parse(line) as RuntimeEvent;
            set((s) => ({ events: [...s.events, ev] }));
            get().processDriftForEvent(ev);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* optional */
    }
  },
  startSamplePolling: () => {
    if (get().pollId) return;
    const id = window.setInterval(() => {
      void get().loadSampleFiles();
    }, 3000);
    set({ pollId: id });
  },
  stopSamplePolling: () => {
    const p = get().pollId;
    if (p) {
      clearInterval(p);
      set({ pollId: null });
    }
  },
}));
