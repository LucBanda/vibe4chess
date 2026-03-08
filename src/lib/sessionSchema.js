export const PLAYER_COLORS = ["white", "red", "black", "blue"];
export const PLAYER_STATUS = new Set(["idle", "in_game"]);
export const SESSION_MODES = new Set(["local", "remote_create", "remote_join"]);
export const CONTROL_MODES = new Set(["human", "robot"]);

export function normalizeMoveCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function normalizePlayerColor(value, fallback = null) {
  return PLAYER_COLORS.includes(value) ? value : fallback;
}

export function normalizeStatus(value, fallback = "idle") {
  return PLAYER_STATUS.has(value) ? value : fallback;
}

export function normalizeSessionMode(value, fallback = "local") {
  return SESSION_MODES.has(value) ? value : fallback;
}

export function normalizeCapturesBy(raw) {
  const capturesBy = {};
  for (const color of PLAYER_COLORS) {
    capturesBy[color] = normalizeMoveCount(raw?.[color]);
  }
  return capturesBy;
}

export function normalizeControlByColor(raw) {
  const controlByColor = {};
  for (const color of PLAYER_COLORS) {
    const requested = raw?.[color];
    controlByColor[color] = CONTROL_MODES.has(requested) ? requested : "human";
  }
  return controlByColor;
}
