"use client";

import React, { useMemo, useState } from "react";
import LabelDesigner from "./components/LabelDesigner";
import ProductCatalog from "./components/catalog/ProductCatalog";
import PackagingManager from "./components/catalog/PackagingManager";
import BarcodeTemplatesManager from "./components/barcodes/BarcodeTemplatesManager";
import StationsPage from "./stations/page";
import SettingsPage from "./components/settings/SettingsPage";

type TabKey = "home" | "labels" | "catalog" | "packaging" | "barcodes" | "print_tasks" | "users" | "stations" | "settings";

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
  name: "home" | "sparkles" | "tag" | "box" | "barcode" | "printer" | "users" | "server" | "settings";
  className?: string;
}) {
  const common = "h-5 w-5";
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" className="stroke-current" strokeWidth="1.6" />
          <path d="M9 22V12h6v10" className="stroke-current" strokeWidth="1.6" />
        </svg>
      );
    case "printer":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" className="stroke-current" strokeWidth="1.6" />
          <path d="M6 14h12v8H6v-8z" className="stroke-current" strokeWidth="1.6" />
        </svg>
      );
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
    case "server":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path d="M4 4h16v6H4zM4 14h16v6H4z" className="stroke-current" strokeWidth="1.6" />
          <path d="M7 7h.01M7 17h.01" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)} aria-hidden="true">
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            className="stroke-current"
            strokeWidth="1.6"
          />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            className="stroke-current"
            strokeWidth="1.6"
          />
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
      { key: "home", label: "Главная страница", description: "Обзор системы, аналитика и быстрые действия." },
      { key: "labels", label: "Дизайнер этикеток", description: "Создание макетов, слои, печать и экспорт." },
      { key: "catalog", label: "Номенклатурная база", description: "Справочник товаров, атрибуты и быстрый поиск." },
      { key: "packaging", label: "Упаковки", description: "Типы упаковок, размеры, привязка к товарам." },
      { key: "barcodes", label: "Штрихкоды", description: "Генерация, просмотр и печать штрихкодов." },
      { key: "print_tasks", label: "Задание на печать", description: "Управление текущими очередями и заданиями на печать." },
      { key: "stations", label: "Станции", description: "Управление станциями маркировки." },
      { key: "users", label: "Пользователи", description: "Управление пользователями (только для админа)." },
      { key: "settings", label: "Настройки", description: "Обновления системы, версии и конфигурация." },
    ],
    []
  );

  const [active, setActive] = useState<TabKey>("home");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  const tabIcon = (key: TabKey) => {
    switch (key) {
      case "home":
        return "home";
      case "labels":
        return "tag";
      case "catalog":
        return "sparkles";
      case "packaging":
        return "box";
      case "barcodes":
        return "barcode";
      case "print_tasks":
        return "printer";
      case "stations":
        return "server";
      case "users":
        return "users";
      case "settings":
        return "settings";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/15 to-sky-500/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-emerald-400/10 via-cyan-400/10 to-indigo-400/10 blur-3xl" />
      </div>

      <header className="relative z-50 border-b border-white/10 bg-neutral-950/90 backdrop-blur sticky top-0">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-inner">
                <img src="/icons/logo.svg" alt="LabelPilot Logo" className="h-10 w-10 object-contain" />
              </div>
              <div className="flex flex-col">
                <div className="text-3xl font-extrabold tracking-tight text-white font-[family-name:var(--font-geist-sans)]">
                  Label<span className="text-indigo-400">Pilot</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                  Industrial Labeling System
                </div>
              </div>
            </div>

            <nav role="tablist" aria-label="Разделы приложения" className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/5">
              {tabs.map((t) => {
                const isActive = t.key === active;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(t.key)}
                    className={cx(
                      "group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500/50",
                      isActive
                        ? "bg-white text-neutral-950 shadow-[0_4px_20px_rgba(255,255,255,0.15)] scale-[1.02]"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon
                      name={tabIcon(t.key)}
                      className={cx("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-neutral-950" : "text-white/40 group-hover:text-indigo-400")}
                    />
                    <span className="whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <div className="mx-auto px-3 py-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">

              <p className="max-w-2xl text-sm text-white/65 sm:text-base">{activeTab.description}</p>
            </div>

            {active === "labels" ? <LabelDesigner /> : null}
            {active === "catalog" ? <ProductCatalog /> : null}
            {active === "packaging" ? <PackagingManager /> : null}
            {active === "barcodes" ? <BarcodeTemplatesManager /> : null}
            {active === "stations" ? <StationsPage /> : null}
            {active === "settings" ? <SettingsPage /> : null}

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
    </div >
  );
}
