# Wearable Catalog and Per-Item Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete hybrid wearable catalog with correct Growtopia slots and add persistent per-item position controls to the Set Planner.

**Architecture:** A Python build step combines a dated official Set Planner snapshot with locally parsed `items.dat` records and emits a static browser manifest plus validation report. Small UMD-style browser modules own slot configuration and position persistence; `app.js` consumes those modules to build the slot UI, randomize equipment, and composite layers with per-item offsets.

**Tech Stack:** Python 3.11, standard-library `unittest`, Pillow, browser JavaScript, Node `node:test`, HTML/CSS canvas UI, `localStorage`.

---

The directory is not a Git repository. Each task therefore ends with a tested
file checkpoint rather than a commit; no plan step initializes Git or mutates
unrelated files.

## File Map

- Create `build_wearable_manifest.py`: parse the required `items.dat` fields,
  decrypt names, merge official types, validate assets, and write outputs.
- Create `data/wearables/official_spfe_encrypted.json`: reproducible source
  snapshot downloaded only by an explicit refresh flag.
- Create `data/wearables/slot_overrides.json`: reviewed exceptional slot/render
  profile data, initially empty.
- Create `public/wearables_manifest.json`: generated runtime catalog.
- Create `public/wearables_validation.json`: generated diagnostics.
- Create `public/wearable_catalog.js`: shared slot configuration and catalog
  indexing helpers for browser and Node.
- Create `public/avatar_positioning.js`: versioned, clamped per-item offset
  state and persistence helpers.
- Modify `public/index.html`: replace duplicated static slot rows with one
  generated container and load the new helpers before `app.js`.
- Modify `public/styles.css`: slot controls, arrow pad, offset values, error
  state, and responsive behavior.
- Modify `public/app.js`: load the manifest, construct slots from one config,
  render in configured order, and apply saved offsets.
- Create `tests/test_wearable_catalog.py`: parser, merge, asset, and generated
  manifest tests.
- Create `tests/wearable_catalog.test.js`: slot config and catalog helper tests.
- Create `tests/avatar_positioning.test.js`: isolation, clamping, reset, and
  malformed-storage tests.
- Modify `tests/test_avatar_composite.py`: replace obsolete hard-coded order
  assertions with the centralized-layer and offset contract.

### Task 1: Correctly Parse Wearable Metadata from `items.dat`

**Files:**
- Create: `build_wearable_manifest.py`
- Create: `tests/test_wearable_catalog.py`

- [x] **Step 1: Write failing parser tests**

Add fixture-level tests that build a compact binary item record using the
current key and assert exact name and clothing type decoding:

```python
from build_wearable_manifest import (
    CLOTHING_SLOTS,
    ITEM_NAME_KEY,
    decode_item_name,
    parse_candidate_record,
)


def test_name_key_uses_item_id_offset():
    item_id = 16020
    plain = "The Prince's Hair and Headband"
    encoded = bytes(
        ord(char) ^ ord(ITEM_NAME_KEY[(item_id + index) % len(ITEM_NAME_KEY)])
        for index, char in enumerate(plain)
    )
    assert decode_item_name(encoded, item_id) == plain


def test_clothing_enum_maps_all_standard_slots():
    assert CLOTHING_SLOTS == {
        0: "Hat", 1: "Shirt", 2: "Pants", 3: "Feet", 4: "Face",
        5: "Hand", 6: "Back", 7: "Hair", 8: "Chest",
    }
```

- [x] **Step 2: Run the tests and verify failure**

Run:

```powershell
python -m unittest tests.test_wearable_catalog -v
```

Expected: import failure because `build_wearable_manifest.py` does not exist.

- [x] **Step 3: Implement the parser primitives**

Define the authoritative constants and candidate offsets:

