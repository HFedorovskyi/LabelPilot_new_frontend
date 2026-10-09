"use client";

import React from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into <body> via a React portal.
 *
 * Why: the SPA shell (app/page.tsx) puts all page content inside a `z-10` main
 * column that also contains a `backdrop-blur` <header>. Both create stacking
 * contexts, so any `fixed inset-0` overlay rendered inside the content tree is
 * (a) z-capped below the `z-20` sidebar — its backdrop can't dim the sidebar —
 * and (b) at risk of being painted under <main>. Portaling to <body> lifts the
 * overlay to the true document root (which has no transform/filter/overflow),
 * so its z-index and full-viewport backdrop behave as intended.
 *
 * The `mounted` guard keeps it safe under Next.js static export: document.body
 * is never touched during prerender / first client render, so there is no SSR
 * crash and no hydration mismatch.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
