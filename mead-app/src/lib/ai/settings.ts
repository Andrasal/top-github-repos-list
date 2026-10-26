/**
 * Bring-your-own-key AI settings (SPEC §25). The key never leaves the user's device except
 * in requests sent straight to the provider's API. "Remember" keeps it in localStorage;
 * otherwise it lives in sessionStorage and is gone when the tab closes.
 */
import type { ProviderId } from './providers';
export interface AiSettings {
  provider: ProviderId;
  /** Empty for providers that need no key (local Ollama). */
  apiKey: string;
  /** API address for OpenAI-compatible providers. */
  baseUrl?: string;
  remember: boolean;
  verifiedAt: string;
  /** Model in use. */
  model: string;
  /** Chat models the key can use, for the model picker. */
  models?: string[];
}

const KEY = 'mead-lab:ai:v1';
const EVENT = 'mead-lab:ai-changed';

const read = (s: Storage | undefined): AiSettings | null => {
  try {
    const v = s?.getItem(KEY);
    if (!v) return null;
    const o = JSON.parse(v) as AiSettings;
    return o && typeof o.apiKey === 'string' && typeof o.model === 'string' && (o.apiKey || o.baseUrl) ? { ...o, provider: o.provider ?? 'anthropic' } : null;
  } catch { return null; }
};
const ls = (): Storage | undefined => { try { return window.localStorage; } catch { return undefined; } };
const ss = (): Storage | undefined => { try { return window.sessionStorage; } catch { return undefined; } };

export function loadAi(): AiSettings | null {
  return read(ls()) ?? read(ss());
}

export function saveAi(s: AiSettings): void {
  const json = JSON.stringify(s);
  try {
    (s.remember ? ss() : ls())?.removeItem(KEY);
    (s.remember ? ls() : ss())?.setItem(KEY, json);
  } catch { /* storage blocked: the key lasts for this page only */ memory = s; }
  notify();
}

export function clearAi(): void {
  try { ls()?.removeItem(KEY); ss()?.removeItem(KEY); } catch { /* ignore */ }
  memory = null;
  notify();
}

/** Fallback when storage throws (private mode): keep the key in memory for this page. */
let memory: AiSettings | null = null;
export const currentAi = (): AiSettings | null => loadAi() ?? memory;

export function maskKey(k: string): string {
  if (!k) return 'no key';
  return k.length <= 12 ? '••••' : `${k.slice(0, 7)}…${k.slice(-4)}`;
}

function notify() { try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ } }
export function onAiChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', fn); };
}
