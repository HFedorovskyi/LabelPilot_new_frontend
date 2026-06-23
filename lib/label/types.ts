export type ElementType = "text" | "rect" | "barcode" | "table";

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

export interface TableColumn {
    id: string; // unique internal id for dragging/react keys
    key: string; // The data field identifier (e.g. 'article', 'weight_netto_pack')
    title: string;
    widthRatio: number; // Percentage 0-100 indicating relative width
}

export interface TableElement extends LabelElementBase {
    type: "table";
    columns: TableColumn[];
    groupBy: 'none' | 'nomenclature' | 'batch';
    sortBy: 'name' | 'date' | 'none';
    fontSize: number;
    showHeaders: boolean;
    showBorders: boolean;
    fontFamily?: string;
    fontStyle?: "normal" | "italic";
    maxRows?: number;
}

export type LabelElement = TextElement | RectElement | BarcodeElement | TableElement;

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
    labelType?: 'pack' | 'box' | 'pallet';
    printedZones: PrintedZone[];
}

export interface LabelDoc {
    version: 1;
    canvas: CanvasConfig;
    elements: LabelElement[];
}
