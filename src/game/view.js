import { BOARD_SIZE, PLAYERS } from "./constants.js";
import { isPlayable, keyOf } from "./board.js";
import { createCapturesBy } from "./engine.js";

export function parseRemoteState(row) {
  let board = {};
  let moveCount = 0;
  let capturesBy = createCapturesBy();
  let winner = null;

  try {
    const fenPayload = JSON.parse(row.fen);
    if (fenPayload?.board && typeof fenPayload.board === "object") {
      board = fenPayload.board;
    }
  } catch {
    board = {};
  }

  try {
    const pgnPayload = JSON.parse(row.pgn);
    moveCount = Number.isFinite(pgnPayload?.moveCount)
      ? pgnPayload.moveCount
      : 0;
    capturesBy = {
      ...createCapturesBy(),
      ...(pgnPayload?.capturesBy ?? {}),
    };
    winner = pgnPayload?.winner ?? null;
  } catch {
    moveCount = 0;
    capturesBy = createCapturesBy();
    winner = null;
  }

  return {
    board,
    turn: row.turn,
    moveCount,
    capturesBy,
    winner,
  };
}

export function freeSeatsOf(playerIds) {
  return PLAYERS.filter((color) => !playerIds?.[color]);
}

export function firstHumanColor(controlByColor) {
  for (const color of PLAYERS) {
    if (controlByColor[color] === "human") {
      return color;
    }
  }
  return "white";
}

export function displayToBoard(x, y, perspectiveColor) {
  if (perspectiveColor === "red") {
    return { x: BOARD_SIZE - 1 - y, y: x };
  }
  if (perspectiveColor === "black") {
    return {
      x: BOARD_SIZE - 1 - x,
      y: BOARD_SIZE - 1 - y,
    };
  }
  if (perspectiveColor === "blue") {
    return { x: y, y: BOARD_SIZE - 1 - x };
  }
  return { x, y };
}

export function boardToDisplay(x, y, perspectiveColor) {
  if (perspectiveColor === "red") {
    return { x: y, y: BOARD_SIZE - 1 - x };
  }
  if (perspectiveColor === "black") {
    return {
      x: BOARD_SIZE - 1 - x,
      y: BOARD_SIZE - 1 - y,
    };
  }
  if (perspectiveColor === "blue") {
    return { x: BOARD_SIZE - 1 - y, y: x };
  }
  return { x, y };
}

export function createPerspectiveCells(board, perspectiveColor) {
  const cells = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const boardPos = displayToBoard(x, y, perspectiveColor);
      cells.push({
        x,
        y,
        boardX: boardPos.x,
        boardY: boardPos.y,
        playable: isPlayable(boardPos.x, boardPos.y),
        piece: board[keyOf(boardPos.x, boardPos.y)] ?? null,
        isLight: (boardPos.x + boardPos.y) % 2 === 0,
      });
    }
  }

  return cells;
}
