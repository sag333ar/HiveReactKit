/**
 * Service for Google Input Tools phonetic transliteration (Type-to-Translate).
 * Converts romanized/phonetic text into native language scripts in real-time.
 */

export interface TransliterationLanguage {
  code: string;
  label: string;
  itc: string;
  nativeLabel?: string;
}

export const TRANSLITERATION_LANGUAGES: TransliterationLanguage[] = [
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', itc: 'hi-t-i0-und' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', itc: 'bn-t-i0-und' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', itc: 'ta-t-i0-und' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', itc: 'te-t-i0-und' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', itc: 'mr-t-i0-und' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', itc: 'gu-t-i0-und' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', itc: 'kn-t-i0-und' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', itc: 'ml-t-i0-und' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', itc: 'pa-t-i0-und' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', itc: 'ur-t-i0-und' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', itc: 'ar-t-i0-und' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', itc: 'fa-t-i0-und' },
  { code: 'ne', label: 'Nepali', nativeLabel: 'नेपाली', itc: 'ne-t-i0-und' },
  { code: 'sa', label: 'Sanskrit', nativeLabel: 'संस्कृतम्', itc: 'sa-t-i0-und' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල', itc: 'si-t-i0-und' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', itc: 'ru-t-i0-und' },
  { code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά', itc: 'el-t-i0-und' },
  { code: 'am', label: 'Amharic', nativeLabel: 'አማርኛ', itc: 'am-t-i0-und' },
  { code: 'ti', label: 'Tigrinya', nativeLabel: 'ትግርኛ', itc: 'ti-t-i0-und' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', itc: 'or-t-i0-und' },
  { code: 'zh', label: 'Chinese (Pinyin)', nativeLabel: '中文', itc: 'zh-t-i0-pinyin' },
];

const LANG_MAP = new Map<string, TransliterationLanguage>();
for (const lang of TRANSLITERATION_LANGUAGES) {
  LANG_MAP.set(lang.code.toLowerCase(), lang);
}

export function isTransliterationSupported(langCode: string): boolean {
  if (!langCode) return false;
  return LANG_MAP.has(langCode.toLowerCase());
}

export function getTransliterationLanguage(langCode: string): TransliterationLanguage | undefined {
  if (!langCode) return undefined;
  return LANG_MAP.get(langCode.toLowerCase());
}

// In-memory cache for transliteration queries: key = `${lang}:${word}` -> suggestions
const cache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 1000;

function setCache(key: string, values: string[]) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, values);
}

/**
 * Fetches transliteration suggestions for a single phonetic word from Google Input Tools.
 */
export async function fetchTransliteration(
  word: string,
  langCode: string,
  options?: { num?: number; signal?: AbortSignal }
): Promise<string[]> {
  const trimmed = word.trim();
  if (!trimmed) return [];

  const lang = getTransliterationLanguage(langCode);
  if (!lang) return [];

  const cacheKey = `${lang.code}:${trimmed.toLowerCase()}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) || [];
  }

  const num = options?.num ?? 5;
  const itc = lang.itc;
  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(trimmed)}&itc=${encodeURIComponent(itc)}&num=${num}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (
      Array.isArray(data) &&
      data[0] === 'SUCCESS' &&
      Array.isArray(data[1]) &&
      data[1][0] &&
      Array.isArray(data[1][0][1])
    ) {
      const suggestions: string[] = data[1][0][1];
      setCache(cacheKey, suggestions);
      return suggestions;
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return [];
    }
    console.warn('Transliteration fetch failed:', err);
  }

  return [];
}
