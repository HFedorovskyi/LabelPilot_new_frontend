"use client";

// Side menu of the redesigned admin UI: a floating glass panel with the sections grouped by
// work scenario, each group with its own icon color, plain names, problem counters, and the
// server/user footer. Pure view — the shell (app/page.tsx) owns navigation state and data;
// search, notifications and the theme live in the top bar (TopBar.tsx).

import React, { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { copyText } from "@/lib/clipboard";

export type NavKey =
    | "home" | "print_tasks" | "stations"
    | "catalog" | "labels" | "packaging" | "barcodes"
    | "operators" | "users"
    | "settings" | "license";

export type NavBadge = { text: string; tone: "bad" | "warn" | "accent" | "plain"; title?: string };

type IconName = NavKey | "search" | "bell" | "logout" | "sun" | "moon" | "monitor" | "check" | "chevron";

const PATHS: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
    print_tasks: <><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>,
    stations: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    catalog: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>,
    labels: <><path d="M3 11.5V4a1 1 0 0 1 1-1h7.5l9.2 9.2a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    packaging: <><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M3 7l2-4h14l2 4M10 11h4" /></>,
    barcodes: <path d="M4 5v14M7.5 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />,
    operators: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
    users: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
    settings: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
    license: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    chevron: <path d="m15 6-6 6 6 6" />,
};

