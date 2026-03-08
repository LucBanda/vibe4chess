import seedrandom from "seedrandom";
import { BOARD_SIZE } from "./constants.js";
import { keyOf, isPlayable } from "./board.js";
import { applyMove } from "./engine.js";
import { isLegalMove, shouldPromote } from "./rules.js";

const PIECE_VALUE = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100,
};

function parseKey(squareKey) {
  const [x, y] = squareKey.split(",").map(Number);
  return { x, y };
}

function canCaptureSquare(board, piece, fromX, fromY, targetX, targetY) {
  return isLegalMove(board, fromX, fromY, targetX, targetY, piece);
}

function isSquareUnderThreat(board, owner, squareX, squareY) {
  for (const [squareKey, piece] of Object.entries(board)) {
    if (piece.player === owner) {
      continue;
    }
    const { x, y } = parseKey(squareKey);
    if (canCaptureSquare(board, piece, x, y, squareX, squareY)) {
      return true;
    }
  }
  return false;
}

function bestOpponentCaptureScore(board, owner) {
  let best = 0;
  for (const [squareKey, piece] of Object.entries(board)) {
    if (piece.player === owner) {
      continue;
    }
    const { x: fromX, y: fromY } = parseKey(squareKey);
    for (let toY = 0; toY < BOARD_SIZE; toY += 1) {
      for (let toX = 0; toX < BOARD_SIZE; toX += 1) {
        if (!isPlayable(toX, toY)) {
          continue;
        }
        if (!isLegalMove(board, fromX, fromY, toX, toY, piece)) {
          continue;
        }
        const captured = board[keyOf(toX, toY)];
        if (captured && captured.player === owner) {
          best = Math.max(best, PIECE_VALUE[captured.type] ?? 0);
        }
      }
    }
  }
  return best;
}

function scoreMove(state, piece, fromX, fromY, toX, toY) {
  const target = state.board[keyOf(toX, toY)];
  const captureScore = target ? (PIECE_VALUE[target.type] ?? 0) * 20 : 0;
  const promotionScore = shouldPromote(piece, toX, toY) ? 25 : 0;
  const centerScore = 8 - (Math.abs(6.5 - toX) + Math.abs(6.5 - toY)) * 0.3;

  let outcomeScore = 0;
  const simulated = applyMove(state, fromX, fromY, toX, toY);
  if (simulated.ok && simulated.state.winner === state.turn) {
    outcomeScore = 10_000;
  }

  if (!simulated.ok) {
    return -10_000;
  }

  const movedPiece = simulated.state.board[keyOf(toX, toY)];
  const movedPieceValue = PIECE_VALUE[movedPiece?.type] ?? PIECE_VALUE[piece.type] ?? 0;
  const exposedPenalty = isSquareUnderThreat(
    simulated.state.board,
    state.turn,
    toX,
    toY,
  )
    ? movedPieceValue * 12
    : 0;

  const opponentCounterCapture = bestOpponentCaptureScore(
    simulated.state.board,
    state.turn,
  );
  const counterPenalty = opponentCounterCapture * 9;

  return (
    captureScore +
    promotionScore +
    centerScore +
    outcomeScore -
    exposedPenalty -
    counterPenalty
  );
}

export function chooseRobotMove(state) {
  if (state.winner) {
    return null;
  }

  const candidates = [];
  for (const [squareKey, piece] of Object.entries(state.board)) {
    if (piece.player !== state.turn) {
      continue;
    }

    const { x: fromX, y: fromY } = parseKey(squareKey);

    for (let toY = 0; toY < BOARD_SIZE; toY += 1) {
      for (let toX = 0; toX < BOARD_SIZE; toX += 1) {
        if (!isPlayable(toX, toY)) {
          continue;
        }
        if (!isLegalMove(state.board, fromX, fromY, toX, toY, piece)) {
          continue;
        }

        candidates.push({
          fromX,
          fromY,
          toX,
          toY,
          score: scoreMove(state, piece, fromX, fromY, toX, toY),
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestScore = candidates[0].score;
  const bestCandidates = candidates.filter((candidate) => candidate.score === bestScore);
  const rng = seedrandom(
    `${state.moveCount}-${state.turn}-${bestCandidates.length}-${bestScore}`,
  );
  const pickedIndex = Math.floor(rng() * bestCandidates.length);
  return bestCandidates[pickedIndex];
}
