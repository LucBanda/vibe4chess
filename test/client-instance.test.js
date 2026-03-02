import test from "node:test";
import assert from "node:assert/strict";

import { getClientInstanceId } from "../src/lib/clientInstance.js";

test("getClientInstanceId is stable during current runtime", () => {
  const idA = getClientInstanceId();
  const idB = getClientInstanceId();

  assert.equal(idA, idB);
  assert.equal(typeof idA, "string");
  assert.equal(idA.includes(":"), true);
});
