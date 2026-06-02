"use client";

import Link from "next/link";
import { WORKFLOWOS_GITHUB_URL, WORKFLOWOS_LICENSE } from "@/lib/workflowos";

// "pro" mode is retained for call-site compatibility; the paid tier was retired
// (2026-05-16). All Studio features are free. The former upgrade panel now tells
// users Studio is open source and how to self-host.
export type UpgradeMode = "auth" | "pro" | null;

interface Props {
  open: boolean;
  mode: UpgradeMode;
  onClose: () => void;
}

const OSS_FEATURES = [
  "AI-powered workflow analysis (PSF Compliance Analyzer)",
  "AI Heal — automated workflow repair",
  "Executive brief generation",
  "Export deployment ZIP (YAML skill specs, docs, hooks)",
  "AI automation transformation (current → future state)",
  "Unlimited saved workflows",
];

export default function UpgradeModal({ open, mode, onClose }: Props) {
  if (!open || !mode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full p-8 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          ✕
        </button>

        {mode === "auth" ? (
          <>
            <div className="text-3xl mb-3 text-center">🔐</div>
            <h2 className="text-2xl font-black text-center mb-2">Create a free account</h2>
            <p className="text-white/60 text-sm text-center mb-8">
              Sign up free to access AI-powered export, your workflow history, and certifications.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/sign-up"
                className="block text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Create free account →
              </Link>
              <Link
                href="/sign-in"
                className="block text-center bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-3xl mb-3 text-center">⚡</div>
            <h2 className="text-2xl font-black text-center mb-2">Free &amp; open source</h2>
            <p className="text-white/60 text-sm text-center mb-6">
              Every feature in PAI Studio is free. AI features run on your own OpenAI API key
              (add it in ⋯ → OpenAI API key). WorkflowOS is open source ({WORKFLOWOS_LICENSE}) —
              run it here or self-host your own instance.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5 space-y-2">
              {OSS_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={WORKFLOWOS_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-6 rounded-xl transition-colors text-center"
              >
                View on GitHub · self-host →
              </a>
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                Keep building →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
