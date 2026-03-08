import test from "node:test";
import assert from "node:assert/strict";

import { getTabUsername, setTabUsername } from "../src/lib/tabUsername.js";

function makeSessionStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test("setTabUsername persists normalized username in sessionStorage", () => {
  globalThis.sessionStorage = makeSessionStorage();

  const saved = setTabUsername("  Bob_99!  ");

  assert.equal(saved, "bob_99");
  assert.equal(getTabUsername(), "bob_99");

  delete globalThis.sessionStorage;
});

test("tab username helpers gracefully fallback on storage errors", () => {
  globalThis.sessionStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(setTabUsername("Alice"), "alice");
  assert.equal(getTabUsername(), "player");

  delete globalThis.sessionStorage;
});
