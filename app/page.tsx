"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import LabelDesigner from "./components/LabelDesigner";
import ProductsPage from "./components/catalog/ProductsPage";
import { mayLeave } from "@/lib/navGuard";
import PackagingPage from "./components/catalog/PackagingPage";
import BarcodesPage from "./components/barcodes/BarcodesPage";
import StationsPage from "./components/stations/StationsPage";
import SettingsPage from "./components/settings/SettingsPage";
import PrintPage from "./components/print/PrintPage";
import Dashboard from "./components/home/Dashboard";
import DemoBanner from "./components/DemoBanner";
import UsersManager from "./components/users/UsersManager";
import OperatorsPage from "./components/operators/OperatorsPage";
import Sidebar, { type NavBadge, type NavKey } from "./components/shell/Sidebar";
import TopBar from "./components/shell/TopBar";
import PageTitle from "./components/shell/PageTitle";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import { LoginScreen, BootstrapScreen } from "./components/auth/AuthScreens";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { apiHost } from "@/lib/api/base";
import { licenseApi } from "@/lib/api/license";
import { attentionCount, type Station } from "@/lib/stations";
import { isNewerVersion } from "@/lib/version";
import SearchModal from "./components/SearchModal";
import NotificationsPanel from "./components/NotificationsPanel";
import NotificationToasts from "./components/NotificationToasts";
import { useNotifications, type NotificationItem } from "@/lib/notifications";
import ErrorBoundary from "./components/ErrorBoundary";

const roleLabel = (t: (key: string) => string, role: string | undefined): string => {
  switch (role) {
    case "admin":
      return t("app.roleAdmin");
    case "manager":
      return t("app.roleManager");
    default:
      return role ?? "";
  }
};

// Redesigned screens render their own page header; the others get the shared one.
const OWN_HEADER: NavKey[] = ["home", "stations", "print_tasks", "catalog", "labels", "packaging", "barcodes", "operators"];

