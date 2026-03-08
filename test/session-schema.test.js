import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultControlByColor,
  normalizeCapturesBy,
  normalizeControlByColor,
  normalizeMoveCount,
  normalizePlayerColor,
  normalizeSessionMode,
  normalizeStatus,
} from "../src/lib/sessionSchema.js";

test("normalizeMoveCount floors positive numbers and clamps invalid to zero", () => {
  assert.equal(normalizeMoveCount(3.9), 3);
  assert.equal(normalizeMoveCount(-2), 0);
  assert.equal(normalizeMoveCount(Number.NaN), 0);
});

test("normalizeCapturesBy returns all seats with safe counts", () => {
  assert.deepEqual(
    normalizeCapturesBy({ white: 2.8, red: -1, blue: 4, extra: 99 }),
    {
      white: 2,
      red: 0,
      black: 0,
      blue: 4,
    },
  );
});

test("normalizeControlByColor defaults to human for unsupported values", () => {
  assert.deepEqual(
    normalizeControlByColor({ white: "robot", red: "bot", black: "human" }),
    {
      white: "robot",
      red: "human",
      black: "human",
      blue: "human",
    },
  );
});

test("createDefaultControlByColor returns all-human independent maps", () => {
  const a = createDefaultControlByColor();
  const b = createDefaultControlByColor();

  assert.deepEqual(a, {
    white: "human",
    red: "human",
    black: "human",
    blue: "human",
  });
  a.white = "robot";
  assert.equal(b.white, "human");
});

test("normalize enum helpers keep allowed values and fallback otherwise", () => {
  assert.equal(normalizePlayerColor("red", null), "red");
  assert.equal(normalizePlayerColor("green", null), null);
  assert.equal(normalizeStatus("in_game", "idle"), "in_game");
  assert.equal(normalizeStatus("broken", "idle"), "idle");
  assert.equal(normalizeSessionMode("remote_join", "local"), "remote_join");
  assert.equal(normalizeSessionMode("offline", "local"), "local");
});