export function NavIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-none ${className}`} aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}

export type NavGroup = "prod" | "what" | "people" | "sys";

const GROUPS: { id: NavGroup; title: string; items: NavKey[] }[] = [
    { id: "prod", title: "nav.groupProduction", items: ["home", "print_tasks", "stations"] },
    { id: "what", title: "nav.groupWhatWePrint", items: ["catalog", "labels", "packaging", "barcodes"] },
    { id: "people", title: "nav.groupPeople", items: ["operators", "users"] },
    { id: "sys", title: "nav.groupSystem", items: ["settings", "license"] },
];

export function groupOf(key: NavKey): NavGroup {
    return GROUPS.find((group) => group.items.includes(key))?.id ?? "sys";
}

/** The icon chip of a menu item: the group's color on a soft tint of it. */
const ICON_CHIP: Record<NavGroup, string> = {
    prod: "bg-lp-g-prod/15 text-lp-g-prod",
    what: "bg-lp-g-what/15 text-lp-g-what",
    people: "bg-lp-g-people/15 text-lp-g-people",
    sys: "bg-lp-g-sys/15 text-lp-g-sys",
};

const BADGE_TONE: Record<NavBadge["tone"], string> = {
    bad: "bg-lp-bad-bg text-lp-bad",
    warn: "bg-lp-warn-bg text-lp-warn",
    accent: "bg-lp-accent-bg text-lp-accent-ink",
    plain: "text-lp-ink-3",
};

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export default function Sidebar({
    active,
    onNavigate,
    hidden,
    badges,
    collapsed,
    onToggleCollapsed,
    serverVersion,
    serverOnline,
    host,
    userName,
    userRole,
    onLogout,
}: {
    active: NavKey;
    onNavigate: (key: NavKey) => void;
    hidden: NavKey[];
    badges: Partial<Record<NavKey, NavBadge>>;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    serverVersion: string | null;
    /** null until the first poll answers. */
    serverOnline: boolean | null;
    host: string;
    userName: string;
    userRole: string;
    onLogout: () => void;
}) {
    const { t } = useTranslation();
    const initials = (userName || "?").slice(0, 2).toUpperCase();
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timer);
    }, [copied]);
    // Opened by IP: labelled as the IP; by name (labelpilot.local): as the address.
    const addressLabel = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) ? t("nav.serverIp") : t("nav.serverAddress");
    const linkLabel = serverOnline === false ? t("nav.offline") : t("nav.online");

    return (
        <aside
            aria-label={t("nav.mainMenu")}
            className={cx(
                "lp-glass relative z-20 m-3 mr-0 flex h-[calc(100vh-24px)] flex-none flex-col rounded-[24px] py-[18px] transition-[width] duration-200",
                collapsed ? "w-[72px] px-2.5" : "w-[248px] px-3.5",
            )}
        >
            <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? t("app.expandMenu") : t("app.collapseMenu")}
                title={collapsed ? t("app.expandMenu") : t("app.collapseMenu")}
                className="absolute -right-3 top-[26px] z-30 flex h-6 w-6 items-center justify-center rounded-full border border-lp-line-2 bg-lp-surface text-lp-ink-3 shadow-sm transition hover:text-lp-ink"
            >
                <NavIcon name="chevron" className={cx("h-3.5 w-3.5", collapsed && "rotate-180")} />
            </button>

            <div className={cx("flex items-center pb-1.5", collapsed ? "justify-center" : "gap-[11px] px-2")}>
                <img src="/icons/logo.svg" alt="" width={36} height={36} className="block h-9 w-9" />
                {!collapsed && (
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[17px] font-extrabold tracking-[-0.015em] text-lp-ink">LabelPilot</span>
                        <span className="text-[12px] font-semibold text-lp-ink-3">{t("nav.server")}</span>
                    </div>
                )}
            </div>
            <div className="mx-2 my-3 flex h-[3px] overflow-hidden rounded-sm" aria-hidden="true">
                <span className="flex-[3] bg-lp-coral" />
                <span className="flex-[2] bg-lp-sky" />
            </div>

            <nav aria-label={t("app.appSections")} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {GROUPS.map((group) => {
                    const items = group.items.filter((key) => !hidden.includes(key));
                    if (items.length === 0) return null;
                    return (
                        <div key={group.id} className="flex flex-col gap-0.5">
                            {collapsed ? (
                                <div className="mx-3 my-2 h-px bg-lp-line" aria-hidden="true" />
                            ) : (
                                <div className="px-2.5 pb-1 pt-3 text-[12px] font-bold text-lp-ink-3">{t(group.title)}</div>
                            )}
                            {items.map((key) => {
                                const current = key === active;
                                const badge = badges[key];
                                const label = t(`nav.${key}`);
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => onNavigate(key)}
                                        aria-current={current ? "page" : undefined}
                                        title={collapsed ? (badge ? `${label} · ${badge.title ?? badge.text}` : label) : undefined}
                                        className={cx(
                                            "relative flex min-h-[42px] items-center rounded-[12px] text-left text-[14px] transition",
                                            collapsed ? "justify-center" : "gap-2.5 px-1.5",
                                            current ? "lp-nav-active font-extrabold text-lp-ink" : "font-semibold text-lp-ink-2 hover:bg-lp-surface/60 hover:text-lp-ink",
                                        )}
                                    >
                                        <span className={cx("flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]", ICON_CHIP[group.id])}>
                                            <NavIcon name={key} className="h-[18px] w-[18px]" />
                                        </span>
                                        {/* Long names («Задания на маркировку», «Etikettieraufträge») take a second line, never «…». */}
                                        {!collapsed && <span className="line-clamp-2 min-w-0 flex-1 hyphens-auto leading-tight">{label}</span>}
                                        {badge && !collapsed && (
                                            <span title={badge.title} className={cx("rounded-full px-2 py-px text-[12px] font-bold tabular-nums", BADGE_TONE[badge.tone])}>
                                                {badge.text}
                                            </span>
                                        )}
                                        {badge && collapsed && badge.tone !== "plain" && (
                                            <span className={cx("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", badge.tone === "bad" ? "bg-lp-bad" : badge.tone === "warn" ? "bg-lp-warn" : "bg-lp-accent")} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            <div className={cx("mt-3 flex flex-col gap-3 border-t border-lp-line pt-3.5", collapsed ? "items-center" : "px-2.5")}>
                {collapsed ? (
                    <span className={cx("h-2 w-2 rounded-full", serverOnline === false ? "bg-lp-bad" : "bg-lp-ok")} title={`${addressLabel} ${host} · ${linkLabel}${serverVersion ? ` · ${serverVersion}` : ""}`} />
                ) : (
                    <dl className="m-0 flex flex-col gap-2 rounded-[14px] border border-lp-line bg-lp-raised px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <dt className="text-[12px] font-bold text-lp-ink-3">{addressLabel}</dt>
                                <span className={cx("ml-auto flex items-center gap-1.5 rounded-full px-2 py-px text-[11px] font-extrabold", serverOnline === false ? "bg-lp-bad-bg text-lp-bad" : "bg-lp-ok-bg text-lp-ok")}>
                                    <span className={cx("h-1.5 w-1.5 rounded-full", serverOnline === false ? "bg-lp-bad" : "bg-lp-ok")} aria-hidden="true" />
                                    {linkLabel}
                                </span>
                            </div>
                            <dd className="m-0 flex items-center gap-1.5">
                                <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-lp-ink">{host}</span>
                                <button
                                    type="button"
                                    onClick={async () => setCopied(await copyText(host))}
                                    aria-label={t("nav.copyAddress")}
                                    title={copied ? t("nav.addressCopied") : t("nav.copyAddress")}
                                    className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-[7px] text-lp-ink-3 transition hover:bg-lp-surface hover:text-lp-ink"
                                >
                                    {copied ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-lp-ok" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                                    )}
                                </button>
                            </dd>
                        </div>
                        <div className="h-px bg-lp-line" />
                        <div className="flex items-center gap-2">
                            <dt className="text-[12px] font-bold text-lp-ink-3">{t("nav.serverVersion")}</dt>
                            <dd className="m-0 ml-auto font-mono text-[13px] font-semibold tabular-nums text-lp-ink">{serverVersion ?? "…"}</dd>
                        </div>
                    </dl>
                )}
                <div className={cx("flex items-center", collapsed ? "flex-col gap-2" : "gap-2.5")}>
                    <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-lp-coral-bg text-[12px] font-extrabold text-lp-coral" title={collapsed ? `${userName} · ${userRole}` : undefined}>
                        {initials}
                    </div>
                    {!collapsed && (
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="truncate text-[14px] font-bold text-lp-ink">{userName || "—"}</span>
                            <span className="text-[12px] text-lp-ink-3">{userRole}</span>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onLogout}
                        aria-label={t("app.logout")}
                        title={t("app.logout")}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] text-lp-ink-3 transition hover:bg-lp-bad-bg hover:text-lp-bad"
                    >
                        <NavIcon name="logout" className="h-[18px] w-[18px]" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
