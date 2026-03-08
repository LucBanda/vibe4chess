export const MIN_BOARD_ZOOM = 1;
export const MAX_BOARD_ZOOM = 1.8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function maxPanForZoom(boardSize, zoom) {
  return Math.max(0, Math.floor(((boardSize * zoom) - boardSize) / 2));
}

export function clampPanForZoom(value, boardSize, zoom) {
  const maxPan = maxPanForZoom(boardSize, zoom);
  return clamp(value, -maxPan, maxPan);
}

export function distanceBetweenTouches(touchA, touchB) {
  return Math.hypot(touchB.pageX - touchA.pageX, touchB.pageY - touchA.pageY);
}

export function centerBetweenTouches(touchA, touchB) {
  return {
    x: (touchA.pageX + touchB.pageX) / 2,
    y: (touchA.pageY + touchB.pageY) / 2,
  };
}
