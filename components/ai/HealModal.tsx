"use client";

import { useState } from "react";
import { studioAiFetch } from "@/lib/studio/openai-key-client";
import { useWorkflowStore } from "@/store/workflow-store";
import type { HealResponse, HealSuggestion, HealQuestion } from "@/app/api/heal/route";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

// ─── Styles ──────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 200,
  background: "#0b102099", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const panel: React.CSSProperties = {
  width: 680, maxWidth: "95vw", maxHeight: "88vh",
  background: "#0f172a", borderRadius: 12,
  border: "1px solid #334155",
  display: "flex", flexDirection: "column", overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: "14px 18px", borderBottom: "1px solid #1e293b",
  display: "flex", alignItems: "center", gap: 10,
};

const body: React.CSSProperties = {
  flex: 1, overflowY: "auto", padding: "16px 18px",
  display: "flex", flexDirection: "column", gap: 16,
};

const footer: React.CSSProperties = {
  padding: "12px 18px", borderTop: "1px solid #1e293b",
  display: "flex", gap: 10, justifyContent: "flex-end",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function FixRow({ text, icon = "✓", color = "#22c55e" }: { text: string; icon?: string; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
      <span style={{ color, flexShrink: 0, fontWeight: 700 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ─── Apply AI suggestion to a workflow ───────────────────────────────────────

function applyAiSuggestion(workflow: Workflow, suggestion: HealSuggestion): Workflow {
  const nodes = [...workflow.nodes];
  const edges = [...workflow.edges];

  if (suggestion.changeType === "add_artifact" && suggestion.artifact) {
    const id = `artifact_${Math.random().toString(36).slice(2, 10)}`;
    const newNode: WorkflowNode = {
      id,
      type: "artifact",
      position: { x: 600, y: 80 + nodes.length * 80 },
      data: {
        name: suggestion.artifact.name,
        fileName: suggestion.artifact.fileName,
        artifactType: "other",
        description: suggestion.artifact.description,
        status: "unknown",
      },
    };
    nodes.push(newNode);
  }

  if (suggestion.changeType === "remove_node" && suggestion.nodeId) {
    const idx = nodes.findIndex((n) => n.id === suggestion.nodeId);
    if (idx !== -1) nodes.splice(idx, 1);
  }

  if (suggestion.changeType === "add_edge" && suggestion.edge) {
    const source = nodes.find((n) => n.data.name === suggestion.edge!.sourceName);
    const target = nodes.find((n) => n.data.name === suggestion.edge!.targetName);
    if (source && target) {
      const newEdge: WorkflowEdge = {
        id: `e_heal_${Math.random().toString(36).slice(2, 10)}`,
        source: source.id,
        target: target.id,
        edgeType: "output",
        derived: false,
      };
      edges.push(newEdge);
    }
  }

  return { ...workflow, nodes, edges };
}

// ─── Main component ──────────────────────────────────────────────────────────

type HealPhase = "idle" | "loading" | "review" | "done";

export function HealModal({ onClose }: { onClose: () => void }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);
  const runValidation = useWorkflowStore((s) => s.runValidation);

  const [phase, setPhase] = useState<HealPhase>("idle");
  const [result, setResult] = useState<HealResponse | null>(null);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  // Track which AI suggestions are selected
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  // Track question answers
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const runHeal = async () => {
    setPhase("loading");
    setError("");
    setAiError("");
    try {
      const res = await studioAiFetch("/api/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow }),
      });
      const data = await res.json() as
        | { ok: true } & HealResponse & { aiError?: string }
        | { ok: false; error: string };

      if (!data.ok) { setError(data.error); setPhase("idle"); return; }

      if (data.aiError) setAiError(data.aiError);

      setResult(data);
      // Pre-select all suggestions
      setSelectedSuggestions(new Set(data.aiSuggestions.map((s) => s.id)));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("idle");
    }
  };

  const applyFixes = () => {
    if (!result) return;
    let w = result.healedWorkflow;
    // Apply selected AI suggestions
    for (const s of result.aiSuggestions) {
      if (selectedSuggestions.has(s.id)) {
        w = applyAiSuggestion(w, s);
      }
    }
    setWorkflow(w);
    runValidation();
    setTimeout(() => applyAutoLayout(), 50);
    setPhase("done");
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div style={overlay}>
      <div style={panel}>

        {/* Header */}
        <div style={header}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>
              ⚕ Workflow Healer
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Analyze, repair, and validate your workflow automatically
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={body}>

          {phase === "idle" && (
            <>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                The healer will:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["⚡ Auto-fix", "Remove duplicate nodes, deduplicate arrays, fix invalid subtypes, sync produces↔outputs, re-wire edges from contracts"],
                  ["🧠 AI analysis", "Understand your workflow's purpose, identify orphaned nodes, suggest missing connections and artifacts"],
                  ["❓ Ask questions", "Surface anything it can't determine automatically for your input"],
                ].map(([title, desc]) => (
                  <div key={title} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 14px", border: "1px solid #334155" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>
                Requires OPENAI_API_KEY. The AI pass is optional — auto-fixes always run.
              </div>
              {error && <div style={{ fontSize: 12, color: "#fca5a5", background: "#7f1d1d22", borderRadius: 6, padding: "8px 12px" }}>{error}</div>}
            </>
          )}

          {phase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, flex: 1, paddingBlock: 40 }}>
              <div style={{ fontSize: 28 }}>⚕</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Analyzing your workflow…</div>
              <div style={{ fontSize: 11, color: "#334155" }}>Running auto-fixes, then asking the AI</div>
            </div>
          )}

          {phase === "review" && result && (
            <>
              {/* Purpose */}
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px" }}>
                <SectionLabel>Workflow Purpose (AI)</SectionLabel>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{result.workflowPurpose}</div>
              </div>

              {/* Auto-fixes */}
              {result.deterministicFixes.length > 0 && (
                <div>
                  <SectionLabel>Auto-fixed ({result.deterministicFixes.length})</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {result.deterministicFixes.map((f, i) => (
                      <FixRow key={i} text={f.message} />
                    ))}
                  </div>
                </div>
              )}

              {result.deterministicFixes.length === 0 && (
                <FixRow text="No auto-fixes needed — graph structure was already clean" icon="✓" color="#22c55e" />
              )}

              {/* AI suggestions */}
              {result.aiSuggestions.length > 0 && (
                <div>
                  <SectionLabel>AI suggestions — select to apply</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aiSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSuggestion(s.id)}
                        style={{
                          display: "flex", gap: 10, alignItems: "flex-start",
                          textAlign: "left", cursor: "pointer",
                          background: selectedSuggestions.has(s.id) ? "#1e3a5f" : "#1e293b",
                          border: `1px solid ${selectedSuggestions.has(s.id) ? "#3b82f6" : "#334155"}`,
                          borderRadius: 8, padding: "9px 12px",
                        }}
                      >
                        <span style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          background: selectedSuggestions.has(s.id) ? "#3b82f6" : "transparent",
                          border: `1.5px solid ${selectedSuggestions.has(s.id) ? "#3b82f6" : "#475569"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "#fff",
                        }}>
                          {selectedSuggestions.has(s.id) ? "✓" : ""}
                        </span>
                        <div>
                          <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>{s.description}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.changeType.replace("_", " ")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {result.aiSuggestions.length === 0 && !aiError && (
                <FixRow text="AI found no further issues to suggest" icon="✓" color="#22c55e" />
              )}

              {aiError && (
                <div style={{ fontSize: 12, color: "#fbbf24", background: "#451a0322", borderRadius: 6, padding: "8px 12px" }}>
                  AI analysis unavailable ({aiError}) — auto-fixes still applied
                </div>
              )}

              {/* Questions */}
              {result.questions.length > 0 && (
                <div>
                  <SectionLabel>Questions ({result.questions.length}) — answer to improve the workflow</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.questions.map((q) => (
                      <QuestionRow
                        key={q.id}
                        question={q}
                        value={answers[q.id] ?? ""}
                        onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
                    Answers are noted for reference — the healer applies structural fixes only.
                  </div>
                </div>
              )}
            </>
          )}

          {phase === "done" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingBlock: 32 }}>
              <div style={{ fontSize: 32 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Workflow healed</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Auto-layout applied. Check the Validation panel for any remaining issues.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={footer}>
          {phase === "done" && (
            <button type="button" onClick={onClose} style={btnStyle("#22c55e", "#14532d")}>Close</button>
          )}
          {phase === "review" && result && (
            <>
              <button type="button" onClick={onClose} style={btnStyle("#475569", "#1e293b")}>Cancel</button>
              <button type="button" onClick={applyFixes} style={btnStyle("#3b82f6", "#1e3a5f")}>
                Apply {result.deterministicFixes.length + selectedSuggestions.size} fix{result.deterministicFixes.length + selectedSuggestions.size !== 1 ? "es" : ""}
              </button>
            </>
          )}
          {phase === "idle" && (
            <>
              <button type="button" onClick={onClose} style={btnStyle("#475569", "#1e293b")}>Cancel</button>
              <button type="button" onClick={() => void runHeal()} style={btnStyle("#7c3aed", "#1e1040")}>
                Run Healer
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function btnStyle(borderColor: string, bg: string): React.CSSProperties {
  return {
    padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13,
    cursor: "pointer", background: bg,
    border: `1px solid ${borderColor}`,
    color: "#e2e8f0",
  };
}

function QuestionRow({
  question, value, onChange,
}: {
  question: HealQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8 }}>{question.message}</div>
      {question.options ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {question.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12,
                cursor: "pointer",
                background: value === opt.value ? "#1e3a5f" : "transparent",
                border: `1px solid ${value === opt.value ? "#3b82f6" : "#475569"}`,
                color: value === opt.value ? "#93c5fd" : "#94a3b8",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer…"
          style={{
            width: "100%", fontSize: 12, background: "#0f172a",
            border: "1px solid #334155", borderRadius: 6,
            padding: "6px 10px", color: "#e2e8f0",
          }}
        />
      )}
    </div>
  );
}
