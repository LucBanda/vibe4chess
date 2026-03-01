import { PLAYERS } from "./constants.js";
import { isPlayable, keyOf } from "./board.js";

function isPathClear(board, fromX, fromY, toX, toY) {
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let x = fromX + stepX;
  let y = fromY + stepY;

  while (x !== toX || y !== toY) {
    if (board[keyOf(x, y)]) {
      return false;
    }
    x += stepX;
    y += stepY;
  }

  return true;
}

function isPawnStart(piece, x, y) {
  return (
    (piece.player === "white" && y === 12) ||
    (piece.player === "black" && y === 1) ||
    (piece.player === "red" && x === 1) ||
    (piece.player === "blue" && x === 12)
  );
}

function pawnDirection(player) {
  if (player === "white") return { dx: 0, dy: -1 };
  if (player === "black") return { dx: 0, dy: 1 };
  if (player === "red") return { dx: 1, dy: 0 };
  return { dx: -1, dy: 0 };
}

function pawnCaptureOffsets(player) {
  if (player === "white") {
    return [
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
    ];
  }
  if (player === "black") {
    return [
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];
  }
  if (player === "red") {
    return [
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 },
    ];
  }
  return [
    { dx: -1, dy: -1 },
    { dx: -1, dy: 1 },
  ];
}

export function shouldPromote(piece, x, y) {
  if (piece.type !== "pawn") {
    return false;
  }
  if (piece.player === "white") return y === 0;
  if (piece.player === "black") return y === 13;
  if (piece.player === "red") return x === 13;
  return x === 0;
}

export function isLegalMove(board, fromX, fromY, toX, toY, piece) {
  if (!isPlayable(toX, toY) || (fromX === toX && fromY === toY)) {
    return false;
  }

  const target = board[keyOf(toX, toY)];
  if (target && target.player === piece.player) {
    return false;
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (piece.type === "knight") {
    return (absX === 1 && absY === 2) || (absX === 2 && absY === 1);
  }

  if (piece.type === "bishop") {
    return absX === absY && isPathClear(board, fromX, fromY, toX, toY);
  }

  if (piece.type === "rook") {
    const sameFileOrRank = dx === 0 || dy === 0;
    return sameFileOrRank && isPathClear(board, fromX, fromY, toX, toY);
  }

  if (piece.type === "queen") {
    const straight = dx === 0 || dy === 0;
    const diagonal = absX === absY;
    return (straight || diagonal) && isPathClear(board, fromX, fromY, toX, toY);
  }

  if (piece.type === "king") {
    return absX <= 1 && absY <= 1;
  }

  if (piece.type === "pawn") {
    const dir = pawnDirection(piece.player);
    const oneStepX = fromX + dir.dx;
    const oneStepY = fromY + dir.dy;

    if (toX === oneStepX && toY === oneStepY && !target) {
      return true;
    }

    const twoStepX = fromX + dir.dx * 2;
    const twoStepY = fromY + dir.dy * 2;
    const middleSquare = board[keyOf(oneStepX, oneStepY)];

    if (
      isPawnStart(piece, fromX, fromY) &&
      toX === twoStepX &&
      toY === twoStepY &&
      !target &&
      !middleSquare
    ) {
      return true;
    }

    const captures = pawnCaptureOffsets(piece.player);
    return captures.some(({ dx: capX, dy: capY }) => {
      return toX === fromX + capX && toY === fromY + capY && Boolean(target);
    });
  }

  return false;
}

export function getNextAlivePlayer(current, alivePlayers) {
  const currentIndex = PLAYERS.indexOf(current);

  for (let i = 1; i <= PLAYERS.length; i += 1) {
    const player = PLAYERS[(currentIndex + i) % PLAYERS.length];
    if (alivePlayers.includes(player)) {
      return player;
    }
  }

  return current;
}
