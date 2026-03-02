import { normalizeUsername } from "./username.js";

const PLAYER_COLORS = ["white", "red", "black", "blue"];
const PLAYER_STATUS = new Set(["idle", "in_game"]);
const SESSION_MODES = new Set(["local", "remote_create", "remote_join"]);

function asTrimmedString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLocalSession(sessionData = {}, nowIso = null) {
    const userId = asTrimmedString(sessionData?.userId);
    const username = normalizeUsername(sessionData?.username, "player");
    const requestedStatus = sessionData?.status ?? "idle";
    const status = PLAYER_STATUS.has(requestedStatus) ? requestedStatus : "idle";
    const requestedMode = sessionData?.sessionMode ?? "local";
    const sessionMode = SESSION_MODES.has(requestedMode)
        ? requestedMode
        : "local";
    const requestedColor = asTrimmedString(sessionData?.currentColor);
    const currentColor = PLAYER_COLORS.includes(requestedColor)
        ? requestedColor
        : null;
    const currentGameId = asTrimmedString(sessionData?.currentGameId);
    const updatedAt = asTrimmedString(sessionData?.updatedAt) ?? nowIso ?? null;

    return {
        userId,
        username,
        status,
        sessionMode,
        currentGameId: status === "in_game" ? currentGameId : null,
        currentColor: status === "in_game" ? currentColor : null,
        isOwner: status === "in_game" ? Boolean(sessionData?.isOwner) : false,
        updatedAt,
    };
}

export function parseLocalSession(raw) {
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        return normalizeLocalSession(parsed);
    } catch {
        return null;
    }
}
