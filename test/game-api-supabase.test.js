import test from "node:test";
import assert from "node:assert/strict";

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "public-anon-key";

const gameApi = await import("../src/lib/gameApi.js");
const supabaseModule = await import("../src/lib/supabase.js");

function makeHarness() {
  const calls = [];
  const next = {
    single: [],
    maybeSingle: [],
    limit: [],
    upsert: [],
    delete: [],
    rpc: [],
  };

  function shift(key, fallback) {
    const queue = next[key];
    if (queue.length > 0) {
      return queue.shift();
    }
    return fallback;
  }

  function queryFor(table) {
    const state = {
      table,
      op: null,
      payload: null,
      filters: [],
      selected: null,
      order: null,
      limit: null,
      options: null,
    };

    const api = {
      insert(payload) {
        state.op = "insert";
        state.payload = payload;
        return api;
      },
      update(payload) {
        state.op = "update";
        state.payload = payload;
        return api;
      },
      delete() {
        state.op = "delete";
        return api;
      },
      upsert(payload, options) {
        state.op = "upsert";
        state.payload = payload;
        state.options = options;
        calls.push({ ...state, filters: [...state.filters] });
        return Promise.resolve(shift("upsert", { error: null }));
      },
      select(columns) {
        state.selected = columns;
        return api;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        if (state.op === "delete") {
          calls.push({ ...state, filters: [...state.filters] });
          return Promise.resolve(shift("delete", { error: null }));
        }
        return api;
      },
      order(column, options) {
        state.order = { column, options };
        return api;
      },
      limit(value) {
        state.limit = value;
        calls.push({ ...state, filters: [...state.filters] });
        return Promise.resolve(shift("limit", { data: [], error: null }));
      },
      single() {
        calls.push({ ...state, filters: [...state.filters] });
        return Promise.resolve(shift("single", { data: null, error: null }));
      },
      maybeSingle() {
        calls.push({ ...state, filters: [...state.filters] });
        return Promise.resolve(shift("maybeSingle", { data: null, error: null }));
      },
    };

    return api;
  }

  let onChangeCb = null;
  let onStatusCb = null;
  let removedChannel = null;

  const channelInstance = {
    on(_event, _filter, cb) {
      onChangeCb = cb;
      return channelInstance;
    },
    subscribe(cb) {
      onStatusCb = cb;
      return channelInstance;
    },
  };

  const auth = {
    getSession: async () => ({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    }),
    signInAnonymously: async () => ({
      data: { user: { id: "anon-user" } },
      error: null,
    }),
  };

  supabaseModule.supabase.auth = auth;
  supabaseModule.supabase.from = (table) => queryFor(table);
  supabaseModule.supabase.rpc = async (name, payload) => {
    calls.push({ op: "rpc", name, payload });
    return shift("rpc", { data: null, error: null });
  };
  supabaseModule.supabase.channel = (name) => {
    calls.push({ op: "channel", name });
    return channelInstance;
  };
  supabaseModule.supabase.removeChannel = async (channel) => {
    removedChannel = channel;
  };

  return {
    calls,
    next,
    auth,
    emitChange(payload) {
      onChangeCb?.(payload);
    },
    emitStatus(status) {
      onStatusCb?.(status);
    },
    getRemovedChannel() {
      return removedChannel;
    },
  };
}

test("getAuthenticatedUserId returns session user id when available", async () => {
  const h = makeHarness();
  let signInCalled = false;
  h.auth.signInAnonymously = async () => {
    signInCalled = true;
    return { data: null, error: null };
  };

  const userId = await gameApi.getAuthenticatedUserId();
  assert.equal(userId, "user-1");
  assert.equal(signInCalled, false);
});

test("getAuthenticatedUserId falls back to anonymous sign-in", async () => {
  const h = makeHarness();
  h.auth.getSession = async () => ({ data: { session: null }, error: null });
  h.auth.signInAnonymously = async () => ({
    data: { user: { id: "anon-42" } },
    error: null,
  });

  const userId = await gameApi.getAuthenticatedUserId();
  assert.equal(userId, "anon-42");
});

