import { PLAYERS } from "./constants.js";

export function computeStats(board, capturesBy) {
  const pieceCount = { white: 0, red: 0, black: 0, blue: 0 };
  const kingAlive = { white: false, red: false, black: false, blue: false };

  Object.values(board).forEach((piece) => {
    pieceCount[piece.player] += 1;
    if (piece.type === "king") {
      kingAlive[piece.player] = true;
    }
  });

  return PLAYERS.map((player) => ({
    player,
    pieces: pieceCount[player],
    captures: capturesBy[player],
    alive: kingAlive[player],
  }));
}
