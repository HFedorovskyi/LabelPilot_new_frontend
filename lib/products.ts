// Products (nomenclature): the rules the Products page, the product page and the menu counter
// share. The server stores the products; stations get them only when the server hands them
// the data set (push, USB file), never by themselves.

import { stationDelivery, type Station } from "@/lib/stations";

export type Product = {
    id: number;
    name: string;
    article: string;
    exp_date: number;
    close_box_counter: number;
    is_fixed_weight: boolean;
    fixed_weight_grams: number;
    min_weight_grams: number;
    max_weight_grams: number;
    portion_container: number | null;
    box_container: number | null;
    templates_pack_label: number | null;
    templates_box_label: number | null;
    folder: number | null;
    extra_data: Record<string, unknown> | null;
    created: string;
    edited: string;
};

export type Folder = { id: number; name: string; order: number; item_count: number };
export type Attribute = { id: number; name: string };
export type Pack = { id: number; name: string };
export type Template = { id: number; name: string; scheme?: { canvas?: { labelType?: string } } };

/** A station refuses to print a pack without a pack label template. */
export const hasPackTemplate = (product: Product) => product.templates_pack_label != null;

/** Templates for the unit label (none marked = an older template, a unit label) and the box label. */
export const isPackTemplate = (template: Template) => {
    const kind = template.scheme?.canvas?.labelType;
    return !kind || kind === "pack";
};
export const isBoxTemplate = (template: Template) => template.scheme?.canvas?.labelType === "box";

/**
 * Tolerable negative error of a prepackage with a fixed nominal quantity, in grams
 * (EU Directive 76/211/EEC, Annex I — the ℮ mark).
 */
export function tolerableNegativeError(grams: number): number {
    if (grams <= 50) return grams * 0.09;
    if (grams <= 100) return 4.5;
    if (grams <= 200) return grams * 0.045;
    if (grams <= 300) return 9;
    if (grams <= 500) return grams * 0.03;
    if (grams <= 1000) return 15;
    if (grams <= 10000) return grams * 0.015;
    if (grams <= 15000) return 150;
    return grams * 0.01;
}

/** Stations that take new data now or by USB stick (a seat problem blocks data). */
export function receivingStations(stations: Station[]): Station[] {
    return stations.filter((station) => stationDelivery(station) !== "blocked");
}

const handedOver = (station: Station) => (station.data_pushed_at ? Date.parse(station.data_pushed_at) : 0);

/** Products changed after some receiving station last got the data. */
export function productsNotOnStations(products: Product[], stations: Station[]): Product[] {
    const receiving = receivingStations(stations);
    if (receiving.length === 0) return [];
    const oldest = Math.min(...receiving.map(handedOver));
    return products.filter((product) => Date.parse(product.edited) > oldest);
}

/** Receiving stations that miss at least one product change. */
export function stationsBehind(products: Product[], stations: Station[]): Station[] {
    const newest = Math.max(0, ...products.map((product) => Date.parse(product.edited)));
    return receivingStations(stations).filter((station) => handedOver(station) < newest);
}
