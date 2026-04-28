import { useEffect, useState } from "react";
import { useHiveLanguage } from "./HiveLanguageContext";
import { translateText as defaultTranslateText } from "./translateService";

/**
 * Plain-text counterpart to `useTranslatedHtml`. Use for titles, captions,
 * preview snippets, and any other short user-generated string that should
 * follow the language set on `<HiveLanguageProvider>`.
 *
 * Returns the original synchronously while the translation API call is
 * in flight, so titles never flash blank. Falls back to the original on
 * error and bypasses the translator entirely for English.
 */
export function useTranslatedText(text: string | undefined | null): { text: string; loading: boolean } {
  const safeInput = text ?? "";
  const { language } = useHiveLanguage();
  const [translated, setTranslated] = useState<string>(safeInput);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!language || language === "en" || !safeInput) {
      setTranslated(safeInput);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    defaultTranslateText(safeInput, language)
      .then((out) => {
        if (cancelled) return;
        setTranslated(out);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTranslated(safeInput);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [safeInput, language]);

  return { text: translated, loading };
}
