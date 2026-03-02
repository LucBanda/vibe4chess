import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    normalizeLocalSession,
    parseLocalSession,
} from "./localSessionState.js";
import { normalizeUsername } from "./username.js";

const LOCAL_SESSIONS_KEY = "expo_chess_local_sessions_v1";
const ACTIVE_USERNAME_KEY = "expo_chess_active_username_v1";
let activeUsernameFallback = "player";

function getActiveUsernameFromTab() {
    try {
        if (typeof sessionStorage !== "undefined") {
            const raw = sessionStorage.getItem(ACTIVE_USERNAME_KEY);
            if (raw) {
                return normalizeUsername(raw, "player");
            }
        }
    } catch {
        // Ignore web storage errors.
    }
    return normalizeUsername(activeUsernameFallback, "player");
}

function setActiveUsernameInTab(username) {
    const normalized = normalizeUsername(username, "player");
    activeUsernameFallback = normalized;
    try {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(ACTIVE_USERNAME_KEY, normalized);
        }
    } catch {
        // Ignore web storage errors.
    }
    return normalized;
}

async function loadSessionMap() {
    const raw = await AsyncStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        // Ignore and return empty map.
    }
    return {};
}

export async function saveLocalSession(sessionData) {
    const normalized = normalizeLocalSession(
        sessionData,
        new Date().toISOString(),
    );
    const username = setActiveUsernameInTab(normalized.username);
    const allSessions = await loadSessionMap();
    allSessions[username] = normalized;
    await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(allSessions));
}

export async function loadLocalSession(preferredUsername = null) {
    const username = preferredUsername
        ? setActiveUsernameInTab(preferredUsername)
        : getActiveUsernameFromTab();
    const allSessions = await loadSessionMap();
    const candidate = allSessions[username];
    if (!candidate) {
        return null;
    }
    return parseLocalSession(JSON.stringify(candidate));
}

export async function clearLocalSession(preferredUsername = null) {
    const username = preferredUsername
        ? setActiveUsernameInTab(preferredUsername)
        : getActiveUsernameFromTab();
    const allSessions = await loadSessionMap();
    if (!(username in allSessions)) {
        return;
    }
    delete allSessions[username];
    await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(allSessions));
}

export function setActiveLocalUsername(username) {
    return setActiveUsernameInTab(username);
}

export function getActiveLocalUsername() {
    return getActiveUsernameFromTab();
}
