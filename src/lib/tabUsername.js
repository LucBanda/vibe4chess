import { normalizeUsername } from "./username.js";

const ACTIVE_TAB_USERNAME_KEY = "expo_chess_tab_username_v1";

export function getTabUsername() {
    try {
        if (typeof sessionStorage !== "undefined") {
            const raw = sessionStorage.getItem(ACTIVE_TAB_USERNAME_KEY);
            return normalizeUsername(raw, "player");
        }
    } catch {
        // Ignore storage errors and fallback.
    }
    return "player";
}

export function setTabUsername(username) {
    const normalized = normalizeUsername(username, "player");
    try {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(ACTIVE_TAB_USERNAME_KEY, normalized);
        }
    } catch {
        // Ignore storage errors.
    }
    return normalized;
}
