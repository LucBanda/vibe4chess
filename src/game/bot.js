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

function materialByPlayer(board) {
  const totals = {
    white: 0,
    red: 0,
    black: 0,
    blue: 0,
  };
  for (const piece of Object.values(board)) {
    totals[piece.player] += PIECE_VALUE[piece.type] ?? 0;
  }
  return totals;
}

function parseKey(squareKey) {
  const [x, y] = squareKey.split(",").map(Number);
  return { x, y };
}

function countSquareThreats(board, owner, squareX, squareY) {
  let threatCount = 0;
  for (const [squareKey, piece] of Object.entries(board)) {
    if (piece.player === owner) {
      continue;
    }
    const { x, y } = parseKey(squareKey);
    if (isLegalMove(board, x, y, squareX, squareY, piece)) {
      threatCount += 1;
    }
  }
  return threatCount;
}

function isSquareUnderThreat(board, owner, squareX, squareY) {
  return countSquareThreats(board, owner, squareX, squareY) > 0;
}

function findKingPosition(board, owner) {
  for (const [squareKey, piece] of Object.entries(board)) {
    if (piece.player !== owner || piece.type !== "king") {
      continue;
    }
    return parseKey(squareKey);
  }
  return null;
}

function countCheckedOpponentKings(board, owner) {
  let count = 0;
  for (const color of ["white", "red", "black", "blue"]) {
    if (color === owner) {
      continue;
    }
    const kingPos = findKingPosition(board, color);
    if (kingPos && isSquareUnderThreat(board, color, kingPos.x, kingPos.y)) {
      count += 1;
    }
  }
  return count;
}

function pawnAdvancement(piece, toX, toY) {
  const base = piece.origin ?? piece.player;
  if (base === "white") return 12 - toY;
  if (base === "black") return toY - 1;
  if (base === "red") return toX - 1;
  return 12 - toX;
}

function kingMobility(board, color) {
  const kingPos = findKingPosition(board, color);
  if (!kingPos) return 0;
  let mobility = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = kingPos.x + dx;
      const ny = kingPos.y + dy;
      if (!isPlayable(nx, ny)) continue;
      const occupant = board[keyOf(nx, ny)];
      if (!occupant || occupant.player !== color) {
        mobility += 1;
      }
    }
  }
  return mobility;
}

function totalOpponentKingMobility(board, owner) {
  let total = 0;
  for (const color of ["white", "red", "black", "blue"]) {
    if (color === owner) continue;
    total += kingMobility(board, color);
  }
  return total;
}

function attackedOpponentsCount(board, owner, fromX, fromY, piece) {
  const attackedColors = new Set();
  for (let toY = 0; toY < BOARD_SIZE; toY += 1) {
    for (let toX = 0; toX < BOARD_SIZE; toX += 1) {
      if (!isPlayable(toX, toY)) {
        continue;
      }
      if (!isLegalMove(board, fromX, fromY, toX, toY, piece)) {
        continue;
      }
      const target = board[keyOf(toX, toY)];
      if (target && target.player !== owner) {
        attackedColors.add(target.player);
      }
    }
  }
  return attackedColors.size;
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
  const promotionScore = shouldPromote(piece, toX, toY) ? 120 : 0;
  const pawnAdvancementBonus = piece.type === "pawn" ? pawnAdvancement(piece, toX, toY) * 0.5 : 0;
  const centerScore = 8 - (Math.abs(6.5 - toX) + Math.abs(6.5 - toY)) * 0.3;

  let outcomeScore = 0;
  const simulated = applyMove(state, fromX, fromY, toX, toY);
  if (simulated.ok && simulated.state.winner === state.turn) {
    outcomeScore = 10_000;
  }

  if (!simulated.ok) {
    return -10_000;
  }

  const myMaterial = materialByPlayer(simulated.state.board)[state.turn];
  const simulatedMaterial = materialByPlayer(simulated.state.board);
  const opponentsByMaterial = Object.entries(simulatedMaterial)
    .filter(([player]) => player !== state.turn)
    .sort((a, b) => b[1] - a[1]);
  const leadingOpponent = opponentsByMaterial[0]?.[0] ?? null;
  const weakestOpponentMaterial = opponentsByMaterial.at(-1)?.[1] ?? myMaterial;
  // When we strongly dominate the weakest opponent, press harder.
  const dominanceRatio = weakestOpponentMaterial > 0 ? myMaterial / weakestOpponentMaterial : 4;
  const dominanceMultiplier = Math.min(dominanceRatio / 2, 2);

  const leaderPressureBonus =
    target && target.player === leadingOpponent ? (PIECE_VALUE[target.type] ?? 0) * 4 : 0;
  const kingCaptureBonus = target?.type === "king" ? 700 : 0;

  const movedPiece = simulated.state.board[keyOf(toX, toY)];
  const movedPieceValue = PIECE_VALUE[movedPiece?.type] ?? PIECE_VALUE[piece.type] ?? 0;
  const threatCount = countSquareThreats(simulated.state.board, state.turn, toX, toY);
  const exposedPenalty = threatCount > 0 ? movedPieceValue * (9 + threatCount * 4) : 0;
  const forkBonus =
    attackedOpponentsCount(simulated.state.board, state.turn, toX, toY, movedPiece) * 20;
  const checkBonus = countCheckedOpponentKings(simulated.state.board, state.turn) * 50;

  // Reward moves that restrict opponent kings' escape squares.
  const mobilityBefore = totalOpponentKingMobility(state.board, state.turn);
  const mobilityAfter = totalOpponentKingMobility(simulated.state.board, state.turn);
  const confinementBonus = Math.max(0, mobilityBefore - mobilityAfter) * 12 * dominanceMultiplier;

  const opponentCounterCapture = bestOpponentCaptureScore(
    simulated.state.board,
    state.turn,
  );
  // Reduced multiplier (was 9): counter-capture risk is always present in
  // multi-player chess and a high constant drag drowns out useful signal.
  const counterPenalty = opponentCounterCapture * 5;
  const kingPosition = findKingPosition(simulated.state.board, state.turn);
  // Reduce king-safety penalty proportionally when we dominate: a large
  // material lead makes our own king safer.
  const baseKingPenalty = 350;
  const scaledKingPenalty = Math.round(baseKingPenalty / dominanceMultiplier);
  const kingInDangerPenalty =
    kingPosition && isSquareUnderThreat(simulated.state.board, state.turn, kingPosition.x, kingPosition.y)
      ? scaledKingPenalty
      : 0;

  return (
    captureScore +
    promotionScore +
    centerScore +
    outcomeScore +
    checkBonus +
    confinementBonus +
    pawnAdvancementBonus -
    kingInDangerPenalty -
    exposedPenalty -
    counterPenalty +
    leaderPressureBonus +
    kingCaptureBonus +
    forkBonus
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
