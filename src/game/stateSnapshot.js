export function createGameSnapshot({
  board,
  turn,
  moveCount,
  capturesBy,
  winner,
}) {
  return {
    board,
    turn,
    moveCount,
    capturesBy,
    winner,
  };
}
