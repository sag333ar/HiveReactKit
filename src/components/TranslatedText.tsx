import React from "react";
import { useTranslatedText } from "../i18n/useTranslatedText";

export interface TranslatedTextProps {
  /** Plain-text source string (post title, snippet, caption, etc.). */
  text: string | null | undefined;
  /**
   * Optional fallback rendered when both translated and source text are
   * empty — typically the calling component already conditionally renders
   * this wrapper, so it's rarely needed.
   */
  fallback?: React.ReactNode;
}

/**
 * Drop-in inline wrapper for translating a plain string into the language
 * supplied by the nearest `<HiveLanguageProvider>`. Useful inside loops /
 * `.map()` render functions where calling `useTranslatedText` directly
 * would break the rules of hooks.
 *
 * ```tsx
 * <h2><TranslatedText text={item.title} /></h2>
 * ```
 *
 * Returns the original synchronously while the translation is in flight,
 * so titles never flash empty. No-op for English.
 */
export const TranslatedText: React.FC<TranslatedTextProps> = ({ text, fallback }) => {
  const { text: translated } = useTranslatedText(text ?? "");
  const out = translated || text;
  return <>{out || fallback || ""}</>;
};

export default TranslatedText;
