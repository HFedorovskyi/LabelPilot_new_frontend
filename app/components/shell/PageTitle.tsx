"use client";

// The title block every page starts with: the page's icon on a tile in its menu group's
// color, a small line above the title, the title and one line on what the page is for;
// the page's main action goes in `children`.

import React from "react";
import { groupOf, NavIcon, type NavGroup, type NavKey } from "./Sidebar";

const TILE: Record<NavGroup, string> = {
    prod: "lp-tile-prod",
    what: "lp-tile-what",
    people: "lp-tile-people",
    sys: "lp-tile-sys",
};

export default function PageTitle({ icon, eyebrow, title, description, children }: {
    icon: NavKey;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className={`lp-tile flex h-[54px] w-[54px] flex-none items-center justify-center rounded-[17px] ${TILE[groupOf(icon)]}`} aria-hidden="true">
                <NavIcon name={icon} className="h-[26px] w-[26px]" />
            </span>
            <div className="mr-auto flex min-w-0 max-w-[640px] flex-col gap-0.5">
                {eyebrow && <span className="text-[13px] font-extrabold text-lp-g-prod">{eyebrow}</span>}
                <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-lp-ink">{title}</h1>
                {description && <p className="m-0 text-[14px] text-lp-ink-2">{description}</p>}
            </div>
            {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
        </div>
    );
}
