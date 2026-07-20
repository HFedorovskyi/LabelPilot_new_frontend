"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import Portal from "../Portal";

type LType = "pack" | "box" | "pallet";

type CreateOpts = { name: string; labelType: LType; widthCm: number; heightCm: number };

type Props = {
  templates: any[];
  onOpen: (template: any) => void;
  onCreate: (opts: CreateOpts) => void;
  onDelete: (id: number) => void;
};

const TYPE_BADGE: Record<LType, string> = {
  pack: "bg-indigo-400/15 text-indigo-200 border-indigo-400/25",
  box: "bg-teal-400/15 text-teal-200 border-teal-400/25",
  pallet: "bg-pink-400/15 text-pink-200 border-pink-400/25",
};

const typeLabel = (t: (key: string) => string, type: LType): string =>
  type === "box" ? t("templates.typeBox") : type === "pallet" ? t("templates.typePallet") : t("templates.typePack");

const PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: "100 × 150", w: 100, h: 150 },
  { label: "58 × 40", w: 58, h: 40 },
  { label: "100 × 100", w: 100, h: 100 },
  { label: "120 × 80", w: 120, h: 80 },
  { label: "A5 · 148 × 210", w: 148, h: 210 },
  { label: "A4 · 210 × 297", w: 210, h: 297 },
];

function parseScheme(t: any): any {
  let scheme = t?.scheme;
  if (!scheme || typeof scheme !== "object") {
    const structure = t?.structure ?? t?.scheme;
    if (typeof structure === "string") {
      try {
        scheme = JSON.parse(structure);
      } catch {
        scheme = null;
      }
    }
  }
  return scheme && typeof scheme === "object" ? scheme : null;
}

function getType(scheme: any): LType {
  const t = scheme?.canvas?.labelType;
  return t === "box" || t === "pallet" ? t : "pack";
}