function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === "admin";
  // «Доступ к серверу» (server users) is admin-only — the server enforces it, this hides the UI.
  const hidden: NavKey[] = isAdmin ? [] : ["users"];

  const [active, setActiveTab] = useState<NavKey>("home");
  // A page with unsaved changes (a product being edited) may hold the switch.
  const setActive = useCallback((tab: NavKey) => {
    if (mayLeave()) setActiveTab(tab);
  }, []);
  useEffect(() => {
    if (active === "users" && !isAdmin) setActive("home");
  }, [active, isAdmin]);

  const [host, setHost] = useState(() => apiHost("localhost"));
  useEffect(() => {
    // Show the server's real LAN IP (the address stations connect to), not the browser
    // host — which is "localhost" when the admin opens the UI on the server itself.
    let alive = true;
    setHost(apiHost());
    api.stations.getServerIp()
      .then((d: { ip?: string }) => { if (alive && d?.ip) setHost(apiHost(d.ip)); })
      .catch(() => { });
    return () => { alive = false; };
  }, []);

  // ── global search (Ctrl K) + notifications ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notifications = useNotifications();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live server version for the menu (must match backend VERSION, not a frontend constant).
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.version()
      .then((d) => { if (alive && d?.server_version) setServerVersion(String(d.server_version).trim()); })
      .catch(() => { if (alive) setServerVersion(null); });
    return () => { alive = false; };
  }, []);

  // ── available-update check (updater service on :9000; reachable from the server's own browser) ──
  // Prefer 127.0.0.1 over "localhost" so we don't hit a different stack via IPv6.
  const [updateAvail, setUpdateAvail] = useState<{ version: string; publishedAt: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => {
      try {
        const signal = (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) ? AbortSignal.timeout(4000) : undefined;
        fetch("http://127.0.0.1:9000/check", signal ? { signal } : undefined)
          .then((r) => r.json())
          .then((d: any) => {
            if (!alive) return;
            // Trust updater's available flag, but also require the candidate to be a real version string.
            setUpdateAvail(d?.available && d?.version
              ? { version: String(d.version).trim(), publishedAt: d.published_at || null }
              : null);
          })
          .catch(() => { if (alive) setUpdateAvail(null); });
      } catch { if (alive) setUpdateAvail(null); }
    };
    check();
    const id = setInterval(check, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // The server checks for updates too (notification "update.server"), so the chip also
  // shows on admin PCs that cannot reach the updater on the server machine.
  const serverUpdate = notifications.feed?.items.find((n) => n.code === "update.server" && n.resolved_at === null);
  const candidate = updateAvail?.version ?? (serverUpdate ? String(serverUpdate.params.version ?? "") : "");
  // Hide the "update available" chrome when the live server version already matches/exceeds
  // the candidate (e.g. dual Docker+native installs, or VERSION file lag on the updater side).
  const effectiveUpdate = candidate && isNewerVersion(candidate, serverVersion) ? candidate : null;

  const unread = notifications.feed?.unread;
  const notifUnread = unread?.total ?? 0;
  const notifSevere = (unread?.critical ?? 0) + (unread?.error ?? 0) > 0;
  // Read = seen when the list is closed, so new items stay marked while the user reads them.
  const toggleNotif = () => {
    if (notifOpen) void notifications.markSeen();
    setNotifOpen((o) => !o);
  };
  const closeNotif = () => {
    setNotifOpen(false);
    void notifications.markSeen();
  };
  const openNotification = (item: NotificationItem) => {
    if (item.link_tab) setActive(item.link_tab as NavKey);
  };

  // ── menu counters: stations that need a decision, jobs that did not go out, seats in use ──
  const [stationProblems, setStationProblems] = useState(0);
  const [jobErrors, setJobErrors] = useState(0);
  const [seats, setSeats] = useState<{ active: number; limit: number | null } | null>(null);
  const [noTemplate, setNoTemplate] = useState(0);
  const loadNoTemplate = useCallback(() => {
    api.nomenclature.list({ no_template: true }).then((list: unknown[]) => setNoTemplate(list.length)).catch(() => { });
  }, []);
  const loadJobErrors = useCallback(() => {
    api.printJobs.list({ status: "error" }).then((list) => setJobErrors(list.length)).catch(() => { });
  }, []);
  useEffect(() => {
    const load = () => {
      api.stations.list()
        .then((list: Station[]) => setStationProblems(attentionCount(list)))
        .catch(() => { });
      licenseApi.get()
        .then((info) => setSeats(info.seats ? { active: info.seats.active, limit: info.seats.limit } : null))
        .catch(() => { });
      loadJobErrors();
      loadNoTemplate();
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [loadJobErrors, loadNoTemplate]);
  const badges: Partial<Record<NavKey, NavBadge>> = {};
  if (stationProblems > 0) badges.stations = { text: String(stationProblems), tone: "bad", title: t("nav.stationsBadge", { count: stationProblems }) };
  if (noTemplate > 0) badges.catalog = { text: String(noTemplate), tone: "warn", title: t("nav.catalogBadge", { count: noTemplate }) };
  if (jobErrors > 0) badges.print_tasks = { text: String(jobErrors), tone: "bad", title: t("nav.printBadge", { count: jobErrors }) };
  if (seats && seats.limit != null) badges.license = { text: `${seats.active}/${seats.limit}`, tone: "plain", title: t("nav.licenseBadge") };

  const [collapsed, setCollapsed] = useState(false);
  // The label editor takes the whole content area: no top bar, no footer.
  const [labelsEditing, setLabelsEditing] = useState(false);
  const fullBleed = active === "labels" && labelsEditing;
  useEffect(() => {
    // On a narrow window the full menu would cover the page: it starts folded there and
    // folds when the window gets narrow; the remembered choice applies to wide windows.
    const narrow = () => window.innerWidth < 900;
    const s = window.localStorage.getItem("lp_sidebar_collapsed");
    setCollapsed(narrow() || s === "1");
    let wasNarrow = narrow();
    const onResize = () => {
      if (narrow() && !wasNarrow) setCollapsed(true);
      wasNarrow = narrow();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  return (
    <div className="lp-mesh flex h-screen overflow-hidden font-sans text-lp-ink">
      <Sidebar
        active={active}
        onNavigate={setActive}
        hidden={hidden}
        badges={badges}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        serverVersion={serverVersion}
        host={host}
        userName={user?.username ?? ""}
        userRole={roleLabel(t, user?.role)}
        onLogout={() => void logout()}
      />
      <NotificationsPanel open={notifOpen} onClose={closeNotif} feed={notifications.feed} anchorRef={bellRef} onOpenItem={openNotification} />
      <NotificationToasts toasts={notifications.toasts} onDismiss={notifications.dismissToast} onOpen={openNotification} />
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(tab) => setActive(tab as NavKey)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Демо-режим: ненавязчивый баннер о лицензии (показывается только когда mode === "demo") */}
        <DemoBanner onActivate={() => setActive("license")} />
        <main className={fullBleed ? "relative flex-1 overflow-hidden p-3" : "relative flex-1 overflow-y-auto px-6 pb-10 pt-3"}>
          {!fullBleed && <TopBar
            onSearch={() => setSearchOpen(true)}
            bellRef={bellRef}
            unread={notifUnread}
            unreadSevere={notifSevere}
            onBell={toggleNotif}
            update={effectiveUpdate}
            onUpdate={() => setActive("settings")}
          />}
          <ErrorBoundary resetKey={active}>
            <div className={fullBleed ? "flex h-full flex-col" : "flex flex-col gap-6"}>
              {!OWN_HEADER.includes(active) && (
                <div className="mx-auto w-full max-w-[1180px]">
                  <PageTitle icon={active} title={t(`nav.${active}`)} description={t(`nav.${active}Desc`)} />
                </div>
              )}
              {active === "home" ? <Dashboard onNavigate={setActive} /> : null}
              {active === "labels" ? <LabelDesigner onEditorChange={setLabelsEditing} /> : null}
              {active === "catalog" ? <ProductsPage onNavigate={setActive} onCatalogChanged={loadNoTemplate} /> : null}
              {active === "packaging" ? <PackagingPage /> : null}
              {active === "barcodes" ? <BarcodesPage onNavigate={setActive} /> : null}
              {active === "print_tasks" ? <PrintPage onNavigate={setActive} onJobsChanged={loadJobErrors} /> : null}
              {active === "stations" ? <StationsPage /> : null}
              {active === "operators" ? <OperatorsPage onNavigate={setActive} /> : null}
              {active === "settings" ? <SettingsPage key="settings" /> : null}
              {active === "license" ? <SettingsPage key="license" initialTab="license" /> : null}
              {active === "users" && isAdmin ? <UsersManager /> : null}

              {!fullBleed && <footer className="border-t border-lp-line pt-5 text-[12px] text-lp-ink-3">
                {t("app.footerCopyright", { year: new Date().getFullYear() })}
              </footer>}
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────
// Decides which surface to render based on the AuthProvider state. Real access
// control is server-side (IsAuthenticated); this only chooses the UI.

function AuthGate() {
  const { loading, user, needsBootstrap } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-lp-bg text-lp-accent">
        <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (needsBootstrap) return <BootstrapScreen />;
  if (!user) return <LoginScreen />;
  return <AppShell />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
