"use client";

import { useEffect, useState } from "react";
import {
  clearStudioOpenAiKey,
  getStudioOpenAiKey,
  setStudioOpenAiKey,
} from "@/lib/studio/openai-key-client";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OpenAiKeyModal({ open, onClose }: Props) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(getStudioOpenAiKey() ?? "");
      setSaved(!!getStudioOpenAiKey());
    }
  }, [open]);

  if (!open) return null;

  function save() {
    const trimmed = value.trim();
    if (!trimmed.startsWith("sk-")) return;
    setStudioOpenAiKey(trimmed);
    setSaved(true);
    onClose();
  }

  function remove() {
    clearStudioOpenAiKey();
    setValue("");
    setSaved(false);
    onClose();
  }

  const valid = value.trim().startsWith("sk-");

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full p-8 relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="text-3xl mb-3 text-center">🔑</div>
        <h2 className="text-xl font-black text-center mb-2 text-white">Your OpenAI API key</h2>
        <p className="text-white/55 text-sm text-center mb-6 leading-relaxed">
          AI features (Wizard, Heal, PSF Analyzer, etc.) run on <strong className="text-white/80">your</strong> OpenAI
          account. The key stays in your browser and is sent only when you invoke AI — we never store it on our servers.
        </p>

        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
          API key
        </label>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 mb-2 font-mono"
        />
        <p className="text-[11px] text-white/35 mb-5">
          Create a key at{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            platform.openai.com/api-keys
          </a>
          . Restrict it to the models you need.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {saved ? "Update key" : "Save key →"}
          </button>
          {getStudioOpenAiKey() && (
            <button
              type="button"
              onClick={remove}
              className="text-red-400/80 hover:text-red-300 text-sm py-2 transition-colors"
            >
              Remove saved key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
