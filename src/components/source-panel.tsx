"use client";
import { exactSource } from "@/lib/flow";
import { Icon } from "./ui";
export function SourcePanel({
  text,
  quote,
  en,
  close,
}: {
  text: string;
  quote: string;
  en: boolean;
  close: () => void;
}) {
  const index = exactSource(text, quote);
  return (
    <section
      className="panel source-box"
      id="source-panel"
      tabIndex={-1}
      aria-label={en ? "Supporting passage" : "Pinagmulang bahagi"}
    >
      <div className="panel-header">
        <h2>{en ? "From your document" : "Mula sa dokumento"}</h2>
        <button
          className="icon-button"
          aria-label={en ? "Close source" : "Isara ang pinagmulan"}
          onClick={close}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div
        className="panel-content"
        tabIndex={0}
        role="region"
        aria-label={en ? "Source text" : "Pinagmulang teksto"}
      >
        <p className="field-hint">
          {en
            ? "Highlighted below: the passage used for this explanation. The interpretation may still be wrong."
            : "Naka-highlight ang pinagbasehan ng paliwanag. Posible pa ring mali ang interpretasyon."}
        </p>
        <pre className="document-text" style={{ marginTop: 20 }}>
          {index < 0 ? (
            text
          ) : (
            <>
              {text.slice(0, index)}
              <mark className="source-highlight">{quote}</mark>
              {text.slice(index + quote.length)}
            </>
          )}
        </pre>
        {index < 0 && (
          <p role="status">
            {en ? "No exact match found." : "Walang eksaktong tugma."}
          </p>
        )}
      </div>
    </section>
  );
}
