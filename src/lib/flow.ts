import { create } from "zustand";
import {
  SAMPLE_TEXT,
  sampleAnalysis,
  sampleQuestions,
  type Analysis,
  type Language,
} from "./sample";
export type Message = {
  role: "user" | "assistant";
  text: string;
  quote?: string;
  language: Language;
};
export type FlowState = {
  mode: "sample" | "real";
  step: number;
  document: File | null;
  revision: number;
  text: string;
  confirmed: boolean;
  language: Language;
  analysis: Analysis | null;
  messages: Message[];
  answers: (string | null)[];
  checked: string[];
  questions: string[];
  startSample: () => void;
  startReal: (document?: File | null) => void;
  setText: (text: string) => void;
  confirm: () => boolean;
  go: (step: number) => boolean;
  answer: (index: number, answer: string) => void;
  acceptAnalysis: (revision: number, analysis: Analysis) => boolean;
  setLanguage: (language: Language) => void;
  setQuestions: (questions: string[]) => void;
  toggleCheck: (key: string) => void;
  addMessage: (message: Message) => void;
};
export const validReview = (text: string) =>
  text.trim().length > 0 && text.length <= 100000;
export const exactSource = (text: string, quote: string) =>
  quote.length ? text.indexOf(quote) : -1;
const blank = () => ({
  step: 0,
  document: null as File | null,
  text: "",
  confirmed: false,
  analysis: null,
  messages: [] as Message[],
  answers: [null, null] as (string | null)[],
  checked: [] as string[],
  questions: [] as string[],
});
export const createFlowStore = () =>
  create<FlowState>((set, get) => ({
    ...blank(),
    mode: "real",
    revision: 0,
    language: "fil",
    startSample: () =>
      set((s) => ({
        ...blank(),
        mode: "sample",
        step: 1,
        text: SAMPLE_TEXT,
        revision: s.revision + 1,
        questions: [...sampleQuestions],
      })),
    startReal: (document = null) =>
      set((s) => ({
        ...blank(),
        document,
        mode: "real",
        revision: s.revision + 1,
      })),
    setText: (text) =>
      set((s) => ({
        text,
        confirmed: false,
        analysis: null,
        messages: [],
        answers: [null, null],
        checked: [],
        questions: [],
        revision: s.revision + 1,
      })),
    confirm: () => {
      const s = get();
      if (
        !validReview(s.text) ||
        (s.mode === "sample" && s.text !== SAMPLE_TEXT)
      )
        return false;
      set({
        confirmed: true,
        step: 2,
        analysis: s.mode === "sample" ? sampleAnalysis(s.language) : null,
        questions: s.questions,
      });
      return true;
    },
    go: (step) => {
      const s = get();
      if (
        step < 0 ||
        step > 4 ||
        (step >= 1 && !s.text) ||
        (step >= 2 && !s.confirmed) ||
        (step >= 3 && !s.analysis) ||
        (step === 4 && s.answers.some((a) => a === null))
      )
        return false;
      set({ step });
      return true;
    },
    answer: (index, answer) =>
      set((s) => ({
        answers: s.answers.map((a, i) => (i === index ? answer : a)),
      })),
    acceptAnalysis: (revision, analysis) => {
      const s = get();
      if (
        revision !== s.revision ||
        !s.confirmed ||
        exactSource(s.text, analysis.quote) < 0
      )
        return false;
      set({ analysis });
      return true;
    },
    setLanguage: (language) =>
      set((s) => ({
        language,
        analysis:
          s.mode === "sample" && s.analysis && s.text === SAMPLE_TEXT
            ? sampleAnalysis(language)
            : s.analysis,
      })),
    setQuestions: (questions) =>
      set({
        questions: questions
          .filter((q) => q.trim() && q.length <= 300)
          .slice(0, 20),
      }),
    toggleCheck: (key) =>
      set((s) => ({
        checked: s.checked.includes(key)
          ? s.checked.filter((k) => k !== key)
          : [...s.checked, key],
      })),
    addMessage: (message) =>
      set((s) => ({ messages: [...s.messages, message] })),
  }));
export const useFlow = createFlowStore();
