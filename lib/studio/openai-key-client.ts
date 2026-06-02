import { OPENAI_KEY_HEADER } from "@/lib/studio/openai-key-constants";

const LS_KEY = "wfos_openai_api_key";

export function getStudioOpenAiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LS_KEY)?.trim();
    return v && v.startsWith("sk-") ? v : null;
  } catch {
    return null;
  }
}

export function setStudioOpenAiKey(key: string): void {
  localStorage.setItem(LS_KEY, key.trim());
  window.dispatchEvent(new CustomEvent("wfos:api-key-changed"));
}

export function clearStudioOpenAiKey(): void {
  localStorage.removeItem(LS_KEY);
  window.dispatchEvent(new CustomEvent("wfos:api-key-changed"));
}

export function hasStudioOpenAiKey(): boolean {
  return !!getStudioOpenAiKey();
}

export function dispatchOpenApiKeyModal(): void {
  window.dispatchEvent(new CustomEvent("wfos:open-api-key"));
}

/** Fetch wrapper — attaches BYOK header and opens settings on 402. */
export async function studioAiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const key = getStudioOpenAiKey();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (key) headers.set(OPENAI_KEY_HEADER, key);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 402) {
    const peek = await res.clone().json().catch(() => ({}));
    if ((peek as { code?: string }).code === "OPENAI_KEY_REQUIRED") dispatchOpenApiKeyModal();
  }
  return res;
}
