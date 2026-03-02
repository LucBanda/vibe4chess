import test from "node:test";
import assert from "node:assert/strict";

import { createInitialBoard, keyOf } from "../src/game/board.js";
import {
  boardToDisplay,
  createPerspectiveCells,
  displayToBoard,
  firstHumanColor,
  freeSeatsOf,
  parseRemoteState,
} from "../src/game/view.js";
import { PLAYERS } from "../src/game/constants.js";

test("displayToBoard and boardToDisplay are inverse transforms", () => {
  const samples = [
    { x: 0, y: 0 },
    { x: 3, y: 7 },
    { x: 10, y: 12 },
    { x: 13, y: 13 },
  ];

  for (const color of PLAYERS) {
    for (const sample of samples) {
      const boardPos = displayToBoard(sample.x, sample.y, color);
      const displayPos = boardToDisplay(boardPos.x, boardPos.y, color);
      assert.deepEqual(displayPos, sample);
    }
  }
});

test("createPerspectiveCells remaps board coordinates by perspective", () => {
  const board = createInitialBoard();
  const redRookBoard = { x: 0, y: 3 };
  const redDisplay = boardToDisplay(redRookBoard.x, redRookBoard.y, "red");

  const cells = createPerspectiveCells(board, "red");
  const redCell = cells.find((cell) => cell.x === redDisplay.x && cell.y === redDisplay.y);

  assert.ok(redCell);
  assert.equal(redCell.boardX, redRookBoard.x);
  assert.equal(redCell.boardY, redRookBoard.y);
  assert.deepEqual(redCell.piece, board[keyOf(redRookBoard.x, redRookBoard.y)]);
});

test("freeSeatsOf excludes occupied slots including robots", () => {
  const free = freeSeatsOf({
    white: "uuid-white",
    red: "robot",
  });

  assert.deepEqual(free, ["black", "blue"]);
});

test("firstHumanColor returns first human seat or white fallback", () => {
  assert.equal(
    firstHumanColor({
      white: "robot",
      red: "human",
      black: "human",
      blue: "robot",
    }),
    "red",
  );

  assert.equal(
    firstHumanColor({
      white: "robot",
      red: "robot",
      black: "robot",
      blue: "robot",
    }),
    "white",
  );
});

test("parseRemoteState parses payload and falls back safely", () => {
  const parsed = parseRemoteState({
    fen: JSON.stringify({ board: { "4,4": { player: "white", type: "king" } } }),
    pgn: JSON.stringify({ moveCount: 12, capturesBy: { red: 3 }, winner: "red" }),
    turn: "black",
  });

  assert.equal(parsed.turn, "black");
  assert.equal(parsed.moveCount, 12);
  assert.equal(parsed.capturesBy.red, 3);
  assert.equal(parsed.winner, "red");
  assert.deepEqual(parsed.board[keyOf(4, 4)], { player: "white", type: "king" });

  const fallback = parseRemoteState({
    fen: "{invalid",
    pgn: "{invalid",
    turn: "white",
  });
  assert.deepEqual(fallback.board, {});
  assert.equal(fallback.moveCount, 0);
  assert.equal(fallback.winner, null);
});
