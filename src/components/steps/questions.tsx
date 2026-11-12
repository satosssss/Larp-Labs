"use client";
import { useState, useRef, useEffect } from "react";
import { gateway } from "@/lib/gateway";
import { useFlow, exactSource } from "@/lib/flow";
import { sampleAnswer, suggestions } from "@/lib/sample";
import { SourcePanel } from "../source-panel";
import { Icon } from "../ui";
export function QuestionsStep({ en }: { en: boolean }) {
  const { messages, addMessage, mode, language, answers, answer, go, text } =
    useFlow();
  const [input, setInput] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const sourceOrigin = useRef<HTMLButtonElement | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function send(question: string) {
    if (busy) return;
    if (!question.trim() || question.length > 500) {
      setError(
        en
          ? "Write a question of 1–500 characters."
          : "Sumulat ng tanong na may 1–500 karakter.",
      );
      return;
    }
    setError("");
    if (mode === "sample") {
      addMessage({ role: "user", text: question, language });
      addMessage({
        role: "assistant",
        ...sampleAnswer(question, language),
        language,
      });
      setInput("");
      return;
    }
    const revision = useFlow.getState().revision;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const result = await gateway.chat(
        { text, question, language },
        controller.signal,
      );
      if (controller.signal.aborted || revision !== useFlow.getState().revision)
        return;
      if (result.quote && exactSource(text, result.quote) < 0)
        throw new Error("Unmatched source");
      addMessage({ role: "user", text: question, language });
      addMessage({ role: "assistant", ...result, language });
      setInput("");
    } catch {
      if (!controller.signal.aborted)
        setError(
          en
            ? "The answer is unavailable. Your question is kept; try again or find legal help."
            : "Hindi available ang sagot. Napanatili ang tanong mo; subukan muli o humanap ng legal na tulong.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="chat-layout">
        <section className="panel">
          <div className="panel-header">
            <span>
              LegaLinaw ·{" "}
              {en ? "Document questions" : "Mga tanong sa dokumento"}
            </span>
            <Icon name="chat" size={18} />
          </div>
          <div
            className="chat-body"
            tabIndex={0}
            role="log"
            aria-label={
              en ? "Document conversation" : "Usapan tungkol sa dokumento"
            }
            aria-live="polite"
          >
            {!messages.length ? (
              <div className="chat-welcome">
                <span className="icon-tile">
                  <Icon name="chat" size={24} />
                </span>
                <h2>
                  {en ? "Ask about your notice" : "Magtanong tungkol sa notice"}
                </h2>
                <p>
                  {en
                    ? "Choose a question below, or write your own."
                    : "Pumili ng tanong sa ibaba, o i-type ang tanong mo."}
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div className={`message ${m.role}`} key={i} lang={m.language}>
                  <span className="message-label">
                    {m.role === "user" ? (en ? "You" : "Ikaw") : "LegaLinaw"} ·{" "}
                    {m.language === "fil" ? "Filipino" : "English"}
                  </span>
                  <p>{m.text}</p>
                  {m.quote && (
                    <button
                      className="source-link"
                      onClick={(e) => {
                        sourceOrigin.current = e.currentTarget;
                        setSource(m.quote!);
                        requestAnimationFrame(() => {
                          document.getElementById("source-panel")?.focus();
                          document
                            .getElementById("source-panel")
                            ?.scrollIntoView({ block: "nearest" });
                        });
                      }}
                    >
                      <Icon name="link" size={14} />
                      {en ? "View source" : "Saan ito nakasulat?"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="suggestions">
            {suggestions[language].map((q) => (
              <button
                className="suggestion"
                key={q}
                disabled={busy}
                onClick={() => {
                  setInput(q);
                  send(q);
                }}
              >
                {q}
                <span aria-hidden="true"> ↗</span>
              </button>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label className="sr-only" htmlFor="chat-input">
              {en ? "Your question" : "Ang tanong mo"}
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                en
                  ? "Ask about the document…"
                  : "Magtanong tungkol sa dokumento…"
              }
              rows={2}
            />
            <button
              className="button"
              type="submit"
              disabled={busy || !input.trim() || input.length > 500}
              aria-label={en ? "Send question" : "Ipadala ang tanong"}
            >
              <Icon name="arrow" />
            </button>
          </form>
          {input.length > 400 && (
            <p className="field-hint" style={{ padding: "0 20px 15px" }}>
              {input.length}/500
            </p>
          )}
          {error && (
            <p className="notice-alert" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside>
          <p className="eyebrow" style={{ marginBottom: 15 }}>
            {en ? "A LITTLE CONTEXT HELPS" : "DALAWANG MABILIS NA TANONG"}
          </p>
          {[
            en
              ? "Have you already responded to the notice?"
              : "Nakasagot ka na ba sa notice?",
            en
              ? "Do you have related documents?"
              : "May iba ka pang dokumento tungkol dito?",
          ].map((q, i) => (
            <section className="follow-up" key={q}>
              <h3>{q}</h3>
              <div className="follow-options">
                {["yes", "no", "skip"].map((v, j) => (
                  <button
                    className="choice"
                    key={v}
                    aria-pressed={answers[i] === v}
                    onClick={() => answer(i, v)}
                  >
                    {
                      (en
                        ? ["Yes", "No", "Skip for now"]
                        : ["Oo", "Hindi", "Skip muna"])[j]
                    }
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="field-hint">
            {en
              ? "Answer or skip both to continue."
              : "Sagutin o i-skip ang dalawa para makatuloy."}
          </p>
        </aside>
      </div>
      {source && (
        <div style={{ marginTop: 20 }}>
          <SourcePanel
            text={text}
            quote={source}
            en={en}
            close={() => {
              setSource("");
              sourceOrigin.current?.focus();
            }}
          />
        </div>
      )}
      <div className="screen-actions">
        <button className="button button-quiet" onClick={() => go(2)}>
          <Icon name="back" />
          {en ? "Explanation" : "Paliwanag"}
        </button>
        <button
          className="button"
          disabled={answers.some((a) => a === null)}
          onClick={() => go(4)}
        >
          {en ? "Continue to checklist" : "Ituloy sa checklist"}
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}
