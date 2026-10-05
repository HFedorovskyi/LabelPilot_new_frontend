"use client";

// Light/dark theme of the admin UI. The class on <html> is set before the first paint
// by the inline script in app/layout.tsx; this hook only reads and toggles it.

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const THEME_KEY = "lp_theme";

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>("light");

    useEffect(() => {
        setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }, []);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            // Private mode or blocked storage: the theme still applies for this visit.
        }
        setThemeState(next);
    }, []);

    const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);
    return { theme, setTheme, toggleTheme };
}
