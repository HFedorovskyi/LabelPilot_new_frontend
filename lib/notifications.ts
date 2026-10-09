"use client";

// Notification feed of the admin UI: polled every 10 s; critical and error items raised
// since the previous poll pop up once as toasts. Text is rendered here from the server's
// `code` + `params` in the viewer's language (keys ntf.<code>.title / .body).

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";

export type Severity = "critical" | "error" | "warning" | "info";

export type NotificationItem = {
    id: number;
    code: string;
    severity: Severity;
    params: Record<string, string | number | null>;
    link_tab: string;
    link_id: string;
    count: number;
    first_at: string;
    last_at: string;
    resolved_at: string | null;
    unread: boolean;
};

export type NotificationsFeed = {
    items: NotificationItem[];
    unread: { critical: number; error: number; warning: number; total: number };
    toasts: NotificationItem[];
    seen_at: string | null;
    server_time: string;
};

const POLL_MS = 10_000;
const MAX_TOASTS = 3;
const BASE_TITLE = "LabelPilot Server";

type T = (key: string, params?: Record<string, string | number | undefined>) => string;

/** Minutes/hours/days since an ISO time, using the shared dashboard wording. */
export function relativeTime(iso: string | null | undefined, t: T): string {
    if (!iso) return "";
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return t("dashboard.relJustNow");
    if (minutes < 60) return t("dashboard.relMinsAgo", { mins: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("dashboard.relHrsAgo", { hrs: hours });
    return t("dashboard.relDaysAgo", { days: Math.floor(hours / 24) });
}

function durationSince(iso: string | null | undefined, t: T): string {
    if (!iso) return "";
    const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return t("stp.minutes", { n: minutes });
    const hours = Math.round(minutes / 60);
    return hours < 48 ? t("stp.hours", { n: hours }) : t("stp.days", { n: Math.round(hours / 24) });
}

/** Title and body of a notification in the current language. */
export function notificationText(item: NotificationItem, t: T): { title: string; body: string } {
    const p = item.params ?? {};
    const params: Record<string, string | number | undefined> = {};
    for (const [key, value] of Object.entries(p)) params[key] = value == null ? "" : value;
    if (typeof p.component === "string") {
        const label = t(`ntf.component.${p.component}`);
        params.component = label.startsWith("ntf.component.") ? p.component : label;
    }
    if (typeof p.since === "string") params.duration = durationSince(p.since, t);
    if (typeof p.last === "string") params.last = new Date(p.last).toLocaleDateString();
    if (p.unit) params.unit = p.unit === "kg" ? t("dashboard.unitKg") : t("dashboard.unitPcs");
    const title = t(`ntf.${item.code}.title`, params);
    const body = t(`ntf.${item.code}.body`, params);
    return { title, body: body === `ntf.${item.code}.body` ? "" : body };
}

export function useNotifications() {
    const [feed, setFeed] = useState<NotificationsFeed | null>(null);
    const [toasts, setToasts] = useState<NotificationItem[]>([]);
    const since = useRef<string | null>(null);
    // Reachability for the menu: two failed polls in a row (~20 s) mean the server is gone;
    // one alone may be a restart.
    const [online, setOnline] = useState<boolean | null>(null);
    const failures = useRef(0);

    const load = useCallback(async () => {
        try {
            const data: NotificationsFeed = await api.notifications(since.current ?? undefined);
            // The first load only sets the baseline: old problems are in the list, not popped up.
            if (since.current !== null && data.toasts.length > 0) {
                setToasts((current) => {
                    const known = new Set(current.map((n) => `${n.id}:${n.last_at}`));
                    const fresh = data.toasts.filter((n) => !known.has(`${n.id}:${n.last_at}`));
                    return [...current, ...fresh].slice(-MAX_TOASTS);
                });
            }
            since.current = data.server_time;
            setFeed(data);
            failures.current = 0;
            setOnline(true);
        } catch {
            failures.current += 1;
            if (failures.current >= 2) setOnline(false);
            // Signed out or server restarting: keep the last feed, try again next poll.
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    useEffect(() => {
        const total = feed?.unread.total ?? 0;
        document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
    }, [feed?.unread.total]);

    const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((n) => n.id !== id)), []);

    const markSeen = useCallback(async () => {
        try {
            await api.notificationsSeen();
            await load();
        } catch {
            // Not fatal: the badge stays until the next successful attempt.
        }
    }, [load]);

    return { feed, toasts, dismissToast, markSeen, refresh: load, online };
}
