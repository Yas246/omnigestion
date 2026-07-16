/**
 * DeepSeek client — browser-only.
 *
 * The user's API key lives in localStorage and the request goes straight from
 * the browser to DeepSeek (https://api.deepseek.com). It is NEVER sent to the
 * Omnigestion backend — hence the "votre clé reste dans votre navigateur"
 * guarantee. CSP connect-src allows api.deepseek.com (see next.config.ts).
 *
 * Model: deepseek-v4-flash with thinking enabled (chain-of-thought raises
 * accuracy). In thinking mode temperature/top_p are ignored by the API, so we
 * don't send them. The final answer is in `content`; the chain-of-thought is
 * returned separately in `reasoning_content` (surfaced as collapsible).
 */

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const STORAGE_KEY = 'omnigestion.deepseek_api_key';
const MODEL = 'deepseek-v4-flash';

export function getDeepSeekKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY) || null;
}

export function setDeepSeekKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResult {
  content: string;
  reasoning: string | null;
}

export async function callDeepSeek(opts: {
  messages: DeepSeekMessage[];
  thinking?: boolean; // default true
  effort?: 'high' | 'max'; // default high
  signal?: AbortSignal;
}): Promise<DeepSeekResult> {
  const key = getDeepSeekKey();
  if (!key) {
    throw new Error(
      "Aucune clé API DeepSeek configurée. Ajoutez-la dans Paramètres › Intelligence.",
    );
  }

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: opts.messages,
      thinking: { type: opts.thinking === false ? 'disabled' : 'enabled' },
      reasoning_effort: opts.effort ?? 'high',
      stream: false,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let msg = `DeepSeek a renvoyé une erreur (${res.status}).`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || msg;
    } catch {
      /* keep default */
    }
    if (res.status === 401) {
      msg =
        "Clé API DeepSeek invalide ou non autorisée. Vérifiez Paramètres › Intelligence.";
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const choice = data?.choices?.[0]?.message ?? {};
  return {
    content: typeof choice.content === 'string' ? choice.content : '',
    reasoning:
      typeof choice.reasoning_content === 'string' ? choice.reasoning_content : null,
  };
}
