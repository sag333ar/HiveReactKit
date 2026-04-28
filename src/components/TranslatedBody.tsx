import React, { forwardRef } from "react";
import { useTranslatedHtml } from "../i18n/useTranslatedHtml";

export interface TranslatedBodyProps {
  /** Rendered post / comment body HTML (output of `createHiveRenderer`). */
  html: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * Drop-in replacement for
 *   `<div className="…" onClick={…} dangerouslySetInnerHTML={{ __html: html }} />`
 * that translates the body into the language supplied by the nearest
 * `<HiveLanguageProvider>`. Forwards refs to the inner div so existing
 * click-delegation / image-fallback logic continues to attach correctly.
 *
 * While translation is in flight the original HTML is shown and the
 * `data-translating="true"` attribute is set on the div so consumers
 * can apply a CSS-only loading style if they want.
 */
export const TranslatedBody = forwardRef<HTMLDivElement, TranslatedBodyProps>(
  ({ html, className, onClick }, ref) => {
    const { html: shown, loading } = useTranslatedHtml(html);
    return (
      <div
        ref={ref}
        className={className}
        onClick={onClick}
        data-translating={loading || undefined}
        dangerouslySetInnerHTML={{ __html: shown }}
      />
    );
  },
);

TranslatedBody.displayName = "TranslatedBody";

export default TranslatedBody;
