"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFlow } from "@/lib/flow";
import { usePreferences } from "@/lib/preferences";
import { Icon, Disclaimer } from "./ui";
import { UploadStep } from "./steps/upload";
import { ReviewStep } from "./steps/review";
import { ExplanationStep } from "./steps/explanation";
import { QuestionsStep } from "./steps/questions";
import { PreparationStep } from "./steps/preparation";
export function NoticeFlow() {
  const {
    step,
    mode,
    text,
    confirmed,
    analysis,
    answers,
    go,
    startReal,
    startSample,
    setLanguage,
  } = useFlow();
  const language = usePreferences((s) => s.language);
  const en = language === "en";
  const params = useSearchParams();
  const initialized = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (params.get("sample") === "1" && !useFlow.getState().text)
        startSample();
    }
  }, [params, startSample]);
  useEffect(() => setLanguage(language), [language, setLanguage]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const steps = en
    ? ["Upload", "Review", "Explanation", "Questions", "Preparation"]
    : ["I-upload", "Suriin", "Paliwanag", "Mga tanong", "Paghahanda"];
  const titles = en
    ? [
        "Upload your notice.",
        "Does the text look right?",
        "Here’s what it means.",
        "What would you like to ask?",
        "Get ready to speak with a lawyer.",
      ]
    : [
        "I-upload ang notice mo.",
        "Tama ba ang nabasang text?",
        "Ito ang ibig sabihin.",
        "Ano ang tanong mo?",
        "Ihanda ang mga kailangan mo.",
      ];
  function canEnter(i: number) {
    return (
      i === 0 ||
      (i === 1 && !!text) ||
      (i === 2 && confirmed) ||
      (i === 3 && !!analysis) ||
      (i === 4 && !!analysis && answers.every((a) => a !== null))
    );
  }
  return (
    <main id="main" className="workspace">
      <div className="workspace-top">
        <Link href="/" className="back-link">
          <Icon name="back" size={16} />
          {en ? "Back to home" : "Bumalik sa simula"}
        </Link>
        <button
          className="text-button"
          onClick={() => dialog.current?.showModal()}
        >
          {en ? "Start a new document" : "Magsimula ng bagong dokumento"}
        </button>
      </div>
      {mode === "sample" && (
        <div className="sample-banner">
          <span>
            <Icon name="book" size={17} />
            {en
              ? "Demo · Fictional notice and prepared answers."
              : "Demo lang · Hindi totoong notice. Sample ang mga sagot."}
          </span>
          <button
            className="text-button"
            onClick={() => dialog.current?.showModal()}
          >
            {en ? "Use my document" : "Gamitin ang dokumento ko"} ↗
          </button>
        </div>
      )}
      <ol
        className="stepper"
        aria-label={en ? "Document progress" : "Mga hakbang sa dokumento"}
      >
        {steps.map((name, i) => (
          <li key={i}>
            <button
              className={step === i ? "active" : i < step ? "done" : ""}
              aria-current={step === i ? "step" : undefined}
              disabled={!canEnter(i)}
              onClick={() => go(i)}
              aria-label={`${i + 1}. ${name}`}
            >
              <span className="step-number">
                {i < step ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span>{name}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mobile-progress">
        {en ? "Step" : "Hakbang"} {step + 1} / 5 · {steps[step]}
      </p>
      <div className="screen-heading">
        <h1 ref={heading} tabIndex={-1}>
          {titles[step]}
        </h1>
      </div>
      {step === 0 ? (
        <UploadStep en={en} />
      ) : step === 1 ? (
        <ReviewStep en={en} />
      ) : step === 2 ? (
        <ExplanationStep en={en} />
      ) : step === 3 ? (
        <QuestionsStep en={en} />
      ) : (
        <PreparationStep en={en} />
      )}
      <Disclaimer en={en} />
      <dialog ref={dialog} className="modal" aria-labelledby="restart-title">
        <h2 id="restart-title">{en ? "Start again?" : "Magsimula muli?"}</h2>
        <p>
          {en
            ? "This clears the current document, questions, and edits from this tab. Nothing in this preview has been sent to a server."
            : "Mabubura sa tab na ito ang file at mga sagot mo. Walang na-upload sa preview na ito."}
        </p>
        <div className="screen-actions">
          <button
            className="button button-secondary"
            onClick={() => dialog.current?.close()}
          >
            {en ? "Keep working" : "Dito muna"}
          </button>
          <button
            className="button"
            onClick={() => {
              startReal();
              dialog.current?.close();
            }}
          >
            {en ? "Start again" : "Magsimula muli"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
