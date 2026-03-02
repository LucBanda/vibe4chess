import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCreateOptions } from "../src/lib/gameApi.js";

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
