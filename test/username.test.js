import test from "node:test";
import assert from "node:assert/strict";

import { normalizeUsername } from "../src/lib/username.js";

test("normalizeUsername lowercases and strips unsupported chars", () => {
  assert.equal(normalizeUsername("  Alice-42!@#  "), "alice-42");
});

test("normalizeUsername truncates to 32 chars", () => {
  const value = normalizeUsername("abcdefghijklmnopqrstuvwxyz0123456789");
  assert.equal(value.length, 32);
  assert.equal(value, "abcdefghijklmnopqrstuvwxyz012345");
});

test("normalizeUsername falls back when empty", () => {
  assert.equal(normalizeUsername("   ", "guest"), "guest");
  assert.equal(normalizeUsername(undefined, "guest"), "guest");
});
