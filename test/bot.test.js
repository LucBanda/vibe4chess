import test from "node:test";
import assert from "node:assert/strict";

import { keyOf } from "../src/game/board.js";
import { chooseRobotMove } from "../src/game/bot.js";

function makeState(board, turn = "white", moveCount = 0, winner = null) {
  return {
    board,
    turn,
    moveCount,
    capturesBy: {
      white: 0,
      red: 0,
      black: 0,
      blue: 0,
    },
    winner,
  };
}

test("chooseRobotMove returns null for finished game", () => {
  const state = makeState(
    {
      [keyOf(5, 5)]: { player: "white", type: "king" },
      [keyOf(8, 8)]: { player: "black", type: "king" },
    },
    "white",
    12,
    "white",
  );

  assert.equal(chooseRobotMove(state), null);
});

test("chooseRobotMove prefers winning king capture when available", () => {
  const state = makeState({
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(5, 4)]: { player: "white", type: "queen" },
    [keyOf(5, 1)]: { player: "black", type: "king" },
  });

  const move = chooseRobotMove(state);
  assert.ok(move);
  assert.deepEqual(
    { fromX: move.fromX, fromY: move.fromY, toX: move.toX, toY: move.toY },
    { fromX: 5, fromY: 4, toX: 5, toY: 1 },
  );
});

test("chooseRobotMove is deterministic for a given state", () => {
  const state = makeState({
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(6, 6)]: { player: "white", type: "knight" },
    [keyOf(9, 9)]: { player: "black", type: "king" },
    [keyOf(7, 8)]: { player: "red", type: "pawn" },
  });

  const first = chooseRobotMove(state);
  const second = chooseRobotMove(state);
  assert.deepEqual(first, second);
});

test("chooseRobotMove prioritizes pressuring the leading opponent in 4-player mode", () => {
  const state = makeState({
    [keyOf(6, 6)]: { player: "white", type: "king" },
    [keyOf(6, 5)]: { player: "white", type: "queen" },
    [keyOf(6, 2)]: { player: "red", type: "rook" },
    [keyOf(8, 5)]: { player: "blue", type: "rook" },
    [keyOf(9, 2)]: { player: "red", type: "queen" },
    [keyOf(1, 1)]: { player: "black", type: "king" },
    [keyOf(12, 12)]: { player: "red", type: "king" },
    [keyOf(10, 10)]: { player: "blue", type: "king" },
  });

  const move = chooseRobotMove(state);
  assert.ok(move);
  assert.deepEqual(
    { fromX: move.fromX, fromY: move.fromY, toX: move.toX, toY: move.toY },
    { fromX: 6, fromY: 5, toX: 6, toY: 2 },
  );
});
