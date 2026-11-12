"use client";
import { create } from "zustand";
import type { Language } from "./sample";
export const usePreferences = create<{
  language: Language;
  scale: number;
  setLanguage: (language: Language) => void;
  setScale: (scale: number) => void;
}>((set) => ({
  language: "fil",
  scale: 1,
  setLanguage: (language) => set({ language }),
  setScale: (scale) => set({ scale }),
}));
