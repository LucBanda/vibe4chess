import test from "node:test";
import assert from "node:assert/strict";

import { keyOf } from "../../src/game/board.js";
import { applyMove, createGameState } from "../../src/game/engine.js";
import {
  colorOfPlayer,
  freeSeatsOf,
  parseRemoteState,
} from "../../src/game/view.js";
import { normalizeCreateOptions } from "../../src/lib/gameApi.js";
import {
  normalizeLocalSession,
  parseLocalSession,
} from "../../src/lib/localSessionState.js";

test("e2e local game flow from move engine to persisted session", () => {
  const initialBoard = {
    [keyOf(4, 4)]: { player: "white", type: "rook" },
    [keyOf(5, 5)]: { player: "white", type: "king" },
    [keyOf(4, 6)]: { player: "red", type: "king" },
    [keyOf(4, 8)]: { player: "black", type: "king" },
  };

  const initialState = createGameState(initialBoard);

  const whiteCapture = applyMove(initialState, 4, 4, 4, 6);
  assert.equal(whiteCapture.ok, true);
  assert.equal(whiteCapture.state.turn, "black");
  assert.equal(whiteCapture.state.capturesBy.white, 1);

  const remoteLikeRow = {
    fen: JSON.stringify({ version: 1, board: whiteCapture.state.board }),
    pgn: JSON.stringify({
      turn: whiteCapture.state.turn,
      moveCount: whiteCapture.state.moveCount,
      capturesBy: whiteCapture.state.capturesBy,
      winner: whiteCapture.state.winner,
    }),
    turn: whiteCapture.state.turn,
  };

  const rehydratedFromRemote = parseRemoteState(remoteLikeRow);
  const blackMove = applyMove(
    {
      ...rehydratedFromRemote,
      winner: null,
    },
    4,
    8,
    4,
    7,
  );
  assert.equal(blackMove.ok, true);

  const whiteWins = applyMove(blackMove.state, 4, 6, 4, 7);
  assert.equal(whiteWins.ok, true);
  assert.equal(whiteWins.state.winner, "white");

  const savedSession = normalizeLocalSession(
    {
      username: "Alice",
      status: "in_game",
      sessionMode: "local",
      currentColor: "white",
      localGameState: {
        ...whiteWins.state,
        controlByColor: {
          white: "human",
          red: "robot",
          black: "human",
          blue: "robot",
        },
      },
    },
    "2026-03-08T12:00:00.000Z",
  );

  const roundtrip = parseLocalSession(JSON.stringify(savedSession));
  assert.equal(roundtrip?.username, "alice");
  assert.equal(roundtrip?.localGameState?.winner, "white");
  assert.equal(roundtrip?.localGameState?.capturesBy?.white, 2);
  assert.equal(roundtrip?.localGameState?.moveCount, 3);
});

test("e2e remote create/join seating flow resolves seats correctly", () => {
  const ownerOptions = normalizeCreateOptions(" Alice ", {
    robotSeats: ["red"],
    playerIdsByColor: {
      blue: "  BOB  ",
    },
  });
  assert.deepEqual(ownerOptions.player_ids, {
    white: "alice",
    red: "robot",
    blue: "bob",
  });

  const freeSeatsAfterCreate = freeSeatsOf(ownerOptions.player_ids);
  assert.deepEqual(freeSeatsAfterCreate, ["black"]);

  const joinedPlayerIds = {
    ...ownerOptions.player_ids,
    black: "charlie",
  };
  assert.equal(colorOfPlayer(joinedPlayerIds, "charlie"), "black");
  assert.equal(freeSeatsOf(joinedPlayerIds).length, 0);
});

test("e2e local session roundtrip keeps sanitized in-game snapshot", () => {
  const localState = {
    board: {
      [keyOf(4, 4)]: { player: "white", type: "king" },
      [keyOf(4, 5)]: { player: "white", type: "rook" },
      [keyOf(8, 8)]: { player: "black", type: "king" },
    },
    turn: "black",
    moveCount: 9,
    capturesBy: {
      white: 3,
      red: 1,
      black: 0,
      blue: 0,
    },
    winner: null,
    controlByColor: {
      white: "human",
      red: "robot",
      black: "human",
      blue: "robot",
    },
  };

  const normalized = normalizeLocalSession(
    {
      username: "  DEV_PLAYER  ",
      status: "in_game",
      sessionMode: "local",
      currentColor: "white",
      isOwner: true,
      localGameState: localState,
    },
    "2026-03-08T14:00:00.000Z",
  );

  const restored = parseLocalSession(JSON.stringify(normalized));
  assert.equal(restored?.username, "dev_player");
  assert.equal(restored?.status, "in_game");
  assert.equal(restored?.sessionMode, "local");
  assert.equal(restored?.isOwner, true);
  assert.deepEqual(restored?.localGameState?.capturesBy, localState.capturesBy);
  assert.deepEqual(restored?.localGameState?.controlByColor, localState.controlByColor);
});
