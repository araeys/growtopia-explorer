const test = require("node:test");
const assert = require("node:assert/strict");
const Inventory = require("../public/avatar_inventory.js");

const items = [
  { id: 16012, name: "Turbine Wings", slot: "Back" },
  {
    id: 16020,
    name: "The Prince's Hair and Headband",
    slot: "Hair",
  },
  { id: 66, name: "Top Hat", slot: "Hat" },
];

test("searches names, numeric ids, and hash ids", () => {
  assert.deepEqual(
    Inventory.filterItems(items, { query: "prince", slot: "All" }),
    [items[1]]
  );
  assert.deepEqual(
    Inventory.filterItems(items, { query: "16012", slot: "All" }),
    [items[0]]
  );
  assert.deepEqual(
    Inventory.filterItems(items, { query: "  #66 ", slot: "All" }),
    [items[2]]
  );
});

test("combines query and slot filters", () => {
  assert.deepEqual(
    Inventory.filterItems(items, { query: "hat", slot: "Hair" }),
    []
  );
  assert.deepEqual(
    Inventory.filterItems(items, { query: "hat", slot: "Hat" }),
    [items[2]]
  );
});

test("advances visible limits in deterministic chunks", () => {
  assert.equal(Inventory.DEFAULT_CHUNK_SIZE, 120);
  assert.equal(Inventory.nextVisibleLimit(0, 4029), 120);
  assert.equal(Inventory.nextVisibleLimit(120, 4029), 240);
  assert.equal(Inventory.nextVisibleLimit(3960, 4029), 4029);
  assert.equal(Inventory.nextVisibleLimit("bad", 20, 7), 7);
});

test("equips, replaces, and toggles only one declared slot immutably", () => {
  const initial = { Back: null, Hair: items[1], Hat: null };
  const first = Inventory.equipOrToggle(initial, items[2]);
  assert.equal(first.Hat.id, 66);
  assert.equal(first.Hair.id, 16020);
  assert.equal(initial.Hat, null);

  const replacement = { id: 68, name: "Brown Hair", slot: "Hair" };
  const second = Inventory.equipOrToggle(first, replacement);
  assert.equal(second.Hair.id, 68);
  assert.equal(second.Hat.id, 66);

  const removed = Inventory.equipOrToggle(second, items[2]);
  assert.equal(removed.Hat, null);
  assert.equal(removed.Hair.id, 68);
});

test("detects equipped cards by slot and item id", () => {
  const equipped = { Back: items[0], Hair: items[1], Hat: null };
  assert.equal(Inventory.isEquipped(equipped, items[0]), true);
  assert.equal(Inventory.isEquipped(equipped, items[2]), false);
  assert.equal(
    Inventory.isEquipped(equipped, { ...items[0], slot: "Hat" }),
    false
  );
});

test("keeps a valid active target and falls back in shared layer order", () => {
  const equipped = { Back: items[0], Hair: items[1], Hat: null };
  assert.deepEqual(
    Inventory.resolveActiveTarget(
      equipped,
      ["Back", "Hair", "Hat"],
      { slot: "Hair", itemId: 16020 }
    ),
    { slot: "Hair", itemId: 16020 }
  );
  assert.deepEqual(
    Inventory.resolveActiveTarget(
      equipped,
      ["Back", "Hair", "Hat"],
      { slot: "Hat", itemId: 66 }
    ),
    { slot: "Back", itemId: 16012 }
  );
  assert.equal(
    Inventory.resolveActiveTarget(
      { Back: null, Hair: null, Hat: null },
      ["Back", "Hair", "Hat"],
      null
    ),
    null
  );
});
