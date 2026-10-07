"use client";

// Light/dark theme of the admin UI, or "system" to follow the computer's setting. The class
// on <html> is set before the first paint by the inline script in app/layout.tsx (keep the
// two in step); this hook reads and changes it, and follows the system while "system".

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const THEME_KEY = "lp_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemDark(): boolean {
    return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

function applyTheme(theme: Theme) {
    const dark = theme === "dark" || (theme === "system" && systemDark());
    document.documentElement.classList.toggle("dark", dark);
}

function savedTheme(): Theme {
    try {
        const value = localStorage.getItem(THEME_KEY);
        return value === "dark" || value === "system" ? value : "light";
    } catch {
        return "light";
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>("light");

    useEffect(() => {
        setThemeState(savedTheme());
    }, []);

    useEffect(() => {
        if (theme !== "system") return;
        const media = window.matchMedia(DARK_QUERY);
        const follow = () => applyTheme("system");
        media.addEventListener("change", follow);
        return () => media.removeEventListener("change", follow);
    }, [theme]);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            // Private mode or blocked storage: the theme still applies for this visit.
        }
        setThemeState(next);
    }, []);

    return { theme, setTheme };
}
