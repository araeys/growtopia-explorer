const test = require("node:test");
const assert = require("node:assert/strict");

let positioning = {};
try {
  positioning = require("../public/avatar_positioning.js");
} catch {
  positioning = {};
}

test("isolates offsets by slot and item without mutating prior state", () => {
  assert.equal(typeof positioning.emptyState, "function");
  assert.equal(typeof positioning.setOffset, "function");
  assert.equal(typeof positioning.getOffset, "function");

  const initial = positioning.emptyState();
  const updated = positioning.setOffset(
    initial,
    "Hat",
    10,
    { x: 2, y: -1 }
  );

  assert.deepEqual(positioning.getOffset(updated, "Hat", 10), {
    x: 2,
    y: -1
  });
  assert.deepEqual(positioning.getOffset(updated, "Hat", 11), {
    x: 0,
    y: 0
  });
  assert.deepEqual(positioning.getOffset(initial, "Hat", 10), {
    x: 0,
    y: 0
  });
});

test("clamps offsets and normalizes invalid axes", () => {
  assert.equal(typeof positioning.normalizeOffset, "function");
  assert.deepEqual(
    positioning.normalizeOffset({ x: 999, y: "bad" }),
    { x: 32, y: 0 }
  );
  assert.deepEqual(
    positioning.normalizeOffset({ x: -999, y: 2.8 }),
    { x: -32, y: 2 }
  );
});

test("resets one item without erasing other item offsets", () => {
  assert.equal(typeof positioning.resetOffset, "function");
  let state = positioning.emptyState();
  state = positioning.setOffset(state, "Hat", 10, { x: 1, y: 2 });
  state = positioning.setOffset(state, "Hat", 11, { x: 3, y: 4 });

  const reset = positioning.resetOffset(state, "Hat", 10);

  assert.deepEqual(positioning.getOffset(reset, "Hat", 10), { x: 0, y: 0 });
  assert.deepEqual(positioning.getOffset(reset, "Hat", 11), { x: 3, y: 4 });
});

test("rejects malformed and wrong-version persistence", () => {
  assert.equal(typeof positioning.deserialize, "function");
  assert.deepEqual(
    positioning.deserialize("{broken"),
    positioning.emptyState()
  );
  assert.deepEqual(
    positioning.deserialize('{"version":99,"positions":{}}'),
    positioning.emptyState()
  );
});

test("loads and saves through guarded storage access", () => {
  assert.equal(typeof positioning.load, "function");
  assert.equal(typeof positioning.save, "function");
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  const state = positioning.setOffset(
    positioning.emptyState(),
    "Hair",
    44,
    { x: -2, y: 3 }
  );

  assert.equal(positioning.save(storage, state), true);
  assert.deepEqual(positioning.load(storage), state);

  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };
  assert.deepEqual(positioning.load(throwingStorage), positioning.emptyState());
  assert.equal(positioning.save(throwingStorage, state), false);
});

test("reset all returns a fresh empty state", () => {
  assert.equal(typeof positioning.resetAll, "function");
  const populated = positioning.setOffset(
    positioning.emptyState(),
    "Back",
    16012,
    { x: 4, y: 4 }
  );
  assert.deepEqual(positioning.resetAll(populated), positioning.emptyState());
});
