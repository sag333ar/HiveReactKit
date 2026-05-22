/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google-Translate-backed translation service for translating Hive post /
 * comment bodies (rendered HTML) into the user's selected app language.
 *
 * Uses the unofficial `translate.googleapis.com/translate_a/single` endpoint
 * (client=gtx). No API key, much higher anonymous quota than MyMemory, and
 * built-in source-language auto-detect via `sl=auto`.
 *
 * Consumers can override by passing their own `translate` function to
 * `<HiveLanguageProvider>` (e.g. DeepL, Google Cloud Translate with a key).
 *
 * Heavy caching: in-memory map (session) + localStorage (cross-reload) +
 * in-flight dedup so two views of the same body share one network call.
 */

// Bumped to v3 when we switched the backend from MyMemory to Google
// Translate. v2 entries are abandoned in localStorage; they don't pollute v3.
const STORAGE_KEY = "hive-react-kit-translation-cache-v3";
const STORAGE_LIMIT = 500;
// Google Translate handles longer payloads well; keep chunks well under the
// 5000-char practical URL limit so multi-paragraph bodies don't get truncated.
const REQUEST_CHAR_LIMIT = 1500;

let storageCache: Record<string, string> | null = null;
const inFlight = new Map<string, Promise<string>>();
const memCache = new Map<string, string>();

function loadStorageCache(): Record<string, string> {
  if (storageCache) return storageCache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    storageCache = raw ? JSON.parse(raw) : {};
  } catch {
    storageCache = {};
  }
  return storageCache as Record<string, string>;
}

function saveStorageCache(): void {
  if (!storageCache) return;
  try {
    const keys = Object.keys(storageCache);
    if (keys.length > STORAGE_LIMIT) {
      const drop = Math.max(1, Math.floor(keys.length - STORAGE_LIMIT * 0.8));
      for (let i = 0; i < drop; i++) delete storageCache[keys[i]];
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCache));
    }
  } catch {
    // localStorage unavailable / over quota — drop silently
  }
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = -1;
    const slice = remaining.slice(0, max);
    cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    if (cut < max * 0.4) cut = slice.lastIndexOf(" ");
    if (cut < 0) cut = max;
    out.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1);
  }
  if (remaining) out.push(remaining);
  return out;
}

async function callGoogleTranslate(text: string, target: string, source: string): Promise<string> {
  // Google's unofficial endpoint takes `sl=auto` to detect source language.
  // We pass through any explicit ISO code; anything we treat as "unknown"
  // (empty / "autodetect") falls back to `auto`.
  const sl =
    source && source.toLowerCase() !== "autodetect" ? source : "auto";
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`GoogleTranslate ${resp.status}`);
  const data = await resp.json();
  // Response shape: [ [ [ "translated", "original", ... ], ... ], null, "src", ... ]
  const segments: any[] = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  const out = segments.map((seg) => (Array.isArray(seg) ? seg[0] : "")).join("");
  return out || text;
}

// Cheap pre-flight: if the user picked English and the text already looks
// English (ASCII Latin + common English stop words, no accented chars), skip
// the network round-trip. Saves a lot of API quota on the default
// English locale where most posts are already English.
function looksLikeEnglish(text: string): boolean {
  if (/[áéíóúñü¿¡àèìòùâêîôûãõçßа-я֐-׿؀-ۿ一-鿿぀-ヿ]/i.test(text)) {
    return false;
  }
  return /\b(the|and|is|are|was|were|of|to|in|that|it|you|for|with|on|at|this|but|not|have|has)\b/i.test(text);
}

/** Translate a single text string to `target` language. */
export async function translateText(
  text: string,
  target: string,
  source: string = "Autodetect",
): Promise<string> {
  if (!text) return text;
  if (!target) return text;
  if (source && source.toLowerCase() !== "autodetect" && source === target) return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  if (target.toLowerCase() === "en" && looksLikeEnglish(trimmed)) return text;

  const cacheKey = `${source}|${target}|${hashKey(text)}`;
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;
  const stored = loadStorageCache()[cacheKey];
  if (stored) {
    memCache.set(cacheKey, stored);
    return stored;
  }
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey)!;

  const promise = (async () => {
    try {
      let result: string;
      if (text.length <= REQUEST_CHAR_LIMIT) {
        result = await callGoogleTranslate(text, target, source);
      } else {
        const parts = chunkText(text, REQUEST_CHAR_LIMIT);
        const out = await Promise.all(parts.map((p) => callGoogleTranslate(p, target, source)));
        result = out.join(" ");
      }
      // Only cache real translations. If the API echoed the input verbatim
      // (rate limit, untranslatable token, etc.), caching that would poison
      // subsequent reads — every revisit would return the original even after
      // the API recovered. Skip the cache write in that case so the next
      // render retries.
      if (result && result.trim() !== text.trim()) {
        memCache.set(cacheKey, result);
        const store = loadStorageCache();
        store[cacheKey] = result;
        saveStorageCache();
      }
      return result;
    } catch {
      return text;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, promise);
  return promise;
}

const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME"]);

function hasSkipAncestor(node: Node, root: Node): boolean {
  let p: Node | null = node.parentNode;
  while (p && p !== root) {
    const tag = (p as Element).tagName;
    if (tag && SKIP_TAGS.has(tag)) return true;
    p = p.parentNode;
  }
  return false;
}

/**
 * Translate every visible text node in an HTML string to `target`. Skips
 * text inside `<code>`, `<pre>`, `<script>`, `<style>`, `<noscript>`, and
 * `<iframe>` so embeds and code samples render unchanged.
 */
export async function translateHtml(html: string, target: string): Promise<string> {
  if (!html || !target) return html;
  if (typeof document === "undefined") return html;

  const fullKey = `${target}|html|${hashKey(html)}`;
  if (memCache.has(fullKey)) return memCache.get(fullKey)!;
  const stored = loadStorageCache()[fullKey];
  if (stored) {
    memCache.set(fullKey, stored);
    return stored;
  }
  if (inFlight.has(fullKey)) return inFlight.get(fullKey)!;

  const promise = (async () => {
    try {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const items: Text[] = [];
      let node: Node | null = walker.nextNode();
      while (node) {
        const t = node as Text;
        if (t.nodeValue && t.nodeValue.trim().length > 1 && !hasSkipAncestor(t, tpl.content)) {
          items.push(t);
        }
        node = walker.nextNode();
      }
      const translated = await Promise.all(
        items.map((n) => translateText(n.nodeValue || "", target)),
      );
      items.forEach((n, i) => {
        n.nodeValue = translated[i] ?? n.nodeValue;
      });
      const out = tpl.innerHTML;
      // Only cache when at least one text node was actually translated. If the
      // entire HTML came back identical (every per-node call hit a rate
      // limit or untranslatable token), skip the cache write so the next
      // view retries.
      if (out && out !== html) {
        memCache.set(fullKey, out);
        const store = loadStorageCache();
        store[fullKey] = out;
        saveStorageCache();
      }
      return out;
    } catch {
      return html;
    } finally {
      inFlight.delete(fullKey);
    }
  })();
  inFlight.set(fullKey, promise);
  return promise;
}
