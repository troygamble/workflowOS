export const dynamic = "force-dynamic";

import Link from "next/link";
import { StudioApp } from "@/components/studio/StudioApp";
import { WORKFLOWOS_GITHUB_URL, WORKFLOWOS_LICENSE } from "@/lib/workflowos";

export const metadata = {
  title: "PSF Workflow Studio — Free Reference Implementation | Production AI Institute",
  description:
    "PSF Workflow Studio is the Production AI Institute's free, open reference implementation of the Production Safety Framework. Design, simulate, and ship PSF-aligned workflows. Not a managed product — a working artifact that demonstrates the standard.",
  alternates: { canonical: "https://github.com/troygamble/workflowOS" },
};

function StudioReferenceStrip() {
  return (
    <section
      aria-labelledby="studio-reference-heading"
      style={{
        flexShrink: 0,
        background: "linear-gradient(180deg, #0f172a 0%, #0b1220 100%)",
        borderBottom: "1px solid rgba(148, 163, 184, 0.22)",
        padding: "10px 16px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1
          id="studio-reference-heading"
          style={{
            margin: "0 0 4px",
            fontSize: 15,
            fontWeight: 800,
            color: "#f1f5f9",
            letterSpacing: "-0.02em",
          }}
        >
          PSF Workflow Studio
        </h1>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#94a3b8",
            maxWidth: 720,
          }}
        >
          The Production AI Institute&apos;s free reference implementation of the Production Safety
          Framework — a working artifact that demonstrates the standard, not a managed product.
          AI features use your own OpenAI API key (⋯ menu in Studio).
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
          Export workflows from Studio as portfolio evidence for{" "}
          <Link
            href="https://www.productionai.institute/certify/cpap" target="_blank" rel="noopener noreferrer"
            style={{ color: "#93c5fd", fontWeight: 700, textDecoration: "underline" }}
          >
            Certified Production AI Practitioner (CPAP)
          </Link>
          .{" "}
          Free &amp; open source ({WORKFLOWOS_LICENSE}) —{" "}
          <a
            href={WORKFLOWOS_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#93c5fd", fontWeight: 700, textDecoration: "underline" }}
          >
            self-host from GitHub ↗
          </a>
          .
        </p>
      </div>
    </section>
  );
}

export default function StudioPage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.studio-page-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.studio-page-shell .studio-app-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.studio-page-shell .studio-app-host #studio-root {
  height: 100% !important;
  max-height: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .studio-page-shell * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`,
        }}
      />
      <div className="studio-page-shell">
        <StudioReferenceStrip />
        <div className="studio-app-host">
          <StudioApp />
        </div>
      </div>
    </>
  );
}
