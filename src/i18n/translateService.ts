/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MyMemory-backed translation service for translating Hive post / comment
 * bodies (rendered HTML) into the user's selected app language.
 *
 * Free, no API key, soft daily quota. The kit ships this as the default
 * translator — consumers can override by passing their own `translate`
 * function to `<HiveLanguageProvider>` (e.g. DeepL, Google Translate, an
 * authenticated MyMemory account).
 *
 * Heavy caching: in-memory map (session) + localStorage (cross-reload) +
 * in-flight dedup so two views of the same body share one network call.
 */

const STORAGE_KEY = "hive-react-kit-translation-cache";
const STORAGE_LIMIT = 500;
const REQUEST_CHAR_LIMIT = 480; // MyMemory anonymous: 500. Leave headroom.

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

async function callMyMemory(text: string, target: string, source: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`MyMemory ${resp.status}`);
  const data = await resp.json();
  const out: string | undefined = data?.responseData?.translatedText;
  if (!out || /QUERY LENGTH|MYMEMORY WARNING|INVALID/i.test(out)) {
    return text;
  }
  return out;
}

/** Translate a single text string to `target` language. */
export async function translateText(
  text: string,
  target: string,
  source: string = "en",
): Promise<string> {
  if (!text) return text;
  if (!target || target === source || target === "en") return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;

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
        result = await callMyMemory(text, target, source);
      } else {
        const parts = chunkText(text, REQUEST_CHAR_LIMIT);
        const out = await Promise.all(parts.map((p) => callMyMemory(p, target, source)));
        result = out.join(" ");
      }
      memCache.set(cacheKey, result);
      const store = loadStorageCache();
      store[cacheKey] = result;
      saveStorageCache();
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
  if (!html || !target || target === "en") return html;
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
      memCache.set(fullKey, out);
      const store = loadStorageCache();
      store[fullKey] = out;
      saveStorageCache();
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