```python
ITEM_NAME_KEY = "PBG892FXX982ABC*"
CLOTHING_SLOTS = {
    0: "Hat", 1: "Shirt", 2: "Pants", 3: "Feet", 4: "Face",
    5: "Hand", 6: "Back", 7: "Hair", 8: "Chest",
}


def decode_item_name(encoded, item_id):
    return bytes(
        value ^ ord(ITEM_NAME_KEY[(item_id + index) % len(ITEM_NAME_KEY)])
        for index, value in enumerate(encoded)
    ).decode("utf-8", errors="replace")
```

`parse_candidate_record` must read `texture_x` at byte `after_texture + 9`,
`texture_y` at `+10`, and `clothing_type` at `+19`. It accepts a candidate only
when its ID matches, its strings stay in bounds, and its texture is empty or
ends in `.rttex`/`.png`. `scan_items_dat` retains the current monotonic search
behavior but returns the decrypted name and clothing type.

- [x] **Step 4: Run parser tests**

Run:

```powershell
python -m unittest tests.test_wearable_catalog -v
```

Expected: parser tests pass.

- [x] **Step 5: Verify against installed game data**

Run:

```powershell
python build_wearable_manifest.py --inspect-items "C:\Users\VICTUS\AppData\Local\Growtopia\cache\items.dat"
```

Expected summary includes version `26`, item count `16304`, `Turbine Wings` for
ID `16012`, clothing type `Back`, and no missing parsed IDs.

### Task 2: Generate the Hybrid Manifest and Validation Report

**Files:**
- Modify: `build_wearable_manifest.py`
- Create: `data/wearables/official_spfe_encrypted.json`
- Create: `data/wearables/slot_overrides.json`
- Create: `public/wearables_manifest.json`
- Create: `public/wearables_validation.json`
- Modify: `tests/test_wearable_catalog.py`

- [x] **Step 1: Add failing merge tests**

Cover these decisions explicitly:

```python
def test_official_type_wins_for_artifact():
    local = {"id": 5078, "clothing_type": 5, "name": "local"}
    official = {"itemID": 5078, "nameWithCaps": "Artifact", "Type": "['Artifact', '', '', False]"}
    merged = merge_record(local, official, {})
    assert merged["slot"] == "Artifact"
    assert merged["classification_source"] == "official"


def test_new_item_uses_local_clothing_type():
    local = {"id": 16020, "clothing_type": 7, "name": "The Prince's Hair and Headband"}
    merged = merge_record(local, None, {})
    assert merged["slot"] == "Hair"
    assert merged["classification_source"] == "local_clothing_type"
```

Also assert that the same input data produces byte-for-byte stable JSON,
duplicate IDs fail validation, missing textures are excluded from
`randomizable`, and a reviewed override wins last.

- [x] **Step 2: Run merge tests and verify failure**

Run:

```powershell
python -m unittest tests.test_wearable_catalog -v
```

Expected: failures for undefined merge/generation functions.

- [x] **Step 3: Implement official snapshot refresh and merge**

The explicit refresh path downloads
`https://gtsetplanner.com/static/spfe_encrypted.json` and writes it to
`data/wearables/official_spfe_encrypted.json`. Normal generation reads only that
snapshot. Decrypt with:

```python
OFFICIAL_KEY = "sorenessiscool"


def decrypt_official_snapshot(raw_text):
    return "".join(
        chr(ord(char) ^ ord(OFFICIAL_KEY[index % len(OFFICIAL_KEY)]))
        for index, char in enumerate(raw_text)
    )
```

Parse the first value of the official `Type` string using
`ast.literal_eval`. Merge official type/name first, local clothing type/name
second, and `slot_overrides.json` last. Preserve local texture coordinates and
convert `.rttex` to `.png`.

- [x] **Step 4: Implement deterministic asset validation**

For each record, open `public/tilesheets/<texture>` with Pillow and require:

```python
source_x = tx * 32
source_y = ty * 32
valid_crop = source_x + 32 <= width and source_y + 32 <= height
```

