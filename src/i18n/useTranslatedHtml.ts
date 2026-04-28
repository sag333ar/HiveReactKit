import { useEffect, useState } from "react";
import { useHiveLanguage } from "./HiveLanguageContext";

/**
 * Translate a rendered Hive post / comment body (HTML) into the language
 * supplied by the nearest `<HiveLanguageProvider>`. Returns the original
 * HTML for English (the source language) and synchronously falls back to
 * the original on translation errors so the UI never looks broken.
 *
 * The translation is async — `loading` is true while the API request is
 * in flight on the very first render. Subsequent renders read from cache
 * and resolve instantly.
 */
export function useTranslatedHtml(html: string): { html: string; loading: boolean } {
  const { language, translateHtml } = useHiveLanguage();
  const [translated, setTranslated] = useState<string>(html);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!language || language === "en" || !html) {
      setTranslated(html);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    translateHtml(html, language)
      .then((out) => {
        if (cancelled) return;
        setTranslated(out);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTranslated(html);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [html, language, translateHtml]);

  return { html: translated, loading };
}
