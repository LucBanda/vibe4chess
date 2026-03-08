import { normalizeUsername } from "./username.js";

const PLAYER_COLORS = ["white", "red", "black", "blue"];
const PLAYER_STATUS = new Set(["idle", "in_game"]);
const SESSION_MODES = new Set(["local", "remote_create", "remote_join"]);
const CONTROL_MODES = new Set(["human", "robot"]);

function asTrimmedString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoveCount(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function normalizeCapturesBy(raw) {
    const capturesBy = {};
    for (const color of PLAYER_COLORS) {
        capturesBy[color] = normalizeMoveCount(raw?.[color]);
    }
    return capturesBy;
}

function normalizeControlByColor(raw) {
    const controlByColor = {};
    for (const color of PLAYER_COLORS) {
        const requested = raw?.[color];
        controlByColor[color] = CONTROL_MODES.has(requested) ? requested : "human";
    }
    return controlByColor;
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
    const turn = PLAYER_COLORS.includes(raw.turn) ? raw.turn : "white";
    const winner = PLAYER_COLORS.includes(raw.winner) ? raw.winner : null;
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