Write catalog metadata with version, source counts, generated item count, and
slot counts. Write validation arrays for unresolved items, missing textures,
invalid crops, duplicate IDs, and official/local type disagreements. Mark only
valid records as `randomizable: true`.

- [x] **Step 5: Refresh the snapshot and generate outputs**

Run:

```powershell
python build_wearable_manifest.py --refresh-official --items-dat "C:\Users\VICTUS\AppData\Local\Growtopia\cache\items.dat"
python -m unittest tests.test_wearable_catalog -v
```

Expected: 3,948 official records are merged; all 81 newer action-20 records
receive a standard local slot; official Artifact records stay Artifact; tests
pass.

### Task 3: Centralize Slot Configuration and Catalog Indexing

**Files:**
- Create: `public/wearable_catalog.js`
- Create: `tests/wearable_catalog.test.js`
- Modify: `public/index.html`

- [x] **Step 1: Write failing Node tests**

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SLOT_CONFIG, RENDER_PROFILES, groupWearablesBySlot, getRenderLayers,
  getRenderProfile
} = require("../public/wearable_catalog.js");

test("defines every planner slot once", () => {
  assert.deepEqual(
    SLOT_CONFIG.map((slot) => slot.key),
    ["Back", "Artifact", "Feet", "Pants", "Shirt", "Chest",
     "Face", "Hair", "Hat", "Hand"]
  );
  assert.equal(new Set(SLOT_CONFIG.map((slot) => slot.key)).size, 10);
});

test("groups only matching manifest records", () => {
  const grouped = groupWearablesBySlot([
    { id: 1, slot: "Hat" }, { id: 2, slot: "Hair" }
  ]);
  assert.deepEqual(grouped.Hat.map((item) => item.id), [1]);
  assert.deepEqual(grouped.Hair.map((item) => item.id), [2]);
});

test("declares the standard crop profile", () => {
  assert.deepEqual(RENDER_PROFILES.standard_32, {
    sourceWidth: 32,
    sourceHeight: 32,
    destinationWidth: 128,
    destinationHeight: 128,
  });
  assert.equal(getRenderProfile("unknown"), RENDER_PROFILES.standard_32);
});
```

- [x] **Step 2: Run Node tests and verify failure**

Run:

```powershell
node --test tests/wearable_catalog.test.js
```

Expected: module-not-found failure.

- [x] **Step 3: Implement the UMD-style catalog helper**

Expose the same API as `window.GTWearableCatalog` and `module.exports`.
`SLOT_CONFIG` owns label, icon, UI order, render phase, and randomizable status.
`RENDER_PROFILES` owns declarative crop and destination sizes, beginning with
`standard_32`; unknown profile names resolve to `standard_32` and are recorded
once as a catalog warning.
`groupWearablesBySlot` initializes every slot to an empty array and rejects
unknown slot values. `getRenderLayers()` returns the declared layer sequence,
not a second hard-coded list.

- [x] **Step 4: Load helpers before `app.js`**

Insert:

```html
<script src="wearable_catalog.js"></script>
<script src="avatar_positioning.js"></script>
<script src="app.js"></script>
```

Keep `avatar_tint.js` before all avatar modules.

- [x] **Step 5: Run the catalog tests**

Run:

```powershell
node --test tests/wearable_catalog.test.js
```

Expected: all tests pass.

### Task 4: Implement Per-Item Position State and Persistence

**Files:**
- Create: `public/avatar_positioning.js`
- Create: `tests/avatar_positioning.test.js`

- [x] **Step 1: Write failing positioning tests**

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../public/avatar_positioning.js");

test("isolates offsets by slot and item", () => {
  let state = P.emptyState();
  state = P.setOffset(state, "Hat", 10, { x: 2, y: -1 });
  assert.deepEqual(P.getOffset(state, "Hat", 10), { x: 2, y: -1 });
  assert.deepEqual(P.getOffset(state, "Hat", 11), { x: 0, y: 0 });
});

test("clamps offsets and ignores malformed persisted data", () => {
  assert.deepEqual(P.normalizeOffset({ x: 999, y: "bad" }), { x: 16, y: 0 });
  assert.deepEqual(P.deserialize("{broken"), P.emptyState());
});
```

