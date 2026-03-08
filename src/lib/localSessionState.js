import { normalizeUsername } from "./username.js";
import {
    PLAYER_COLORS,
    SESSION_MODES,
    PLAYER_STATUS,
    normalizeCapturesBy,
    normalizeControlByColor,
    normalizeMoveCount,
    normalizePlayerColor,
    normalizeSessionMode,
    normalizeStatus,
} from "./sessionSchema.js";

function asTrimmedString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeLocalGameState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }
    const board = raw.board && typeof raw.board === "object" && !Array.isArray(raw.board)
        ? raw.board
        : null;
    if (!board) {
        return null;
    }
    const turn = normalizePlayerColor(raw.turn, "white");
    const winner = normalizePlayerColor(raw.winner, null);
    return {
        board,
        turn,
        moveCount: normalizeMoveCount(raw.moveCount),
        capturesBy: normalizeCapturesBy(raw.capturesBy),
        winner,
        controlByColor: normalizeControlByColor(raw.controlByColor),
    };
}

export function normalizeLocalSession(sessionData = {}, nowIso = null) {
    const userId = asTrimmedString(sessionData?.userId);
    const username = normalizeUsername(sessionData?.username, "player");
    const requestedStatus = sessionData?.status ?? "idle";
    const status = normalizeStatus(requestedStatus, "idle");
    const requestedMode = sessionData?.sessionMode ?? "local";
    const sessionMode = normalizeSessionMode(requestedMode, "local");
    const requestedColor = asTrimmedString(sessionData?.currentColor);
    const currentColor = normalizePlayerColor(requestedColor, null);
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
        localGameState:
            status === "in_game" && sessionMode === "local"
                ? normalizeLocalGameState(sessionData?.localGameState)
                : null,
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
