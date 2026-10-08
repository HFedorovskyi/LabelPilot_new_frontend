"use client";

// A label drawn the way the editor draws it, scaled to fit its box: template cards and
// the starter gallery.

import React, { useEffect, useRef, useState } from "react";
import type { LabelDoc } from "@/lib/label/types";
import { imagesReady, labelFontsReady, renderLabel } from "@/lib/label/renderer";

export default function LabelThumb({ doc, data, className }: { doc: LabelDoc; data: Record<string, any>; className?: string }) {
    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const k = box.w && box.h ? Math.min(box.w / doc.canvas.width, box.h / doc.canvas.height) : 0;
    const w = Math.max(1, Math.round(doc.canvas.width * k));
    const h = Math.max(1, Math.round(doc.canvas.height * k));

    useEffect(() => {
        if (!k) return;
        let alive = true;
        const draw = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            renderLabel(ctx, doc, data, { scale: k, pixelRatio: dpr, showZones: false, barcodePlaceholder: true, blankMissing: true });
        };
        draw();
        void Promise.all([imagesReady(doc), labelFontsReady()]).then(() => alive && draw());
        return () => {
            alive = false;
        };
    }, [doc, data, k, w, h]);

    return (
        <div ref={boxRef} className={className ?? "flex h-full w-full items-center justify-center"}>
            {k > 0 && (
                <canvas
                    ref={canvasRef}
                    style={{ width: w, height: h }}
                    className="rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,.04),0_14px_30px_-14px_rgba(15,23,42,.45)]"
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
