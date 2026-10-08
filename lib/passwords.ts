// Password rules for server users, answered while typing; the server checks the same plus a
// list of common passwords (backend api/passwords.py). Texts: pw.rule, pw.short, pw.digits,
// pw.login, pw.ok.

/** The i18n key of what is wrong with the password, or null (also for an empty one). */
export function passwordProblem(password: string, login: string): string | null {
    if (!password) return null;
    if (password.length < 8) return "pw.short";
    if (/^\d+$/.test(password)) return "pw.digits";
    if (login.length >= 3 && password.toLowerCase().includes(login.toLowerCase())) return "pw.login";
    return null;
}

// Easy to dictate, ~60 bits: three groups of four from letters and digits that do not get confused.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
    return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}
