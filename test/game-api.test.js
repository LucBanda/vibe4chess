import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCreateOptions } from "../src/lib/gameApi.js";

test("normalizeCreateOptions defaults to private and assigns owner to white", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId);

  assert.equal(options.visibility, "private");
  assert.deepEqual(options.player_ids, {
    white: ownerId,
  });
});

test("normalizeCreateOptions keeps valid visibility and trims player ids", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId, {
    visibility: "public",
    playerIdsByColor: {
      white: " 22222222-2222-4222-8222-222222222222 ",
      red: " 33333333-3333-4333-8333-333333333333 ",
      black: "   ",
    },
  });

  assert.equal(options.visibility, "public");
  assert.deepEqual(options.player_ids, {
    white: "22222222-2222-4222-8222-222222222222",
    red: "33333333-3333-4333-8333-333333333333",
  });
});

test("normalizeCreateOptions falls back to private for unknown visibility", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const options = normalizeCreateOptions(ownerId, {
    visibility: "friends-only",
    playerIdsByColor: {
      blue: "44444444-4444-4444-8444-444444444444",
    },
  });

  assert.equal(options.visibility, "private");
  assert.deepEqual(options.player_ids, {
    white: ownerId,
    blue: "44444444-4444-4444-8444-444444444444",
  });
});
