"use client";

// The barcode as the server draws it for a product: the picture, the data string and
// the server's warnings. Results are cached per structure and product.

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { cx } from "../stations/shared";
import { is2D, type BarcodeStructure } from "./model";

export type Preview = { png: string | null; data: string | null; warnings: string[]; errors: string[] };

const cache = new Map<string, Promise<Preview>>();

function fetchPreview(structure: BarcodeStructure, productId: string): Promise<Preview> {
    const key = `${productId}|${JSON.stringify(structure)}`;
    let hit = cache.get(key);
    if (!hit) {
        hit = api.barcodes
            .generate({ barcode_structure: structure, ...(productId ? { product_id: productId } : {}) })
            .then((res: { png?: string; data_string?: string; warnings?: string[]; errors?: string[] }) => ({
                png: res.png ?? null,
                data: res.data_string ?? null,
                warnings: Array.isArray(res.warnings) ? res.warnings : [],
                errors: Array.isArray(res.errors) ? res.errors : [],
            }))
            .catch((error: unknown) => ({ png: null, data: null, warnings: [], errors: [error instanceof Error ? error.message : String(error)] }));
        cache.set(key, hit);
        if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    }
    return hit;
}

/** The server's picture of the barcode, refreshed `delay` ms after the structure stops changing. */
export function useBarcodePreview(structure: BarcodeStructure | null, productId: string, delay = 0): { preview: Preview | null; loading: boolean } {
    const [preview, setPreview] = useState<Preview | null>(null);
    const [loading, setLoading] = useState(false);
    const key = structure ? `${productId}|${JSON.stringify(structure)}` : "";
    useEffect(() => {
        if (!structure || structure.fields.length === 0) {
            setPreview(null);
            return;
        }
        let alive = true;
        setLoading(true);
        const timer = window.setTimeout(() => {
            void fetchPreview(structure, productId).then((result) => {
                if (!alive) return;
                setPreview(result);
                setLoading(false);
            });
        }, delay);
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, delay]);
    return { preview, loading };
}

/** A drawn barcode on a white tile, or a grey stand-in while there is no picture. */
export function BarcodePicture({ type, preview, size = "md", dim = false }: { type: string; preview: Preview | null; size?: "sm" | "md"; dim?: boolean }) {
    const square = is2D(type);
    const box = size === "sm" ? (square ? "h-[92px] w-[92px]" : "h-[86px] w-[190px]") : square ? "h-[150px] w-[150px]" : "h-[120px] w-[280px]";
    return (
        <span className={cx("flex items-center justify-center rounded-[6px] bg-[#fff] p-2.5 shadow-[0_2px_12px_rgba(10,18,32,.18)]", dim && "opacity-70")}>
            {preview?.png ? (
                <img src={`data:image/png;base64,${preview.png}`} alt="" className={cx("object-contain", box)} />
            ) : (
                <span aria-hidden="true" className={cx(box, "block opacity-35")} style={square
                    ? { background: "conic-gradient(#121722 25%, #fff 0 50%, #121722 0 75%, #fff 0) 0 0 / 14px 14px", border: "5px solid #121722" }
                    : { backgroundImage: "repeating-linear-gradient(90deg,#121722 0,#121722 2px,#fff 2px,#fff 3px,#121722 3px,#121722 4px,#fff 4px,#fff 7px,#121722 7px,#121722 10px,#fff 10px,#fff 11px)" }}
                />
            )}
        </span>
    );
}
