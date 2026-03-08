import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlayerStatusPayload,
  normalizeCreateOptions,
} from "../src/lib/gameApi.js";

test("normalizeCreateOptions assigns owner to white when missing", () => {
  const options = normalizeCreateOptions("alice");

  assert.deepEqual(options.player_ids, {
    white: "alice",
  });
});

test("normalizeCreateOptions trims player ids", () => {
  const options = normalizeCreateOptions("alice", {
    playerIdsByColor: {
      white: "  BOB  ",
      red: "  CHARLIE ",
      black: "   ",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: "bob",
    red: "charlie",
  });
});

test("normalizeCreateOptions keeps additional explicit player assignments", () => {
  const options = normalizeCreateOptions("alice", {
    playerIdsByColor: {
      blue: "david",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: "alice",
    blue: "david",
  });
});

test("normalizeCreateOptions assigns explicit robot seats", () => {
  const options = normalizeCreateOptions("alice", {
    robotSeats: ["red", "black"],
    playerIdsByColor: {
      red: "someone",
      blue: "eve",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: "alice",
    red: "robot",
    black: "robot",
    blue: "eve",
  });
});

test("normalizeCreateOptions never persists literal robot usernames", () => {
  const options = normalizeCreateOptions("alice", {
    playerIdsByColor: {
      red: "robot",
      black: "ROBOT",
      blue: "bob",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: "alice",
    blue: "bob",
  });
});

test("buildPlayerStatusPayload keeps in_game fields when valid", () => {
  const payload = buildPlayerStatusPayload({
    status: "in_game",
    sessionMode: "remote_join",
    currentGameId: " 77777777-7777-4777-8777-777777777777 ",
    currentColor: "blue",
    username: "Alice 12",
    isOwner: true,
  });

  assert.equal(payload.status, "in_game");
  assert.equal(payload.session_mode, "remote_join");
  assert.equal(payload.current_game_id, "77777777-7777-4777-8777-777777777777");
  assert.equal(payload.current_color, "blue");
  assert.equal(payload.username, "alice12");
  assert.equal(payload.is_owner, true);
  assert.ok(typeof payload.updated_at === "string");
});

test("buildPlayerStatusPayload sanitizes unsupported values", () => {
  const payload = buildPlayerStatusPayload({
    status: "whatever",
    sessionMode: "offline",
    currentGameId: "   ",
    currentColor: "green",
    username: "  ",
    isOwner: true,
  });

  assert.equal(payload.status, "idle");
  assert.equal(payload.session_mode, "local");
  assert.equal(payload.current_game_id, null);
  assert.equal(payload.current_color, null);
  assert.equal(payload.username, "player");
  assert.equal(payload.is_owner, false);
});
