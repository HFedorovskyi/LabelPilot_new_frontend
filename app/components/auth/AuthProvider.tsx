"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, type AuthUser } from "@/lib/api/auth";
import { setUnauthorizedHandler } from "@/lib/api/client";

// ─── Auth context ─────────────────────────────────────────────────────────────
//
// On mount: getCsrf() → bootstrapStatus(). If the system needs its first admin we
// stop and surface needsBootstrap; otherwise we call me() to resolve the current
// user. The global 401/403 handler (registered with the api client) resets the
// user to null so a session that expires mid-use drops back to the login screen.
//
// NOTE: this is a client-side guard for a static export. Real enforcement is on
// the server (IsAuthenticated) — this only decides what UI to render.

interface AuthContextValue {
    loading: boolean;
    user: AuthUser | null;
    needsBootstrap: boolean;
    /** Re-run csrf → bootstrap-status → me(). */
    refresh: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    bootstrap: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [needsBootstrap, setNeedsBootstrap] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            // Prime the csrftoken cookie before any write happens.
            await authApi.getCsrf();
            const status = await authApi.bootstrapStatus();
            if (status.needs_bootstrap) {
                setNeedsBootstrap(true);
                setUser(null);
                return;
            }
            setNeedsBootstrap(false);
            const me = await authApi.me();
            setUser(me);
        } catch {
            // Server unreachable or unexpected error — treat as logged-out so the
            // login screen renders rather than a blank app.
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Drop to the login screen whenever any API call returns 401/403.
    useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
        return () => setUnauthorizedHandler(null);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const login = useCallback(
        async (username: string, password: string) => {
            await authApi.login(username, password);
            await refresh();
        },
        [refresh]
    );

    const bootstrap = useCallback(
        async (username: string, password: string) => {
            await authApi.bootstrap(username, password);
            // After creating the first admin, log in immediately to start a session.
            await authApi.login(username, password);
            await refresh();
        },
        [refresh]
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const value: AuthContextValue = {
        loading,
        user,
        needsBootstrap,
        refresh,
        login,
        bootstrap,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
