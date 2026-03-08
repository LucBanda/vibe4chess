import { supabase, supabaseConfigured } from "./supabase.js";
import { normalizeUsername } from "./username.js";

const LOG_PREFIX = "[supabase][gameApi]";
const PLAYER_COLORS = ["white", "red", "black", "blue"];
const PLAYER_STATUS = new Set(["idle", "in_game"]);
const SESSION_MODES = new Set(["local", "remote_create", "remote_join"]);
const REMOTE_GAME_NOT_FOUND_CODE = "REMOTE_GAME_NOT_FOUND";

function asPayload(gameState) {
    if (typeof gameState?.fen === "function") {
        // Backward compatibility for old 2-player chess.js flow.
        return {
            fen: gameState.fen(),
            pgn: gameState.pgn(),
            turn: gameState.turn(),
            status: gameState.isGameOver() ? "finished" : "active",
            updated_at: new Date().toISOString(),
        };
    }

    return {
        fen: JSON.stringify({
            version: 1,
            board: gameState.board,
        }),
        pgn: JSON.stringify({
            turn: gameState.turn,
            moveCount: gameState.moveCount,
            capturesBy: gameState.capturesBy,
            winner: gameState.winner,
        }),
        turn: gameState.turn,
        status: gameState.winner ? "finished" : "active",
        updated_at: new Date().toISOString(),
    };
}

