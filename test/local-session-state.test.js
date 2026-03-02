import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeLocalSession,
  parseLocalSession,
} from "../src/lib/localSessionState.js";

test("normalizeLocalSession keeps valid in-game values", () => {
  const normalized = normalizeLocalSession(
    {
      userId: " 11111111-1111-4111-8111-111111111111 ",
      status: "in_game",
      sessionMode: "remote_join",
      currentGameId: " 22222222-2222-4222-8222-222222222222 ",
      currentColor: "red",
      isOwner: true,
      updatedAt: "2026-03-02T08:10:00.000Z",
    },
    "2026-03-02T09:00:00.000Z",
  );

  assert.deepEqual(normalized, {
    userId: "11111111-1111-4111-8111-111111111111",
    status: "in_game",
    sessionMode: "remote_join",
    currentGameId: "22222222-2222-4222-8222-222222222222",
    currentColor: "red",
    isOwner: true,
    updatedAt: "2026-03-02T08:10:00.000Z",
  });
});

test("normalizeLocalSession sanitizes invalid values and clears in-game fields", () => {
  const normalized = normalizeLocalSession(
    {
      userId: "   ",
      status: "broken",
      sessionMode: "offline",
      currentGameId: "x",
      currentColor: "green",
      isOwner: true,
    },
    "2026-03-02T09:00:00.000Z",
  );

  assert.deepEqual(normalized, {
    userId: null,
    status: "idle",
    sessionMode: "local",
    currentGameId: null,
    currentColor: null,
    isOwner: false,
    updatedAt: "2026-03-02T09:00:00.000Z",
  });
});

test("parseLocalSession returns normalized content", () => {
  const parsed = parseLocalSession(
    JSON.stringify({
      userId: "33333333-3333-4333-8333-333333333333",
      status: "in_game",
      sessionMode: "remote_create",
      currentGameId: "44444444-4444-4444-8444-444444444444",
      currentColor: "blue",
      isOwner: 1,
    }),
  );

  assert.equal(parsed.userId, "33333333-3333-4333-8333-333333333333");
  assert.equal(parsed.status, "in_game");
  assert.equal(parsed.sessionMode, "remote_create");
  assert.equal(parsed.currentGameId, "44444444-4444-4444-8444-444444444444");
  assert.equal(parsed.currentColor, "blue");
  assert.equal(parsed.isOwner, true);
});

test("parseLocalSession returns null for invalid JSON", () => {
  assert.equal(parseLocalSession("{not-json"), null);
});
