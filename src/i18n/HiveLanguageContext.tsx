/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from "react";
import { translateHtml as defaultTranslateHtml } from "./translateService";

export type TranslateHtmlFn = (html: string, target: string) => Promise<string>;

export interface HiveLanguageContextValue {
  /**
   * Two-letter language code for translating user-generated content
   * (post bodies, comments, activity bodies). `"en"` is the no-op default —
   * content passes through unchanged.
   */
  language: string;

  /**
   * Custom translator. Defaults to a free MyMemory-backed implementation
   * that ships with the kit. Override to plug in DeepL, Google Translate,
   * or any other service — receives the rendered HTML and target language,
   * returns translated HTML.
   */
  translateHtml: TranslateHtmlFn;
}

const DEFAULT_VALUE: HiveLanguageContextValue = {
  language: "en",
  translateHtml: defaultTranslateHtml,
};

const HiveLanguageContext = createContext<HiveLanguageContextValue>(DEFAULT_VALUE);

export interface HiveLanguageProviderProps {
  /** Two-letter language code, e.g. `"en"`, `"es"`. Defaults to `"en"`. */
  language?: string;

  /**
   * Optional override translator. If omitted, the kit's default MyMemory
   * implementation is used.
   */
  translateHtml?: TranslateHtmlFn;

  children: React.ReactNode;
}

/**
 * Wrap your app once with this provider so every Hive content body
 * rendered by the kit (`<HiveDetailPost>`, comments, snaps, profile feeds,
 * activity bodies) translates to the chosen language.
 *
 * ```tsx
 * <HiveLanguageProvider language={i18n.language}>
 *   <App />
 * </HiveLanguageProvider>
 * ```
 *
 * When `language === "en"` (the default), the provider is a no-op.
 */
export const HiveLanguageProvider: React.FC<HiveLanguageProviderProps> = ({
  language = "en",
  translateHtml,
  children,
}) => {
  const value = useMemo<HiveLanguageContextValue>(
    () => ({
      language,
      translateHtml: translateHtml ?? defaultTranslateHtml,
    }),
    [language, translateHtml],
  );
  return <HiveLanguageContext.Provider value={value}>{children}</HiveLanguageContext.Provider>;
};

/** Read the current Hive language + translator from context. */
export function useHiveLanguage(): HiveLanguageContextValue {
  return useContext(HiveLanguageContext);
}
