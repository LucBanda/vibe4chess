import test from "node:test";
import assert from "node:assert/strict";

import { buildPlayerStatusPayload } from "../../src/lib/gameApi.js";
import { normalizeLocalSession } from "../../src/lib/localSessionState.js";

test("e2e session contract keeps status/mode/color normalization aligned between layers", () => {
  const payload = buildPlayerStatusPayload({
    status: "broken",
    sessionMode: "offline",
    currentColor: "green",
    username: "ALICE",
    isOwner: true,
  });

  const local = normalizeLocalSession({
    status: "broken",
    sessionMode: "offline",
    currentColor: "green",
    username: "ALICE",
    isOwner: true,
  });

  assert.equal(payload.status, "idle");
  assert.equal(local.status, "idle");
  assert.equal(payload.session_mode, "local");
  assert.equal(local.sessionMode, "local");
  assert.equal(payload.current_color, null);
  assert.equal(local.currentColor, null);
  assert.equal(payload.username, local.username);
});
