import { LabelDoc, LabelElement, TextElement, RectElement, BarcodeElement, TableElement, TableColumn } from "./types";

export function processDynamicText(
    text: string,
    data: Record<string, any>,
    opts?: { minLength?: number }
) {
    return text.replace(/{{\s*([^{}]+)\s*}}/g, (match, key) => {
        const trimmedKey = key.trim();
        let value = data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match; // Modified line

        if (trimmedKey === "pack_number" || trimmedKey === "box_number") {
            if (/^\d+$/.test(value)) {
                value = value.padStart(12, "0");
            }
        } else if (
            opts?.minLength &&
            (trimmedKey === "pallet_number" || trimmedKey === "pack_counter") &&
            /^\d+$/.test(value)
        ) {
            value = value.padStart(opts.minLength, "0");
        }
        return value;
    });
}

export function renderLabel(
    ctx: CanvasRenderingContext2D,
    doc: LabelDoc,
    previewData: Record<string, any>,
    options: {
        scale?: number;
        showZones?: boolean;
        pixelRatio?: number;
    } = {}
) {
    const { scale = 1, showZones = true, pixelRatio = 1 } = options;
    const { canvas, elements } = doc;

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Background
    ctx.fillStyle = canvas.background || "#ffffff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.scale(scale * pixelRatio, scale * pixelRatio);

    // 1. Draw Printed Zones (if requested)
    if (showZones && canvas.printedZones) {
        drawPrintedZones(ctx, doc);
    }

    // 2. Draw Elements
    for (const el of elements) {
        ctx.save();

        // Move to element center for rotation
        const centerX = el.x + el.w / 2;
        const centerY = el.y + el.h / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        if (el.type === "text") {
            drawText(ctx, el as TextElement, previewData);
        } else if (el.type === "rect") {
            drawRect(ctx, el as RectElement);
        } else if (el.type === "barcode") {
            drawBarcode(ctx, el as BarcodeElement);
        } else if (el.type === "table") {
            drawTable(ctx, el as TableElement, previewData);
        }

        ctx.restore();
    }

    ctx.restore();
}

function drawText(
    ctx: CanvasRenderingContext2D,
    el: TextElement,
    previewData: Record<string, any>
) {
    const text = processDynamicText(el.text, previewData, {
        minLength: el.minLength,
    });
    const fontStyle = el.fontStyle || "normal";
    const fontWeight = el.fontWeight || 400;
    const fontSize = el.fontSize || 14;
    const fontFamily = el.fontFamily || "Inter, Arial, sans-serif";

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = el.color || "#000000";
    ctx.textBaseline = "top";

    const lines = wrapText(ctx, text, el.w);
    const lineHeight = fontSize * 1.1;
    const totalHeight = lines.length * lineHeight;

    // Vertical alignment (center by default in our HTML version)
    let y = el.y + (el.h - totalHeight) / 2;

    for (const line of lines) {
        const metrics = ctx.measureText(line);
        let x = el.x;

        if (el.textAlign === "center") {
            x = el.x + (el.w - metrics.width) / 2;
        } else if (el.textAlign === "right") {
            x = el.x + el.w - metrics.width;
        }

        ctx.fillText(line, x, y);

        if (el.textDecoration === "underline") {
            ctx.beginPath();
            ctx.moveTo(x, y + fontSize);
            ctx.lineTo(x + metrics.width, y + fontSize);
            ctx.strokeStyle = el.color || "#000000";
            ctx.lineWidth = Math.max(1, fontSize / 15);
            ctx.stroke();
        }

        y += lineHeight;
    }
}

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    if (!text) return [];
    const paragraphs = String(text).split("\n");
    const allLines: string[] = [];

    for (const para of paragraphs) {
        const words = para.split(" ");
        let currentLine = "";

        for (const word of words) {
            // First, handle the word itself if it's longer than maxWidth
            if (ctx.measureText(word).width > maxWidth) {
                // If we have something in currentLine, push it
                if (currentLine) {
                    allLines.push(currentLine);
                    currentLine = "";
                }

                // Splitting word by characters (rude but necessary)
                let charLine = "";
                for (const char of word) {
                    if (ctx.measureText(charLine + char).width > maxWidth) {
                        allLines.push(charLine);
                        charLine = char;
                    } else {
                        charLine += char;
                    }
                }
                currentLine = charLine;
                continue;
            }

            const testLine = currentLine ? currentLine + " " + word : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                allLines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) allLines.push(currentLine);
    }
    return allLines;
}

