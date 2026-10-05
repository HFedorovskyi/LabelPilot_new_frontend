"use client";

import React, { useEffect, useRef, useState } from "react";
import LabelDesigner from "./components/LabelDesigner";
import ProductCatalog from "./components/catalog/ProductCatalog";
import PackagingManager from "./components/catalog/PackagingManager";
import BarcodeTemplatesManager from "./components/barcodes/BarcodeTemplatesManager";
import StationsPage from "./stations/page";
import SettingsPage from "./components/settings/SettingsPage";
import PrintJobsManager from "./components/print_jobs/PrintJobsManager";
import Dashboard from "./components/home/Dashboard";
import DemoBanner from "./components/DemoBanner";
import UsersManager from "./components/users/UsersManager";
import OperatorsManager from "./components/operators/OperatorsManager";
import Sidebar, { type NavBadge, type NavKey } from "./components/shell/Sidebar";
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
const OWN_HEADER: NavKey[] = ["stations", "labels"];

function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === "admin";
  // «Доступ к серверу» (server users) is admin-only — the server enforces it, this hides the UI.
  const hidden: NavKey[] = isAdmin ? [] : ["users"];

  const [active, setActive] = useState<NavKey>("home");
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
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifSeen, setNotifSeen] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") setNotifSeen(window.localStorage.getItem("lp_notif_seen") || "");
  }, []);
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
  useEffect(() => {
    let alive = true;
    const load = () =>
      api.notifications().then((d: any) => { if (alive) setNotifItems(d.notifications ?? []); }).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
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

  // Hide the "update available" chrome when the live server version already matches/exceeds
  // the candidate (e.g. dual Docker+native installs, or VERSION file lag on the updater side).
  const effectiveUpdate = updateAvail && isNewerVersion(updateAvail.version, serverVersion)
    ? updateAvail
    : null;

  // Surface an available update both in the menu and as a notifications-panel item.
  const updateNotif = effectiveUpdate
    ? { id: `update-${effectiveUpdate.version}`, level: "INFO", title: t("app.updateAvailable", { version: effectiveUpdate.version }), subtitle: t("app.updateAvailableHint"), created_at: effectiveUpdate.publishedAt }
    : null;
  const allNotifItems = updateNotif ? [updateNotif, ...notifItems] : notifItems;
  const notifUnread = allNotifItems.filter((n) => n.created_at && (!notifSeen || n.created_at > notifSeen)).length;
  const openNotif = () => {
    if (!notifOpen) {
      const now = new Date().toISOString();
      setNotifSeen(now);
      if (typeof window !== "undefined") window.localStorage.setItem("lp_notif_seen", now);
    }
    setNotifOpen((o) => !o);
  };

  // ── menu counters: stations that need a decision, licence seats in use ──
  const [stationProblems, setStationProblems] = useState(0);
  const [seats, setSeats] = useState<{ active: number; limit: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      api.stations.list()
        .then((list: Station[]) => { if (alive) setStationProblems(attentionCount(list)); })
        .catch(() => { });
      licenseApi.get()
        .then((info) => { if (alive) setSeats(info.seats ? { active: info.seats.active, limit: info.seats.limit } : null); })
        .catch(() => { });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const badges: Partial<Record<NavKey, NavBadge>> = {};
  if (stationProblems > 0) badges.stations = { text: String(stationProblems), tone: "bad", title: t("nav.stationsBadge", { count: stationProblems }) };
  if (seats && seats.limit != null) badges.license = { text: `${seats.active}/${seats.limit}`, tone: "plain", title: t("nav.licenseBadge") };

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const s = typeof window !== "undefined" ? window.localStorage.getItem("lp_sidebar_collapsed") : null;
    if (s !== null) setCollapsed(s === "1");
    else if (typeof window !== "undefined" && window.innerWidth < 900) setCollapsed(true);
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
    <div className="flex h-screen overflow-hidden bg-lp-bg font-sans text-lp-ink">
      <Sidebar
        active={active}
        onNavigate={setActive}
        hidden={hidden}
        badges={badges}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onSearch={() => setSearchOpen(true)}
        bellRef={bellRef}
        unread={notifUnread}
        onBell={openNotif}
        serverVersion={serverVersion}
        host={host}
        update={effectiveUpdate?.version ?? null}
        onUpdate={() => setActive("settings")}
        userName={user?.username ?? ""}
        userRole={roleLabel(t, user?.role)}
        onLogout={() => void logout()}
      />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} items={allNotifItems} anchorRef={bellRef} />
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(tab) => setActive(tab as NavKey)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Демо-режим: ненавязчивый баннер о лицензии (показывается только когда mode === "demo") */}
        <DemoBanner onActivate={() => setActive("license")} />
        <main className="relative flex-1 overflow-y-auto px-8 pb-10 pt-[26px]">
          <ErrorBoundary resetKey={active}>
            <div className="flex flex-col gap-6">
              {!OWN_HEADER.includes(active) && (
                <div className="flex max-w-[640px] flex-col gap-1">
                  <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em] text-lp-ink">{t(`nav.${active}`)}</h1>
                  <p className="m-0 text-[14px] text-lp-ink-2">{t(`nav.${active}Desc`)}</p>
                </div>
              )}
              {active === "home" ? <Dashboard /> : null}
              {active === "labels" ? <LabelDesigner /> : null}
              {active === "catalog" ? <ProductCatalog /> : null}
              {active === "packaging" ? <PackagingManager /> : null}
              {active === "barcodes" ? <BarcodeTemplatesManager /> : null}
              {active === "print_tasks" ? <PrintJobsManager /> : null}
              {active === "stations" ? <StationsPage /> : null}
              {active === "operators" ? <OperatorsManager /> : null}
              {active === "settings" ? <SettingsPage key="settings" /> : null}
              {active === "license" ? <SettingsPage key="license" initialTab="license" /> : null}
              {active === "users" && isAdmin ? <UsersManager /> : null}

              <footer className="border-t border-lp-line pt-5 text-[12px] text-lp-ink-3">
                {t("app.footerCopyright", { year: new Date().getFullYear() })}
              </footer>
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
