const test = require("node:test");
const assert = require("node:assert/strict");

let catalog = {};
try {
  catalog = require("../public/wearable_catalog.js");
} catch {
  catalog = {};
}

test("defines every planner slot once", () => {
  assert.ok(Array.isArray(catalog.SLOT_CONFIG));
  assert.deepEqual(
    catalog.SLOT_CONFIG.map((slot) => slot.key),
    [
      "Back",
      "Artifact",
      "Feet",
      "Pants",
      "Shirt",
      "Chest",
      "Face",
      "Hair",
      "Hat",
      "Hand"
    ]
  );
  assert.equal(
    new Set(catalog.SLOT_CONFIG.map((slot) => slot.key)).size,
    10
  );
});

test("groups only matching manifest records", () => {
  assert.equal(typeof catalog.groupWearablesBySlot, "function");
  const grouped = catalog.groupWearablesBySlot([
    { id: 1, slot: "Hat" },
    { id: 2, slot: "Hair" },
    { id: 3, slot: "Unknown" }
  ]);

  assert.deepEqual(grouped.Hat.map((item) => item.id), [1]);
  assert.deepEqual(grouped.Hair.map((item) => item.id), [2]);
  assert.equal(Object.hasOwn(grouped, "Unknown"), false);
});

test("declares and resolves the standard crop profile", () => {
  assert.deepEqual(catalog.RENDER_PROFILES.standard_32, {
    sourceWidth: 32,
    sourceHeight: 32,
    destinationWidth: 128,
    destinationHeight: 128
  });
  assert.equal(
    catalog.getRenderProfile("unknown"),
    catalog.RENDER_PROFILES.standard_32
  );
});

test("uses the same configuration for render layers", () => {
  assert.equal(typeof catalog.getRenderLayers, "function");
  const layers = catalog.getRenderLayers();

  assert.deepEqual(
    layers.map((slot) => slot.key),
    catalog.SLOT_CONFIG.map((slot) => slot.key)
  );
  assert.equal(layers[0].phase, "behind-base");
  assert.equal(layers.at(-1).phase, "wearable");
});

test("declares systemic head anchors above expression", () => {
  const hair = catalog.SLOT_CONFIG.find((slot) => slot.key === "Hair");
  const hat = catalog.SLOT_CONFIG.find((slot) => slot.key === "Hat");
  const face = catalog.SLOT_CONFIG.find((slot) => slot.key === "Face");

  assert.deepEqual(hair.defaultOffset, { x: 0, y: -9 });
  assert.deepEqual(hat.defaultOffset, { x: 0, y: -18 });
  assert.equal(hair.phase, "wearable");
  assert.equal(hat.phase, "wearable");
  assert.deepEqual(face.defaultOffset, { x: 0, y: 0 });
  assert.equal(face.phase, "wearable");
});
