import { keyOf } from "./board.js";
import { getNextAlivePlayer, isLegalMove, shouldPromote } from "./rules.js";
import { computeStats } from "./stats.js";

export function createCapturesBy() {
  return {
    white: 0,
    red: 0,
    black: 0,
    blue: 0,
  };
}

export function createGameState(initialBoard) {
  return {
    board: initialBoard,
    turn: "white",
    moveCount: 0,
    capturesBy: createCapturesBy(),
    winner: null,
  };
}

export function applyMove(state, fromX, fromY, toX, toY) {
  if (state.winner) {
    return { ok: false, reason: "game_over", state };
  }

  const sourceKey = keyOf(fromX, fromY);
  const targetKey = keyOf(toX, toY);
  const movingPiece = state.board[sourceKey];
  const target = state.board[targetKey];

  if (!movingPiece || movingPiece.player !== state.turn) {
    return { ok: false, reason: "invalid_source", state };
  }

  if (target && target.player === state.turn) {
    return { ok: false, reason: "friendly_target", state };
  }

  if (!isLegalMove(state.board, fromX, fromY, toX, toY, movingPiece)) {
    return { ok: false, reason: "illegal_move", state };
  }

  const nextBoard = { ...state.board };
  delete nextBoard[sourceKey];

  nextBoard[targetKey] = shouldPromote(movingPiece, toX, toY)
    ? { ...movingPiece, type: "queen" }
    : movingPiece;

  const nextCapturesBy = { ...state.capturesBy };
  if (target) {
    nextCapturesBy[state.turn] += 1;
  }

  const stats = computeStats(nextBoard, nextCapturesBy);
  const alivePlayers = stats.filter((entry) => entry.alive).map((entry) => entry.player);
  const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
  const nextTurn = winner ?? getNextAlivePlayer(state.turn, alivePlayers);

  return {
    ok: true,
    state: {
      board: nextBoard,
      turn: nextTurn,
      moveCount: state.moveCount + 1,
      capturesBy: nextCapturesBy,
      winner,
    },
  };
}
