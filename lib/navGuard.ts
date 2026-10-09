// A page with unsaved changes registers a check here; the shell asks it before switching
// sections, so a click in the side menu does not silently drop the changes.

let guard: (() => boolean) | null = null;

export function setLeaveGuard(check: (() => boolean) | null): void {
    guard = check;
}

/** true when the current page may be left (nothing unsaved, or the user agreed). */
export function mayLeave(): boolean {
    return guard ? guard() : true;
}
