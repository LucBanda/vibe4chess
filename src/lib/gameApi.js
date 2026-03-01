import { supabase, supabaseConfigured } from "./supabase";

function asPayload(chess) {
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    status: chess.isGameOver() ? "finished" : "active",
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

export async function createRemoteGame(chess) {
  assertConfigured();
  const payload = {
    ...asPayload(chess),
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

export async function syncRemoteGame(gameId, chess) {
  assertConfigured();
  const { error } = await supabase
    .from("chess_games")
    .update(asPayload(chess))
    .eq("id", gameId);

  if (error) {
    throw new Error(`Synchronisation impossible: ${error.message}`);
  }
}

export { supabaseConfigured };
