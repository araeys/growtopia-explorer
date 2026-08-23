const test = require("node:test");
const assert = require("node:assert/strict");
const Sequence = require("../public/wearable_sequence.js");

test("normalizes explicit replace-frame descriptors", () => {
  assert.deepEqual(
    Sequence.normalizeDescriptor({
      mode: "replace-frame",
      frames: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
    }),
    {
      mode: "replace-frame",
      frames: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
    }
  );
  assert.throws(
    () => Sequence.normalizeDescriptor({ mode: "replace-frame", frames: [] }),
    /at least two frames/
  );
  assert.throws(
    () =>
      Sequence.normalizeDescriptor({
        mode: "replace-frame",
        frames: [{ dx: 0, dy: 0 }, { dx: 1.5, dy: 0 }],
      }),
    /integer tile offset/
  );
});

test("resolves playing and paused replacement frames", () => {
  const descriptor = {
    mode: "replace-frame",
    frames: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
  };
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "playing" }, 4),
    [{ dx: 1, dy: 0, role: "replace" }]
  );
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "paused", frame: 2 }, 99),
    [{ dx: 2, dy: 0, role: "replace" }]
  );
});

test("keeps the base while cycling overlay frames", () => {
  const descriptor = {
    mode: "base-plus-overlay",
    base: { dx: 0, dy: 0 },
    frames: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
  };
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "playing" }, 1),
    [
      { dx: 0, dy: 0, role: "base" },
      { dx: 2, dy: 0, role: "overlay" },
    ]
  );
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "paused", frame: 0 }, 1),
    [
      { dx: 0, dy: 0, role: "base" },
      { dx: 1, dy: 0, role: "overlay" },
    ]
  );
});

test("supports a base-only frame in overlay sequences", () => {
  const descriptor = {
    mode: "base-plus-overlay",
    base: { dx: 0, dy: 0 },
    frames: [null, { dx: 1, dy: 0 }],
  };

  assert.deepEqual(Sequence.normalizeDescriptor(descriptor), descriptor);
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "playing" }, 0),
    [{ dx: 0, dy: 0, role: "base" }]
  );
  assert.deepEqual(
    Sequence.resolveDrawPlan(descriptor, { mode: "playing" }, 1),
    [
      { dx: 0, dy: 0, role: "base" },
      { dx: 1, dy: 0, role: "overlay" },
    ]
  );
});