/** Faithful mini-preview: renders the label's elements at native px, scaled to fit (letterboxed). */
function TemplatePreview({ scheme }: { scheme: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const measure = () => {
      if (ref.current) setBox({ w: ref.current.clientWidth, h: ref.current.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const canvas = scheme?.canvas ?? {};
  const cw = Number(canvas.width) || (Number(canvas.widthCm) || 10) * 80;
  const ch = Number(canvas.height) || (Number(canvas.heightCm) || 6) * 80;
  const els: any[] = Array.isArray(scheme?.elements) ? scheme.elements : [];

  const scale = box.w && box.h ? Math.min(box.w / cw, box.h / ch) : 0;

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {scale > 0 && (
        <div
          className="relative overflow-hidden rounded-[3px]"
          style={{ width: cw * scale, height: ch * scale, background: canvas.background || "#ffffff", boxShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: ch, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {els.map((el, i) => {
              const baseStyle: React.CSSProperties = {
                position: "absolute",
                left: Number(el.x) || 0,
                top: Number(el.y) || 0,
                width: Number(el.w) || 0,
                height: Number(el.h) || 0,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              };
              if (el.type === "barcode") {
                return <div key={i} style={{ ...baseStyle, backgroundImage: "repeating-linear-gradient(90deg,#111 0,#111 2px,#fff 2px,#fff 5px)" }} />;
              }
              if (el.type === "rect") {
                return (
                  <div
                    key={i}
                    style={{ ...baseStyle, background: el.fill || "transparent", border: `${Number(el.borderWidth) || 1}px solid ${el.borderColor || "#94a3b8"}`, borderRadius: Number(el.borderRadius) || 0 }}
                  />
                );
              }
              if (el.type === "table") {
                return (
                  <div
                    key={i}
                    style={{ ...baseStyle, border: "1px solid #64748b", backgroundImage: "linear-gradient(#cbd5e1 1px,transparent 1px)", backgroundSize: `100% ${Math.max(8, (Number(el.h) || 40) / 4)}px` }}
                  />
                );
              }
              if (el.type === "image") {
                return <div key={i} style={{ ...baseStyle, background: "#e2e8f0", border: "1px solid #cbd5e1" }} />;
              }
              return (
                <div
                  key={i}
                  style={{
                    ...baseStyle,
                    fontSize: Number(el.fontSize) || 16,
                    color: el.color || "#111827",
                    fontWeight: el.fontWeight || 400,
                    fontStyle: el.fontStyle || "normal",
                    fontFamily: el.fontFamily ? `${el.fontFamily}, sans-serif` : "Inter, sans-serif",
                    textAlign: (el.textAlign || "left") as React.CSSProperties["textAlign"],
                    lineHeight: 1.1,
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {String(el.text ?? "")}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplateHub({ templates, onOpen, onCreate, onDelete }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | LType>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState(t("templates.newTemplate"));
  const [labelType, setLabelType] = useState<LType>("pack");
  const [widthMm, setWidthMm] = useState(100);
  const [heightMm, setHeightMm] = useState(150);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .map((t) => ({ raw: t, scheme: parseScheme(t), type: getType(parseScheme(t)) }))
      .filter((it) => (filter === "all" ? true : it.type === filter))
      .filter((it) => (q ? String(it.raw?.name ?? "").toLowerCase().includes(q) : true));
  }, [templates, search, filter]);

  const counts = useMemo(() => {
    const c = { all: templates.length, pack: 0, box: 0, pallet: 0 } as Record<string, number>;
    templates.forEach((t) => {
      c[getType(parseScheme(t))]++;
    });
    return c;
  }, [templates]);

  const filters: Array<{ key: "all" | LType; label: string }> = [
    { key: "all", label: t("templates.filterAll") },
    { key: "pack", label: t("templates.typePack") },
    { key: "box", label: t("templates.typeBox") },
    { key: "pallet", label: t("templates.typePallet") },
  ];

  const submitCreate = () => {
    onCreate({
      name: name.trim() || t("templates.newTemplate"),
      labelType,
      widthCm: Math.max(1, widthMm) / 10,
      heightCm: Math.max(1, heightMm) / 10,
    });
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">{t("templates.heading")}</h2>
          <p className="text-sm text-white/45">{t("templates.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" className="text-white/40" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-white/40" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("templates.searchPlaceholder")}
              className="w-40 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {t("templates.createNew")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "rounded-full border px-3.5 py-1.5 text-[12px] transition " +
              (filter === f.key
                ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
                : "border-white/10 text-white/55 hover:text-white hover:bg-white/5")
            }
          >
            {f.label}
            <span className="ml-1.5 text-white/35">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <button
          onClick={() => setModalOpen(true)}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-400/40 bg-indigo-400/[0.06] text-indigo-200 transition hover:border-indigo-400/70 hover:bg-indigo-400/10"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="text-[13px]">{t("templates.createNewTemplate")}</span>
        </button>

        {items.map(({ raw, scheme, type }) => {
          const cm = scheme?.canvas ?? {};
          const wMm = Math.round((Number(cm.widthCm) || 0) * 10);
          const hMm = Math.round((Number(cm.heightCm) || 0) * 10);
          const badge = TYPE_BADGE[type];
          return (
            <div
              key={raw.id}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-indigo-400/40"
            >
              <button onClick={() => onOpen(raw)} className="block w-full text-left outline-none">
                <div className="h-[132px] bg-black/20 p-2.5">
                  {scheme ? (
                    <TemplatePreview scheme={scheme} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-white/30">{t("templates.noPreview")}</div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <div className="truncate text-[13px] text-white">{raw.name || t("templates.untitled")}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white/40">{wMm > 0 ? t("templates.dimensions", { w: wMm, h: hMm }) : "—"}</span>
                    <span className={"rounded-md border px-2 py-0.5 text-[10px] " + badge}>{typeLabel(t, type)}</span>
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(raw.id);
                }}
                title={t("templates.deleteTemplate")}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/50 opacity-0 transition hover:bg-red-500/25 hover:text-red-300 group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-10 text-center text-sm text-white/40">
          {templates.length === 0 ? t("templates.emptyNoTemplates") : t("templates.emptyNoMatches")}
        </div>
      )}

      {modalOpen && (
        <Portal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0e13] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-base font-semibold text-white">{t("templates.newTemplate")}</div>

            <div className="mb-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/50">{t("templates.labelType")}</div>
              <div className="grid grid-cols-3 gap-2">
                {(["pack", "box", "pallet"] as LType[]).map((lt) => (
                  <button
                    key={lt}
                    onClick={() => setLabelType(lt)}
                    className={
                      "rounded-lg border px-2 py-2.5 text-[12px] transition " +
                      (labelType === lt
                        ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200"
                        : "border-white/10 text-white/55 hover:bg-white/5")
                    }
                  >
                    {typeLabel(t, lt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/50">{t("templates.size")}</div>
              <div className="mb-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const on = widthMm === p.w && heightMm === p.h;
                  return (
                    <button
                      key={p.label}
                      onClick={() => {
                        setWidthMm(p.w);
                        setHeightMm(p.h);
                      }}
                      className={
                        "rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition " +
                        (on ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200" : "border-white/10 text-white/55 hover:bg-white/5")
                      }
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[11px] text-white/40">{t("templates.widthMm")}</span>
                  <input
                    type="number"
                    value={widthMm}
                    onChange={(e) => setWidthMm(Number(e.target.value))}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </label>
                <label className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[11px] text-white/40">{t("templates.heightMm")}</span>
                  <input
                    type="number"
                    value={heightMm}
                    onChange={(e) => setHeightMm(Number(e.target.value))}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/50">{t("templates.name")}</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5">
                {t("templates.cancel")}
              </button>
              <button onClick={submitCreate} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400">
                {t("templates.create")}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
