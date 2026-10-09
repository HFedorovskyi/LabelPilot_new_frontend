// The admin panel's barcode picture, drawn in the browser with bwip-js: the same BWIPP
// encoders the server used through treepoem and Ghostscript, with the options it used, so
// the preview keeps its look while the server no longer ships Ghostscript (AGPL).

const TWO_D = new Set(["qrcode", "gs1qrcode"]);
const INCH_MM = 25.4;
const PNG_PREFIX = "data:image/png;base64,";

/** The barcode as a base64 PNG (no data: prefix). Throws when the data cannot be encoded. */
export async function barcodePicture(type: string, data: string): Promise<string> {
    // bwip-js is large and only the barcode pages need it: load it on first use.
    const bwipjs = await import("bwip-js/browser");
    const options = TWO_D.has(type)
        ? { bcid: type, text: data, scale: 2 }
        : // treepoem's width "5" is inches; bwip-js takes millimetres.
          { bcid: type, text: data, scale: 2, includetext: true, textsize: 10, textyoffset: -10, width: 5 * INCH_MM };
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, options);
    return canvas.toDataURL("image/png").slice(PNG_PREFIX.length);
}
