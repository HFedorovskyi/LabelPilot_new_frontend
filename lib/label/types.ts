export type ElementType = "text" | "rect" | "barcode";

export interface LabelElementBase {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number; // deg
}

export interface TextElement extends LabelElementBase {
    type: "text";
    text: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    fontFamily: string;
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    textDecoration: 'none' | 'underline';
    minLength?: number;
}

export interface RectElement extends LabelElementBase {
    type: "rect";
    fill: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
}

export type BarcodeType = string;

export interface BarcodeElement extends LabelElementBase {
    type: "barcode";
    value: string;
    barcodeType: string;
    showText: boolean;
    templateId?: number;
    imageData?: string; // base64 PNG
    error?: string;
}

export type LabelElement = TextElement | RectElement | BarcodeElement;

export interface PrintedZone {
    id: string;
    label: string;
    side: "top" | "bottom" | "left" | "right";
    sizeMm: number;
    color: string;
}

export interface CanvasConfig {
    width: number;
    height: number;
    widthCm: number;
    heightCm: number;
    dpi: number;
    background: string;
    showGrid: boolean;
    gridSize: number;
    printedZones: PrintedZone[];
}

export interface LabelDoc {
    version: 1;
    canvas: CanvasConfig;
    elements: LabelElement[];
}
