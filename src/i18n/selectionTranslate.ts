/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google-Translate-backed translator for the selection-translate
 * popover. Uses the public `translate.googleapis.com/translate_a/single`
 * endpoint — no API key needed for short snippets, which is the right
 * shape for "user highlighted a sentence, show me the translation".
 *
 * For full-body auto-translate the kit's HiveLanguageProvider still
 * uses MyMemory via `translateService.ts`. This service is dedicated
 * to the on-demand selection flow and isn't a general replacement.
 *
 * Lightweight in-memory + sessionStorage cache so repeated selections
 * of the same text resolve instantly. No localStorage — selection
 * translations are session-scoped.
 */

const SESSION_KEY = "hrk-selection-translate-cache-v1";
const CACHE_LIMIT = 200;

let sessionCache: Record<string, string> | null = null;
const memCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function loadCache(): Record<string, string> {
  if (sessionCache) return sessionCache;
  try {
    const raw =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(SESSION_KEY)
        : null;
    sessionCache = raw ? JSON.parse(raw) : {};
  } catch {
    sessionCache = {};
  }
  return sessionCache as Record<string, string>;
}

function saveCache(): void {
  if (!sessionCache) return;
  try {
    const keys = Object.keys(sessionCache);
    if (keys.length > CACHE_LIMIT) {
      const drop = Math.max(1, Math.floor(keys.length - CACHE_LIMIT * 0.8));
      for (let i = 0; i < drop; i++) delete sessionCache[keys[i]];
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionCache));
    }
  } catch {
    // sessionStorage over quota / unavailable — silently skip
  }
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function cacheKey(text: string, target: string): string {
  return `${target}:${hashKey(text)}`;
}

/**
 * Translate `text` into the given BCP-47 language code (e.g. `es`,
 * `pt-BR`, `hi`). Source language is auto-detected by Google.
 * Returns the original text on any error so callers can render
 * without a try/catch.
 */
export async function translateSelection(
  text: string,
  target: string,
): Promise<string> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  if (!target) return trimmed;

  const key = cacheKey(trimmed, target);
  const cached = loadCache()[key] ?? memCache.get(key);
  if (cached) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const work = (async () => {
    try {
      const url =
        "https://translate.googleapis.com/translate_a/single" +
        `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(trimmed)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`google ${resp.status}`);
      const data = (await resp.json()) as any;
      // Response shape: [[ ["chunk-translated","chunk-source",...], ... ], ...]
      // We concatenate every chunk's translated text into one string.
      const segments: string[] = [];
      if (Array.isArray(data) && Array.isArray(data[0])) {
        for (const row of data[0]) {
          if (Array.isArray(row) && typeof row[0] === "string") {
            segments.push(row[0]);
          }
        }
      }
      const result = segments.join("").trim();
      if (!result) throw new Error("empty");
      memCache.set(key, result);
      loadCache()[key] = result;
      saveCache();
      return result;
    } catch {
      // Network error / endpoint blocked — return the source so the UI
      // shows the user's selection back to them rather than nothing.
      return trimmed;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, work);
  return work;
}

/** Languages offered in the selection-translate popover. Add more
 *  if needed — keep the list short so the picker stays one-tap. */
export interface SelectionTranslateLanguage {
  code: string;
  label: string;
}

export const DEFAULT_TRANSLATE_LANGUAGES: SelectionTranslateLanguage[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
];

const PREF_KEY = "hrk-selection-translate-lang";

/** Read the user's last-picked target language from sessionStorage,
 *  or fall back to the browser's primary language → English. Returned
 *  code is always normalised to a value present in DEFAULT_TRANSLATE_LANGUAGES. */
export function getPreferredTranslateLanguage(): string {
  try {
    if (typeof sessionStorage !== "undefined") {
      const v = sessionStorage.getItem(PREF_KEY);
      if (v) return v;
    }
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const primary = navigator.language.split("-")[0];
    const match = DEFAULT_TRANSLATE_LANGUAGES.find((l) => l.code === primary);
    if (match) return match.code;
  }
  return "en";
}

export function setPreferredTranslateLanguage(code: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PREF_KEY, code);
    }
  } catch {
    // ignore
  }
}
