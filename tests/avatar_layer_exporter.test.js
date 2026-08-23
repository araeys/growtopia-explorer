const test = require("node:test");
const assert = require("node:assert/strict");
const Exporter = require("../public/avatar_layer_exporter.js");

test("declares all independent canonical body parts", () => {
  assert.deepEqual(Exporter.BASE_PART_KEYS, [
    "tangan-kanan",
    "kaki-kiri",
    "kaki-kanan",
    "body",
    "head-utuh",
    "head-bolong",
    "bola-mata",
    "pupil",
    "mulut",
    "tutup-mata",
    "expression",
    "tangan-kiri"
  ]);
});

test("omits empty wearables and serializes stable metadata", () => {
  const plan = Exporter.buildExportPlan({
    canvas: { width: 192, height: 192 },
    playerOrigin: { x: 8, y: 16 },
    scale: 4,
    skinTone: "White",
    expressionId: 0,
    manifestVersion: 26,
    slotConfig: [
      {
        key: "Hat",
        phase: "pre-expression",
        defaultOffset: { x: 0, y: -18 },
      },
    ],
    equipped: { Hat: null },
    getUserOffset: () => ({ x: 0, y: 0 }),
  });

  assert.equal(
    plan.layers.some(layer => layer.kind === "wearable"),
    false
  );
  const first = Exporter.buildLayersMetadata(plan);
  const second = Exporter.buildLayersMetadata(plan);
  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  const parsed = JSON.parse(first);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.canvas.width, 192);
  assert.equal(parsed.layers.length, 10);
});

test("builds positioned wearable records in renderer order", () => {
  const plan = Exporter.buildExportPlan({
    canvas: { width: 192, height: 192 },
    playerOrigin: { x: 8, y: 16 },
    scale: 4,
    skinTone: "Tone 4",
    expressionId: 2,
    manifestVersion: 26,
    slotConfig: [
      {
        key: "Back",
        phase: "behind-base",
        defaultOffset: { x: 0, y: 0 },
      },
      {
        key: "Hair",
        phase: "wearable",
        defaultOffset: { x: 0, y: -9 },
      },
      {
        key: "Hand",
        phase: "wearable",
        defaultOffset: { x: 0, y: 0 },
      },
    ],
    equipped: {
      Back: {
        id: 16012,
        name: "Turbine Wings",
        slot: "Back",
      },
      Hair: {
        id: 16020,
        name: "The Prince's Hair and Headband",
        slot: "Hair",
      },
      Hand: null,
    },
    getUserOffset: slot =>
      slot === "Hair" ? { x: 3, y: -2 } : { x: 0, y: 0 },
  });

  const hair = plan.layers.find(layer => layer.itemId === 16020);
  assert.deepEqual(hair.userOffset, { x: 3, y: -2 });
  assert.deepEqual(hair.systemicAnchor, { x: 0, y: -9 });
  assert.deepEqual(hair.finalLogicalOrigin, { x: 11, y: 5 });
  assert.match(
    hair.filename,
    /^wearables\/\d{3}-hair-16020-the-princes-hair-and-headband\.png$/
  );

  const keys = plan.layers.map(layer => layer.key || layer.slot);
  assert.equal(keys[0], "Back");
  assert.ok(keys.indexOf("head-utuh") < keys.indexOf("Hair"));
  assert.ok(keys.indexOf("expression") < keys.indexOf("Hair"));
  assert.equal(keys.at(-1), "tangan-kiri");
  assert.equal(
    new Set(plan.layers.map(layer => layer.zIndex)).size,
    plan.layers.length
  );
});



test("creates safe deterministic wearable slugs", () => {
  assert.equal(
    Exporter.safeSlug("  The Prince's Håir + Headband!  "),
    "the-princes-hair-headband"
  );
  assert.equal(Exporter.safeSlug("!!!"), "item");
});

test("computes standard CRC32", () => {
  assert.equal(
    Exporter.crc32(new TextEncoder().encode("123456789")),
    0xcbf43926
  );
});

test("writes byte-stable stored zip entries", () => {
  const entries = [
    {
      name: "layers.json",
      bytes: new TextEncoder().encode("{}"),
    },
    {
      name: "base/body-torso.png",
      bytes: Uint8Array.from([1, 2, 3]),
    },
  ];
  const first = Exporter.createStoredZip(entries);
  const second = Exporter.createStoredZip(entries);
  assert.deepEqual(first, second);
  assert.deepEqual(
    Array.from(first.slice(0, 4)),
    [0x50, 0x4b, 0x03, 0x04]
  );
  assert.deepEqual(
    Exporter.listStoredZipNames(first),
    ["base/body-torso.png", "layers.json"]
  );
  assert.throws(
    () =>
      Exporter.createStoredZip([
        { name: "../bad.png", bytes: new Uint8Array() },
      ]),
    /relative ZIP path/
  );
  assert.throws(
    () =>
      Exporter.createStoredZip([
        { name: "same", bytes: new Uint8Array() },
        { name: "same", bytes: new Uint8Array() },
      ]),
    /Duplicate ZIP path/
  );
});

test("reports the first mismatching rgba byte with layer context", () => {
  assert.doesNotThrow(() =>
    Exporter.assertEqualRgba(
      Uint8ClampedArray.from([1, 2, 3, 4]),
      Uint8ClampedArray.from([1, 2, 3, 4]),
      "preview"
    )
  );
  assert.throws(
    () =>
      Exporter.assertEqualRgba(
        Uint8ClampedArray.from([1, 9, 3, 4]),
        Uint8ClampedArray.from([1, 2, 3, 4]),
        "composite-preview"
      ),
    /composite-preview.*byte 1/
  );
});
