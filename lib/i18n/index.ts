"use client";

// Lightweight client-side i18n for the static-export admin UI. Mirrors the desktop
// client's pattern: language is persisted in localStorage and a window 'lang-changed'
// event re-renders every component that uses useTranslation() — no context provider
// needed. Missing keys fall back to ru (the source language), then to the key itself.

import { useCallback, useEffect, useState } from "react";
import { translations, type Lang } from "./translations";

export type { Lang };
export const LANGS: Lang[] = ["ru", "en", "de", "uk"];
export const LANG_LABELS: Record<Lang, string> = {
    ru: "🇷🇺 Русский",
    en: "🇬🇧 English",
    de: "🇩🇪 Deutsch",
    uk: "🇺🇦 Українська",
};

const LANG_KEY = "labelpilot_language";

/** The language chosen here; before any choice the browser's language, else English — an EU
 *  customer meets the sign-in (and the first-run screen) before they could pick one. */
export function getSavedLang(): Lang {
    if (typeof window === "undefined") return "ru";
    let saved: string | null = null;
    try {
        saved = localStorage.getItem(LANG_KEY);
    } catch {
        // blocked storage: fall through to the browser's language
    }
    if (saved && LANGS.includes(saved as Lang)) return saved as Lang;
    for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
        const code = (tag || "").slice(0, 2).toLowerCase() as Lang;
        if (LANGS.includes(code)) return code;
    }
    return "en";
}

export function saveLang(lang: Lang): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANG_KEY, lang);
    window.dispatchEvent(new Event("lang-changed"));
}

/** Resolve a key for a given language with {param} interpolation. undefined params render as "". */
export function translate(key: string, lang: Lang, params?: Record<string, string | number | undefined>): string {
    let text = translations[lang]?.[key] ?? translations.ru?.[key] ?? key;
    if (params) {
        for (const p of Object.keys(params)) text = text.split(`{${p}}`).join(String(params[p] ?? ""));
    }
    return text;
}

/** Hook: returns the current language, a setter, and a bound t() that re-renders on change. */
export function useTranslation() {
    const [lang, setLangState] = useState<Lang>("ru");

    useEffect(() => {
        // The document speaks the chosen language too: screen readers and hyphenation of long
        // menu names («Etikettieraufträge») follow it.
        const handler = () => {
            const current = getSavedLang();
            document.documentElement.lang = current;
            setLangState(current);
        };
        handler();
        window.addEventListener("lang-changed", handler);
        return () => window.removeEventListener("lang-changed", handler);
    }, []);

    const setLang = useCallback((l: Lang) => saveLang(l), []);
    const t = useCallback(
        (key: string, params?: Record<string, string | number | undefined>) => translate(key, lang, params),
        [lang]
    );
    return { t, lang, setLang };
}
