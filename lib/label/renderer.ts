import { LabelDoc, LabelElement, TextElement, RectElement, BarcodeElement } from "./types";

export function processDynamicText(
    text: string,
    data: Record<string, string>,
    opts?: { minLength?: number }
) {
    return text.replace(/{{\s*([^{}]+)\s*}}/g, (match, key) => {
        const trimmedKey = key.trim();
        let value = data[trimmedKey] || match;

        if (
            opts?.minLength &&
            (trimmedKey === "pack_number" ||
                trimmedKey === "box_number" ||
                trimmedKey === "pallet_number" ||
                trimmedKey === "pack_counter") &&
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
    previewData: Record<string, string>,
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
        }

        ctx.restore();
    }

    ctx.restore();
}

function drawText(
    ctx: CanvasRenderingContext2D,
    el: TextElement,
    previewData: Record<string, string>
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
    const paragraphs = text.split("\n");
    const allLines: string[] = [];

    for (const para of paragraphs) {
        const words = para.split(" ");
        let currentLine = "";

        for (const word of words) {
            const testLine = currentLine ? currentLine + " " + word : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                allLines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        allLines.push(currentLine);
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
