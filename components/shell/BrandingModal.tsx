"use client";

import { useState, useRef, useCallback } from "react";
import { loadBranding, saveBranding, type ProposalBranding } from "@/lib/io/proposal-html";

const ACCENT_PRESETS = [
  "#6d28d9", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777",
];

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: "#334155" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function BrandingModal({ onClose }: { onClose: () => void }) {
  const [brand, setBrand] = useState<ProposalBranding>(() => loadBranding());
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof ProposalBranding>(key: K, val: ProposalBranding[K]) => {
    setBrand((b) => ({ ...b, [key]: val }));
    setSaved(false);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set("logoDataUrl", ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveBranding(brand);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const accentColor = brand.accentColor ?? "#6d28d9";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "#0b102099", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 660, maxWidth: "96vw", maxHeight: "90vh", background: "#0a0f1e", borderRadius: 14, border: "1px solid #1e2d4a", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px #00000088" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "linear-gradient(90deg, #080e1c, #0d1a35)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>🎨 Branding Settings</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Your name and logo appear on every client proposal and export. Takes 30 seconds.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", gap: 24 }}>

          {/* Left: form */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

            <Field label="Firm / Business Name">
              <input style={inputStyle} value={brand.firmName ?? ""} onChange={(e) => set("firmName", e.target.value)} placeholder="Acme AI Consulting" />
            </Field>

            <Field label="Tagline" hint="one line">
              <input style={inputStyle} value={brand.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="AI Workflow Automation for Enterprise Teams" />
            </Field>

            <Field label="Your Name">
              <input style={inputStyle} value={brand.consultantName ?? ""} onChange={(e) => set("consultantName", e.target.value)} placeholder="Jane Smith" />
            </Field>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Field label="Email">
                  <input style={inputStyle} type="email" value={brand.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="jane@acme.com" />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Website">
                  <input style={inputStyle} value={brand.websiteUrl ?? ""} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="acme.ai" />
                </Field>
              </div>
            </div>

            {/* Logo upload */}
            <Field label="Logo" hint="PNG or SVG, ideally on transparent background">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {brand.logoDataUrl ? (
                  <div style={{ width: 56, height: 56, background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brand.logoDataUrl} alt="Logo preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>
                ) : (
                  <div style={{ width: 56, height: 56, background: "#0f172a", borderRadius: 8, border: "1px dashed #1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    🖼️
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: "none" }} onChange={handleLogoUpload} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button type="button" onClick={() => logoInputRef.current?.click()} style={{ background: "#1e293b", border: "none", borderRadius: 7, padding: "7px 16px", color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {brand.logoDataUrl ? "Replace logo" : "Upload logo"}
                  </button>
                  {brand.logoDataUrl && (
                    <button type="button" onClick={() => set("logoDataUrl", undefined)} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", textAlign: "left" }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </Field>

            {/* Accent colour */}
            <Field label="Brand Colour">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("accentColor", c)}
                    style={{
                      width: 28, height: 28,
                      borderRadius: "50%",
                      background: c,
                      border: brand.accentColor === c ? `3px solid #fff` : "3px solid transparent",
                      cursor: "pointer",
                      boxShadow: brand.accentColor === c ? `0 0 0 2px ${c}` : "none",
                      outline: "none",
                      transition: "all 0.15s",
                    }}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", padding: 0 }}
                  title="Custom colour"
                />
                <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{accentColor}</span>
              </div>
            </Field>

            {/* ROI defaults */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Hourly rate ($/hr)" hint="For proposal ROI calcs">
                <input style={inputStyle} type="number" min="20" max="999" value={brand.hourlyRate ?? ""} onChange={(e) => set("hourlyRate", e.target.value ? Number(e.target.value) : undefined)} placeholder="120" />
              </Field>
              <Field label="Cost per skill ($)" hint="Build cost estimate">
                <input style={inputStyle} type="number" min="500" max="99999" value={brand.costPerSkill ?? ""} onChange={(e) => set("costPerSkill", e.target.value ? Number(e.target.value) : undefined)} placeholder="3500" />
              </Field>
            </div>
          </div>

          {/* Right: preview card */}
          <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cover preview</div>
            <div style={{
              background: `linear-gradient(160deg, #0f172a, #1e1b4b)`,
              borderRadius: 10,
              padding: 16,
              aspectRatio: "3/4",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border: "1px solid #1e293b",
              overflow: "hidden",
              position: "relative",
            }}>
              {/* Glow */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: `radial-gradient(circle, ${accentColor}44, transparent 70%)`, pointerEvents: "none" }} />

              {/* Logo area */}
              <div style={{ position: "relative", zIndex: 1 }}>
                {brand.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoDataUrl} alt="Logo" style={{ height: 24, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 24, height: 24, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                    {(brand.firmName ?? "W").charAt(0)}
                  </div>
                )}
                <div style={{ fontSize: 9, fontWeight: 700, color: "#e2e8f0", marginTop: 4 }}>{brand.firmName ?? "Your Firm"}</div>
              </div>

              {/* Title area */}
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "inline-block", background: `${accentColor}22`, border: `1px solid ${accentColor}44`, borderRadius: 999, padding: "2px 7px", fontSize: 7, fontWeight: 700, color: accentColor, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  ⚡ Automation Proposal
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 4 }}>
                  Invoice Approval<br />Automation
                </div>
                <div style={{ fontSize: 7, color: "#64748b" }}>
                  8 AI skills · 3 integrations
                </div>
              </div>

              {/* Footer */}
              <div style={{ position: "relative", zIndex: 1, fontSize: 7, color: "#475569" }}>
                {brand.consultantName ?? ""}{brand.consultantName && <br />}
                {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short" })}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#334155", lineHeight: 1.6 }}>
              This branding appears on all client proposals and export documents.
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
            onClick={handleSave}
            style={{
              background: saved ? "#16a34a22" : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              border: saved ? "1px solid #16a34a44" : "none",
              borderRadius: 8,
              padding: "9px 24px",
              color: saved ? "#4ade80" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: saved ? "none" : `0 4px 16px ${accentColor}44`,
            }}
          >
            {saved ? "✓ Saved!" : "Save Branding"}
          </button>
        </div>
      </div>
    </div>
  );
}
