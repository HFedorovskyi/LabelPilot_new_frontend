"use client";

// «Шаблоны этикеток»: the list of templates and the editor of one. The editor shows the
// label filled with a real product's data, measures everything in mm and pt, checks a
// pack label against the EU rules and saves it for the stations.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api as client } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import { setLeaveGuard } from "@/lib/navGuard";
import { stationDelivery, type Station } from "@/lib/stations";
import type { BarcodeElement, LabelDoc, LabelElement, TableElement, TextElement } from "@/lib/label/types";
import { imagesReady, labelFontsReady, renderLabel } from "@/lib/label/renderer";
import { labelToZpl } from "@/lib/label/zpl";
import { defaultDoc, validateDoc } from "@/lib/label/document";
import { clamp, uid } from "@/lib/label/helpers";
import { euCheck, fieldKeys, isEuChecked, pxPerMm, type EuRequirement } from "@/lib/label/eu";
import { cx } from "./stations/shared";
import TemplateHub, { type Product, type SavedTemplate } from "./designer/TemplateHub";
import FieldsPanel from "./designer/FieldsPanel";
import Inspector from "./designer/Inspector";
import EuPopover from "./designer/EuPopover";
import { DIcon, Seg, TypeChip, type DIconName } from "./designer/ui";
import {
    barcodeElement, defaultBarcode, extraFieldFor, fieldNamesData, fieldsFor, fieldText, fmt, frameElement, imageElement, is2D,
    labelType, lineElement, parseScheme, previewDataFor, readPicture, REQUIREMENT_FIELD, signature, sizeMm, tableElement,
    textElement, toMm, usedKeys, type BarcodeTemplate, type FieldDef,
} from "./designer/model";
import { buildStarter, type ExtraNames, type Starter } from "./designer/starters";

// Tab-local (sessionStorage) so two tabs do not overwrite each other's open template.
const SS = {
    doc: "label_designer_doc_v1",
    view: "labelDesigner_view",
    id: "labelDesigner_labelId",
    name: "labelDesigner_labelName",
    saved: "labelDesigner_savedSig",
};
const LS_PRODUCT = "labelDesigner_selectedNomenclatureId";
const LS_SNAP = "labelDesigner_snap";

const read = (store: "local" | "session", key: string): string | null => {
    try {
        return (store === "local" ? localStorage : sessionStorage).getItem(key);
    } catch {
        return null;
    }
};
const write = (store: "local" | "session", key: string, value: string | null) => {
    try {
        const s = store === "local" ? localStorage : sessionStorage;
        if (value === null) s.removeItem(key);
        else s.setItem(key, value);
    } catch {
        // storage full or blocked: the editor still works
    }
};

type Toast = { text: string; tone: "ok" | "info" | "bad"; action?: { label: string; run: () => void } };
type Interaction =
    | { kind: "drag"; id: string; startX: number; startY: number; px: number; py: number }
    | { kind: "resize"; handle: string; px: number; py: number; el: LabelElement }
    | { kind: "pan"; px: number; py: number; pan: { x: number; y: number } };

const HANDLES: Array<[string, string, string]> = [
    ["nw", "left-[-5px] top-[-5px]", "nwse-resize"],
    ["n", "left-[calc(50%-4.5px)] top-[-5px]", "ns-resize"],
    ["ne", "right-[-5px] top-[-5px]", "nesw-resize"],
    ["e", "right-[-5px] top-[calc(50%-4.5px)]", "ew-resize"],
    ["se", "right-[-5px] bottom-[-5px]", "nwse-resize"],
    ["s", "left-[calc(50%-4.5px)] bottom-[-5px]", "ns-resize"],
    ["sw", "left-[-5px] bottom-[-5px]", "nesw-resize"],
    ["w", "left-[-5px] top-[calc(50%-4.5px)]", "ew-resize"],
];

const rotatePoint = (x: number, y: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) };
};

const isEan13 = (el: LabelElement) => el.type === "barcode" && (el as BarcodeElement).barcodeType.toLowerCase().replace(/[^a-z0-9]/g, "").includes("ean13");