test("clamps invalid playback values to a safe state", () => {
  assert.deepEqual(Sequence.normalizePlayback({ mode: "paused", frame: 99 }, 3), {
    mode: "paused",
    frame: 2,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.normalizePlayback({ mode: "wat" }, 3), {
    mode: "playing",
    frame: 0,
    intervalMs: 150,
  });
});

test("toggles playing and paused on the visible frame", () => {
  assert.deepEqual(Sequence.togglePlayback({ mode: "playing" }, 3, 8), {
    mode: "paused",
    frame: 3,
    intervalMs: 150,
  });
  assert.deepEqual(
    Sequence.togglePlayback({ mode: "paused", frame: 3 }, 3, 8),
    { mode: "playing", frame: 3, intervalMs: 150, startedAtMs: 0 }
  );
});

test("manual stepping pauses and wraps", () => {
  assert.deepEqual(Sequence.stepPlayback({ mode: "playing" }, -1, 0, 8), {
    mode: "paused",
    frame: 7,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.stepPlayback({ mode: "paused", frame: 7 }, 1, 7, 8), {
    mode: "paused",
    frame: 0,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.selectFrame({ mode: "playing" }, 99, 8), {
    mode: "paused",
    frame: 7,
    intervalMs: 150,
  });
});

test("persists playback independently by item id", () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let state = Sequence.loadState(storage);
  state = Sequence.setPlayback(state, 42, { mode: "paused", frame: 1 }, 4);
  state = Sequence.setPlayback(state, 77, { mode: "playing", frame: 0 }, 2);
  Sequence.saveState(storage, state);
  const loaded = Sequence.loadState(storage);
  assert.deepEqual(Sequence.getPlayback(loaded, 42, 4), {
    mode: "paused",
    frame: 1,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.getPlayback(loaded, 77, 2), {
    mode: "playing",
    frame: 0,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.getPlayback(loaded, 88, 2), {
    mode: "playing",
    frame: 0,
    intervalMs: 150,
  });
});

test("migrates version one playback state", () => {
  const storage = {
    getItem(key) {
      if (key !== "gt-set-planner:wearable-sequences:v1") return null;
      return JSON.stringify({
        version: 1,
        items: {
          42: { mode: "frame", frame: 2 },
          77: { mode: "off" },
          88: { mode: "auto" },
        },
      });
    },
    setItem() {},
  };

  const state = Sequence.loadState(storage);

  assert.deepEqual(Sequence.getPlayback(state, 42, 4), {
    mode: "paused",
    frame: 2,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.getPlayback(state, 77, 4), {
    mode: "paused",
    frame: 0,
    intervalMs: 150,
  });
  assert.deepEqual(Sequence.getPlayback(state, 88, 4), {
    mode: "playing",
    frame: 0,
    intervalMs: 150,
  });
});

test("builds deterministic positioned sequence export manifests", () => {
  const manifest = Sequence.buildSequenceExportManifest({
    canvas: { width: 192, height: 192 },
    items: [
      {
        item: { id: 8304, name: "Magic Magnet", slot: "Hand" },
        finalLogicalOrigin: { x: 35, y: 30 },
        descriptor: {
          mode: "base-plus-overlay",
          base: { dx: 0, dy: 0 },
          frames: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
        },
      },
      {
        item: { id: 10, name: "Static Hat", slot: "Hat" },
        finalLogicalOrigin: { x: 32, y: 14 },
        descriptor: null,
      },
    ],
  });
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.canvas, { width: 192, height: 192 });
  assert.equal(manifest.items.length, 1);
  assert.deepEqual(manifest.items[0].finalLogicalOrigin, { x: 35, y: 30 });
  assert.deepEqual(
    manifest.items[0].frames.map(frame => frame.filename),
    [
      "items/8304-magic-magnet/frame-001.png",
      "items/8304-magic-magnet/frame-002.png",
    ]
  );
  assert.deepEqual(manifest.items[0].frames[0].drawPlan, [
    { dx: 0, dy: 0, role: "base" },
    { dx: 1, dy: 0, role: "overlay" },
  ]);
});

test("sorts sequence export items by numeric id", () => {
  const descriptor = {
    mode: "replace-frame",
    frames: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
  };
  const manifest = Sequence.buildSequenceExportManifest({
    canvas: { width: 192, height: 192 },
    items: [
      { item: { id: 20, name: "B", slot: "Back" }, descriptor },
      { item: { id: 3, name: "A", slot: "Hair" }, descriptor },
    ],
  });
  assert.deepEqual(manifest.items.map(value => value.id), [3, 20]);
});

test("normalizes sequence interval milliseconds", () => {
  assert.equal(Sequence.DEFAULT_INTERVAL_MS, 150);
  assert.equal(Sequence.MIN_INTERVAL_MS, 50);
  assert.equal(Sequence.MAX_INTERVAL_MS, 2000);
  assert.equal(Sequence.INTERVAL_STEP_MS, 10);
  assert.equal(Sequence.normalizeIntervalMs(undefined), 150);
  assert.equal(Sequence.normalizeIntervalMs("wat"), 150);
  assert.equal(Sequence.normalizeIntervalMs(10), 50);
  assert.equal(Sequence.normalizeIntervalMs(2500), 2000);
  assert.equal(Sequence.normalizeIntervalMs(154), 150);
  assert.equal(Sequence.normalizeIntervalMs(156), 160);
});

test("normalizes playback with interval milliseconds", () => {
  assert.deepEqual(Sequence.normalizePlayback({ mode: "playing" }, 4), {
    mode: "playing",
    frame: 0,
    intervalMs: 150,
  });
  assert.deepEqual(
    Sequence.normalizePlayback({ mode: "paused", frame: 9, intervalMs: 73 }, 4),
    { mode: "paused", frame: 3, intervalMs: 70 }
  );
});

test("persists interval milliseconds independently by item id", () => {
  let state = Sequence.loadState({
    getItem: () => null,
    setItem() {},
  });
  state = Sequence.setPlayback(state, 42, { mode: "paused", frame: 1 }, 4);
  state = Sequence.setIntervalMs(state, 42, 360, 4);
  state = Sequence.setPlayback(state, 77, { mode: "playing", frame: 0 }, 2);
  state = Sequence.setIntervalMs(state, 77, 90, 2);

  assert.deepEqual(Sequence.getPlayback(state, 42, 4), {
    mode: "paused",
    frame: 1,
    intervalMs: 360,
  });
  assert.deepEqual(Sequence.getPlayback(state, 77, 2), {
    mode: "playing",
    frame: 0,
    intervalMs: 90,
  });
});

test("calculates visible frame from elapsed milliseconds", () => {
  assert.equal(
    Sequence.getVisibleFrameAtTime(
      { mode: "playing", frame: 1, intervalMs: 100, startedAtMs: 1000 },
      4,
      1299
    ),
    3
  );
  assert.equal(
    Sequence.getVisibleFrameAtTime(
      { mode: "paused", frame: 2, intervalMs: 100, startedAtMs: 1000 },
      4,
      9999
    ),
    2
  );
});

test("changes interval while preserving visible frame and mode", () => {
  const next = Sequence.changeIntervalForVisibleFrame(
    { mode: "playing", frame: 0, intervalMs: 100, startedAtMs: 1000 },
    250,
    3,
    4,
    1410
  );
  assert.deepEqual(next, {
    mode: "playing",
    frame: 3,
    intervalMs: 250,
    startedAtMs: 1410,
  });
  assert.deepEqual(
    Sequence.changeIntervalForVisibleFrame(
      { mode: "paused", frame: 2, intervalMs: 100 },
      250,
      2,
      4,
      1410
    ),
    { mode: "paused", frame: 2, intervalMs: 250 }
  );
});
