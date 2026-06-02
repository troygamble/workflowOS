"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { decodeWorkflowFromHash, buildShareUrl } from "@/lib/io/share-link";
import { ProcessView } from "@/components/views/ProcessView";
import { useWorkflowStore } from "@/store/workflow-store";
import type { Workflow } from "@/lib/types/workflow";

type LoadState = "loading" | "ready" | "error" | "empty";

export function ShareableView() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const setStoreWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const applyAutoLayout = useWorkflowStore((s) => s.applyAutoLayout);

  useEffect(() => {
    void decodeWorkflowFromHash().then((wf) => {
      if (!wf) {
        setLoadState("empty");
        return;
      }
      // Inject into store so ProcessView can read it
      setStoreWorkflow(wf);
      setTimeout(() => applyAutoLayout(), 50);
      setWorkflow(wf);
      setLoadState("ready");
    }).catch((err) => {
      setError(String(err));
      setLoadState("error");
    });
  }, [setStoreWorkflow, applyAutoLayout]);

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const handleOpenInStudio = () => {
    const hash = window.location.hash;
    window.location.href = "/studio" + hash;
  };

  // ── Empty / error states ─────────────────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1020", color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Loading workflow…</div>
      </div>
    );
  }

  if (loadState === "empty") {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b1020", color: "#e2e8f0", gap: 20, padding: 40 }}>
        <div style={{ fontSize: 40 }}>🗺</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>No workflow in this link</div>
        <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>
          This URL doesn&#39;t contain a workflow. Share links are generated from the PAI Workflow Studio using the Share button.
        </div>
        <a href="/studio" style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", textDecoration: "none", padding: "8px 20px", border: "1px solid #4338ca55", borderRadius: 6, background: "#3730a318" }}>
          Open Studio &#8594;
        </a>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b1020", color: "#e2e8f0", gap: 16, padding: 40 }}>
        <div style={{ fontSize: 36 }}>⚠</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Failed to decode workflow</div>
        <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{error}</div>
        <a href="/studio" style={{ fontSize: 12, color: "#818cf8" }}>Open Studio</a>
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────────

  const skillCount = workflow?.nodes.filter((n) => n.type === "skill").length ?? 0;
  const humanCount = workflow?.nodes.filter((n) => n.type === "human").length ?? 0;
  const artifactCount = workflow?.nodes.filter((n) => n.type === "artifact").length ?? 0;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0b1020", color: "#e2e8f0" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "#080c18", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        {/* Logo */}
        <Link href="/studio" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <svg viewBox="0 0 64 64" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="13" fill="#070d1a"/>
                <line x1="12" y1="12" x2="22" y2="42" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="22" y1="42" x2="32" y2="22" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="32" y1="22" x2="42" y2="42" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="42" y1="42" x2="52" y2="12" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="4.5" fill="#6d28d9"/>
                <circle cx="22" cy="42" r="4.5" fill="#6d28d9"/>
                <circle cx="32" cy="22" r="6" fill="#a78bfa"/>
                <circle cx="42" cy="42" r="4.5" fill="#6d28d9"/>
                <circle cx="52" cy="12" r="4.5" fill="#6d28d9"/>
              </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>PAI Studio</span>
        </Link>

        <div style={{ width: 1, height: 16, background: "#1e293b" }} />

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{workflow?.name ?? "Workflow"}</div>
          <div style={{ fontSize: 10, color: "#475569" }}>
            {workflow?.workflowType === "future_state" ? "AI-automated workflow" : "Process map"} &#183;{" "}
            {skillCount > 0 && <span>{skillCount} AI skill{skillCount !== 1 ? "s" : ""} &#183; </span>}
            {humanCount > 0 && <span>{humanCount} human step{humanCount !== 1 ? "s" : ""} &#183; </span>}
            {artifactCount > 0 && <span>{artifactCount} artifact{artifactCount !== 1 ? "s" : ""}</span>}
          </div>
        </div>

        {workflow?.workflowType === "future_state" && (
          <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", background: "#3730a322", border: "1px solid #4338ca44", borderRadius: 4, padding: "2px 8px" }}>
            &#9889; Contract Map
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6, border: "1px solid #1e293b", background: copied ? "#16a34a22" : "transparent", color: copied ? "#4ade80" : "#94a3b8", cursor: "pointer", transition: "all 0.2s" }}
        >
          {copied ? "&#10003; Copied!" : "&#128279; Copy link"}
        </button>

        <button
          type="button"
          onClick={handleOpenInStudio}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 6, border: "1px solid #4338ca55", background: "#3730a322", color: "#818cf8", cursor: "pointer" }}
        >
          Open in Studio &#8594;
        </button>
      </div>

      {/* Read-only banner */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 20px", background: "#0a0f1e", borderBottom: "1px solid #1e293b" }}>
        <span style={{ fontSize: 10, color: "#334155" }}>&#128274; Read-only view &#183; Open in Studio to edit</span>
      </div>

      {/* Process view (read-only) */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <ProcessView />
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 20px", borderTop: "1px solid #1e293b", background: "#080c18", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#334155" }}>PAI Workflow Studio &#8212; Production AI Institute</span>
        <Link href="/studio" style={{ fontSize: 10, color: "#475569", textDecoration: "none" }}>productionai.institute</Link>
      </div>
    </div>
  );
}
