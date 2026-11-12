"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFlow } from "@/lib/flow";
import { gateway } from "@/lib/gateway";
import { Icon } from "../ui";
export function UploadStep({ en }: { en: boolean }) {
  const file = useFlow((s) => s.document);
  const revision = useFlow((s) => s.revision);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!file || !["image/png", "image/jpeg"].includes(file.type)) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    request.current?.abort();
    setBusy(false);
    setError("");
  }, [file]);
  useEffect(() => () => request.current?.abort(), []);
  function choose(candidate?: File) {
    if (!candidate) return;
    request.current?.abort();
    setBusy(false);
    useFlow.getState().startReal();
    setError("");

    if (!candidate.size || candidate.size > 10485760) {
      setError(
        en
          ? "Choose a non-empty file up to 10 MB."
          : "Pumili ng file na may laman at hindi lalampas sa 10 MB.",
      );
      return;
    }
    if (!/\.(jpe?g|png|pdf)$/i.test(candidate.name)) {
      setError(
        en
          ? "This preview supports JPG, PNG and PDF. HEIC support is pending."
          : "JPG, PNG at PDF muna ang suportado sa preview. Inihahanda pa ang HEIC.",
      );
      return;
    }
    useFlow.getState().startReal(candidate);
  }
  async function extract() {
    if (!file) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const revision = useFlow.getState().revision;
    try {
      const result = await gateway.extract(file, controller.signal);
      if (controller.signal.aborted || revision !== useFlow.getState().revision)
        return;
      useFlow.getState().setText(result.text);
      useFlow.getState().go(1);
    } catch {
      if (
        !controller.signal.aborted &&
        revision === useFlow.getState().revision
      )
        setError(
          en
            ? "Document reading is not connected yet. Your file has not been uploaded. You can try the sample or find legal help."
            : "Hindi pa nakakonekta ang pagbasa ng dokumento. Hindi na-upload ang file mo. Maaari mong subukan ang halimbawa o humanap ng legal na tulong.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="upload-layout">
        <div>
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              <Icon name="upload" size={26} />
            </span>
            <h2>
              {en
                ? "Let’s start with your document."
                : "Magsimula sa dokumento mo."}
            </h2>
            <p>
              {en
                ? "Drop your file here, or choose one below."
                : "I-drag ang file dito, o pumili mula sa device."}
            </p>
            <input
              ref={input}
              className="sr-only"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              aria-label={en ? "Choose document" : "Pumili ng dokumento"}
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = "";
              }}
              tabIndex={-1}
            />
            <button className="button" onClick={() => input.current?.click()}>
              <Icon name="plus" size={17} />
              {en ? "Choose a document" : "Pumili ng dokumento"}
            </button>
            <small>
              JPG, PNG, PDF · {en ? "Up to 10 MB" : "Hanggang 10 MB"}
            </small>
          </div>
          <p className="privacy-note">
            <Icon name="shield" size={18} />
            <span>
              {en
                ? "This frontend preview keeps your file in this tab. When document reading is connected, the original will be sent to OCR; review the data-use notice before proceeding."
                : "Sa frontend preview na ito, nasa tab na ito lang ang file mo. Kapag nakakonekta na ang pagbasa, ipapadala ang orihinal sa OCR; basahin muna ang paunawa sa paggamit ng data."}
            </span>
          </p>
          {file && (
            <>
              <div className="file-selected">
                <Icon name="file" />
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {(file.size / 1024).toFixed(0)} KB ·{" "}
                    {en ? "Selected locally" : "Nakapili sa device"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={en ? "Remove document" : "Alisin ang dokumento"}
                  onClick={() => {
                    request.current?.abort();

                    setError("");
                    setBusy(false);
                    useFlow.getState().startReal();
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
              {preview && (
                /* Local object URL, never uploaded for preview. */ <img
                  className="local-preview"
                  src={preview}
                  alt={
                    en
                      ? "Selected document preview"
                      : "Preview ng napiling dokumento"
                  }
                />
              )}
              <div className="screen-actions">
                <button className="button" onClick={extract} disabled={busy}>
                  {busy ? (
                    <span className="loading-dot" />
                  ) : (
                    <Icon name="file" />
                  )}
                  {en ? "Read the document" : "Basahin ang dokumento"}
                </button>
              </div>
            </>
          )}
          {error && (
            <div className="notice-alert" role="status">
              {error}{" "}
              <Link href="/help">
                {en ? "Find help" : "Humanap ng tulong"} ↗
              </Link>
            </div>
          )}
        </div>
        <aside className="side-note">
          <p className="eyebrow">
            {en ? "A GOOD PLACE TO START" : "BAGO TAYO MAGSIMULA"}
          </p>
          <h2>
            {en
              ? "A clearer photo helps."
              : "Mas malinaw na larawan, mas maayos na pagbasa."}
          </h2>
          <ul>
            <li>
              {en ? "Include the whole page." : "Isama ang buong pahina."}
            </li>
            <li>
              {en
                ? "Use good light, without glare."
                : "Gumamit ng maliwanag na lugar."}
            </li>
            <li>
              {en
                ? "Make sure the text is readable."
                : "Tiyaking nababasa ang mga salita."}
            </li>
          </ul>
          <div className="sample-callout">
            <h3>{en ? "Just exploring?" : "Gusto mo munang subukan?"}</h3>
            <p>
              {en
                ? "Walk through a fictional notice, with no upload needed."
                : "Tingnan kung paano ito gumagana gamit ang isang kathang-isip na notice."}
            </p>
            <button
              className="text-button"
              onClick={() => useFlow.getState().startSample()}
            >
              {en ? "Try the example" : "Subukan ang halimbawa"} ↗
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
