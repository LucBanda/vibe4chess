import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_BOARD_ZOOM,
  MIN_BOARD_ZOOM,
  centerBetweenTouches,
  clamp,
  clampPanForZoom,
  distanceBetweenTouches,
  maxPanForZoom,
} from "../src/game/camera.js";

test("camera zoom constants stay stable", () => {
  assert.equal(MIN_BOARD_ZOOM, 1);
  assert.equal(MAX_BOARD_ZOOM, 1.8);
});

test("clamp bounds values", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
});

test("maxPanForZoom computes bounded pan budget", () => {
  assert.equal(maxPanForZoom(700, 1), 0);
  assert.equal(maxPanForZoom(700, 1.4), 139);
});

test("clampPanForZoom respects dynamic pan budget", () => {
  assert.equal(clampPanForZoom(30, 500, 1), 0);
  assert.equal(clampPanForZoom(120, 500, 1.2), 50);
  assert.equal(clampPanForZoom(-120, 500, 1.2), -50);
});

test("touch helpers compute geometry", () => {
  const a = { pageX: 10, pageY: 20 };
  const b = { pageX: 14, pageY: 23 };

  assert.equal(distanceBetweenTouches(a, b), 5);
  assert.deepEqual(centerBetweenTouches(a, b), { x: 12, y: 21.5 });
});
