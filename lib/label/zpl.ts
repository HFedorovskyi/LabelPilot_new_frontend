import { LabelDoc, LabelElement, TextElement, RectElement, BarcodeElement, TableElement } from "./types";
import { processDynamicText } from "./renderer";

/**
 * Converts a Label Document to ZPL code.
 * Assumes 8 dots/mm (203 DPI) for coordinates.
 */
export function labelToZpl(doc: LabelDoc, data: Record<string, any> = {}): string {
    const { canvas, elements } = doc;
    const dpi = canvas.dpi || 203;

    // Convert cm to dots (8 dots/mm = 20.3 dots/cm)
    const widthDots = Math.round(canvas.widthCm * (dpi / 2.54));
    const heightDots = Math.round(canvas.heightCm * (dpi / 2.54));

    let zpl = "^XA\n";
    zpl += "^CI28\n"; // UTF-8 Encoding
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;

    // Process elements in order
    for (const el of elements) {
        switch (el.type) {
            case "text":
                zpl += textToZpl(el as TextElement, data, dpi);
                break;
            case "rect":
                zpl += rectToZpl(el as RectElement, dpi);
                break;
            case "barcode":
                zpl += barcodeToZpl(el as BarcodeElement, data, dpi);
                break;
            case "table":
                zpl += tableToZpl(el as TableElement, data, dpi);
                break;
        }
    }

    zpl += "^XZ";
    return zpl;
}

function textToZpl(el: TextElement, data: Record<string, any>, dpi: number): string {
    const x = Math.round(el.x);
    const y = Math.round(el.y);
    const text = processDynamicText(el.text, data, { minLength: el.minLength });

    // Basic ZPL font sizing (A is default, B, C, etc. are fixed)
    // ^A0 is Scalable font
    const fontSize = Math.round(el.fontSize || 20);

    // ^FB handles text wrapping
    const wrap = `^FB${Math.round(el.w)},999,0,${el.textAlign?.toUpperCase()[0] || 'L'},0`;

    return `^FO${x},${y}${wrap}^A0N,${fontSize},${fontSize}^FD${text}^FS\n`;
}

function rectToZpl(el: RectElement, dpi: number): string {
    const x = Math.round(el.x);
    const y = Math.round(el.y);
    const w = Math.round(el.w);
    const h = Math.round(el.h);
    const t = Math.round(el.borderWidth || 1);
    const r = Math.round(el.borderRadius || 0);

    // ^GBWidth,Height,Thickness,Color,Rounding
    // Rounding is 0-8
    const rounding = Math.min(8, Math.floor(r / 10));

    return `^FO${x},${y}^GB${w},${h},${t},B,${rounding}^FS\n`;
}

function barcodeToZpl(el: BarcodeElement, data: Record<string, any>, dpi: number): string {
    const x = Math.round(el.x);
    const y = Math.round(el.y);
    const value = processDynamicText(el.value, data);
    const h = Math.round(el.h);
    const w = Math.round(el.w);

    const type = el.barcodeType.toLowerCase();

    // Simplified mapping for common types
    if (type.includes("ean13")) {
        const mag = Math.max(1, Math.round(w / 95));
        return `^FO${x},${y}^BY${mag}^BE,${h},Y,N^FD${value}^FS\n`;
    } else if (type.includes("code128")) {
        const mag = Math.max(1, Math.round(w / 150)); // Rough estimate
        return `^FO${x},${y}^BY${mag}^BCN,${h},Y,N,N^FD${value}^FS\n`;
    } else if (type.includes("qrcode")) {
        const mag = Math.max(1, Math.round(w / 50));
        return `^FO${x},${y}^BQN,2,${mag}^FDQA,${value}^FS\n`;
    }

    // Fallback to Code 128
    return `^FO${x},${y}^BCN,${h},Y,N,N^FD${value}^FS\n`;
}

function tableToZpl(el: TableElement, data: Record<string, any>, dpi: number): string {
    const { x, y, w, h, columns, fontSize, showHeaders, showBorders } = el;
    const rowHeight = Math.round(fontSize * 1.5);
    const padding = 4;

    let zpl = `^FX Table ${el.id}\n`;
    let currentY = Math.round(y);

    // Headers
    if (showHeaders) {
        if (showBorders) {
            zpl += `^FO${Math.round(x)},${currentY}^GB${Math.round(w)},${rowHeight},1,B,0^FS\n`;
        }

        let currentX = Math.round(x);
        for (const col of columns) {
            const colWidth = Math.round((w * col.widthRatio) / 100);
            zpl += `^FO${currentX + padding},${currentY + padding}^A0N,${fontSize},${fontSize}^FD${col.title}^FS\n`;
            if (showBorders && currentX > Math.round(x)) {
                // Vertical line before column (except first)
                zpl += `^FO${currentX},${currentY}^GB1,${rowHeight},1,B,0^FS\n`;
            }
            currentX += colWidth;
        }
        currentY += rowHeight;
    }

    // Data Rows
    // If data.items exists, we loop, otherwise we show one row from data itself
    let items = Array.isArray(data.items) ? data.items : [data];

    // Enforce maxRows if specified
    if (el.maxRows && el.maxRows > 0) {
        items = items.slice(0, el.maxRows);
    }

    for (const item of items) {
        if (currentY + rowHeight > y + h) break; // Simple overflow check

        if (showBorders) {
            zpl += `^FO${Math.round(x)},${currentY}^GB${Math.round(w)},${rowHeight},1,B,0^FS\n`;
        }

        let currentX = Math.round(x);
        for (const col of columns) {
            const colWidth = Math.round((w * col.widthRatio) / 100);
            const val = processDynamicText(`{{ ${col.key} }}`, item);

            // Use ^FB for native ZPL wrapping
            // ^FBw,maxLines,lineSpacing,alignment,indent
            const fb = `^FB${colWidth - padding * 2},2,0,L,0`;
            zpl += `^FO${currentX + padding},${currentY + padding}${fb}^A0N,${fontSize},${fontSize}^FD${val}^FS\n`;

            if (showBorders && currentX > Math.round(x)) {
                zpl += `^FO${currentX},${currentY}^GB1,${rowHeight},1,B,0^FS\n`;
            }
            currentX += colWidth;
        }
        currentY += rowHeight;
    }

    // Final outer border if needed and not already drawn by rows
    if (showBorders) {
        zpl += `^FO${Math.round(x)},${Math.round(y)}^GB${Math.round(w)},${Math.round(h)},1,B,0^FS\n`;
    }

    return zpl;
}