test("createRemoteGame inserts chess_games payload and returns row", async () => {
  const h = makeHarness();
  h.next.single.push({
    data: {
      id: "game-1",
      player_ids: { white: "alice" },
      updated_at: "2026-03-08T10:00:00.000Z",
    },
    error: null,
  });

  const result = await gameApi.createRemoteGame(
    {
      board: { "4,4": { player: "white", type: "king" } },
      turn: "white",
      moveCount: 0,
      capturesBy: { white: 0, red: 0, black: 0, blue: 0 },
      winner: null,
    },
    { robotSeats: ["red"] },
    "Alice",
  );

  assert.equal(result.id, "game-1");
  const insertCall = h.calls.find((call) => call.op === "insert");
  assert.equal(insertCall.table, "chess_games");
  assert.equal(insertCall.payload.owner_id, "user-1");
  assert.equal(insertCall.payload.status, "active");
  assert.deepEqual(insertCall.payload.player_ids, { white: "alice", red: "robot" });
});

test("joinRemoteGame validates id and normalizes rpc payload", async () => {
  const h = makeHarness();

  await assert.rejects(
    gameApi.joinRemoteGame("   ", "red", "Alice"),
    /Game ID requis/,
  );

  h.next.rpc.push({
    data: [{ id: "game-7", assigned_color: "black" }],
    error: null,
  });

  const joined = await gameApi.joinRemoteGame(" game-7 ", "black", " Alice 12 ");
  assert.equal(joined.id, "game-7");

  const rpcCall = h.calls.find((call) => call.op === "rpc");
  assert.equal(rpcCall.name, "join_chess_game");
  assert.deepEqual(rpcCall.payload, {
    p_game_id: "game-7",
    p_color: "black",
    p_username: "alice12",
  });
});

test("fetchRemoteGame handles success and not-found error code", async () => {
  const h = makeHarness();
  h.next.maybeSingle.push({
    data: { id: "game-ok", turn: "white" },
    error: null,
  });

  const row = await gameApi.fetchRemoteGame(" game-ok ");
  assert.equal(row.id, "game-ok");

  h.next.maybeSingle.push({ data: null, error: null });
  await assert.rejects(async () => {
    await gameApi.fetchRemoteGame("missing");
  }, (error) => gameApi.isRemoteGameNotFoundError(error));
});

test("listJoinableGames filters out full tables", async () => {
  const h = makeHarness();
  h.next.limit.push({
    data: [
      {
        id: "full",
        player_ids: {
          white: "w",
          red: "r",
          black: "b",
          blue: "u",
        },
      },
      {
        id: "open",
        player_ids: {
          white: "w",
          red: "r",
          black: "b",
        },
      },
    ],
    error: null,
  });

  const games = await gameApi.listJoinableGames();
  assert.deepEqual(games.map((g) => g.id), ["open"]);
});

test("upsertPlayerStatus and clearPlayerStatus write normalized status", async () => {
  const h = makeHarness();
  h.next.upsert.push({ error: null });
  h.next.upsert.push({ error: null });

  await gameApi.upsertPlayerStatus({
    status: "in_game",
    sessionMode: "remote_create",
    currentGameId: " game-8 ",
    currentColor: "red",
    username: "  ALICE ",
    isOwner: true,
  });
  await gameApi.clearPlayerStatus("  ALICE ");

  const upserts = h.calls.filter((call) => call.op === "upsert");
  assert.equal(upserts.length, 2);
  assert.equal(upserts[0].table, "chess_player_status");
  assert.equal(upserts[0].payload.username, "alice");
  assert.equal(upserts[0].payload.status, "in_game");
  assert.equal(upserts[1].payload.status, "idle");
  assert.equal(upserts[1].payload.current_game_id, null);
});

test("subscribeRemoteGame relays events and unsubscribes channel", async () => {
  const h = makeHarness();
  const events = [];
  const statuses = [];

  const unsubscribe = gameApi.subscribeRemoteGame(" game-9 ", {
    onChange: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
  });

  h.emitChange({ eventType: "UPDATE", new: { id: "game-9" }, old: { id: "old" } });
  h.emitStatus("SUBSCRIBED");

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "UPDATE");
  assert.equal(statuses[0], "SUBSCRIBED");

  await unsubscribe();
  assert.ok(h.getRemovedChannel());
});

test("deleteRemoteGame trims id and propagates delete errors", async () => {
  const h = makeHarness();
  h.next.delete.push({ error: null });

  await gameApi.deleteRemoteGame(" game-del ");
  const deleteCall = h.calls.find((call) => call.op === "delete");
  assert.equal(deleteCall.table, "chess_games");
  assert.deepEqual(deleteCall.filters, [{ column: "id", value: "game-del" }]);

  h.next.delete.push({ error: { message: "forbidden" } });
  await assert.rejects(gameApi.deleteRemoteGame("game-del-2"), /Suppression impossible/);
});
