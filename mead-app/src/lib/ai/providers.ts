/**
 * AI providers a subscriber can connect (SPEC §25.5). Claude uses Anthropic's SDK;
 * every other provider speaks the OpenAI-style Chat Completions format.
 */
export type ProviderId = 'gemini' | 'anthropic' | 'openrouter' | 'openai' | 'groq' | 'mistral' | 'ollama' | 'custom';

export interface ProviderPreset {
  id: ProviderId;
  name: string;
  /** Short price tag shown on the picker. */
  price: string;
  free: boolean;
  baseUrl: string;
  keyUrl?: string;
  keyHint?: string;
  needsKey: boolean;
  /** Model ids to prefer, best first (regexes tried in order). */
  prefer: RegExp[];
  steps: string[];
  note?: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'gemini', name: 'Google Gemini', price: 'Free tier', free: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…', needsKey: true,
    prefer: [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash(?!-lite)/, /flash/],
    steps: ['Sign in at aistudio.google.com with a Google account (no card needed).', 'Click “Create API key” and paste it here.'],
    note: 'Free tier: daily limits apply, and Google may use free-tier chats to improve its products. In the EU, UK and Switzerland Google’s terms ask for its paid tier.',
  },
  {
    id: 'anthropic', name: 'Claude (Anthropic)', price: 'Pay per use', free: false,
    baseUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…', needsKey: true,
    prefer: [],
    steps: ['Sign in at console.anthropic.com and add credits.', 'Create an API key and paste it here.'],
    note: 'Best recipe quality. A Claude.ai Pro or Max chat plan can’t be linked to other apps; this needs an API key.',
  },
  {
    id: 'openrouter', name: 'OpenRouter', price: 'Free & paid models', free: true,
    baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys', keyHint: 'sk-or-…', needsKey: true,
    prefer: [/^openrouter\/free$/, /:free$/],
    steps: ['Sign up at openrouter.ai (no card needed for free models).', 'Create an API key and paste it here.'],
    note: 'One key for hundreds of models, including some free ones (models ending in “:free”, with daily limits).',
  },
  {
    id: 'openai', name: 'OpenAI (ChatGPT models)', price: 'Pay per use', free: false,
    baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…', needsKey: true,
    prefer: [/^gpt-[\d.]+-mini$/, /^gpt-[\d.]+$/, /^gpt-/],
    steps: ['Sign in at platform.openai.com and add credits.', 'Create an API key and paste it here.'],
    note: 'A ChatGPT Plus subscription can’t be linked; this needs an API key.',
  },
  {
    id: 'groq', name: 'Groq', price: 'Free tier', free: true,
    baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…', needsKey: true,
    prefer: [/llama.*versatile/, /llama/, /qwen/, /gpt-oss/],
    steps: ['Sign up at console.groq.com.', 'Create an API key and paste it here.'],
  },
  {
    id: 'mistral', name: 'Mistral', price: 'Free tier', free: true,
    baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true,
    prefer: [/^mistral-medium-latest$/, /^mistral-small-latest$/, /latest$/],
    steps: ['Sign up at console.mistral.ai and pick the free plan.', 'Create an API key and paste it here.'],
  },
  {
    id: 'ollama', name: 'Ollama (on your computer)', price: 'Free, runs locally', free: true,
    baseUrl: 'http://localhost:11434/v1', needsKey: false,
    prefer: [/qwen/, /llama/, /mistral/, /gemma/],
    steps: ['Install Ollama and pull a model, e.g. “ollama pull qwen3”.', 'Start it with OLLAMA_ORIGINS set to this site’s address, then connect.'],
    note: 'Private and free, but small local models make weaker recipes.',
  },
  {
    id: 'custom', name: 'Other (OpenAI-compatible)', price: 'Any', free: false,
    baseUrl: '', needsKey: false,
    prefer: [],
    steps: ['Enter the provider’s API address (it ends in /v1 for most) and your key.'],
    note: 'Works with most AI services that offer an “OpenAI-compatible” API, such as DeepSeek, Together, Fireworks or LM Studio.',
  },
];

export const preset = (id: ProviderId): ProviderPreset => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1];

const NOT_CHAT = /embed|whisper|tts|speech|dall-e|image|imagen|veo|moderation|audio|transcri|rerank|guard|realtime|live|aqa|search|computer-use|robotics|native-audio/i;

/** Model ids that can chat, newest-looking first. */
export function chatModels(ids: string[]): string[] {
  return [...new Set(ids.map((i) => i.replace(/^models\//, '')))]
    .filter((i) => !NOT_CHAT.test(i))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

/** Pick a sensible default model for a provider from what the key can use. */
export function pickModel(ids: string[], p: ProviderPreset): string {
  const list = chatModels(ids);
  for (const re of p.prefer) {
    const hit = list.find((i) => re.test(i) && !/preview|exp/i.test(i)) ?? list.find((i) => re.test(i));
    if (hit) return hit;
  }
  return list[0] ?? ids[0] ?? '';
}
