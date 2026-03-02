import { supabase, supabaseConfigured } from "./supabase.js";

const LOG_PREFIX = "[supabase][gameApi]";
const PLAYER_COLORS = ["white", "red", "black", "blue"];

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

export function normalizeCreateOptions(ownerId, options = {}) {
    const rawPlayerIds = options?.playerIdsByColor ?? {};
    const controlByColor = options?.controlByColor ?? {};
    const playerIds = {};

    for (const color of PLAYER_COLORS) {
        if (controlByColor[color] === "robot") {
            playerIds[color] = "robot";
        }
    }

    for (const [color, candidate] of Object.entries(rawPlayerIds)) {
        if (controlByColor[color] === "robot") {
            continue;
        }
        const trimmed = typeof candidate === "string" ? candidate.trim() : "";
        if (trimmed) {
            playerIds[color] = trimmed;
        }
    }

    if (!playerIds.white || playerIds.white === "robot") {
        playerIds.white = ownerId;
    }

    return {
        player_ids: playerIds,
    };
}

export async function createRemoteGame(gameState, options = {}) {
    console.log(`${LOG_PREFIX} createRemoteGame:start`);
    const userId = await ensureAuthenticatedUserId();
    const createOptions = normalizeCreateOptions(userId, options);
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

export async function joinRemoteGame(gameId, preferredColor = null) {
    const userId = await ensureAuthenticatedUserId();
    const trimmedGameId = gameId?.trim();
    if (!trimmedGameId) {
        throw new Error("Game ID requis pour s'inscrire.");
    }

    const color = typeof preferredColor === "string" ? preferredColor.trim() : null;
    const rpcPayload = {
        p_game_id: trimmedGameId,
        p_color: color || null,
    };

    console.log(`${LOG_PREFIX} joinRemoteGame:start`, {
        gameId: trimmedGameId,
        preferredColor: rpcPayload.p_color,
        userId,
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
        .single();

    if (error) {
        throw new Error(`Chargement impossible: ${error.message}`);
    }

    return data;
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

export { supabaseConfigured };
