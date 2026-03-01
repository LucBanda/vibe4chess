import test from "node:test";
import assert from "node:assert/strict";

import { createInitialBoard, isPlayable, keyOf } from "../src/game/board.js";
import { getNextAlivePlayer, isLegalMove, shouldPromote } from "../src/game/rules.js";
import { computeStats } from "../src/game/stats.js";

test("createInitialBoard places 64 pieces", () => {
  const board = createInitialBoard();
  assert.equal(Object.keys(board).length, 64);
  assert.deepEqual(board[keyOf(3, 13)], { player: "white", type: "rook" });
  assert.deepEqual(board[keyOf(0, 3)], { player: "red", type: "rook" });
  assert.deepEqual(board[keyOf(13, 10)], { player: "blue", type: "rook" });
});

test("isPlayable excludes removed corner zones", () => {
  assert.equal(isPlayable(0, 0), false);
  assert.equal(isPlayable(13, 0), false);
  assert.equal(isPlayable(0, 13), false);
  assert.equal(isPlayable(13, 13), false);
  assert.equal(isPlayable(3, 3), true);
  assert.equal(isPlayable(7, 7), true);
});

test("pawn movement supports one-step, two-step, and diagonal capture", () => {
  const board = {};
  const pawn = { player: "white", type: "pawn" };
  board[keyOf(6, 12)] = pawn;

  assert.equal(isLegalMove(board, 6, 12, 6, 11, pawn), true);
  assert.equal(isLegalMove(board, 6, 12, 6, 10, pawn), true);

  board[keyOf(7, 11)] = { player: "red", type: "knight" };
  assert.equal(isLegalMove(board, 6, 12, 7, 11, pawn), true);
  assert.equal(isLegalMove(board, 6, 12, 5, 11, pawn), false);
});

test("rook cannot jump over blocking piece", () => {
  const board = {
    [keyOf(4, 4)]: { player: "black", type: "rook" },
    [keyOf(4, 6)]: { player: "white", type: "pawn" },
  };

  assert.equal(isLegalMove(board, 4, 4, 4, 8, board[keyOf(4, 4)]), false);
});

test("shouldPromote returns true on destination edge", () => {
  assert.equal(shouldPromote({ player: "white", type: "pawn" }, 6, 0), true);
  assert.equal(shouldPromote({ player: "red", type: "pawn" }, 13, 6), true);
  assert.equal(shouldPromote({ player: "blue", type: "pawn" }, 0, 7), true);
  assert.equal(shouldPromote({ player: "black", type: "pawn" }, 5, 12), false);
});

test("getNextAlivePlayer skips eliminated players", () => {
  const alivePlayers = ["white", "black"];
  assert.equal(getNextAlivePlayer("white", alivePlayers), "black");
  assert.equal(getNextAlivePlayer("black", alivePlayers), "white");
});

test("computeStats tracks pieces, captures, and king status", () => {
  const board = {
    [keyOf(4, 4)]: { player: "white", type: "king" },
    [keyOf(4, 5)]: { player: "white", type: "queen" },
    [keyOf(8, 8)]: { player: "black", type: "king" },
    [keyOf(1, 4)]: { player: "red", type: "pawn" },
  };

  const stats = computeStats(board, { white: 1, red: 2, black: 3, blue: 4 });
  const white = stats.find((item) => item.player === "white");
  const blue = stats.find((item) => item.player === "blue");

  assert.deepEqual(white, { player: "white", pieces: 2, captures: 1, alive: true });
  assert.deepEqual(blue, { player: "blue", pieces: 0, captures: 4, alive: false });
});
