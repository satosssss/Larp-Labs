"use client";
import Link from "next/link";
import { useState } from "react";
import { useFlow } from "@/lib/flow";
import { ExportControls } from "../export-controls";
import { Icon } from "../ui";
export function PreparationStep({ en }: { en: boolean }) {
  const { checked, toggleCheck, questions, setQuestions, go } = useFlow();
  const [newQuestion, setNewQuestion] = useState("");
  const groups = [
    {
      title: en ? "Who to contact" : "Sino ang kakausapin",
      items: [
        [
          "contact",
          en
            ? "Identify a legal help provider to ask about your notice."
            : "Humanap ng legal help provider na mapagtatanungan tungkol sa notice.",
        ],
      ],
    },
    {
      title: en ? "What to prepare" : "Ano ang ihahanda",
      items: [
        [
          "notice",
          en
            ? "The complete notice and its envelope, if available."
            : "Ang buong notice at sobre nito, kung mayroon.",
        ],
        [
          "id",
          en
            ? "An identification document, if requested by the provider."
            : "Isang pagkakakilanlan, kung hihingin ng provider.",
        ],
        [
          "related",
          en
            ? "Any related documents and your notes."
            : "Mga kaugnay na dokumento at tala.",
        ],
      ],
    },
    {
      title: en ? "What to clarify" : "Ano ang lilinawin",
      items: [
        [
          "schedule",
          en
            ? "Ask about the stated schedule and any applicable deadlines."
            : "Itanong ang nakasaad na iskedyul at anumang naaangkop na deadline.",
        ],
        [
          "cost",
          en
            ? "Ask about eligibility, appointment requirements, and any costs."
            : "Itanong ang kwalipikasyon, appointment, at anumang bayad.",
        ],
      ],
    },
  ];
  function add() {
    if (
      !newQuestion.trim() ||
      newQuestion.length > 300 ||
      questions.length >= 20
    )
      return;
    setQuestions([...questions, newQuestion.trim()]);
    setNewQuestion("");
  }
  return (
    <>
      <div className="prep-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <span>
                {en ? "Your preparation checklist" : "Checklist sa paghahanda"}
              </span>
              <span className="pill">{checked.length}/6</span>
            </div>
            <div className="panel-content">
              {groups.map((g) => (
                <div className="check-group" key={g.title}>
                  <h3>{g.title}</h3>
                  {g.items.map(([key, label]) => (
                    <label className="check-row" key={key}>
                      <input
                        type="checkbox"
                        checked={checked.includes(key)}
                        onChange={() => toggleCheck(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <span>
                {en
                  ? "Questions to bring to a lawyer"
                  : "Mga tanong para sa abogado"}
              </span>
              <Icon name="chat" size={18} />
            </div>
            <div className="panel-content">
              <p className="field-hint" style={{ marginBottom: 20 }}>
                {en
                  ? "Make these your own. Your edits stay unchanged when switching languages."
                  : "Baguhin ayon sa kailangan mo. Mananatili ang mga edit mo kahit magpalit ng wika."}
              </p>
              {questions.map((q, i) => (
                <div className="question-row" key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <textarea
                    aria-label={`${en ? "Question" : "Tanong"} ${i + 1}`}
                    value={q}
                    maxLength={300}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[i] = e.target.value;
                      useFlow.setState({ questions: updated });
                    }}
                    onBlur={() => setQuestions(useFlow.getState().questions)}
                  />
                  <button
                    className="icon-button"
                    aria-label={`${en ? "Remove question" : "Alisin ang tanong"} ${i + 1}`}
                    onClick={() =>
                      setQuestions(questions.filter((_, j) => j !== i))
                    }
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              ))}
              <form
                className="add-question"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <label className="sr-only" htmlFor="new-question">
                  {en ? "Add your own question" : "Magdagdag ng tanong"}
                </label>
                <input
                  id="new-question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  maxLength={300}
                  placeholder={
                    en
                      ? "Add your own question…"
                      : "Idagdag ang sarili mong tanong…"
                  }
                />
                <button
                  className="button button-secondary"
                  disabled={!newQuestion.trim() || questions.length >= 20}
                >
                  <Icon name="plus" size={17} />
                  {en ? "Add" : "Idagdag"}
                </button>
              </form>
              <p className="field-hint">
                {questions.length}/20 ·{" "}
                {en
                  ? "Up to 300 characters per question"
                  : "Hanggang 300 karakter bawat tanong"}
              </p>
            </div>
          </section>
        </div>
        <aside className="stack">
          <section className="panel help-card">
            <div className="panel-content">
              <span className="icon-tile" style={{ marginBottom: 20 }}>
                <Icon name="pin" />
              </span>
              <h3>
                {en ? "Find someone who can help." : "May puwedeng makatulong."}
              </h3>
              <p>
                {en
                  ? "Start with official legal help resources. Confirm eligibility and availability directly with the office."
                  : "Magsimula sa mga opisyal na mapagkukunan ng legal na tulong. Kumpirmahin ang kwalipikasyon at availability sa mismong opisina."}
              </p>
              <Link className="button button-secondary" href="/help">
                {en ? "Explore legal help" : "Tingnan ang legal na tulong"}
                <Icon name="arrowUp" size={17} />
              </Link>
            </div>
          </section>
          <section className="panel help-card">
            <div className="panel-content">
              <h3>
                {en
                  ? "Keep your preparation together."
                  : "Pagsama-samahin ang paghahanda."}
              </h3>
              <p>
                {en
                  ? "The report and family-share services are being connected. You can review and edit everything here in the meantime."
                  : "Ikinokonekta pa ang report at family-share services. Maaari mong suriin at i-edit ang lahat dito habang hinihintay."}
              </p>
              <ExportControls en={en} />
            </div>
          </section>
        </aside>
      </div>
      <div className="screen-actions">
        <button className="button button-quiet" onClick={() => go(3)}>
          <Icon name="back" />
          {en ? "Back to questions" : "Bumalik sa mga tanong"}
        </button>
        <Link className="button" href="/help">
          {en ? "Find legal help" : "Humanap ng legal na tulong"}
          <Icon name="arrowUp" />
        </Link>
      </div>
    </>
  );
}
