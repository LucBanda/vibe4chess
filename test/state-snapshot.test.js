import test from "node:test";
import assert from "node:assert/strict";

import { createGameSnapshot } from "../src/game/stateSnapshot.js";

test("createGameSnapshot keeps runtime game state shape", () => {
  const input = {
    board: { "4,4": { player: "white", type: "king" } },
    turn: "red",
    moveCount: 12,
    capturesBy: { white: 3, red: 1, black: 0, blue: 0 },
    winner: null,
  };

  assert.deepEqual(createGameSnapshot(input), input);
});
