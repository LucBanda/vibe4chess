export function normalizeUsername(input, fallback = "player") {
    const raw = typeof input === "string" ? input.trim() : "";
    const cleaned = raw
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 32);
    return cleaned.length > 0 ? cleaned : fallback;
}
