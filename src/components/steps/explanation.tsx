"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFlow } from "@/lib/flow";
import { gateway } from "@/lib/gateway";
import { Icon } from "../ui";
import { SourcePanel } from "../source-panel";
export function ExplanationStep({ en }: { en: boolean }) {
  const {
    analysis,
    text,
    go,
    mode,
    confirmed,
    language,
    revision,
    acceptAnalysis,
  } = useFlow();
  const [requestCount, setRequestCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [requestedLanguage, setRequestedLanguage] = useState(language);
  useEffect(() => {
    if (mode !== "real" || !confirmed) return;
    const controller = new AbortController();
    setBusy(true);
    setAnalysisError("");
    gateway
      .analyze(text, requestedLanguage, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted && !acceptAnalysis(revision, result))
          setAnalysisError("invalid");
      })
      .catch(() => {
        if (!controller.signal.aborted) setAnalysisError("unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [
    mode,
    confirmed,
    text,
    requestedLanguage,
    requestCount,
    revision,
    acceptAnalysis,
  ]);
  const [source, setSource] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [rate, setRate] = useState(1);
  const sourceButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setSpeechError("");
  }, [en, rate]);
  function listen() {
    if (!analysis) return;
    if (!window.speechSynthesis) {
      setSpeechError(
        en
          ? "Read-aloud is unavailable in this browser."
          : "Hindi available ang pagbasa nang malakas sa browser na ito.",
      );
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) =>
        analysis.language === "en"
          ? v.lang.startsWith("en")
          : v.lang.startsWith("fil") || v.lang.startsWith("tl"),
      );
    if (!voice) {
      setSpeechError(
        en
          ? "No matching voice is available. Try the other language."
          : "Walang tugmang voice. Subukan ang ibang wika.",
      );
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      analysis.summary +
        " " +
        (analysis.language === "en"
          ? "This is not legal advice."
          : "Hindi ito legal advice."),
    );
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError(
        en
          ? "Reading could not finish. Please try again."
          : "Hindi natapos ang pagbasa. Subukan muli.",
      );
    };
    setSpeechError("");
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }
  if (!analysis)
    return (
      <div className="notice-alert">
        <p role="status">
          {busy
            ? en
              ? "Preparing your explanation…"
              : "Inihahanda ang paliwanag…"
            : en
              ? "The explanation is unavailable. Your reviewed text is still here."
              : "Hindi available ang paliwanag. Nandito pa rin ang sinuri mong teksto."}
        </p>
        <div className="screen-actions">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => setRequestCount((n) => n + 1)}
          >
            {en ? "Retry" : "Subukan muli"}
          </button>
          <button className="button button-quiet" onClick={() => go(1)}>
            {en ? "Review text" : "I-check ulit ang text"}
          </button>
          <Link href="/help">{en ? "Find help" : "Humanap ng tulong"} ↗</Link>
        </div>
      </div>
    );
  function openSource() {
    setSource(true);
    requestAnimationFrame(() => {
      document.getElementById("source-panel")?.focus();
      document
        .getElementById("source-panel")
        ?.scrollIntoView({ block: "nearest" });
    });
  }
  return (
    <>
      {mode === "real" && analysis.language !== language && (
        <div className="notice-alert">
          <p>
            {en
              ? "This explanation is still in its original language. Regenerate it to use the selected language."
              : "Nasa orihinal na wika pa ang paliwanag. Muling gumawa ng paliwanag para gamitin ang napiling wika."}
          </p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRequestedLanguage(language);
              setRequestCount((n) => n + 1);
            }}
          >
            {en ? "Regenerate explanation" : "Muling gumawa ng paliwanag"}
          </button>
        </div>
      )}
      {mode === "real" && (busy || analysisError) && (
        <div role="status" className="notice-alert">
          {busy
            ? en
              ? "Updating explanation…"
              : "Ina-update ang paliwanag…"
            : en
              ? "The update could not finish. The previous explanation is retained."
              : "Hindi natapos ang update. Napanatili ang naunang paliwanag."}
          {!busy && (
            <button
              className="text-button"
              onClick={() => setRequestCount((n) => n + 1)}
            >
              {en ? "Retry" : "Subukan muli"}
            </button>
          )}
        </div>
      )}
      <div className={source ? "explanation-grid" : ""}>
        <section className="panel">
          <div className="panel-header">
            <span>
              {en ? "Your notice, in simple words" : "Paliwanag sa notice mo"}
            </span>
            <Icon name="sparkles" size={18} />
          </div>
          <div className="panel-content">
            <span className="pill">
              <span className="status-dot" />
              {analysis.type}
            </span>

            <p className="summary-text">{analysis.summary}</p>
            <div className="analysis-meta">
              <div className="meta-card">
                <span>
                  <Icon name="clock" size={16} />
                  {en ? "Stated schedule" : "Petsa at oras sa notice"}
                </span>
                <strong>{analysis.date}</strong>
                <small>{analysis.time}</small>
              </div>
              <div className="meta-card">
                <span>
                  <Icon name="pin" size={16} />
                  {en ? "Named sender" : "Nagpadala"}
                </span>
                <strong>{analysis.sender}</strong>
                <small>
                  {en ? "Not independently verified" : "Hindi pa verified"}
                </small>
              </div>
            </div>
            <button
              ref={sourceButton}
              className="source-link"
              onClick={openSource}
            >
              <Icon name="link" size={16} />
              {en ? "Where does it say this?" : "Saan ito nakasulat?"}
              <Icon name="arrowUp" size={16} />
            </button>
            <div className="details-list">
              {mode === "sample" && (
                <details>
                  <summary>
                    {en
                      ? "What does “paanyaya” mean?"
                      : "Ano ang ibig sabihin ng “paanyaya”?"}
                  </summary>
                  <p>
                    {en
                      ? "In everyday language, paanyaya means invitation. The legal significance depends on the actual document and circumstances; a legal professional can help clarify it."
                      : "Ang “paanyaya” ay imbitasyon. Itanong sa abogado kung ano ang ibig sabihin nito para sa sitwasyon mo."}
                  </p>
                </details>
              )}
              <details>
                <summary>
                  {en
                    ? "How can I check who sent this?"
                    : "Paano susuriin kung sino ang nagpadala?"}
                </summary>
                <p>
                  {en
                    ? "This example cannot verify a sender. Use a contact source you independently trust to confirm the document."
                    : "Hindi namin makukumpirma kung tunay ang nagpadala. Hanapin ang official contact ng opisina para magtanong."}
                </p>
                <Link className="text-button" href="/verify">
                  {en
                    ? "Open the verification guide"
                    : "Paano i-check ang nagpadala?"}{" "}
                  ↗
                </Link>
              </details>
            </div>
            <div className="listen-controls" style={{ marginTop: 20 }}>
              <button className="button button-secondary" onClick={listen}>
                <Icon name={speaking ? "stop" : "volume"} size={17} />
                {speaking
                  ? en
                    ? "Stop reading"
                    : "Ihinto"
                  : en
                    ? "Listen"
                    : "Pakinggan"}
              </button>
              <select
                value={rate}
                aria-label={en ? "Reading speed" : "Bilis ng pagbasa"}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                <option value={0.75}>0.75×</option>
                <option value={1}>1×</option>
                <option value={1.25}>1.25×</option>
              </select>
            </div>
            {speechError && (
              <p className="field-hint" role="status">
                {speechError}
              </p>
            )}
          </div>
        </section>
        {source && (
          <SourcePanel
            text={text}
            quote={analysis.quote}
            en={en}
            close={() => {
              setSource(false);
              sourceButton.current?.focus();
            }}
          />
        )}
      </div>
      <div className="notice-alert">
        {en
          ? "Need advice for your situation?"
          : "Kailangan mo ng payo para sa sitwasyon mo?"}{" "}
        <Link href="/help">
          {en ? "Find legal help" : "Humanap ng legal na tulong"} ↗
        </Link>
      </div>
      <div className="screen-actions">
        <button className="button button-quiet" onClick={() => go(1)}>
          <Icon name="back" />
          {en ? "Review text" : "I-check ulit ang text"}
        </button>
        <button className="button" onClick={() => go(3)}>
          {en ? "Ask a question" : "May tanong pa ako"}
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}