function drawRect(ctx: CanvasRenderingContext2D, el: RectElement) {
    const { x, y, w, h, fill, borderColor, borderWidth, borderRadius } = el;

    ctx.beginPath();
    if (borderRadius > 0) {
        const r = Math.min(borderRadius, w / 2, h / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    } else {
        ctx.rect(x, y, w, h);
    }
    ctx.closePath();

    if (fill && fill !== "transparent") {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (borderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.stroke();
    }
}

const imageCache = new Map<string, HTMLImageElement>();

function drawBarcode(ctx: CanvasRenderingContext2D, el: BarcodeElement) {
    if (!el.imageData) return;

    const src = `data:image/png;base64,${el.imageData}`;
    let img = imageCache.get(src);

    if (!img) {
        img = new Image();
        img.src = src;
        imageCache.set(src, img);
        img.onload = () => {
            // The designer's next render cycle will pick this up
        };
    }

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, el.x, el.y, el.w, el.h);
    } else {
        // Optional: Draw a placeholder while loading
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(el.x, el.y, el.w, el.h);
    }
}

function drawPrintedZones(ctx: CanvasRenderingContext2D, doc: LabelDoc) {
    const { canvas } = doc;
    const dpi = canvas.dpi || 203;

    for (const zone of canvas.printedZones) {
        const sizePx = (zone.sizeMm * dpi) / 25.4;
        let x = 0, y = 0, w = 0, h = 0;

        const widthPx = (canvas.widthCm * dpi) / 2.54;
        const heightPx = (canvas.heightCm * dpi) / 2.54;

        if (zone.side === "top") {
            w = widthPx;
            h = sizePx;
        } else if (zone.side === "bottom") {
            y = heightPx - sizePx;
            w = widthPx;
            h = sizePx;
        } else if (zone.side === "left") {
            w = sizePx;
            h = heightPx;
        } else if (zone.side === "right") {
            x = widthPx - sizePx;
            w = sizePx;
            h = heightPx;
        }

        ctx.save();
        ctx.fillStyle = zone.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, w, h);

        // Hatched pattern overlay (roughly)
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        for (let i = -1000; i < 2000; i += 8) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + h, y + h);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function drawTable(
    ctx: CanvasRenderingContext2D,
    el: TableElement,
    previewData: Record<string, any>
) {
    const { x, y, w, h, columns, fontSize, showHeaders, showBorders, fontFamily, fontStyle } = el;

    ctx.save();
    ctx.translate(x, y);

    const rowHeight = fontSize * 1.5;
    const padding = 4;
    const lineH = fontSize * 1.1;

    // Header height accounts for wrapped (multi-line) column titles
    let headerHeight = showHeaders ? rowHeight : 0;
    const headerLines: string[][] = [];
    if (showHeaders) {
        ctx.font = `bold ${fontSize}px ${fontFamily || "Inter"}`;
        let maxHeaderLines = 1;
        columns.forEach((col) => {
            const colWidth = (w * col.widthRatio) / 100;
            const lines = wrapText(ctx, col.title, colWidth - padding * 2);
            headerLines.push(lines);
            maxHeaderLines = Math.max(maxHeaderLines, lines.length);
        });
        headerHeight = Math.max(rowHeight, maxHeaderLines * lineH + padding * 2);
    }

    // Draw header (wrapped titles, top-aligned)
    if (showHeaders) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, w, headerHeight);
        ctx.font = `bold ${fontSize}px ${fontFamily || "Inter"}`;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "top";
        let currentX = 0;
        columns.forEach((col, ci) => {
            const colWidth = (w * col.widthRatio) / 100;
            headerLines[ci].forEach((line, li) => {
                ctx.fillText(line, currentX + padding, padding + li * lineH, colWidth - padding * 2);
            });
            currentX += colWidth;
        });
    }

    // Draw borders (horizontal lines)
    if (showBorders) {
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1;

        // Top border
        ctx.strokeRect(0, 0, w, h);

        // Header bottom line
        if (showHeaders) {
            ctx.beginPath();
            ctx.moveTo(0, headerHeight);
            ctx.lineTo(w, headerHeight);
            ctx.stroke();
        }

        // Column lines
        let currentX = 0;
        columns.forEach((col, idx) => {
            if (idx < columns.length - 1) {
                currentX += (w * col.widthRatio) / 100;
                ctx.beginPath();
                ctx.moveTo(currentX, 0);
                ctx.lineTo(currentX, h);
                ctx.stroke();
            }
        });
    }

    // Collect rows, then sort / group / draw
    let items: any[] = Array.isArray(previewData.items) ? [...previewData.items] : [previewData];

    if (el.sortBy === "name") {
        items.sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ru"));
    } else if (el.sortBy === "date") {
        items.sort((a, b) => String(a?.production_date_batch ?? "").localeCompare(String(b?.production_date_batch ?? "")));
    }

    if (el.maxRows && el.maxRows > 0) {
        items = items.slice(0, el.maxRows);
    }

    const totalCount = items.length;
    let drawnCount = 0;
    const footerH = Math.round(rowHeight * 3.0); // reserved strip for the page/total footer
    const bodyLimit = h - footerH;

    let currentY = headerHeight;

    // Draw a single data row; returns false if it doesn't fit (caller stops).
    const drawDataRow = (item: any): boolean => {
        ctx.font = `${fontStyle === "italic" ? "italic " : ""}${fontSize}px ${fontFamily || "Inter"}`;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "top";

        let maxLines = 1;
        const colLines: string[][] = [];
        columns.forEach((col) => {
            const colWidth = (w * col.widthRatio) / 100;
            const val = String(processDynamicText(`{{ ${col.key} }}`, item));
            const lines = wrapText(ctx, val, colWidth - padding * 2);
            colLines.push(lines);
            maxLines = Math.max(maxLines, lines.length);
        });

        const currentRowHeight = Math.max(rowHeight, maxLines * (fontSize * 1.1) + padding * 2);
        if (currentY + currentRowHeight > bodyLimit) return false;

        let currentX = 0;
        columns.forEach((col, colIdx) => {
            const colWidth = (w * col.widthRatio) / 100;
            colLines[colIdx].forEach((line, lineIdx) => {
                const lineY = currentY + padding + lineIdx * (fontSize * 1.1);
                ctx.fillText(line, currentX + padding, lineY, colWidth - padding * 2);
            });
            currentX += colWidth;
        });

        if (showBorders) {
            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, currentY + currentRowHeight);
            ctx.lineTo(w, currentY + currentRowHeight);
            ctx.stroke();
        }
        currentY += currentRowHeight;
        drawnCount++;
        return true;
    };

    // Draw a group-header band (carries the group's shared fields, incl. dates).
    const drawGroupHeader = (label: string): boolean => {
        if (currentY + rowHeight > bodyLimit) return false;
        ctx.fillStyle = "#e8edf3";
        ctx.fillRect(0, currentY, w, rowHeight);
        ctx.font = `bold ${fontSize}px ${fontFamily || "Inter"}`;
        ctx.fillStyle = "#0f172a";
        ctx.textBaseline = "middle";
        ctx.fillText(label, padding, currentY + rowHeight / 2, w - padding * 2);
        if (showBorders) {
            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, currentY + rowHeight);
            ctx.lineTo(w, currentY + rowHeight);
            ctx.stroke();
        }
        currentY += rowHeight;
        return true;
    };

    if (el.groupBy === "nomenclature" || el.groupBy === "batch") {
        const groupField = el.groupBy === "batch" ? "batch_number" : "name";
        const order: string[] = [];
        const groups: Record<string, any[]> = {};
        items.forEach((it) => {
            const k = String(it?.[groupField] ?? "—");
            if (!(k in groups)) { groups[k] = []; order.push(k); }
            groups[k].push(it);
        });

        for (const k of order) {
            const groupItems = groups[k];
            const first = groupItems[0] || {};
            let label: string;
            if (el.groupBy === "batch") {
                const prod = first.production_date_batch ? ` · Произв.: ${first.production_date_batch}` : "";
                const exp = first.exp_date_full ? ` · Годен до: ${first.exp_date_full}` : "";
                label = `Партия ${k}${prod}${exp}`;
            } else {
                label = String(k);
            }
            if (!drawGroupHeader(label)) break;
            let stop = false;
            for (const item of groupItems) {
                if (!drawDataRow(item)) { stop = true; break; }
            }
            if (stop) break;
        }
    } else {
        for (const item of items) {
            if (!drawDataRow(item)) break;
        }
    }

    // Page / total footer — always shown as a band at the bottom when the table has rows
    if (totalCount > 0) {
        const truncated = drawnCount < totalCount;
        const pages = truncated ? Math.max(2, Math.ceil(totalCount / Math.max(1, drawnCount))) : 1;
        const fy = h - footerH;
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, fy, w, footerH);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, fy);
        ctx.lineTo(w, fy);
        ctx.stroke();
        ctx.font = `bold ${Math.max(13, Math.round(fontSize * 1.8))}px ${fontFamily || "Inter"}`;
        ctx.fillStyle = "#1e293b";
        ctx.textBaseline = "middle";
        const txt = truncated
            ? `Стр. 1 / ${pages}   ·   показано ${drawnCount} из ${totalCount} позиций`
            : `Стр. 1 / 1   ·   всего ${totalCount} позиций`;
        ctx.fillText(txt, padding * 2, fy + footerH / 2, w - padding * 4);
    }

    ctx.restore();
}
