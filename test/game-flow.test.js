import test from "node:test";
import assert from "node:assert/strict";

import { keyOf } from "../src/game/board.js";
import { applyMove, createCapturesBy } from "../src/game/engine.js";

function makeState(board, turn = "white") {
  return {
    board,
    turn,
    moveCount: 0,
    capturesBy: createCapturesBy(),
    winner: null,
  };
}

test("applyMove rejects illegal move and keeps state unchanged", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "king" },
    [keyOf(8, 8)]: { player: "black", type: "king" },
    [keyOf(6, 6)]: { player: "white", type: "rook" },
  });

  const result = applyMove(initial, 6, 6, 7, 8);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "illegal_move");
  assert.deepEqual(result.state, initial);
});

test("applyMove advances turn and move count on legal move", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "king" },
    [keyOf(6, 12)]: { player: "white", type: "pawn" },
    [keyOf(8, 8)]: { player: "black", type: "king" },
    [keyOf(1, 4)]: { player: "red", type: "king" },
    [keyOf(12, 4)]: { player: "blue", type: "king" },
  });

  const result = applyMove(initial, 6, 12, 6, 11);

  assert.equal(result.ok, true);
  assert.equal(result.state.moveCount, 1);
  assert.equal(result.state.turn, "red");
  assert.deepEqual(result.state.board[keyOf(6, 11)], { player: "white", type: "pawn" });
});

test("capture increments score and skips eliminated player's turn", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "rook" },
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(4, 6)]: { player: "red", type: "king" },
    [keyOf(8, 8)]: { player: "black", type: "king" },
    [keyOf(10, 10)]: { player: "blue", type: "king" },
  });

  const result = applyMove(initial, 4, 4, 4, 6);

  assert.equal(result.ok, true);
  assert.equal(result.state.capturesBy.white, 1);
  assert.equal(result.state.turn, "black");
});

test("promotion happens inside move flow", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "king" },
    [keyOf(6, 1)]: { player: "white", type: "pawn" },
    [keyOf(8, 8)]: { player: "black", type: "king" },
    [keyOf(1, 4)]: { player: "red", type: "king" },
    [keyOf(12, 4)]: { player: "blue", type: "king" },
  });

  const result = applyMove(initial, 6, 1, 6, 0);

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.board[keyOf(6, 0)], { player: "white", type: "queen" });
});

test("winner is set when last opponent king is captured", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "rook" },
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(4, 6)]: { player: "red", type: "king" },
  });

  const result = applyMove(initial, 4, 4, 4, 6);

  assert.equal(result.ok, true);
  assert.equal(result.state.winner, "white");
});

test("capturing a king transfers defeated player's remaining pieces", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "rook" },
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(4, 6)]: { player: "red", type: "king" },
    [keyOf(7, 6)]: { player: "red", type: "queen" },
    [keyOf(9, 9)]: { player: "black", type: "king" },
    [keyOf(11, 11)]: { player: "blue", type: "king" },
  });

  const result = applyMove(initial, 4, 4, 4, 6);

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.board[keyOf(7, 6)], {
    player: "white",
    type: "queen",
    origin: "red",
  });
  assert.equal(result.state.capturesBy.white, 1);
});

test("a transferred pawn remains playable with its original orientation", () => {
  const initial = makeState({
    [keyOf(4, 4)]: { player: "white", type: "rook" },
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(4, 6)]: { player: "red", type: "king" },
    [keyOf(7, 6)]: { player: "red", type: "pawn" },
    [keyOf(9, 9)]: { player: "black", type: "king" },
    [keyOf(11, 11)]: { player: "blue", type: "king" },
  });

  const afterCapture = applyMove(initial, 4, 4, 4, 6).state;
  const afterBlack = applyMove(afterCapture, 9, 9, 9, 8).state;
  const afterBlue = applyMove(afterBlack, 11, 11, 11, 10).state;
  const playTransferredPawn = applyMove(afterBlue, 7, 6, 8, 6);

  assert.equal(playTransferredPawn.ok, true);
  assert.deepEqual(playTransferredPawn.state.board[keyOf(8, 6)], {
    player: "white",
    type: "pawn",
    origin: "red",
  });
});
