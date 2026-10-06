"use client";

// Pop-ups for critical problems and errors the moment they appear (bottom right).
// Errors close themselves after a while; critical ones stay until dismissed.

import React, { useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n";
import { notificationText, type NotificationItem } from "@/lib/notifications";
import { SEVERITY_STYLE } from "./NotificationsPanel";

const ERROR_TOAST_MS = 12_000;

function Toast({ item, onClose, onOpen }: { item: NotificationItem; onClose: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  const style = SEVERITY_STYLE[item.severity];
  const { title, body } = notificationText(item, t);

  // The parent re-renders on every poll: keep the timer tied to this toast, not to the callback.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (item.severity === "critical") return;
    const id = setTimeout(() => close.current(), ERROR_TOAST_MS);
    return () => clearTimeout(id);
  }, [item.id, item.last_at, item.severity]);

  return (
    <div role="alert" className="pointer-events-auto flex w-[380px] max-w-[calc(100vw-24px)] gap-3 rounded-[14px] border border-lp-line bg-lp-surface p-3.5 font-sans shadow-2xl">
      <span aria-hidden="true" className={`flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-[13px] font-black ${style.tint} ${style.ink}`}>
        {style.symbol}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-[12px] font-extrabold ${style.ink}`}>{t(`ntf.severity.${item.severity}`)}</span>
        <span className="text-[14px] font-extrabold leading-snug text-lp-ink">{title}</span>
        {body && <span className="text-[13px] leading-snug text-lp-ink-2">{body}</span>}
        <div className="mt-1 flex items-center gap-3">
          {item.link_tab && (
            <button type="button" onClick={onOpen} className="min-h-[34px] rounded-[9px] bg-lp-accent px-3 text-[13px] font-extrabold text-[#fff] transition hover:brightness-110">
              {t("ntf.open")}
            </button>
          )}
          <button type="button" onClick={onClose} className="border-0 bg-transparent p-0 text-[13px] font-bold text-lp-ink-3 hover:text-lp-ink">
            {t("ntf.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationToasts({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: NotificationItem[];
  onDismiss: (id: number) => void;
  onOpen: (item: NotificationItem) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div aria-live="assertive" className="pointer-events-none fixed bottom-4 right-4 z-[210] flex flex-col items-end gap-2.5">
      {toasts.map((item) => (
        <Toast
          key={`${item.id}:${item.last_at}`}
          item={item}
          onClose={() => onDismiss(item.id)}
          onOpen={() => {
            onOpen(item);
            onDismiss(item.id);
          }}
        />
      ))}
    </div>
  );
}
