import { supabase, supabaseConfigured } from "./supabase";

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
      "Supabase non configuré. Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

async function ensureAuthenticatedUserId() {
  assertConfigured();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Session Supabase invalide: ${sessionError.message}`);
  }

  const existingUserId = sessionData?.session?.user?.id;
  if (existingUserId) {
    return existingUserId;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(`Connexion anonyme impossible: ${error.message}`);
  }

  const userId = data?.user?.id ?? data?.session?.user?.id;
  if (!userId) {
    throw new Error("Connexion anonyme réussie mais utilisateur introuvable.");
  }

  return userId;
}

export async function createRemoteGame(gameState) {
  const userId = await ensureAuthenticatedUserId();
  const payload = {
    ...asPayload(gameState),
    owner_id: userId,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("chess_games")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Création de partie impossible: ${error.message}`);
  }
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
