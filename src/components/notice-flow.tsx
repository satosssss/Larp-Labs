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
        "Let’s start with your notice.",
        "A quick check, before we explain.",
        "A little more clarity.",
        "Let’s clear up your questions.",
        "Feel more prepared for the conversation.",
      ]
    : [
        "Magsimula tayo sa notice mo.",
        "Suriin muna, bago ipaliwanag.",
        "Mas malinaw na ngayon.",
        "Linawin natin ang mga tanong mo.",
        "Mas handa sa pakikipag-usap.",
      ];
  const descriptions = en
    ? [
        "Choose a document or explore a fictional example.",
        "Compare the text with the original. You can correct anything here.",
        "Read what the document says, and see the passage behind the explanation.",
        "Ask about the document and share a little context for your preparation.",
        "Bring your documents, your notes, and the questions that matter to you.",
      ]
    : [
        "Pumili ng dokumento o subukan ang isang kathang-isip na halimbawa.",
        "Ihambing ang teksto sa orihinal. Maaari mong itama ang anumang hindi tugma.",
        "Unawain ang nakasaad at tingnan ang pinagmulan ng paliwanag.",
        "Magtanong tungkol sa dokumento at magbigay ng kaunting konteksto.",
        "Ihanda ang dokumento, mga tala, at mga tanong na mahalaga sa iyo.",
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
              ? "Sample mode · Fictional document and prepared answers."
              : "Halimbawa lamang · Kathang-isip na dokumento at nakahandang sagot."}
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
        <p className="eyebrow">
          0{step + 1} / {steps[step]}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {titles[step]}
        </h1>
        <p>{descriptions[step]}</p>
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
            : "Mawawala sa tab na ito ang kasalukuyang dokumento, mga tanong, at edit. Walang ipinadala sa server sa preview na ito."}
        </p>
        <div className="screen-actions">
          <button
            className="button button-secondary"
            onClick={() => dialog.current?.close()}
          >
            {en ? "Keep working" : "Magpatuloy dito"}
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
