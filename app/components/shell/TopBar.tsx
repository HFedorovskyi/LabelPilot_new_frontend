"use client";

// Top bar of the shell: the command bar (search and go, Ctrl K), an available server update,
// notifications and the theme (light, dark or as the computer is set). Glass, like the menu.

import React, { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { NavIcon } from "./Sidebar";

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

const THEMES: { id: Theme; icon: "sun" | "moon" | "monitor"; label: string }[] = [
    { id: "light", icon: "sun", label: "nav.themeLight" },
    { id: "dark", icon: "moon", label: "nav.themeDark" },
    { id: "system", icon: "monitor", label: "nav.themeSystem" },
];

const chrome = "lp-glass flex items-center justify-center rounded-[14px] text-lp-ink-2 transition hover:text-lp-ink";

export default function TopBar({
    onSearch,
    bellRef,
    unread,
    unreadSevere,
    onBell,
    update,
    onUpdate,
}: {
    onSearch: () => void;
    bellRef: React.RefObject<HTMLButtonElement | null>;
    unread: number;
    /** Any unread critical/error item (red badge); otherwise only warnings (amber). */
    unreadSevere: boolean;
    onBell: () => void;
    update: string | null;
    onUpdate: () => void;
}) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [themeOpen, setThemeOpen] = useState(false);
    const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];

    return (
        <div className="mb-5 flex items-center gap-2.5">
            <button
                type="button"
                onClick={onSearch}
                className="lp-glass flex min-h-[44px] w-full max-w-[460px] items-center gap-2.5 rounded-[14px] px-3.5 text-left text-[14px] text-lp-ink-3 transition hover:text-lp-ink-2"
            >
                <NavIcon name="search" className="h-[18px] w-[18px]" />
                <span className="min-w-0 flex-1 truncate">{t("app.commandBar")}</span>
                <kbd className="rounded-[6px] border border-lp-line-2 px-1.5 py-px font-mono text-[11px] text-lp-ink-3">Ctrl K</kbd>
            </button>
            <span className="flex-1" />
            {update && (
                <button type="button" onClick={onUpdate} className="lp-glass flex min-h-[44px] items-center gap-2 rounded-[14px] px-3.5 text-[13px] font-extrabold text-lp-warn">
                    <span aria-hidden="true">▲</span>
                    {t("app.updateTo", { version: update })}
                </button>
            )}
            <button
                ref={bellRef}
                type="button"
                onClick={onBell}
                aria-label={t("app.notifications")}
                title={t("app.notifications")}
                className={cx(chrome, "relative h-11 w-11")}
            >
                <NavIcon name="bell" className="h-[19px] w-[19px]" />
                {unread > 0 && (
                    <span className={cx("absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-[#fff] ring-2 ring-lp-surface", unreadSevere ? "bg-lp-bad" : "bg-lp-warn")}>
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setThemeOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={themeOpen}
                    aria-label={`${t("nav.theme")}: ${t(current.label)}`}
                    title={t("nav.theme")}
                    className={cx(chrome, "h-11 w-11")}
                >
                    <NavIcon name={current.icon} className="h-[19px] w-[19px]" />
                </button>
                {themeOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setThemeOpen(false)} />
                        <div role="menu" aria-label={t("nav.theme")} className="lp-card absolute right-0 top-[52px] z-40 flex min-w-[210px] flex-col p-1.5">
                            {THEMES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={theme === item.id}
                                    onClick={() => {
                                        setTheme(item.id);
                                        setThemeOpen(false);
                                    }}
                                    className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] font-bold text-lp-ink transition hover:bg-lp-raised"
                                >
                                    <NavIcon name={item.icon} className="h-[18px] w-[18px] text-lp-ink-3" />
                                    <span className="flex-1">{t(item.label)}</span>
                                    {theme === item.id && <NavIcon name="check" className="h-[18px] w-[18px] text-lp-accent-ink" />}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
