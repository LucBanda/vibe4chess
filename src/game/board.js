import { BACK_RANK, BOARD_SIZE } from "./constants.js";

export function keyOf(x, y) {
  return `${x},${y}`;
}

export function isPlayable(x, y) {
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
    return false;
  }

  const inTopLeft = x < 3 && y < 3;
  const inTopRight = x > 10 && y < 3;
  const inBottomLeft = x < 3 && y > 10;
  const inBottomRight = x > 10 && y > 10;

  return !(inTopLeft || inTopRight || inBottomLeft || inBottomRight);
}

export function createInitialBoard() {
  const board = {};

  for (let i = 0; i < 8; i += 1) {
    const x = i + 3;
    board[keyOf(x, 13)] = { player: "white", type: BACK_RANK[i] };
    board[keyOf(x, 12)] = { player: "white", type: "pawn" };

    board[keyOf(x, 0)] = { player: "black", type: BACK_RANK[i] };
    board[keyOf(x, 1)] = { player: "black", type: "pawn" };
  }

  for (let i = 0; i < 8; i += 1) {
    const y = i + 3;
    board[keyOf(0, y)] = { player: "red", type: BACK_RANK[i] };
    board[keyOf(1, y)] = { player: "red", type: "pawn" };

    board[keyOf(13, y)] = { player: "blue", type: BACK_RANK[i] };
    board[keyOf(12, y)] = { player: "blue", type: "pawn" };
  }

  return board;
}

export function buildCells(board) {
  const cells = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      cells.push({
        x,
        y,
        playable: isPlayable(x, y),
        piece: board[keyOf(x, y)] ?? null,
        isLight: (x + y) % 2 === 0,
      });
    }
  }

  return cells;
}