function assertConfigured() {
    if (!supabaseConfigured) {
        throw new Error(
            "Supabase non configuré. Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        );
    }
}

async function ensureAuthenticatedUserId() {
    assertConfigured();
    console.log(`${LOG_PREFIX} ensureAuthenticatedUserId:start`);

    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
    if (sessionError) {
        console.error(`${LOG_PREFIX} getSession:error`, {
            message: sessionError.message,
            status: sessionError.status,
            code: sessionError.code,
        });
        throw new Error(`Session Supabase invalide: ${sessionError.message}`);
    }

    const existingUserId = sessionData?.session?.user?.id;
    if (existingUserId) {
        console.log(`${LOG_PREFIX} getSession:existing-user`, {
            userId: existingUserId,
        });
        return existingUserId;
    }

    console.log(`${LOG_PREFIX} getSession:no-session`);
    console.log(`${LOG_PREFIX} signInAnonymously:start`);

    let authResponse;
    try {
        authResponse = await supabase.auth.signInAnonymously();
    } catch (caughtError) {
        console.error(`${LOG_PREFIX} signInAnonymously:thrown`, {
            message: caughtError?.message,
            name: caughtError?.name,
            stack: caughtError?.stack,
            cause: caughtError?.cause,
        });
        throw caughtError;
    }

    const { data, error } = authResponse;
    console.log(`${LOG_PREFIX} signInAnonymously:response`, {
        hasData: Boolean(data),
        hasError: Boolean(error),
    });
    if (error) {
        console.error(`${LOG_PREFIX} signInAnonymously:error`, {
            message: error.message,
            status: error.status,
            code: error.code,
        });
        throw new Error(`Connexion anonyme impossible: ${error.message}`);
    }

    const userId = data?.user?.id ?? data?.session?.user?.id;
    if (!userId) {
        console.error(`${LOG_PREFIX} signInAnonymously:missing-user`, {
            hasSession: Boolean(data?.session),
            hasUser: Boolean(data?.user),
        });
        throw new Error(
            "Connexion anonyme réussie mais utilisateur introuvable.",
        );
    }

    console.log(`${LOG_PREFIX} signInAnonymously:success`, { userId });
    return userId;
}

export function normalizeCreateOptions(username, options = {}) {
    const rawPlayerIds = options?.playerIdsByColor ?? {};
    const controlByColor = options?.controlByColor ?? {};
    const playerIds = {};
    const normalizedUsername = normalizeUsername(username, "player");

    for (const color of PLAYER_COLORS) {
        if (controlByColor[color] === "robot") {
            playerIds[color] = "robot";
        }
    }

    for (const [color, candidate] of Object.entries(rawPlayerIds)) {
        if (controlByColor[color] === "robot") {
            continue;
        }
        const trimmed = normalizeUsername(candidate, "");
        if (trimmed) {
            playerIds[color] = trimmed;
        }
    }

    if (!playerIds.white || playerIds.white === "robot") {
        playerIds.white = normalizedUsername;
    }

    return {
        player_ids: playerIds,
    };
}

export async function createRemoteGame(gameState, options = {}, username = null) {
    console.log(`${LOG_PREFIX} createRemoteGame:start`);
    const userId = await ensureAuthenticatedUserId();
    const createOptions = normalizeCreateOptions(username, options);
    const payload = {
        ...asPayload(gameState),
        owner_id: userId,
        ...createOptions,
        created_at: new Date().toISOString(),
    };
    console.log(`${LOG_PREFIX} createRemoteGame:insert`, {
        ownerId: userId,
        playerIds: payload.player_ids,
        turn: payload.turn,
        status: payload.status,
        fenLength: payload.fen?.length,
        pgnLength: payload.pgn?.length,
    });
    const { data, error } = await supabase
        .from("chess_games")
        .insert(payload)
        .select("id, player_ids, updated_at")
        .single();

    if (error) {
        console.error(`${LOG_PREFIX} createRemoteGame:error`, {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        throw new Error(`Création de partie impossible: ${error.message}`);
    }
    console.log(`${LOG_PREFIX} createRemoteGame:success`, {
        gameId: data?.id,
    });
    return data;
}

export async function syncRemoteGame(gameId, gameState) {
    await ensureAuthenticatedUserId();
    const { data, error } = await supabase
        .from("chess_games")
        .update(asPayload(gameState))
        .eq("id", gameId)
        .select("updated_at")
        .single();

    if (error) {
        throw new Error(`Synchronisation impossible: ${error.message}`);
    }

    return data;
}

export async function joinRemoteGame(
    gameId,
    preferredColor = null,
    username = null,
) {
    await ensureAuthenticatedUserId();
    const trimmedGameId = gameId?.trim();
    if (!trimmedGameId) {
        throw new Error("Game ID requis pour s'inscrire.");
    }

    const color = typeof preferredColor === "string" ? preferredColor.trim() : null;
    const rpcPayload = {
        p_game_id: trimmedGameId,
        p_color: color || null,
        p_username: normalizeUsername(username, "player"),
    };

    console.log(`${LOG_PREFIX} joinRemoteGame:start`, {
        gameId: trimmedGameId,
        preferredColor: rpcPayload.p_color,
        username: rpcPayload.p_username,
    });

    const { data, error } = await supabase.rpc("join_chess_game", rpcPayload);
    if (error) {
        console.error(`${LOG_PREFIX} joinRemoteGame:error`, {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        throw new Error(`Inscription impossible: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
        throw new Error("Inscription impossible: réponse Supabase invalide.");
    }

    console.log(`${LOG_PREFIX} joinRemoteGame:success`, {
        gameId: row.id,
        assignedColor: row.assigned_color ?? null,
    });

    return row;
}

export async function fetchRemoteGame(gameId) {
    assertConfigured();
    const trimmedGameId = gameId?.trim();
    if (!trimmedGameId) {
        throw new Error("Game ID requis pour charger une partie.");
    }

    const { data, error } = await supabase
        .from("chess_games")
        .select("id, fen, pgn, turn, status, player_ids, updated_at")
        .eq("id", trimmedGameId)
        .maybeSingle();

    if (error) {
        throw new Error(`Chargement impossible: ${error.message}`);
    }
    if (!data) {
        const notFoundError = new Error("Partie introuvable ou supprimée.");
        notFoundError.code = REMOTE_GAME_NOT_FOUND_CODE;
        throw notFoundError;
    }

    return data;
}

export function isRemoteGameNotFoundError(error) {
    return error?.code === REMOTE_GAME_NOT_FOUND_CODE;
}

export function subscribeRemoteGame(gameId, handlers = {}) {
    assertConfigured();
    const trimmedGameId = gameId?.trim();
    if (!trimmedGameId) {
        throw new Error("Game ID requis pour s'abonner à une partie.");
    }

    const channel = supabase
        .channel(`chess-game-${trimmedGameId}-${Date.now()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chess_games",
                filter: `id=eq.${trimmedGameId}`,
            },
            (payload) => {
                handlers?.onChange?.({
                    eventType: payload?.eventType ?? null,
                    row: payload?.new ?? null,
                    oldRow: payload?.old ?? null,
                });
            },
        )
        .subscribe((status) => {
            handlers?.onStatus?.(status);
        });

    return async () => {
        await supabase.removeChannel(channel);
    };
}

export async function listJoinableGames() {
    assertConfigured();
    const { data, error } = await supabase
        .from("chess_games")
        .select("id, status, player_ids, created_at, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(50);

    if (error) {
        throw new Error(`Liste des parties impossible: ${error.message}`);
    }

    return (data ?? []).filter((row) => {
        const playerIds = row.player_ids ?? {};
        return PLAYER_COLORS.some((color) => !playerIds[color]);
    });
}

export async function fetchPlayerStatus(username) {
    assertConfigured();
    await ensureAuthenticatedUserId();
    const normalizedUsername = normalizeUsername(username, "");
    if (!normalizedUsername) {
        return null;
    }

    const { data, error } = await supabase
        .from("chess_player_status")
        .select(
            "username, status, session_mode, current_game_id, current_color, is_owner, updated_at",
        )
        .eq("username", normalizedUsername)
        .maybeSingle();

    if (error) {
        throw new Error(`Statut joueur impossible à charger: ${error.message}`);
    }

    return data ?? null;
}

export async function getAuthenticatedUserId() {
    return ensureAuthenticatedUserId();
}

export function buildPlayerStatusPayload(statusInput = {}) {
    const requestedStatus = statusInput?.status ?? "idle";
    const status = PLAYER_STATUS.has(requestedStatus) ? requestedStatus : "idle";
    const requestedMode = statusInput?.sessionMode ?? "local";
    const sessionMode = SESSION_MODES.has(requestedMode)
        ? requestedMode
        : "local";
    const requestedColor = statusInput?.currentColor ?? null;
    const currentColor = PLAYER_COLORS.includes(requestedColor)
        ? requestedColor
        : null;
    const currentGameId =
        typeof statusInput?.currentGameId === "string" &&
        statusInput.currentGameId.trim().length > 0
            ? statusInput.currentGameId.trim()
            : null;
    const username = normalizeUsername(statusInput?.username, "player");

    return {
        status,
        current_game_id: status === "in_game" ? currentGameId : null,
        current_color: status === "in_game" ? currentColor : null,
        session_mode: sessionMode,
        username,
        is_owner: status === "in_game" ? Boolean(statusInput?.isOwner) : false,
        updated_at: new Date().toISOString(),
    };
}

export async function upsertPlayerStatus(statusInput = {}) {
    console.log(`${LOG_PREFIX} upsertPlayerStatus:start`, {
        status: statusInput?.status ?? "idle",
        sessionMode: statusInput?.sessionMode ?? "local",
        username: statusInput?.username ?? null,
        currentGameId: statusInput?.currentGameId ?? null,
        currentColor: statusInput?.currentColor ?? null,
        isOwner: Boolean(statusInput?.isOwner),
    });
    await ensureAuthenticatedUserId();
    const payload = {
        ...buildPlayerStatusPayload(statusInput),
    };

    const { error } = await supabase
        .from("chess_player_status")
        .upsert(payload, { onConflict: "username" });

    if (error) {
        console.error(`${LOG_PREFIX} upsertPlayerStatus:error`, {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        throw new Error(`Statut joueur impossible à enregistrer: ${error.message}`);
    }

    console.log(`${LOG_PREFIX} upsertPlayerStatus:success`, {
        username: payload.username,
        status: payload.status,
        sessionMode: payload.session_mode,
        currentGameId: payload.current_game_id,
        currentColor: payload.current_color,
        isOwner: payload.is_owner,
    });
}

export async function clearPlayerStatus(username = "player") {
    console.log(`${LOG_PREFIX} clearPlayerStatus:start`);
    await upsertPlayerStatus({
        status: "idle",
        sessionMode: "local",
        username,
        currentGameId: null,
        currentColor: null,
        isOwner: false,
    });
    console.log(`${LOG_PREFIX} clearPlayerStatus:success`);
}

export async function deleteRemoteGame(gameId) {
    await ensureAuthenticatedUserId();
    const trimmedGameId = gameId?.trim();
    if (!trimmedGameId) {
        throw new Error("Game ID requis pour supprimer une partie.");
    }

    const { error } = await supabase
        .from("chess_games")
        .delete()
        .eq("id", trimmedGameId);

    if (error) {
        throw new Error(
            `Suppression impossible: ${error.message}. Vérifie que la policy DELETE owner est bien appliquée dans Supabase (réexécute supabase/schema.sql).`,
        );
    }
}

export { supabaseConfigured };