const editable = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export default function LabelDesigner({ onEditorChange }: { onEditorChange?: (editing: boolean) => void }) {
    const { t, lang } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const [view, setView] = useState<"hub" | "editor">("hub");
    const [hubNotice, setHubNotice] = useState<string | null>(null);

    // ── the document and its undo history ──
    const [doc, setDocState] = useState<LabelDoc>(defaultDoc);
    const docRef = useRef(doc);
    docRef.current = doc;
    const sig = useMemo(() => signature(doc), [doc]);
    const past = useRef<LabelDoc[]>([]);
    const future = useRef<LabelDoc[]>([]);
    const committed = useRef<{ doc: LabelDoc; sig: string }>({ doc, sig });
    const burst = useRef<number | null>(null);
    const restoring = useRef(false);
    const interaction = useRef<Interaction | null>(null);
    const [, bumpHistory] = useReducer((n: number) => n + 1, 0);

    const setDoc = useCallback((update: (d: LabelDoc) => LabelDoc) => setDocState(update), []);

    const endBurst = useCallback(() => {
        if (interaction.current && interaction.current.kind !== "pan") {
            burst.current = window.setTimeout(endBurst, 300);
            return;
        }
        burst.current = null;
        committed.current = { doc: docRef.current, sig: signature(docRef.current) };
    }, []);
    const flushBurst = () => {
        if (burst.current !== null) {
            window.clearTimeout(burst.current);
            burst.current = null;
            committed.current = { doc: docRef.current, sig: signature(docRef.current) };
        }
    };
    // Changes made within 0.7 s of each other (typing, a drag) are one undo step; barcode
    // pictures arriving for the preview are not a change.
    useEffect(() => {
        if (restoring.current) {
            restoring.current = false;
            committed.current = { doc, sig };
            return;
        }
        if (sig === committed.current.sig) {
            if (burst.current === null) committed.current = { doc, sig };
            return;
        }
        if (burst.current === null) {
            past.current.push(committed.current.doc);
            if (past.current.length > 100) past.current.shift();
            future.current = [];
            bumpHistory();
        } else {
            window.clearTimeout(burst.current);
        }
        burst.current = window.setTimeout(endBurst, 700);
    }, [doc, sig, endBurst]);

    const restore = (next: LabelDoc) => {
        if (next !== docRef.current) restoring.current = true;
        committed.current = { doc: next, sig: signature(next) };
        setDocState(next);
        bumpHistory();
    };
    const undo = () => {
        flushBurst();
        const prev = past.current.pop();
        if (!prev) return;
        future.current.push(docRef.current);
        restore(prev);
    };
    const redo = () => {
        flushBurst();
        const next = future.current.pop();
        if (!next) return;
        past.current.push(docRef.current);
        restore(next);
    };
    const resetHistory = (next: LabelDoc) => {
        if (burst.current !== null) window.clearTimeout(burst.current);
        burst.current = null;
        past.current = [];
        future.current = [];
        restore(next);
    };

    // ── what the template is ──
    const [labelId, setLabelId] = useState<number | null>(null);
    const [labelName, setLabelName] = useState("");
    const [savedSig, setSavedSig] = useState("");
    const [busy, setBusy] = useState(false);

    // ── editor view state ──
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hidden, setHidden] = useState<Set<string>>(() => new Set());
    const [mode, setMode] = useState<"data" | "fields">("data");
    const [leftTab, setLeftTab] = useState<"fields" | "layers">("fields");
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [panning, setPanning] = useState(false);
    const [space, setSpace] = useState(false);
    const spaceDown = useRef(false);
    const [snap, setSnap] = useState(true);
    const [euOpen, setEuOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [codeMenu, setCodeMenu] = useState(false);
    const [focusText, setFocusText] = useState(0);
    const [toast, setToast] = useState<Toast | null>(null);
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const snapRef = useRef(snap);
    snapRef.current = snap;
    const ppm = pxPerMm(doc.canvas);
    const ppmRef = useRef(ppm);
    ppmRef.current = ppm;

    const stageRef = useRef<HTMLElement | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const fileMode = useRef<"add" | "replace">("add");
    const nameRef = useRef<HTMLInputElement | null>(null);

    // ── data from the server ──
    const [templates, setTemplates] = useState<SavedTemplate[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [attributes, setAttributes] = useState<Array<{ id: number; name: string }>>([]);
    const [barcodeTemplates, setBarcodeTemplates] = useState<BarcodeTemplate[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [productId, setProductId] = useState("");

    const list = <X,>(value: unknown): X[] => (Array.isArray(value) ? value : ((value as { results?: X[] })?.results ?? []));
    const loadTemplates = useCallback(() => {
        client.labels.list().then((value: unknown) => setTemplates(list<SavedTemplate>(value))).catch(() => { });
    }, []);
    useEffect(() => {
        loadTemplates();
        client.nomenclature.list().then((value: unknown) => {
            const items = list<Product>(value);
            setProducts(items);
            const saved = read("local", LS_PRODUCT);
            const pick = items.find((p) => String(p.id) === saved) ?? items[0];
            if (pick) setProductId(String(pick.id));
        }).catch(() => { });
        client.attributes.list().then((value: unknown) => setAttributes(list(value))).catch(() => { });
        client.barcodes.list().then((value: unknown) => setBarcodeTemplates(list(value))).catch(() => { });
        client.stations.list().then((value: unknown) => setStations(list(value))).catch(() => { });
    }, [loadTemplates]);

    // ── restore an open template after a reload ──
    useEffect(() => {
        setMounted(true);
        if (read("local", LS_SNAP) === "0") setSnap(false);
        if (read("session", SS.view) !== "editor") return;
        let stored: LabelDoc | null = null;
        try {
            stored = validateDoc(JSON.parse(read("session", SS.doc) || "null"));
        } catch {
            stored = null;
        }
        if (!stored) return;
        const id = Number(read("session", SS.id));
        resetHistory(stored);
        setLabelId(Number.isFinite(id) && id > 0 ? id : null);
        setLabelName(read("session", SS.name) ?? "");
        setSavedSig(read("session", SS.saved) ?? "");
        setView("editor");
        requestFit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!mounted) return;
        write("session", SS.view, view);
        if (view !== "editor") return;
        const timer = window.setTimeout(() => write("session", SS.doc, JSON.stringify(doc)), 400);
        return () => window.clearTimeout(timer);
    }, [doc, view, mounted]);
    useEffect(() => {
        if (!mounted) return;
        write("session", SS.id, labelId === null ? null : String(labelId));
        write("session", SS.name, labelName);
        write("session", SS.saved, savedSig);
    }, [labelId, labelName, savedSig, mounted]);

    useEffect(() => {
        onEditorChange?.(view === "editor");
    }, [view, onEditorChange]);
    useEffect(() => () => onEditorChange?.(false), [onEditorChange]);

    // ── fields, preview data, EU check ──
    const type = labelType(doc);
    const extraNames = useMemo(() => attributes.map((a) => String(a.name)), [attributes]);
    const extraNamesRef = useRef(extraNames);
    extraNamesRef.current = extraNames;
    const fields = useMemo(() => fieldsFor(type, extraNames, t), [type, extraNames, t]);
    const labelOf = useMemo(() => new Map(fields.map((f) => [f.key, f.label])), [fields]);
    const used = useMemo(() => usedKeys(doc), [doc]);
    const product = products.find((p) => String(p.id) === productId) ?? null;
    const tableRows = (doc.elements.find((e) => e.type === "table") as TableElement | undefined)?.maxRows || 12;
    const previewData = useMemo(() => previewDataFor(product, tableRows), [product, tableRows]);
    const shownData = useMemo(() => (mode === "fields" ? fieldNamesData(fields, previewData) : previewData), [mode, fields, previewData]);
    // Fields the chosen product has no value for: the station prints them as "{{ key }}".
    const unfilled = useMemo(() => {
        if (!product) return [];
        const keys = new Set<string>();
        for (const el of doc.elements) {
            if (el.type === "text") fieldKeys((el as TextElement).text).forEach((key) => keys.add(key));
            if (el.type === "barcode") fieldKeys((el as BarcodeElement).value || "").forEach((key) => keys.add(key));
        }
        return [...keys].filter((key) => key !== "barcode" && (previewData[key] === undefined || previewData[key] === "")).map((key) => labelOf.get(key) ?? key);
    }, [doc.elements, previewData, product, labelOf]);
    const euOn = isEuChecked(doc);
    const eu = useMemo(() => euCheck(doc), [doc]);
    const dirty = view === "editor" && sig !== savedSig;
    const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
    const selectedRef = useRef(selected);
    selectedRef.current = selected;

    useEffect(() => {
        if (selectedId && !doc.elements.some((e) => e.id === selectedId)) setSelectedId(null);
    }, [doc.elements, selectedId]);

    // ── barcode pictures for the preview (made on the server from the product's data) ──
    const generateBarcode = useCallback(async (template: BarcodeTemplate & { structure?: unknown }, elementId: string) => {
        try {
            const payload: { barcode_structure: unknown; product_id?: string } = { barcode_structure: template.structure };
            if (productId) payload.product_id = productId;
            const response = await client.barcodes.generate(payload);
            if (response?.png) {
                setDocState((d) => ({ ...d, elements: d.elements.map((el) => (el.id === elementId ? ({ ...el, imageData: response.png, error: undefined } as BarcodeElement) : el)) }));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setDocState((d) => ({ ...d, elements: d.elements.map((el) => (el.id === elementId ? ({ ...el, imageData: undefined, error: message } as BarcodeElement) : el)) }));
        }
    }, [productId]);
    const missingPictures = doc.elements.filter((e) => e.type === "barcode" && !(e as BarcodeElement).imageData && !(e as BarcodeElement).error).map((e) => e.id).join(",");
    useEffect(() => {
        if (view !== "editor" || !missingPictures || barcodeTemplates.length === 0) return;
        let active = true;
        (async () => {
            for (const el of docRef.current.elements) {
                if (!active) break;
                if (el.type !== "barcode") continue;
                const code = el as BarcodeElement;
                if (code.imageData || code.error) continue;
                const template = barcodeTemplates.find((b) => (code.templateId ? b.id === code.templateId : b.name === code.barcodeType));
                if (template) await generateBarcode(template, el.id);
            }
        })();
        return () => {
            active = false;
        };
    }, [view, missingPictures, barcodeTemplates, generateBarcode]);

    const chooseProduct = (id: string) => {
        setProductId(id);
        write("local", LS_PRODUCT, id);
        // Barcodes carry the product's data: draw them again.
        setDocState((d) => ({ ...d, elements: d.elements.map((el) => (el.type === "barcode" ? ({ ...el, imageData: undefined, error: undefined } as BarcodeElement) : el)) }));
    };

    // ── drawing the label ──
    const renderDoc = useMemo(() => (hidden.size ? { ...doc, elements: doc.elements.filter((e) => !hidden.has(e.id)) } : doc), [doc, hidden]);
    useEffect(() => {
        if (view !== "editor") return;
        const canvas = previewCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const w = renderDoc.canvas.width * zoom;
        const h = renderDoc.canvas.height * zoom;
        // Big labels at high zoom would exceed what a browser canvas can hold.
        const ratio = Math.min(window.devicePixelRatio || 1, 6000 / Math.max(w, h, 1));
        canvas.width = Math.max(1, Math.round(w * ratio));
        canvas.height = Math.max(1, Math.round(h * ratio));
        const draw = () => renderLabel(ctx, renderDoc, shownData, { scale: zoom, pixelRatio: ratio, showZones: true, barcodePlaceholder: true, blankMissing: mode === "data" });
        draw();
        let alive = true;
        void Promise.all([imagesReady(renderDoc), labelFontsReady()]).then(() => alive && draw());
        return () => {
            alive = false;
        };
    }, [renderDoc, shownData, zoom, view, mode]);

    // ── toasts ──
    const showToast = useCallback((text: string, tone: Toast["tone"] = "ok", action?: Toast["action"]) => setToast({ text, tone, action }), []);
    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), toast.action ? 9000 : 5000);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const closePopovers = () => {
        setEuOpen(false);
        setMoreOpen(false);
        setCodeMenu(false);
    };

    // ── fit the label into the stage ──
    const fit = useCallback(() => {
        const el = stageRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const c = docRef.current.canvas;
        setZoom(clamp(Math.min((width - 110) / c.width, (height - 110) / c.height), 0.1, 8));
        setPan({ x: 0, y: 0 });
    }, []);
    // A new printer resolution changes the canvas pixels, not the label: keep its size on screen.
    const lastDpi = useRef(doc.canvas.dpi);
    useEffect(() => {
        const prev = lastDpi.current;
        lastDpi.current = doc.canvas.dpi;
        if (prev && prev !== doc.canvas.dpi) setZoom((z) => clamp((z * prev) / doc.canvas.dpi, 0.1, 8));
    }, [doc.canvas.dpi]);
    const requestFit = () => {
        autoFit.current = true;
        requestAnimationFrame(() => requestAnimationFrame(fit));
    };
    // Until the person zooms or pans, the label keeps fitting the stage (menu folding, window resizing).
    const autoFit = useRef(true);
    useEffect(() => {
        const el = stageRef.current;
        if (!el || view !== "editor") return;
        const observer = new ResizeObserver(() => {
            if (autoFit.current) fit();
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [view, fit]);

    // ── open, create, leave ──
    const loadIntoEditor = (next: LabelDoc, id: number | null, name: string, saved: string) => {
        resetHistory(next);
        setLabelId(id);
        setLabelName(name);
        setSavedSig(saved);
        setSelectedId(null);
        setHidden(new Set());
        setMode("data");
        setLeftTab("fields");
        closePopovers();
        setToast(null);
        setView("editor");
        requestFit();
    };
    const openTemplate = (raw: SavedTemplate) => {
        const parsed = parseScheme(raw);
        if (!parsed) {
            setHubNotice(t("ed.invalid", { name: raw.name }));
            return;
        }
        loadIntoEditor(parsed, raw.id, raw.name, signature(parsed));
    };
    const createTemplate = (next: LabelDoc, name: string, note: string | null) => {
        loadIntoEditor(next, null, name.slice(0, 100), "");
        if (note) showToast(note, "info");
    };
    const backToHub = () => {
        if (dirty && !window.confirm(t("ed.leaveConfirm"))) return;
        setHubNotice(null);
        setView("hub");
        loadTemplates();
    };

    useEffect(() => {
        if (!dirty) return;
        setLeaveGuard(() => window.confirm(t("ed.leaveConfirm")));
        const onUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onUnload);
        return () => {
            setLeaveGuard(null);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [dirty, t]);

    // ── extra product fields the EU particulars need ──
    const ensureExtra = async (requirement: "ingredients" | "storage" | "producer"): Promise<{ name: string; created: boolean }> => {
        const existing = extraFieldFor(requirement, extraNamesRef.current);
        if (existing) return { name: existing, created: false };
        const name = t(`ed.extra.${requirement}`);
        try {
            const attribute = await client.attributes.create({ name });
            setAttributes((all) => [...all, attribute]);
            extraNamesRef.current = [...extraNamesRef.current, name];
            return { name, created: true };
        } catch {
            return { name, created: false };
        }
    };
    const makeStarter = async (starter: Starter) => {
        const extras: ExtraNames = {};
        const created: string[] = [];
        if (starter.euFields) {
            for (const requirement of ["ingredients", "storage", "producer"] as const) {
                const field = await ensureExtra(requirement);
                extras[requirement] = field.name;
                if (field.created) created.push(field.name);
            }
        }
        const code = defaultBarcode(barcodeTemplates);
        const notes: string[] = [];
        if (created.length) notes.push(t("ed.extrasCreated", { names: created.join(", ") }));
        if (!code && starter.type !== "pallet") notes.push(t("ed.noBarcodeForStarter"));
        return { doc: buildStarter(starter, t, extras, code), note: notes.join(" ") || null };
    };

    // ── editing ──
    const addElement = (el: LabelElement) => {
        setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
        setSelectedId(el.id);
        closePopovers();
    };
    const margin = () => (sizeMm(docRef.current.canvas).w >= 100 ? 5 : 2);
    /** The first free band of the label tall enough for a new line; else the tallest free band. */
    const nextY = (hMm: number) => {
        const c = docRef.current.canvas;
        const H = sizeMm(c).h;
        const edge = margin() / 2;
        const taken = docRef.current.elements
            .map((e) => [toMm(e.y, c), toMm(e.y + e.h, c)] as const)
            .sort((a, b) => a[0] - b[0]);
        let cursor = edge;
        let best = { y: Math.max(0, (H - hMm) / 2), size: 0 };
        for (const [top, bottom] of [...taken, [H - edge, H] as const]) {
            const gap = top - cursor;
            if (gap >= hMm + 0.4) return cursor + 0.2;
            if (gap > best.size) best = { y: cursor, size: gap };
            cursor = Math.max(cursor, bottom);
        }
        return Math.min(best.y, Math.max(0, H - hMm));
    };
    const addField = (key: string, extra: boolean, pt = 7, lines = 1) => {
        const c = docRef.current.canvas;
        const W = sizeMm(c).w;
        const h = Math.ceil((pt * 0.3528 * 1.25 * lines + 0.4) * 10) / 10;
        addElement(textElement(c, { x: margin(), y: nextY(h), w: W - margin() * 2, h }, fieldText(key, extra, t), pt));
    };
    const addFieldDef = (field: FieldDef) => {
        addField(field.key, !!field.extra);
        showToast(t("ed.fieldAdded", { name: field.label }));
    };
    const showField = (key: string) => {
        const el = docRef.current.elements.find((e) => usedKeys({ ...docRef.current, elements: [e] }).has(key));
        if (el) setSelectedId(el.id);
    };
    const addRequirement = async (requirement: EuRequirement) => {
        const builtIn = REQUIREMENT_FIELD[requirement];
        if (builtIn) {
            addField(builtIn, false, requirement === "name" ? 9 : 7);
            return;
        }
        setBusy(true);
        const field = await ensureExtra(requirement as "ingredients" | "storage" | "producer");
        setBusy(false);
        addField(field.name, true, 7, requirement === "ingredients" ? 3 : requirement === "producer" ? 2 : 1);
        if (field.created) showToast(t("ed.extrasCreated", { names: field.name }), "info");
    };
    const centered = (wMm: number, hMm: number) => {
        const { w: W, h: H } = sizeMm(docRef.current.canvas);
        return { x: Math.max(0, (W - wMm) / 2), y: Math.max(0, (H - hMm) / 2), w: wMm, h: hMm };
    };
    const addText = () => {
        const W = sizeMm(docRef.current.canvas).w;
        addElement(textElement(docRef.current.canvas, centered(Math.min(W - 4, 40), 4.2), t("ed.newText"), 8));
        setFocusText((n) => n + 1);
    };
    const addFrame = () => {
        const { w: W, h: H } = sizeMm(docRef.current.canvas);
        addElement(frameElement(docRef.current.canvas, centered(W * 0.6, H * 0.4)));
    };
    const addLine = () => {
        const { w: W, h: H } = sizeMm(docRef.current.canvas);
        addElement(lineElement(docRef.current.canvas, { x: margin(), y: H / 2, w: W - margin() * 2 }));
    };
    const addBarcode = (template: BarcodeTemplate) => {
        const { w: W, h: H } = sizeMm(docRef.current.canvas);
        const square = is2D(template);
        const w = square ? Math.min(20, W - 4, H - 4) : Math.min(40, W - 4);
        const h = square ? w : Math.min(15, H * 0.4);
        const el = barcodeElement(docRef.current.canvas, template, centered(w, h));
        addElement(el);
        void generateBarcode(template, el.id);
    };
    const addTable = () => {
        const { w: W, h: H } = sizeMm(docRef.current.canvas);
        addElement(tableElement(docRef.current.canvas, { x: W * 0.05, y: H * 0.3, w: W * 0.9, h: H * 0.4 }, t));
    };
    const pickPicture = (modeOfPick: "add" | "replace") => {
        fileMode.current = modeOfPick;
        fileRef.current?.click();
    };
    const onPicture = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast(t("ed.imageTooBig"), "bad");
            return;
        }
        try {
            const { src, ratio } = await readPicture(file);
            if (fileMode.current === "replace" && selectedRef.current?.type === "image") {
                update({ src } as Partial<LabelElement>);
                return;
            }
            const { w: W, h: H } = sizeMm(docRef.current.canvas);
            let w = Math.min(30, W * 0.5);
            let h = w * ratio;
            if (h > H * 0.6) {
                h = H * 0.6;
                w = h / ratio;
            }
            addElement(imageElement(docRef.current.canvas, src, centered(w, h)));
        } catch {
            showToast(t("ed.imageFailed"), "bad");
        }
    };

    const update = (patch: Partial<LabelElement>) => {
        const current = selectedRef.current;
        if (!current) return;
        const next = { ...patch } as Partial<LabelElement> & { text?: string; minLength?: number };
        if (current.type === "text" && typeof next.text === "string") {
            // A counter added by hand is padded to 12 digits, like on the stations.
            const counter = /{{\s*(pack_number|box_number)\s*}}/;
            if (counter.test(next.text) && !counter.test((current as TextElement).text) && !(current as TextElement).minLength) next.minLength = 12;
        }
        if (isEan13(current) && next.w !== undefined) next.w = Math.max(1, Math.round(next.w / 95)) * 95;
        setDoc((d) => ({ ...d, elements: d.elements.map((e) => (e.id === current.id ? ({ ...e, ...next } as LabelElement) : e)) }));
    };
    const duplicate = () => {
        const current = selectedRef.current;
        if (!current) return;
        const step = ppmRef.current;
        addElement({ ...current, id: uid(), x: current.x + step, y: current.y + step } as LabelElement);
    };
    const remove = () => {
        const current = selectedRef.current;
        if (!current) return;
        setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== current.id) }));
        setSelectedId(null);
    };
    const moveLayer = (dir: "up" | "down") => {
        const current = selectedRef.current;
        if (!current) return;
        setDoc((d) => {
            const i = d.elements.findIndex((e) => e.id === current.id);
            const j = dir === "up" ? i + 1 : i - 1;
            if (i < 0 || j < 0 || j >= d.elements.length) return d;
            const elements = d.elements.slice();
            const [item] = elements.splice(i, 1);
            elements.splice(j, 0, item);
            return { ...d, elements };
        });
    };
    const nudge = (dx: number, dy: number) => {
        const current = selectedRef.current;
        if (!current) return;
        setDoc((d) => ({ ...d, elements: d.elements.map((e) => (e.id === current.id ? ({ ...e, x: e.x + dx, y: e.y + dy } as LabelElement) : e)) }));
    };
    const toggleHidden = (id: string) => setHidden((set) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    // ── saving ──
    const sendToStations = async () => {
        const online = stations.filter((s) => stationDelivery(s) === "network");
        let sent = 0;
        const failed: string[] = [];
        for (const station of online) {
            try {
                await client.stations.sync(station.station_uuid);
                sent += 1;
            } catch {
                failed.push(station.station_name);
            }
        }
        client.stations.list().then((value: unknown) => setStations(list(value))).catch(() => { });
        if (failed.length) showToast(t("ed.sendFailed", { names: failed.join(", ") }), "bad");
        else showToast(t("ed.sent", { count: sent }));
    };
    const save = async (): Promise<boolean> => {
        const name = labelName.trim();
        if (!name) {
            showToast(t("ed.nameRequired"), "bad");
            nameRef.current?.focus();
            return false;
        }
        setBusy(true);
        try {
            const current = docRef.current;
            const payload = { name, scheme: current };
            if (labelId) await client.labels.update(labelId, payload);
            else {
                const created = await client.labels.create(payload);
                setLabelId(created.id);
            }
            setSavedSig(signature(current));
            loadTemplates();
            const online = stations.filter((s) => stationDelivery(s) === "network");
            showToast(t("ed.saved"), "ok", online.length ? { label: t("ed.sendNow"), run: () => void sendToStations() } : undefined);
            return true;
        } catch {
            showToast(t("ed.saveFailed"), "bad");
            return false;
        } finally {
            setBusy(false);
        }
    };
    const saveCopy = async () => {
        setMoreOpen(false);
        const name = t("ed.copyName", { name: labelName.trim() || t("tpl.untitled") }).slice(0, 100);
        setBusy(true);
        try {
            const current = docRef.current;
            const created = await client.labels.create({ name, scheme: current });
            setLabelId(created.id);
            setLabelName(name);
            setSavedSig(signature(current));
            loadTemplates();
            showToast(t("ed.copySaved", { name }));
        } catch {
            showToast(t("ed.saveFailed"), "bad");
        } finally {
            setBusy(false);
        }
    };
    const usersOf = (id: number) => products.filter((p) => p.templates_pack_label === id || p.templates_box_label === id || p.templates_pallet_label === id).length;
    const deleteCurrent = async () => {
        setMoreOpen(false);
        if (labelId === null) return;
        const count = usersOf(labelId);
        if (!window.confirm(count > 0 ? t("tpl.deleteUsed", { count }) : t("tpl.deleteAsk"))) return;
        try {
            await client.labels.delete(labelId);
            setSavedSig(sig);
            setHubNotice(t("tpl.deleted", { name: labelName }));
            setLabelId(null);
            setView("hub");
            loadTemplates();
        } catch {
            showToast(t("tpl.failed"), "bad");
        }
    };
    const copyText = async (text: string, done: string) => {
        setMoreOpen(false);
        try {
            await navigator.clipboard.writeText(text);
            showToast(done);
        } catch {
            showToast(t("ed.copyFailed"), "bad");
        }
    };
    const printHere = () => {
        setMoreOpen(false);
        const current = docRef.current;
        const k = 2;
        const canvas = document.createElement("canvas");
        canvas.width = current.canvas.width * k;
        canvas.height = current.canvas.height * k;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderLabel(ctx, current, previewData, { pixelRatio: k, showZones: false, blankMissing: true });
        const url = canvas.toDataURL("image/png");
        const win = window.open("", "_blank");
        if (!win) {
            showToast(t("designer.allowPopupsForPrint"), "bad");
            return;
        }
        const { widthCm, heightCm } = current.canvas;
        win.document.write(`<html><head><title>${t("designer.printLabelTitle", { name: labelName })}</title><style>
body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#fff}
img{width:100%;max-width:${widthCm}cm;height:auto;display:block}
@page{margin:0;size:${widthCm}cm ${heightCm}cm}
@media print{img{width:${widthCm}cm;height:${heightCm}cm}}
</style></head><body><img src="${url}"><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
        win.document.close();
    };

    // ── pointer: select, move, resize, pan ──
    const panKey = (e: React.PointerEvent) => e.ctrlKey || e.altKey || spaceDown.current || e.button === 1;
    const capture = (e: React.PointerEvent) => {
        try {
            stageRef.current?.setPointerCapture(e.pointerId);
        } catch {
            // the pointer is gone already
        }
    };
    const onElementDown = (e: React.PointerEvent, id: string) => {
        if (e.button !== 0 || panKey(e)) return;
        e.stopPropagation();
        e.preventDefault();
        const el = docRef.current.elements.find((x) => x.id === id);
        if (!el) return;
        setSelectedId(id);
        closePopovers();
        interaction.current = { kind: "drag", id, startX: el.x, startY: el.y, px: e.clientX, py: e.clientY };
        capture(e);
    };
    const onHandleDown = (e: React.PointerEvent, el: LabelElement, handle: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        interaction.current = { kind: "resize", handle, px: e.clientX, py: e.clientY, el: { ...el } };
        capture(e);
    };
    const onStageDown = (e: React.PointerEvent) => {
        if (panKey(e)) {
            e.preventDefault();
            interaction.current = { kind: "pan", px: e.clientX, py: e.clientY, pan };
            autoFit.current = false;
            setPanning(true);
            capture(e);
            return;
        }
        if (e.button === 0) {
            setSelectedId(null);
            closePopovers();
        }
    };
    const onStageMove = (e: React.PointerEvent) => {
        const it = interaction.current;
        if (!it) return;
        const s = zoomRef.current;
        if (it.kind === "pan") {
            setPan({ x: it.pan.x + e.clientX - it.px, y: it.pan.y + e.clientY - it.py });
            return;
        }
        const step = ppmRef.current;
        const snapTo = (v: number) => (snapRef.current ? Math.round(v / step) * step : v);
        if (it.kind === "drag") {
            const x = snapTo(it.startX + (e.clientX - it.px) / s);
            const y = snapTo(it.startY + (e.clientY - it.py) / s);
            setDocState((d) => ({ ...d, elements: d.elements.map((el) => (el.id === it.id ? ({ ...el, x, y } as LabelElement) : el)) }));
            return;
        }
        const el = it.el;
        const { handle } = it;
        const dx = (e.clientX - it.px) / s;
        const dy = (e.clientY - it.py) / s;
        let { x, y, w, h } = el;
        if (((el.rotation % 360) + 360) % 360 === 0) {
            let left = el.x;
            let top = el.y;
            let right = el.x + el.w;
            let bottom = el.y + el.h;
            if (handle.includes("e")) right = snapTo(right + dx);
            if (handle.includes("w")) left = snapTo(left + dx);
            if (handle.includes("s")) bottom = snapTo(bottom + dy);
            if (handle.includes("n")) top = snapTo(top + dy);
            if (right - left < 1) {
                if (handle.includes("w")) left = right - 1;
                else right = left + 1;
            }
            if (bottom - top < 1) {
                if (handle.includes("n")) top = bottom - 1;
                else bottom = top + 1;
            }
            if (isEan13(el) && (handle.includes("e") || handle.includes("w"))) {
                const width = Math.max(1, Math.round((right - left) / 95)) * 95;
                if (handle.includes("w")) left = right - width;
                else right = left + width;
            }
            x = left;
            y = top;
            w = right - left;
            h = bottom - top;
        } else {
            const local = rotatePoint(dx, dy, -el.rotation);
            if (handle.includes("e")) w = Math.max(1, el.w + local.x);
            if (handle.includes("w")) {
                w = Math.max(1, el.w - local.x);
                const shift = rotatePoint(el.w - w, 0, el.rotation);
                x += shift.x;
                y += shift.y;
            }
            if (handle.includes("s")) h = Math.max(1, el.h + local.y);
            if (handle.includes("n")) {
                h = Math.max(1, el.h - local.y);
                const shift = rotatePoint(0, el.h - h, el.rotation);
                x += shift.x;
                y += shift.y;
            }
            if (isEan13(el)) w = Math.max(1, Math.round(w / 95)) * 95;
        }
        setDocState((d) => ({ ...d, elements: d.elements.map((cur) => (cur.id === el.id ? ({ ...cur, x, y, w, h } as LabelElement) : cur)) }));
    };
    const onStageUp = (e: React.PointerEvent) => {
        if (!interaction.current) return;
        if (interaction.current.kind === "pan") setPanning(false);
        interaction.current = null;
        try {
            stageRef.current?.releasePointerCapture(e.pointerId);
        } catch {
            // released already
        }
    };

    // Wheel zooms around the pointer.
    useEffect(() => {
        const el = stageRef.current;
        if (!el || view !== "editor") return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cxp = e.clientX - rect.left - rect.width / 2;
            const cyp = e.clientY - rect.top - rect.height / 2;
            const old = zoomRef.current;
            const next = clamp(old * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.1, 8);
            const k = next / old;
            autoFit.current = false;
            setPan((p) => ({ x: cxp - (cxp - p.x) * k, y: cyp - (cyp - p.y) * k }));
            setZoom(next);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [view]);
    const zoomBy = (factor: number) => {
        autoFit.current = false;
        setZoom((z) => clamp(z * factor, 0.1, 8));
    };

    // ── keyboard ──
    const keys = useRef({ undo, redo, save, duplicate, remove, nudge, addText, addFrame, addLine });
    keys.current = { undo, redo, save, duplicate, remove, nudge, addText, addFrame, addLine };
    useEffect(() => {
        if (view !== "editor") return;
        const down = (e: KeyboardEvent) => {
            const k = keys.current;
            const mod = e.ctrlKey || e.metaKey;
            if (e.code === "Space" && !editable(e.target)) {
                e.preventDefault();
                spaceDown.current = true;
                setSpace(true);
                return;
            }
            if (mod && e.code === "KeyS") {
                e.preventDefault();
                void k.save();
                return;
            }
            if (editable(e.target)) return;
            if (mod && e.code === "KeyZ") {
                e.preventDefault();
                if (e.shiftKey) k.redo();
                else k.undo();
                return;
            }
            if (mod && e.code === "KeyY") {
                e.preventDefault();
                k.redo();
                return;
            }
            if (mod && e.code === "KeyD") {
                e.preventDefault();
                k.duplicate();
                return;
            }
            if (e.key === "Escape") {
                setSelectedId(null);
                setEuOpen(false);
                setMoreOpen(false);
                setCodeMenu(false);
                return;
            }
            if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current) {
                e.preventDefault();
                k.remove();
                return;
            }
            if (e.key.startsWith("Arrow") && selectedRef.current) {
                e.preventDefault();
                const step = (snapRef.current ? ppmRef.current : 1) * (e.shiftKey ? 10 : 1);
                k.nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
                return;
            }
            if (mod || e.altKey) return;
            if (e.code === "KeyT") k.addText();
            else if (e.code === "KeyR") k.addFrame();
            else if (e.code === "KeyL") k.addLine();
            else if (e.code === "KeyF") setLeftTab("fields");
            else if (e.code === "KeyB") setCodeMenu((v) => !v);
        };
        const up = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                spaceDown.current = false;
                setSpace(false);
            }
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, [view]);

    if (view === "hub") {
        return (
            <TemplateHub
                templates={templates}
                products={products}
                makeStarter={makeStarter}
                onOpen={openTemplate}
                onCreate={createTemplate}
                onCopy={async (raw) => {
                    const parsed = parseScheme(raw);
                    await client.labels.create({ name: t("ed.copyName", { name: raw.name }).slice(0, 100), scheme: parsed ?? raw.scheme });
                    loadTemplates();
                }}
                onDelete={async (raw) => {
                    await client.labels.delete(raw.id);
                    if (labelId === raw.id) setLabelId(null);
                    loadTemplates();
                }}
                notice={hubNotice}
            />
        );
    }

    // ── the editor ──
    const c = doc.canvas;
    const size = sizeMm(c);
    const s = zoom;
    const paperW = c.width * s;
    const paperH = c.height * s;
    const mmPx = ppm * s;
    const tick = mmPx * (mmPx * 5 >= 6 ? 5 : 10);
    const ruler = (dir: "x" | "y"): React.CSSProperties => ({
        backgroundImage: `repeating-linear-gradient(${dir === "x" ? "90deg" : "180deg"}, rgb(var(--lp-ink) / 0.35) 0 1px, transparent 1px ${tick}px)`,
    });
    const gridLine = (alpha: number) => `rgba(47,111,208,${alpha})`;
    const gridStyle: React.CSSProperties = mmPx >= 4
        ? {
            backgroundImage: [
                `linear-gradient(to right, ${gridLine(0.22)} 1px, transparent 1px)`,
                `linear-gradient(to bottom, ${gridLine(0.22)} 1px, transparent 1px)`,
                `linear-gradient(to right, ${gridLine(0.08)} 1px, transparent 1px)`,
                `linear-gradient(to bottom, ${gridLine(0.08)} 1px, transparent 1px)`,
            ].join(","),
            backgroundSize: `${mmPx * 5}px ${mmPx * 5}px, ${mmPx * 5}px ${mmPx * 5}px, ${mmPx}px ${mmPx}px, ${mmPx}px ${mmPx}px`,
        }
        : {
            backgroundImage: `linear-gradient(to right, ${gridLine(0.16)} 1px, transparent 1px), linear-gradient(to bottom, ${gridLine(0.16)} 1px, transparent 1px)`,
            backgroundSize: `${mmPx * 5}px ${mmPx * 5}px`,
        };

    const tools: Array<{ id: string; icon: DIconName; label: string; run: () => void; hidden?: boolean }> = [
        { id: "text", icon: "text", label: t("ed.tool.text"), run: addText },
        { id: "field", icon: "field", label: t("ed.tool.field"), run: () => setLeftTab("fields") },
        { id: "barcode", icon: "barcode", label: t("ed.tool.barcode"), run: () => setCodeMenu((v) => !v) },
        { id: "frame", icon: "frame", label: t("ed.tool.frame"), run: addFrame },
        { id: "line", icon: "line", label: t("ed.tool.line"), run: addLine },
        { id: "table", icon: "table", label: t("ed.tool.table"), run: addTable, hidden: type !== "pallet" },
        { id: "image", icon: "image", label: t("ed.tool.image"), run: () => pickPicture("add") },
    ];
    const euAll = eu.ready === eu.total;
    const menuItem = "flex min-h-[38px] w-full items-center rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink transition hover:bg-lp-raised disabled:opacity-50";

    return (
        <div className="relative flex h-full min-h-[560px] flex-col gap-3">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/bmp,image/webp" className="hidden" onChange={(e) => { void onPicture(e.target.files?.[0]); e.target.value = ""; }} />

            {/* One row: back, name, tools, preview product, view, undo, EU, save, more */}
            <div className="lp-glass relative z-30 flex flex-wrap items-center gap-2 rounded-[18px] p-2">
                <button type="button" onClick={backToHub} className="flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-lp-line bg-lp-surface pl-2 pr-3 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                    <DIcon name="back" className="h-4 w-4" />
                    {t("ed.back")}
                </button>
                <div className="flex min-w-0 flex-col leading-tight">
                    <label htmlFor="ed-name" className="sr-only">{t("ed.nameLabel")}</label>
                    <input
                        id="ed-name"
                        ref={nameRef}
                        value={labelName}
                        maxLength={100}
                        placeholder={t("ed.namePlaceholder")}
                        title={labelName}
                        onChange={(e) => setLabelName(e.target.value)}
                        className="w-[180px] rounded-[6px] bg-transparent px-1 py-0.5 text-[16px] font-extrabold text-lp-ink outline-none transition hover:bg-lp-surface focus:bg-lp-surface"
                    />
                    <span className="flex items-center gap-1.5 whitespace-nowrap px-1 text-[12px] font-bold text-lp-ink-3">
                        <TypeChip type={type} className="px-2 py-0 text-[11px]">{t(`tpl.type.${type}`)}</TypeChip>
                        <span className="font-mono">{fmt(size.w, lang)}×{fmt(size.h, lang)} {t("ed.unitMm")}</span>
                        {dirty ? <span className="text-lp-warn">● {t("ed.unsaved")}</span> : <span className="font-mono">· {c.dpi} dpi</span>}
                    </span>
                </div>
                <div className="relative">
                    <div role="toolbar" aria-label={t("ed.tools")} className="flex gap-0.5 rounded-[12px] bg-lp-ink/[0.05] p-[3px]">
                        {tools.filter((tool) => !tool.hidden).map((tool) => (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={tool.run}
                                aria-label={tool.label}
                                title={tool.label}
                                aria-expanded={tool.id === "barcode" ? codeMenu : undefined}
                                className={cx(
                                    "flex h-[38px] w-[34px] items-center justify-center rounded-[9px] transition",
                                    tool.id === "barcode" && codeMenu ? "bg-lp-surface text-lp-accent-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-2 hover:bg-lp-surface hover:text-lp-ink",
                                )}
                            >
                                <DIcon name={tool.icon} />
                            </button>
                        ))}
                    </div>
                    {codeMenu && (
                        <div role="menu" className="lp-card absolute left-0 top-[48px] z-40 flex w-[280px] flex-col p-1.5">
                            <span className="px-2.5 pb-1 pt-1.5 text-[12px] font-extrabold text-lp-ink-3">{t("ed.barcodeFrom")}</span>
                            {barcodeTemplates.length === 0 ? (
                                <span className="px-2.5 py-2 text-[13px] text-lp-ink-2">{t("ed.noBarcodeTemplates")}</span>
                            ) : barcodeTemplates.map((tpl) => (
                                <button key={tpl.id} type="button" role="menuitem" className={menuItem} onClick={() => addBarcode(tpl)}>
                                    <DIcon name="barcode" className="mr-2 h-4 w-4 text-lp-ink-3" />
                                    <span className="truncate">{tpl.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <span className="flex-1" />
                <div className="flex min-h-[40px] items-center gap-2 rounded-[12px] border border-lp-line bg-lp-surface px-2.5" title={t("ed.previewHint")}>
                    <DIcon name="eye" className="h-4 w-4 text-lp-ink-3" />
                    <label htmlFor="ed-product" className="sr-only">{t("ed.previewProduct")}</label>
                    <select id="ed-product" value={productId} onChange={(e) => chooseProduct(e.target.value)} className="max-w-[140px] bg-transparent text-[13px] font-extrabold text-lp-ink outline-none">
                        <option value="">{t("ed.sampleProduct")}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <Seg
                    label={t("ed.showWhat")}
                    size="sm"
                    value={mode}
                    onChange={setMode}
                    options={[{ value: "data", label: t("ed.showData"), title: t("ed.showDataHint") }, { value: "fields", label: t("ed.showFields"), title: t("ed.showFieldsHint") }]}
                />
                <button type="button" onClick={undo} disabled={past.current.length === 0} aria-label={t("ed.undo")} title={t("ed.undoHint")} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:text-lp-ink disabled:cursor-not-allowed disabled:opacity-45">
                    <DIcon name="undo" />
                </button>
                {euOn && (
                    <button
                        type="button"
                        data-eu-toggle
                        aria-expanded={euOpen}
                        onClick={() => { setEuOpen((v) => !v); setMoreOpen(false); setCodeMenu(false); }}
                        className={cx("flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-[12px] px-3 text-[13px] font-extrabold", euAll ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-warn-bg text-lp-warn")}
                    >
                        <DIcon name={euAll ? "check" : "warn"} className="h-4 w-4" />
                        {euAll ? t("ed.euOk") : t("ed.euGap", { ready: eu.ready, total: eu.total })}
                    </button>
                )}
                <button type="button" onClick={() => void save()} disabled={busy} className="min-h-[40px] rounded-[12px] px-[18px] text-[14px] font-extrabold text-[#fff] transition lp-btn-primary hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                    {t("ed.save")}
                </button>
                <div className="relative">
                    <button type="button" aria-label={t("ed.more")} aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => { setMoreOpen((v) => !v); setEuOpen(false); setCodeMenu(false); }} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:text-lp-ink">
                        <DIcon name="more" />
                    </button>
                    {moreOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                            <div role="menu" className="lp-card absolute right-0 top-[48px] z-40 flex w-[260px] flex-col p-1.5">
                                <button type="button" role="menuitem" className={menuItem} onClick={printHere}>{t("ed.menu.print")}</button>
                                <button type="button" role="menuitem" className={menuItem} onClick={() => void copyText(labelToZpl(doc, previewData), t("designer.zplCopied"))}>{t("ed.menu.zpl")}</button>
                                <button type="button" role="menuitem" className={menuItem} onClick={() => void copyText(JSON.stringify(doc, null, 2), t("designer.jsonCopied"))}>{t("ed.menu.json")}</button>
                                <span className="mx-2 my-1 h-px bg-lp-line" />
                                <button type="button" role="menuitem" className={menuItem} disabled={busy} onClick={() => void saveCopy()}>{t("ed.menu.copy")}</button>
                                {labelId !== null && (
                                    <button type="button" role="menuitem" className={cx(menuItem, "text-lp-bad hover:bg-lp-bad-bg")} onClick={() => void deleteCurrent()}>{t("ed.menu.delete")}</button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {euOpen && euOn && (
                <EuPopover
                    t={t}
                    check={eu}
                    busy={busy}
                    onClose={() => setEuOpen(false)}
                    onAdd={(requirement) => void addRequirement(requirement)}
                    onShow={(id) => { setSelectedId(id); setEuOpen(false); }}
                />
            )}

            <div className="flex min-h-0 flex-1 gap-3">
                <FieldsPanel
                    t={t}
                    tab={leftTab}
                    onTab={setLeftTab}
                    fields={fields}
                    used={used}
                    onAdd={addFieldDef}
                    onShow={showField}
                    elements={doc.elements}
                    canvas={c}
                    labelOf={labelOf}
                    hidden={hidden}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onToggle={toggleHidden}
                />

                <section
                    ref={stageRef}
                    aria-label={t("ed.stageLabel")}
                    className={cx("lp-stage relative min-w-0 flex-1 touch-none overflow-hidden rounded-[20px] border border-lp-line", panning ? "cursor-grabbing" : space ? "cursor-grab" : "")}
                    onPointerDown={onStageDown}
                    onPointerMove={onStageMove}
                    onPointerUp={onStageUp}
                    onPointerCancel={onStageUp}
                >
                    <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(${pan.x}px, ${pan.y}px) translate(-50%, -50%)` }}>
                        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-[-20px] h-[12px]" style={{ width: paperW, ...ruler("x") }} />
                        <div aria-hidden="true" className="pointer-events-none absolute left-[-20px] top-0 w-[12px]" style={{ height: paperH, ...ruler("y") }} />
                        <span aria-hidden="true" className="pointer-events-none absolute left-0 top-[-38px] text-[10px] font-bold text-lp-ink-3">0</span>
                        <span aria-hidden="true" className="pointer-events-none absolute top-[-38px] whitespace-nowrap text-[10px] font-bold text-lp-ink-3" style={{ left: paperW, transform: "translateX(-100%)" }}>{fmt(size.w, lang)} {t("ed.unitMm")}</span>
                        <span aria-hidden="true" className="pointer-events-none absolute left-[-24px] whitespace-nowrap text-[10px] font-bold text-lp-ink-3" style={{ top: paperH + 4, transform: "translateX(-100%) rotate(-90deg)", transformOrigin: "right top" }}>{fmt(size.h, lang)} {t("ed.unitMm")}</span>

                        <div className="relative rounded-[3px] bg-[#fff] shadow-[0_1px_0_rgba(0,0,0,.04),0_22px_50px_-18px_rgba(15,23,42,.45)]" style={{ width: paperW, height: paperH }}>
                            <canvas ref={previewCanvasRef} className="pointer-events-none absolute inset-0 rounded-[3px]" style={{ width: paperW, height: paperH }} />
                            {c.showGrid && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={gridStyle} />}
                            {doc.elements.map((el) => {
                                if (hidden.has(el.id)) return null;
                                const isSel = el.id === selectedId;
                                return (
                                    <div
                                        key={el.id}
                                        onPointerDown={(e) => onElementDown(e, el.id)}
                                        onDoubleClick={() => el.type === "text" && setFocusText((n) => n + 1)}
                                        className={cx(
                                            "absolute cursor-move",
                                            isSel ? "z-10 outline outline-[1.5px] outline-[rgb(var(--lp-accent))]" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-[rgb(var(--lp-accent)/0.6)]",
                                        )}
                                        style={{ left: el.x * s, top: el.y * s, width: el.w * s, height: el.h * s, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
                                    >
                                        {isSel && !panning && (
                                            <>
                                                <span className="pointer-events-none absolute left-0 top-[-24px] whitespace-nowrap rounded-[6px] bg-[rgb(var(--lp-accent))] px-1.5 py-px font-mono text-[11px] font-semibold text-[#fff]">
                                                    {fmt(toMm(el.w, c), lang)} × {fmt(toMm(el.h, c), lang)} {t("ed.unitMm")}
                                                </span>
                                                {HANDLES.map(([handle, place, cursor]) => (
                                                    <span
                                                        key={handle}
                                                        onPointerDown={(e) => onHandleDown(e, el, handle)}
                                                        className={cx("absolute h-[9px] w-[9px] rounded-[2px] border-[1.5px] border-[rgb(var(--lp-accent))] bg-[#fff]", place)}
                                                        style={{ cursor }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {doc.elements.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
                            <span className="lp-glass rounded-[12px] px-3.5 py-2 text-[13px] font-bold text-lp-ink-2">{t("ed.emptyHint")}</span>
                        </div>
                    ) : mode === "data" && product && unfilled.length > 0 && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
                            <span className="lp-glass max-w-[640px] rounded-[12px] px-3.5 py-2 text-center text-[12px] font-bold leading-snug text-lp-warn">
                                ▲ {t("ed.unfilled", { product: product.name, fields: unfilled.join(", ") })}
                            </span>
                        </div>
                    )}

                    <div className="lp-glass absolute bottom-3.5 left-3.5 flex items-center gap-1 rounded-[13px] p-1" onPointerDown={(e) => e.stopPropagation()}>
                        <button type="button" aria-pressed={c.showGrid} onClick={() => setDoc((d) => ({ ...d, canvas: { ...d.canvas, showGrid: !d.canvas.showGrid } }))} className={cx("flex min-h-[34px] items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-extrabold transition", c.showGrid ? "bg-lp-surface text-lp-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-3 hover:text-lp-ink")}>
                            <DIcon name="grid" className="h-[15px] w-[15px]" />
                            {t("ed.grid")}
                        </button>
                        <button type="button" aria-pressed={snap} onClick={() => { setSnap((v) => !v); write("local", LS_SNAP, snap ? "0" : "1"); }} className={cx("flex min-h-[34px] items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-extrabold transition", snap ? "bg-lp-surface text-lp-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-3 hover:text-lp-ink")} title={t("ed.snapHint")}>
                            <DIcon name="magnet" className="h-[15px] w-[15px]" />
                            {t("ed.snap")}
                        </button>
                    </div>
                    <div className="lp-glass absolute bottom-3.5 right-3.5 flex items-center gap-0.5 rounded-[13px] p-1" onPointerDown={(e) => e.stopPropagation()}>
                        <button type="button" aria-label={t("ed.zoomOut")} onClick={() => zoomBy(1 / 1.2)} className="h-[34px] w-[34px] rounded-[9px] text-[16px] font-extrabold text-lp-ink-2 transition hover:bg-lp-surface">−</button>
                        <span className="min-w-[52px] text-center font-mono text-[12px] font-bold text-lp-ink" title={t("ed.zoomHint")}>{Math.round(((zoom * ppm) / (203 / 25.4)) * 100)}%</span>
                        <button type="button" aria-label={t("ed.zoomIn")} onClick={() => zoomBy(1.2)} className="h-[34px] w-[34px] rounded-[9px] text-[16px] font-extrabold text-lp-ink-2 transition hover:bg-lp-surface">+</button>
                        <button type="button" aria-label={t("ed.zoomFit")} title={t("ed.zoomFit")} onClick={() => { autoFit.current = true; fit(); }} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-lp-ink-2 transition hover:bg-lp-surface">
                            <DIcon name="fit" className="h-4 w-4" />
                        </button>
                    </div>

                    {toast && (
                        <div role="status" className="absolute bottom-[64px] left-1/2 z-20 flex max-w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-center gap-3 rounded-[12px] bg-[#0B1324] px-4 py-2.5 text-[13px] font-bold text-[#fff] shadow-[0_20px_40px_-14px_rgba(0,0,0,.5)]" onPointerDown={(e) => e.stopPropagation()}>
                            <span className={toast.tone === "ok" ? "text-[#5DD39E]" : toast.tone === "info" ? "text-[#9CC8FF]" : "text-[#FF9C93]"} aria-hidden="true">{toast.tone === "ok" ? "✓" : toast.tone === "info" ? "ℹ" : "■"}</span>
                            <span className="min-w-0 flex-1">{toast.text}</span>
                            {toast.action && (
                                <button type="button" onClick={() => { const run = toast.action!.run; setToast(null); run(); }} className="whitespace-nowrap font-extrabold text-[#9CC8FF] hover:underline">
                                    {toast.action.label}
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <Inspector
                    t={t}
                    lang={lang}
                    doc={doc}
                    selected={selected}
                    update={update}
                    setDoc={setDoc}
                    barcodeTemplates={barcodeTemplates}
                    fields={fields}
                    labelOf={labelOf}
                    focusText={focusText}
                    onDuplicate={duplicate}
                    onDelete={remove}
                    onLayer={moveLayer}
                    onReplaceImage={() => pickPicture("replace")}
                />
            </div>
        </div>
    );
}