Add tests for reset-active, reset-all, version mismatch, storage exceptions,
and integer-only values.

- [x] **Step 2: Run tests and verify failure**

Run:

```powershell
node --test tests/avatar_positioning.test.js
```

Expected: module-not-found failure.

- [x] **Step 3: Implement pure state helpers**

Use:

```javascript
const STORAGE_KEY = "gt-set-planner:item-positions:v1";
const MIN_OFFSET = -16;
const MAX_OFFSET = 16;
```

Implement `emptyState`, `normalizeOffset`, `getOffset`, `setOffset`,
`resetOffset`, `resetAll`, `serialize`, `deserialize`, `load`, and `save`.
Return new nested objects rather than mutating caller state.

- [x] **Step 4: Run positioning tests**

Run:

```powershell
node --test tests/avatar_positioning.test.js
```

Expected: all tests pass.

- [x] **Step 5: Run all Node helpers together**

Run:

```powershell
node --test tests/*.test.js
```

Expected: catalog, positioning, and existing tint tests all pass.

### Task 5: Build the Dynamic Slot UI and Position Controls

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`

- [x] **Step 1: Add failing HTML/app contract tests**

Assert that HTML contains one generated container and no duplicated static
Hat/Hair rows:

```python
self.assertIn('id="avatar-slot-rows"', html)
self.assertIn('id="avatar-reset-all-positions"', html)
self.assertNotIn('id="slot-select-hat"', html)
self.assertIn("function buildAvatarSlotRows(", source)
self.assertNotIn("slotItems.slice(0, 400)", source)
self.assertNotIn('n.includes("hat")', source)
```

- [x] **Step 2: Run Python tests and verify failure**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: new UI contract assertions fail.

- [x] **Step 3: Replace static rows and load the manifest**

Replace the existing row markup with:

```html
<div id="avatar-catalog-status" class="avatar-catalog-status" role="status"></div>
<div id="avatar-slot-rows" class="slot-rows-list"></div>
<button id="avatar-reset-all-positions" class="btn btn-secondary">
  Reset All Positions
</button>
```

In `app.js`, fetch `wearables_manifest.json` once during data initialization,
index records with `groupWearablesBySlot`, and call `buildAvatarSlotRows`.
Manifest failure must show an error in `avatar-catalog-status` while leaving the
base character controls usable.

- [x] **Step 4: Build each row from `SLOT_CONFIG`**

Each row includes its complete selector and:

```html
<div class="position-pad" aria-label="Move Hat">
  <button data-dx="0" data-dy="-1">↑</button>
  <button data-dx="-1" data-dy="0">←</button>
  <button data-position-reset>Reset</button>
  <button data-dx="1" data-dy="0">→</button>
  <button data-dx="0" data-dy="1">↓</button>
</div>
<output class="position-readout">X 0 · Y 0</output>
```

Disable all position controls when the selector is empty. A nudge updates the
active item only, saves state, updates the readout, and rerenders. Reset Set
does not erase position storage; Reset All Positions clears it and rerenders.

- [x] **Step 5: Add responsive CSS and rerun tests**

Use a compact grid for `.position-pad`, minimum 36px button targets, tab-visible
focus outlines, and a stacked layout below 700px.

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --test tests/*.test.js
```

Expected: all UI contracts and helper tests pass.

### Task 6: Apply Central Layering and Saved Offsets in the Canvas

