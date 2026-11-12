"use client";
import { useEffect, useState } from "react";
import { useFlow, validReview } from "@/lib/flow";
import { SAMPLE_TEXT } from "@/lib/sample";
import { Icon } from "../ui";
export function ReviewStep({ en }: { en: boolean }) {
  const { text, setText, confirm, mode, startSample, go, document } = useFlow();
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!document) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(document);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [document]);
  const changed = mode === "sample" && text !== SAMPLE_TEXT;
  return (
    <>
      <div className="review-grid">
        <section className="panel">
          <div className="panel-header">
            <span>
              <Icon name="file" size={16} />{" "}
              {en ? "Original document" : "Original na dokumento"}
            </span>
            {mode === "sample" && (
              <span className="pill">{en ? "Fictional" : "Demo"}</span>
            )}
          </div>
          <div
            className="source-document"
            tabIndex={0}
            role="region"
            aria-label={
              en ? "Original document text" : "Teksto ng orihinal na dokumento"
            }
          >
            {mode === "sample" ? (
              <pre className="document-text">{SAMPLE_TEXT}</pre>
            ) : preview && document ? (
              <>
                {document.type === "application/pdf" ||
                /\.pdf$/i.test(document.name) ? (
                  <iframe
                    src={preview}
                    title={en ? "Original PDF" : "Orihinal na PDF"}
                    className="pdf-preview"
                  />
                ) : (
                  <img
                    src={preview}
                    className="local-preview"
                    alt={en ? "Original document" : "Original na dokumento"}
                  />
                )}
                <a
                  className="text-button"
                  href={preview}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {en
                    ? "Open original in a new tab"
                    : "Buksan ang orihinal sa bagong tab"}{" "}
                  ↗
                </a>
              </>
            ) : (
              <p>
                {en
                  ? "No original file is selected."
                  : "Walang napiling orihinal na file."}
              </p>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <span>{en ? "Check the extracted text" : "Nabasang text"}</span>
            <Icon name="checks" size={18} />
          </div>
          <div className="panel-content">
            <label htmlFor="review-text" className="sr-only">
              {en
                ? "Correct anything that does not match."
                : "Itama ang anumang hindi tugma sa dokumento."}
            </label>
            <textarea
              id="review-text"
              className="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="review-hint"
            />
            <p id="review-hint" className="field-hint">
              {en
                ? "Check names, dates, and amounts. You can edit the text above."
                : "I-check ang mga pangalan, petsa, at halaga. Puwede mong i-edit ang text sa itaas."}
            </p>
            {text.length > 90000 && (
              <p className="field-hint">
                {text.length.toLocaleString()} / 100,000{" "}
                {en ? "characters" : "karakter"}
              </p>
            )}

            {changed && (
              <div className="notice-alert" role="status">
                {en
                  ? "You changed the example. Its prepared explanation is now cleared; this sample cannot generate a new one."
                  : "Na-edit ang demo. Ibalik ang original para makita ulit ang sample na paliwanag."}
                <br />
                <button className="text-button" onClick={startSample}>
                  {en
                    ? "Restore original example"
                    : "Ibalik ang orihinal na halimbawa"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="screen-actions">
        <button className="button button-quiet" onClick={() => go(0)}>
          <Icon name="back" />
          {en ? "Back" : "Bumalik"}
        </button>
        <button
          className="button"
          onClick={confirm}
          disabled={!validReview(text) || changed}
        >
          {en ? "Looks right — explain" : "Tama na — ipaliwanag"}
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}
