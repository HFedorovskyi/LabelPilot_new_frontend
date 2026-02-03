"use client";

import React, { useMemo, useState } from "react";
import LabelDesigner from "./components/LabelDesigner";
import ProductCatalog from "./components/catalog/ProductCatalog";
import PackagingManager from "./components/catalog/PackagingManager";
import BarcodeGenerator from "./components/barcodes/BarcodeGenerator";

type TabKey = "labels" | "catalog" | "packaging" | "barcodes" | "users";

type Tab = {
  key: TabKey;
  label: string;
  description: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Icon({
  name,
  className,
}: {
  name: "sparkles" | "tag" | "box" | "barcode" | "users";
  className?: string;
}) {
  const common = "h-5 w-5";
  switch (name) {
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path
            d="M12 2l1.2 4.2L17.4 7.4 13.2 8.6 12 12.8 10.8 8.6 6.6 7.4l4.2-1.2L12 2Z"
            className="fill-current opacity-90"
          />
          <path
            d="M19 11l.8 2.8 2.8.8-2.8.8L19 18l-.8-2.8-2.8-.8 2.8-.8L19 11Z"
            className="fill-current opacity-70"
          />
          <path
            d="M5 13l.7 2.3 2.3.7-2.3.7L5 19l-.7-2.3-2.3-.7 2.3-.7L5 13Z"
            className="fill-current opacity-70"
          />
        </svg>
      );
    case "tag":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path
            d="M12.2 3H6.8A2.8 2.8 0 0 0 4 5.8v5.4a3 3 0 0 0 .9 2.1l6.2 6.2a3 3 0 0 0 4.2 0l4.4-4.4a3 3 0 0 0 0-4.2l-6.2-6.2A3 3 0 0 0 12.2 3Z"
            className="stroke-current"
            strokeWidth="1.6"
          />
          <path d="M8.25 8.25h.01" className="stroke-current" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path d="M21 8.5 12 13 3 8.5M12 13v9" className="stroke-current" strokeWidth="1.6" strokeLinejoin="round" />
          <path
            d="M21 8.5V17a2 2 0 0 1-1.1 1.8l-7.8 3.9a2 2 0 0 1-1.8 0l-7.8-3.9A2 2 0 0 1 2 17V8.5a2 2 0 0 1 1.1-1.8l7.8-3.9a2 2 0 0 1 1.8 0l7.8 3.9A2 2 0 0 1 21 8.5Z"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "barcode":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path
            d="M4 6v12M7 6v12M10 6v12M12 6v12M15 6v12M18 6v12M20 8v8"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path
            d="M16 18.5c0-2 1.6-3.5 3.5-3.5S23 16.5 23 18.5V20h-7v-1.5Z"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" className="stroke-current" strokeWidth="1.6" />
          <path
            d="M1 20v-1.5C1 15.5 3.5 13 6.5 13h3C12.5 13 15 15.5 15 18.5V20H1Z"
            className="stroke-current"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M18.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" className="stroke-current" strokeWidth="1.6" />
        </svg>
      );
  }
}

function Button({
  children,
  onClick,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-white text-neutral-950 hover:bg-white/90"
      : variant === "secondary"
        ? "bg-white/10 text-white hover:bg-white/15 border border-white/10"
        : "text-white/80 hover:text-white hover:bg-white/10";
  return (
    <button onClick={onClick} className={cx(base, styles, className)}>
      {children}
    </button>
  );
}

export default function Home() {
  const tabs: Tab[] = useMemo(
    () => [
      { key: "labels", label: "Дизайнер этикеток", description: "Создание макетов, слои, печать и экспорт." },
      { key: "catalog", label: "Номенклатурная база", description: "Справочник товаров, атрибуты и быстрый поиск." },
      { key: "packaging", label: "Упаковки", description: "Типы упаковок, размеры, привязка к товарам." },
      { key: "barcodes", label: "Штрихкоды", description: "Генерация, просмотр и печать штрихкодов." },
      { key: "users", label: "Пользователи", description: "Управление пользователями (только для админа)." },
    ],
    []
  );

  const [active, setActive] = useState<TabKey>("labels");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  const tabIcon = (key: TabKey) => {
    switch (key) {
      case "labels":
        return "tag";
      case "catalog":
        return "sparkles";
      case "packaging":
        return "box";
      case "barcodes":
        return "barcode";
      case "users":
        return "users";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/15 to-sky-500/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-emerald-400/10 via-cyan-400/10 to-indigo-400/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-neutral-950/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon name="tag" className="text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-white/95">Локальная система этикеток</div>
                <div className="text-xs text-white/60">Дизайн • Номенклатура • Упаковки • Штрихкоды • Доступы</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                Локально • Offline
              </div>
              <Button variant="secondary" onClick={() => setActive("labels")}>
                Открыть дизайнер
              </Button>
              <Button variant="ghost" onClick={() => setActive("users")}>
                Пользователи
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <div role="tablist" aria-label="Разделы приложения" className="flex flex-wrap gap-2">
              {tabs.map((t) => {
                const isActive = t.key === active;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(t.key)}
                    className={cx(
                      "group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-white/20",
                      isActive
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon
                      name={tabIcon(t.key)}
                      className={cx("transition", isActive ? "text-white" : "text-white/70 group-hover:text-white")}
                    />
                    <span className="whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 text-white/70">
                <span className="text-xs uppercase tracking-wider">Раздел</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="text-xs">{activeTab.label}</span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeTab.label}</h1>
              <p className="max-w-2xl text-sm text-white/65 sm:text-base">{activeTab.description}</p>
            </div>

            {active === "labels" ? <LabelDesigner /> : null}
            {active === "catalog" ? <ProductCatalog /> : null}
            {active === "packaging" ? <PackagingManager /> : null}
            {active === "barcodes" ? <BarcodeGenerator /> : null}

            {active === "users" ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-base font-semibold text-white">Пользователи</div>
                <p className="mt-1 text-sm text-white/65">
                  Раздел управления пользователями будет подключён к backend (роль admin) следующим этапом.
                </p>
              </section>
            ) : null}

            <footer className="border-t border-white/10 pt-6 text-xs text-white/50">
              © {new Date().getFullYear()} — Локальная система этикеток (offline).
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