**Files:**
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`

- [x] **Step 1: Write failing render contract tests**

Require the renderer to consume the shared config and pass offsets:

```python
self.assertIn("GTWearableCatalog.getRenderLayers()", render_section)
self.assertIn("AvatarPositioning.getOffset(", source)
self.assertIn("drawLayerItemTile(ctx, item, offset)", source)
self.assertNotIn("const clothesOrder =", render_section)
```

Keep the existing assertion that `drawFrontLeftHand` runs after wearable
equipment.

- [x] **Step 2: Run render tests and verify failure**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: offset and centralized-order assertions fail.

- [x] **Step 3: Render from one declared layer sequence**

Iterate `getRenderLayers()` and honor its `phase` field around the base avatar.
Back and Artifact profiles draw in their declared phase; standard clothing
draws after expression. The final base front-left hand remains the last draw.

- [x] **Step 4: Apply destination-only offsets**

Change the draw signature to:

```javascript
function drawLayerItemTile(ctx, item, offset = { x: 0, y: 0 }) {
  const profile = GTWearableCatalog.getRenderProfile(item.render_profile);
  const sx = item.tx * profile.sourceWidth;
  const sy = item.ty * profile.sourceHeight;
  const dx = offset.x * 4;
  const dy = offset.y * 4;
  ctx.drawImage(
    img,
    sx,
    sy,
    profile.sourceWidth,
    profile.sourceHeight,
    dx,
    dy,
    profile.destinationWidth,
    profile.destinationHeight
  );
}
```

Do not modify source crop coordinates. Resolve offsets from
`positionState[slot][item.id]`. Missing or invalid values resolve to zero.
Track failed texture paths in a `Set`; skip the failed layer and report each
path/item ID only once so repeated rerenders do not flood the console.

- [x] **Step 5: Run all automated tests**

Run:

```powershell
python -m unittest discover -s tests -v
node --test tests/*.test.js
```

Expected: all Python and Node tests pass.

### Task 7: End-to-End Catalog and Browser Verification

**Files:**
- Modify: `public/wearables_validation.json` only if regeneration is required
- Modify: `docs/superpowers/plans/2026-07-30-wearable-catalog-positioning.md`
  to mark completed checkboxes

- [x] **Step 1: Run deterministic regeneration**

Run the builder twice without refresh and compare hashes:

```powershell
python build_wearable_manifest.py --items-dat "C:\Users\VICTUS\AppData\Local\Growtopia\cache\items.dat"
$first=(Get-FileHash public/wearables_manifest.json).Hash
python build_wearable_manifest.py --items-dat "C:\Users\VICTUS\AppData\Local\Growtopia\cache\items.dat"
$second=(Get-FileHash public/wearables_manifest.json).Hash
if ($first -ne $second) { throw "manifest is not deterministic" }
```

Expected: hashes match.

- [x] **Step 2: Inspect validation summary**

Run:

```powershell
$v=Get-Content -Raw public/wearables_validation.json | ConvertFrom-Json
$v.summary | Format-List
$v.unresolved | Select-Object -First 20
```

Expected: no duplicate IDs, no unknown clothing enum among new action-20
records, and no unresolved record enters randomization.

- [x] **Step 3: Verify the live planner**

At `http://127.0.0.1:5000/`, reload the Set Planner and verify:

1. Hat, Hair, Face, Back, Hand, and Artifact selectors contain only their type.
2. ID `16012` appears as `Turbine Wings` under Back.
3. ID `16020` appears as `The Prince's Hair and Headband` under Hair.
4. Random Set no longer produces cross-slot sprite piles.
5. Each arrow moves the selected item exactly one source pixel.
6. Switching items and refreshing restores each item's own offset.
7. Reset Position, Reset Set, and Reset All Positions follow the spec.
8. Downloaded PNG matches the visible canvas.

- [x] **Step 4: Check browser errors**

Confirm the developer console has no failed manifest/texture requests and no
uncaught JavaScript errors during selection, movement, randomization, reset,
refresh, and export.

- [x] **Step 5: Run the final verification suite**

Run:

```powershell
python -m unittest discover -s tests -v
node --test tests/*.test.js
```

Expected: all tests pass with zero failures.
