import { supabase, supabaseConfigured } from "./supabase";

const LOG_PREFIX = "[supabase][gameApi]";

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

export async function createRemoteGame(gameState) {
    console.log(`${LOG_PREFIX} createRemoteGame:start`);
    const userId = await ensureAuthenticatedUserId();
    const payload = {
        ...asPayload(gameState),
        owner_id: userId,
        created_at: new Date().toISOString(),
    };
    console.log(`${LOG_PREFIX} createRemoteGame:insert`, {
        ownerId: userId,
        turn: payload.turn,
        status: payload.status,
        fenLength: payload.fen?.length,
        pgnLength: payload.pgn?.length,
    });
    const { data, error } = await supabase
        .from("chess_games")
        .insert(payload)
        .select("id")
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
    const userId = await ensureAuthenticatedUserId();
    const { error } = await supabase
        .from("chess_games")
        .update(asPayload(gameState))
        .eq("id", gameId)
        .eq("owner_id", userId);

    if (error) {
        throw new Error(`Synchronisation impossible: ${error.message}`);
    }
}

export { supabaseConfigured };
