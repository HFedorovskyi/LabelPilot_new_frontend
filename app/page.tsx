"use client";

import React, { useEffect, useMemo, useState } from "react";
import LabelDesigner from "./components/LabelDesigner";
import ProductCatalog from "./components/catalog/ProductCatalog";
import PackagingManager from "./components/catalog/PackagingManager";
import BarcodeTemplatesManager from "./components/barcodes/BarcodeTemplatesManager";
import StationsPage from "./stations/page";
import SettingsPage from "./components/settings/SettingsPage";
import PrintJobsManager from "./components/print_jobs/PrintJobsManager";
import Dashboard from "./components/home/Dashboard";
import DemoBanner from "./components/DemoBanner";

const APP_VERSION = "1.0.3";

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

  const [host, setHost] = useState("localhost:8000");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(`${window.location.hostname}:8000`);
    }
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const s = typeof window !== "undefined" ? window.localStorage.getItem("lp_sidebar_collapsed") : null;
    if (s !== null) setCollapsed(s === "1");
  }, []);
  useEffect(() => {
    // Дизайнеру этикеток нужно максимум места — авто-сворачиваем меню при входе в него
    if (active === "labels") setCollapsed(true);
  }, [active]);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      if (typeof window !== "undefined") window.localStorage.setItem("lp_sidebar_collapsed", v ? "0" : "1");
      return !v;
    });

  const navLabel = (key: TabKey) => {
    switch (key) {
      case "home":
        return "Главная";
      case "print_tasks":
        return "Печать";
      case "catalog":
        return "Номенклатура";
      default:
        return tabs.find((t) => t.key === key)?.label ?? "";
    }
  };

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
    <div className="relative flex h-screen overflow-hidden bg-[#06070b] text-white font-[family-name:var(--font-geist-sans)]">
      {/* Атмосферный фон: световые пятна + техническая сетка */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full blur-[80px]" style={{ background: "rgba(99,102,241,0.13)" }} />
        <div className="absolute bottom-[-120px] left-[120px] h-[360px] w-[360px] rounded-full blur-[80px]" style={{ background: "rgba(217,70,239,0.06)" }} />
        <div className="absolute right-[-110px] top-10 h-[320px] w-[320px] rounded-full blur-[80px]" style={{ background: "rgba(34,211,238,0.045)" }} />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
      </div>

      {/* Боковое меню */}
      <aside
        className={cx(
          "relative z-20 flex flex-none flex-col border-r border-white/[0.08] bg-white/[0.045] py-[18px] backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-[68px] px-2.5" : "w-[236px] px-3.5"
        )}
      >
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          title={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className="absolute -right-3 top-[26px] z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#0d0e13] text-white/55 transition hover:border-white/30 hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={cx("flex items-center pb-[18px]", collapsed ? "justify-center" : "gap-[11px] px-1")}>
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-indigo-400/[0.16] text-indigo-300 ring-1 ring-indigo-400/30"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)" }}
          >
            <img src="/icons/logo.svg" alt="LabelPilot" className="h-6 w-6 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-[17px] font-extrabold tracking-tight">
                Label<span className="text-indigo-400">Pilot</span>
              </div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-white/35 font-[family-name:var(--font-geist-mono)]">
                Industrial Labeling
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-2 pb-2 text-[9px] uppercase tracking-[0.14em] text-white/30 font-[family-name:var(--font-geist-mono)]">
            Навигация
          </div>
        )}
        <nav role="tablist" aria-label="Разделы приложения" className="flex flex-col gap-[3px]">
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                title={collapsed ? navLabel(t.key) : undefined}
                className={cx(
                  "group relative flex items-center rounded-xl border text-[13px] outline-none transition-all focus:ring-2 focus:ring-indigo-500/40",
                  collapsed ? "justify-center py-[10px]" : "gap-3 px-[11px] py-[9px]",
                  isActive
                    ? "border-indigo-400/40 bg-indigo-400/[0.13] text-indigo-200"
                    : "border-transparent text-white/55 hover:bg-white/[0.04] hover:text-white"
                )}
                style={isActive ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" } : undefined}
              >
                {isActive && (
                  <span className="absolute -left-px bottom-2 top-2 w-[2.5px] rounded bg-indigo-400/80" />
                )}
                <Icon
                  name={tabIcon(t.key)}
                  className={cx("h-[18px] w-[18px] flex-none", isActive ? "text-indigo-300" : "text-white/45 group-hover:text-indigo-300")}
                />
                {!collapsed && <span className="whitespace-nowrap">{navLabel(t.key)}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-[10px] pt-4">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <span
                className="h-[9px] w-[9px] rounded-full bg-emerald-400"
                title={`Сервер онлайн · ${host}`}
                style={{ boxShadow: "none" }}
              />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400/20 text-[12px] text-indigo-200 ring-1 ring-indigo-400/30" title="Администратор">
                Н
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-[10px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-[7px] text-[12px] text-white/75">
                    <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" style={{ boxShadow: "none" }} />
                    Сервер онлайн
                  </span>
                  <span className="text-[10px] text-white/40 font-[family-name:var(--font-geist-mono)]">v{APP_VERSION}</span>
                </div>
                <div className="mt-[5px] text-[10px] text-white/35 font-[family-name:var(--font-geist-mono)]">{host}</div>
              </div>
              <div className="flex items-center gap-[10px] px-1 pt-1">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-indigo-400/20 text-[12px] text-indigo-200 ring-1 ring-indigo-400/30">
                  Н
                </div>
                <div className="leading-tight">
                  <div className="text-[12.5px] text-white">Администратор</div>
                  <div className="text-[10.5px] text-white/40">Полный доступ</div>
                </div>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" className="ml-auto text-white/35" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Основная колонка */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Демо-режим: ненавязчивый баннер о лицензии (показывается только когда mode === "demo") */}
        <DemoBanner onActivate={() => setActive("settings")} />
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.045] px-[18px] py-[13px] backdrop-blur-xl">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">{activeTab.label}</div>
            <div className="text-[11.5px] text-white/45">{activeTab.description}</div>
          </div>
          <div className="flex items-center gap-[9px]">
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-[9px] py-[6px] text-white/40 sm:flex">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="text-[12px]">Поиск</span>
              <span className="rounded border border-white/15 px-[5px] py-px text-[10px] font-[family-name:var(--font-geist-mono)]">⌘K</span>
            </div>
            <button
              onClick={() => setActive("settings")}
              className="inline-flex items-center gap-[6px] rounded-lg border border-indigo-400/30 bg-indigo-400/[0.13] px-[10px] py-[6px] text-[11.5px] text-indigo-200 transition hover:bg-indigo-400/20"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 16V8m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Обновления
            </button>
            <button aria-label="Уведомления" className="text-white/45 transition hover:text-white">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto px-[18px] py-4">
          <div className="flex flex-col gap-6">
            {active === "home" ? <Dashboard /> : null}
            {active === "labels" ? <LabelDesigner /> : null}
            {active === "catalog" ? <ProductCatalog /> : null}
            {active === "packaging" ? <PackagingManager /> : null}
            {active === "barcodes" ? <BarcodeTemplatesManager /> : null}
            {active === "print_tasks" ? <PrintJobsManager /> : null}
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

            <footer className="border-t border-white/10 pt-6 text-xs text-white/40">
              © {new Date().getFullYear()} — Локальная система этикеток (offline).
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
