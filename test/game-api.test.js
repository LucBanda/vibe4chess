import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlayerStatusPayload,
  normalizeCreateOptions,
} from "../src/lib/gameApi.js";

test("normalizeCreateOptions assigns owner to white when missing", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId);

  assert.deepEqual(options.player_ids, {
    white: ownerId,
  });
});

test("normalizeCreateOptions trims player ids", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId, {
    playerIdsByColor: {
      white: " 22222222-2222-4222-8222-222222222222 ",
      red: " 33333333-3333-4333-8333-333333333333 ",
      black: "   ",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: "22222222-2222-4222-8222-222222222222",
    red: "33333333-3333-4333-8333-333333333333",
  });
});

test("normalizeCreateOptions keeps additional explicit player assignments", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId, {
    playerIdsByColor: {
      blue: "44444444-4444-4444-8444-444444444444",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: ownerId,
    blue: "44444444-4444-4444-8444-444444444444",
  });
});

test("normalizeCreateOptions marks robot seats as occupied", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId, {
    controlByColor: {
      red: "robot",
      black: "robot",
    },
    playerIdsByColor: {
      red: "55555555-5555-4555-8555-555555555555",
      blue: "66666666-6666-4666-8666-666666666666",
    },
  });

  assert.deepEqual(options.player_ids, {
    white: ownerId,
    red: "robot",
    black: "robot",
    blue: "66666666-6666-4666-8666-666666666666",
  });
});

test("buildPlayerStatusPayload keeps in_game fields when valid", () => {
  const payload = buildPlayerStatusPayload({
    status: "in_game",
    sessionMode: "remote_join",
    currentGameId: " 77777777-7777-4777-8777-777777777777 ",
    currentColor: "blue",
    isOwner: true,
  });

  assert.equal(payload.status, "in_game");
  assert.equal(payload.session_mode, "remote_join");
  assert.equal(payload.current_game_id, "77777777-7777-4777-8777-777777777777");
  assert.equal(payload.current_color, "blue");
  assert.equal(payload.is_owner, true);
  assert.ok(typeof payload.updated_at === "string");
});

test("buildPlayerStatusPayload sanitizes unsupported values", () => {
  const payload = buildPlayerStatusPayload({
    status: "whatever",
    sessionMode: "offline",
    currentGameId: "   ",
    currentColor: "green",
    isOwner: true,
  });

  assert.equal(payload.status, "idle");
  assert.equal(payload.session_mode, "local");
  assert.equal(payload.current_game_id, null);
  assert.equal(payload.current_color, null);
  assert.equal(payload.is_owner, false);
});
