import test from "node:test";
import assert from "node:assert/strict";

import { keyOf } from "../src/game/board.js";
import { createCapturesBy, createGameState } from "../src/game/engine.js";

test("createCapturesBy initializes all players at zero", () => {
  assert.deepEqual(createCapturesBy(), {
    white: 0,
    red: 0,
    black: 0,
    blue: 0,
  });
});

test("createCapturesBy returns independent objects", () => {
  const a = createCapturesBy();
  const b = createCapturesBy();

  a.white = 3;
  assert.equal(b.white, 0);
});

test("createGameState seeds turn, counters, and winner", () => {
  const board = {
    [keyOf(5, 5)]: { player: "white", type: "king" },
  };

  const state = createGameState(board);
  assert.equal(state.board, board);
  assert.equal(state.turn, "white");
  assert.equal(state.moveCount, 0);
  assert.equal(state.winner, null);
  assert.deepEqual(state.capturesBy, {
    white: 0,
    red: 0,
    black: 0,
    blue: 0,
  });
});
