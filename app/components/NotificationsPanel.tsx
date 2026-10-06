"use client";

// Notification centre (bell in the side menu): «Требует внимания» = open problems,
// «События» = informational events and recently resolved problems. Opening it marks
// everything as read (server side, per user).

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n";
import { notificationText, relativeTime, type NotificationItem, type NotificationsFeed, type Severity } from "@/lib/notifications";

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

export const SEVERITY_STYLE: Record<Severity, { symbol: string; tint: string; ink: string }> = {
  critical: { symbol: "■", tint: "bg-lp-bad-bg", ink: "text-lp-bad" },
  error: { symbol: "■", tint: "bg-lp-bad-bg", ink: "text-lp-bad" },
  warning: { symbol: "▲", tint: "bg-lp-warn-bg", ink: "text-lp-warn" },
  info: { symbol: "●", tint: "bg-lp-accent-bg", ink: "text-lp-accent-ink" },
};

function Row({ item, onOpen }: { item: NotificationItem; onOpen?: (item: NotificationItem) => void }) {
  const { t } = useTranslation();
  const style = SEVERITY_STYLE[item.severity];
  const { title, body } = notificationText(item, t);
  const resolved = item.resolved_at !== null;
  return (
    <div className={cx("flex gap-3 border-b border-lp-line px-4 py-3 last:border-0", resolved && "opacity-70")}>
      <span aria-hidden="true" className={cx("mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[12px] font-black", resolved ? "bg-lp-off-bg text-lp-off" : cx(style.tint, style.ink))}>
        {resolved ? "✓" : style.symbol}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5 text-[14px] font-bold leading-snug text-lp-ink">
          {item.unread && !resolved && <span className="h-1.5 w-1.5 flex-none self-center rounded-full bg-lp-accent" aria-label={t("ntf.unread")} />}
          <span className="min-w-0">{title}</span>
        </span>
        {body && <span className="text-[13px] leading-snug text-lp-ink-2">{body}</span>}
        <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-lp-ink-3">
          <span>{relativeTime(item.last_at, t)}</span>
          {item.count > 1 && <span>· {t("ntf.repeated", { count: item.count })}</span>}
          {resolved && <span>· {t("ntf.resolved")}</span>}
          {item.link_tab && onOpen && (
            <button type="button" onClick={() => onOpen(item)} className="ml-auto border-0 bg-transparent p-0 text-[13px] font-extrabold text-lp-accent-ink hover:underline">
              {t("ntf.open")}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export default function NotificationsPanel({
  open,
  onClose,
  feed,
  anchorRef,
  onOpenItem,
}: {
  open: boolean;
  onClose: () => void;
  feed: NotificationsFeed | null;
  anchorRef: React.RefObject<HTMLElement | null>;
  onOpenItem: (item: NotificationItem) => void;
}) {
  const { t } = useTranslation();
  // Rendered into <body> so it escapes the side menu's stacking context.
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // The bell sits in the side menu: open the panel to its right, top-aligned,
      // clamped so it never spills off-screen.
      const left = Math.max(8, Math.min(r.right + 8, window.innerWidth - 408));
      const top = Math.max(8, Math.min(r.top, window.innerHeight - 160));
      setPos({ top: Math.round(top), left: Math.round(left) });
    };
    compute();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !mounted || !pos) return null;

  const items = feed?.items ?? [];
  const problems = items.filter((n) => n.resolved_at === null && n.severity !== "info");
  const events = items.filter((n) => n.resolved_at !== null || n.severity === "info");
  const openItem = (item: NotificationItem) => {
    onOpenItem(item);
    onClose();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[199]" onClick={onClose} />
      <section
        role="dialog"
        aria-label={t("notif.title")}
        className="fixed z-[200] flex max-h-[min(640px,calc(100vh-16px))] w-[400px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[16px] border border-lp-line bg-lp-surface font-sans shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-center justify-between border-b border-lp-line px-4 py-3">
          <span className="text-[15px] font-extrabold text-lp-ink">{t("notif.title")}</span>
          <button type="button" onClick={onClose} aria-label={t("dashboard.close")} className="flex h-8 w-8 items-center justify-center rounded-[9px] text-lp-ink-3 transition hover:bg-lp-raised hover:text-lp-ink">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="m-0 px-4 py-10 text-center text-[14px] text-lp-ink-3">{t("notif.empty")}</p>
          ) : (
            <>
              <div className="px-4 pb-1 pt-3 text-[12px] font-bold text-lp-ink-3">
                {t("ntf.needsAttention")} {problems.length > 0 && <span className="tabular-nums">· {problems.length}</span>}
              </div>
              {problems.length === 0 ? (
                <p className="m-0 px-4 pb-3 text-[14px] font-bold text-lp-ok">● {t("ntf.allGood")}</p>
              ) : (
                problems.map((item) => <Row key={item.id} item={item} onOpen={openItem} />)
              )}
              {events.length > 0 && (
                <>
                  <div className="border-t border-lp-line px-4 pb-1 pt-3 text-[12px] font-bold text-lp-ink-3">{t("ntf.events")}</div>
                  {events.map((item) => <Row key={item.id} item={item} onOpen={openItem} />)}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>,
    document.body
  );
}
