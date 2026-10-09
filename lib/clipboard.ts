// The admin panel is opened over plain http on the plant network (http://192.168.x.x:8000),
// where browsers hide navigator.clipboard; the old copy command still works there.

/** Copies text to the clipboard; false when the browser refused. */
export async function copyText(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // e.g. the window is not focused: try the old way below
        }
    }
    const before = document.activeElement as HTMLElement | null;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }
    area.remove();
    before?.focus();
    return ok;
}
