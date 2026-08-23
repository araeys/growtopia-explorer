# Split Workbench and Animator Layer Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Set Planner tab with the approved Split Workbench inventory UI and add a deterministic ZIP export containing every positioned body and wearable layer for animators.

**Architecture:** Two small UMD modules isolate pure inventory behavior and pure export/ZIP behavior from the existing large `app.js`. The browser keeps the current manifest, compositor, tint, and position state authoritative; the new UI consumes those systems, while the exporter renders independent full-canvas layers and refuses downloads whose reconstruction differs from the visible composite.

**Tech Stack:** Browser JavaScript, Canvas 2D, HTML/CSS, `localStorage`, Node `node:test`, Python `unittest`, Pillow, uncompressed ZIP/CRC32 implemented locally with no CDN dependency.

---

The directory is not a Git repository. Each task therefore ends with a tested
checkpoint instead of a commit; do not initialize Git or mutate unrelated
files.

## File Map

- Create `public/avatar_inventory.js`: pure search, filter, chunking,
  equip/toggle, and active-target helpers.
- Create `tests/avatar_inventory.test.js`: deterministic inventory-state tests.
- Create `public/avatar_layer_exporter.js`: body partitioning, export layer
  planning, deterministic metadata/filenames, pixel comparison, CRC32, and ZIP
  writing.
- Create `tests/avatar_layer_exporter.test.js`: body partition, plan, filename,
  CRC32, ZIP, and failure tests.
- Modify `public/index.html`: replace the old two-card planner with Split
  Workbench markup and load both new modules before `app.js`.
- Modify `public/styles.css`: workbench, sticky preview, inventory grid,
  selected cards, tools drawer, loading/empty/error states, responsive layout,
  focus, and reduced-motion rules.
- Modify `public/app.js`: inventory state/rendering, direct equip behavior,
  tools drawer, active target, layer rendering, and both download actions.
- Modify `tests/test_avatar_composite.py`: new DOM/application contracts while
  preserving renderer, tint, anchor, and positioning contracts.
- Modify `tests/test_preview_reliability.py`: inventory preview and shared-image
  loading contracts.

### Task 1: Add Pure Inventory State Helpers

**Files:**
- Create: `public/avatar_inventory.js`
- Create: `tests/avatar_inventory.test.js`

- [ ] **Step 1: Write failing inventory tests**

Create Node tests for normalized search, combined filtering, chunks,
equip/toggle, and active-target fallback:

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../public/avatar_inventory.js");

const items = [
  { id: 16012, name: "Turbine Wings", slot: "Back" },
  { id: 16020, name: "The Prince's Hair and Headband", slot: "Hair" },
  { id: 66, name: "Top Hat", slot: "Hat" },
];

test("searches names, numeric ids, and hash ids", () => {
  assert.deepEqual(I.filterItems(items, { query: "prince", slot: "All" }), [items[1]]);
  assert.deepEqual(I.filterItems(items, { query: "16012", slot: "All" }), [items[0]]);
  assert.deepEqual(I.filterItems(items, { query: "#66", slot: "All" }), [items[2]]);
});

test("combines query and slot filters", () => {
  assert.deepEqual(I.filterItems(items, { query: "hat", slot: "Hair" }), []);
  assert.deepEqual(I.filterItems(items, { query: "hat", slot: "Hat" }), [items[2]]);
});

test("equips, replaces, and toggles only one declared slot", () => {
  const first = I.equipOrToggle({ Hat: null, Hair: items[1] }, items[2]);
  assert.equal(first.Hat.id, 66);
  assert.equal(first.Hair.id, 16020);
  const removed = I.equipOrToggle(first, items[2]);
  assert.equal(removed.Hat, null);
});

test("falls back active target in shared layer order", () => {
  const equipped = { Back: items[0], Hair: items[1], Hat: null };
  assert.deepEqual(
    I.resolveActiveTarget(equipped, ["Back", "Hair", "Hat"], { slot: "Hat", itemId: 66 }),
    { slot: "Back", itemId: 16012 }
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/avatar_inventory.test.js
```

Expected: `MODULE_NOT_FOUND` for `public/avatar_inventory.js`.

- [ ] **Step 3: Implement the UMD inventory API**

Expose the same frozen API through `module.exports` and
`window.AvatarInventory`:

```javascript
const DEFAULT_CHUNK_SIZE = 120;

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase().replace(/^#/, "");
}

function filterItems(items, { query = "", slot = "All" } = {}) {
  const needle = normalizeQuery(query);
  return (Array.isArray(items) ? items : []).filter((item) => {
    const slotMatches = slot === "All" || item.slot === slot;
    const queryMatches =
      !needle ||
      String(item.id) === needle ||
      String(item.name || "").toLowerCase().includes(needle);
    return slotMatches && queryMatches;
  });
}

function nextVisibleLimit(current, total, chunkSize = DEFAULT_CHUNK_SIZE) {
  const safeCurrent = Number.isInteger(current) && current > 0 ? current : 0;
  const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
  const safeChunk = Number.isInteger(chunkSize) && chunkSize > 0
    ? chunkSize
    : DEFAULT_CHUNK_SIZE;
  return Math.min(safeTotal, safeCurrent + safeChunk);
}
```

Also implement immutable `equipOrToggle`, `isEquipped`, and
`resolveActiveTarget`. `resolveActiveTarget` keeps the preferred target only
when the same item remains equipped; otherwise it returns the first equipped
record in supplied slot order or `null`.

- [ ] **Step 4: Run inventory tests and verify GREEN**

Run:

```powershell
node --test tests/avatar_inventory.test.js
```

Expected: all inventory helper tests pass.

### Task 2: Implement Lossless Base-Body Partitioning

**Files:**
- Create: `public/avatar_layer_exporter.js`
- Create: `tests/avatar_layer_exporter.test.js`

- [ ] **Step 1: Write the failing body-partition tests**

Use a synthetic 32-by-32 RGBA fixture plus the real canonical PNG contract:

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../public/avatar_layer_exporter.js");

test("declares all independent base body parts", () => {
  assert.deepEqual(E.BASE_PART_KEYS, [
    "body-torso",
    "left-arm-hand",
    "right-arm-hand",
    "left-leg-foot",
    "right-leg-foot",
  ]);
});

test("partitions every opaque pixel once and reconstructs losslessly", () => {
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  for (const [x, y] of [[15, 20], [8, 24], [23, 24], [12, 30], [22, 30]]) {
    const index = (y * 32 + x) * 4;
    rgba.set([120 + x, 140 + y, 180, 255], index);
  }
  const parts = E.partitionIdleBodyRgba(rgba, 32, 32);
  const rebuilt = E.mergeRgbaParts(E.BASE_PART_KEYS.map((key) => parts[key]), 32, 32);
  assert.deepEqual(Array.from(rebuilt), Array.from(rgba));
  assert.equal(E.countOverlappingOpaquePixels(parts, 32, 32), 0);
});
```

Add assertions for these exact masks:

```javascript
assert.equal(E.classifyIdleBodyPixel(8, 20), "left-arm-hand");
assert.equal(E.classifyIdleBodyPixel(23, 20), "right-arm-hand");
assert.equal(E.classifyIdleBodyPixel(12, 30), "left-leg-foot");
assert.equal(E.classifyIdleBodyPixel(22, 30), "right-leg-foot");
assert.equal(E.classifyIdleBodyPixel(15, 20), "body-torso");
```

- [ ] **Step 2: Run the partition tests and verify RED**

Run:

```powershell
node --test tests/avatar_layer_exporter.test.js
```

Expected: `MODULE_NOT_FOUND` for `public/avatar_layer_exporter.js`.

- [ ] **Step 3: Implement deterministic mask classification**

Create a UMD module with:

```javascript
const BASE_PART_KEYS = Object.freeze([
  "body-torso",
  "left-arm-hand",
  "right-arm-hand",
  "left-leg-foot",
  "right-leg-foot",
]);

function inLeftArmHand(x, y) {
  return (
    (y >= 19 && y <= 23 && x >= 7 && x <= 10) ||
    (y >= 24 && y <= 26 && x >= 6 && x <= 11) ||
    (y === 27 && x >= 7 && x <= 11)
  );
}

function inRightArmHand(x, y) {
  return (
    (y >= 19 && y <= 23 && x >= 21 && x <= 24) ||
    (y >= 24 && y <= 26 && x >= 20 && x <= 25) ||
    (y === 27 && x >= 20 && x <= 24)
  );
}

function classifyIdleBodyPixel(x, y) {
  if (inLeftArmHand(x, y)) return "left-arm-hand";
  if (inRightArmHand(x, y)) return "right-arm-hand";
  if (y >= 28 && x < 18) return "left-leg-foot";
  if (y >= 28 && x >= 18) return "right-leg-foot";
  return "body-torso";
}
```

Implement `partitionIdleBodyRgba`, `mergeRgbaParts`, and
`countOverlappingOpaquePixels` with equal-sized `Uint8ClampedArray` values.
Transparent input pixels remain transparent in every output.

- [ ] **Step 4: Add a Python contract for the real canonical body**

Extend `tests/test_avatar_composite.py` to read
`player_idle_body.png`, apply the same coordinate rules in the test, and prove
that every opaque pixel is assigned exactly once. This guards against an
incorrect synthetic-only mask.

- [ ] **Step 5: Run partition contracts and verify GREEN**

Run:

```powershell
node --test tests/avatar_layer_exporter.test.js
python -m unittest tests.test_avatar_composite -v
```

Expected: both suites pass.

### Task 3: Add Deterministic Export Plans and ZIP Writing

**Files:**
- Modify: `public/avatar_layer_exporter.js`
- Modify: `tests/avatar_layer_exporter.test.js`

- [ ] **Step 1: Write failing plan, filename, and ZIP tests**

Add tests:

```javascript
test("builds positioned wearable records in renderer order", () => {
  const plan = E.buildExportPlan({
    canvas: { width: 192, height: 192 },
    playerOrigin: { x: 8, y: 16 },
    scale: 4,
    skinTone: "Tone 4",
    expressionId: 2,
    manifestVersion: 26,
    slotConfig: [
      { key: "Back", phase: "behind-base", defaultOffset: { x: 0, y: 0 } },
      { key: "Hair", phase: "pre-expression", defaultOffset: { x: 0, y: -9 } },
      { key: "Hand", phase: "wearable", defaultOffset: { x: 0, y: 0 } },
    ],
    equipped: {
      Back: { id: 16012, name: "Turbine Wings", slot: "Back" },
      Hair: { id: 16020, name: "The Prince's Hair and Headband", slot: "Hair" },
      Hand: null,
    },
    getUserOffset: (slot) => slot === "Hair" ? { x: 3, y: -2 } : { x: 0, y: 0 },
  });
  const hair = plan.layers.find((layer) => layer.itemId === 16020);
  assert.deepEqual(hair.userOffset, { x: 3, y: -2 });
  assert.deepEqual(hair.finalLogicalOrigin, { x: 11, y: 5 });
  assert.match(hair.filename, /16020-the-princes-hair-and-headband\.png$/);
});

test("writes byte-stable stored zip entries", () => {
  const entries = [
    { name: "layers.json", bytes: new TextEncoder().encode("{}") },
    { name: "base/body-torso.png", bytes: Uint8Array.from([1, 2, 3]) },
  ];
  const first = E.createStoredZip(entries);
  const second = E.createStoredZip(entries);
  assert.deepEqual(first, second);
  assert.deepEqual(Array.from(first.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(E.listStoredZipNames(first).join(","), "base/body-torso.png,layers.json");
});
```

Also assert:

- filename slugging uses only `[a-z0-9-]`;
- empty equipment creates no wearable records;
- metadata has schema version `1`;
- back-to-front z-indexes are unique and increasing;
- CRC32 for UTF-8 `"123456789"` is `0xcbf43926`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/avatar_layer_exporter.test.js
```

Expected: failures for undefined planning and ZIP APIs.

- [ ] **Step 3: Implement plan and metadata helpers**

Add:

```javascript
const EXPORT_SCHEMA_VERSION = 1;

function safeSlug(value) {
  return String(value || "item")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}
```

`buildExportPlan` emits ordered descriptors for:

1. `behind-base` wearables;
2. body torso, both legs/feet, and right arm/hand;
3. head;
4. `pre-expression` wearables;
5. expression;
6. `wearable` wearables;
7. left arm/hand as the final front layer.

For a wearable:

```javascript
finalLogicalOrigin = {
  x: playerOrigin.x + slot.defaultOffset.x + userOffset.x,
  y: playerOrigin.y + slot.defaultOffset.y + userOffset.y,
};
```

Create `buildLayersMetadata(plan)` with stable property insertion order and a
trailing newline in its serialized JSON.

- [ ] **Step 4: Implement CRC32 and uncompressed ZIP**

Implement:

```javascript
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
```

`createStoredZip(entries)`:

- validates relative forward-slash paths;
- sorts entries lexicographically by name;
- uses ZIP method `0` (stored);
- uses fixed DOS date/time `1980-01-01 00:00`;
- writes local headers, central-directory records, and EOCD;
- encodes names as UTF-8 and sets the UTF-8 flag;
- rejects duplicate entry names.

Implement `listStoredZipNames` as a small test parser over the central
directory; it is exported only because it also validates generated ZIP bytes.

- [ ] **Step 5: Run exporter tests and verify GREEN**

Run:

```powershell
node --test tests/avatar_layer_exporter.test.js
```

Expected: partition, plan, CRC32, filename, metadata, and ZIP tests all pass.

### Task 4: Replace Planner Markup with Split Workbench

**Files:**
- Modify: `public/index.html`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Write failing markup contract tests**

Replace obsolete static-row expectations with:

```python
self.assertIn('id="avatar-workbench"', html)
self.assertIn('id="avatar-preview-pane"', html)
self.assertIn('id="avatar-tools-toggle"', html)
self.assertIn('id="avatar-tools-drawer"', html)
self.assertIn('id="avatar-inventory-query"', html)
self.assertIn('id="avatar-inventory-slot"', html)
self.assertIn('id="avatar-inventory-grid"', html)
self.assertIn('id="avatar-inventory-sentinel"', html)
self.assertIn('id="avatar-download-layers"', html)
self.assertNotIn('id="avatar-slot-rows"', html)
self.assertLess(
    html.index('src="avatar_inventory.js"'),
    html.index('src="app.js"'),
)
self.assertLess(
    html.index('src="avatar_layer_exporter.js"'),
    html.index('src="app.js"'),
)
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_slots_are_generated_from_the_runtime_catalog -v
```

Expected: failure because Split Workbench IDs do not exist.

- [ ] **Step 3: Replace only the Set Planner tab markup**

Use:

```html
<div id="avatar-workbench" class="avatar-workbench">
  <section id="avatar-preview-pane" class="avatar-preview-pane" aria-label="Avatar preview">
    <div class="avatar-stage-toolbar">
      <button id="avatar-tools-toggle" class="avatar-icon-button"
        type="button" aria-label="Open avatar tools"
        aria-expanded="false" aria-controls="avatar-tools-drawer">
        <img src="character_base_assets/gtsetplanner/wrench.png"
          alt="" width="32" height="32">
      </button>
      <div id="avatar-active-target" class="avatar-active-target" role="status"></div>
    </div>
    <div class="avatar-canvas-box">
      <canvas id="avatar-canvas" width="192" height="192"></canvas>
    </div>
    <div id="equipped-items-bar" class="equipped-items-bar"></div>
    <aside id="avatar-tools-drawer" class="avatar-tools-drawer" hidden>
      <div id="skin-tones-grid" class="skin-tones-grid"></div>
      <div id="expressions-grid" class="expressions-grid"></div>
      <div id="avatar-active-position-controls"></div>
      <div class="avatar-export-actions">
        <button id="avatar-randomize" class="btn btn-purple">Random Set</button>
        <button id="avatar-reset" class="btn btn-secondary">Reset Set</button>
        <button id="avatar-reset-all-positions" class="btn btn-secondary">Reset All Positions</button>
        <button id="avatar-download-png" class="btn btn-primary">Download Set PNG</button>
        <button id="avatar-download-layers" class="btn btn-success">Download Separate Layers ZIP</button>
      </div>
      <div id="avatar-export-status" role="status" aria-live="polite"></div>
    </aside>
  </section>
  <section class="avatar-inventory-pane" aria-label="Wearable inventory">
    <div class="avatar-inventory-toolbar">
      <label for="avatar-inventory-query">Search wearable</label>
      <input id="avatar-inventory-query" type="search" autocomplete="off"
        placeholder="Name or #ID">
      <label for="avatar-inventory-slot">Slot</label>
      <select id="avatar-inventory-slot"></select>
      <button id="avatar-inventory-clear" type="button">Clear</button>
    </div>
    <div id="avatar-catalog-status" role="status"></div>
    <div id="avatar-inventory-count" role="status"></div>
    <div id="avatar-inventory-grid" class="avatar-inventory-grid"></div>
    <button id="avatar-inventory-sentinel" type="button">Load more</button>
  </section>
</div>
```

Keep `avatar_tint.js`, then load `wearable_catalog.js`,
`avatar_positioning.js`, `avatar_inventory.js`,
`avatar_layer_exporter.js`, and finally `app.js`.

- [ ] **Step 4: Run markup contracts and verify GREEN**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: new markup contracts pass while renderer contracts stay green.

### Task 5: Build the Split Workbench CSS

**Files:**
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add failing CSS contract tests**

Assert:

```python
styles = (PROJECT_DIR / "public" / "styles.css").read_text(encoding="utf-8")
self.assertIn("grid-template-columns: minmax(320px, 38%) minmax(0, 1fr)", styles)
self.assertIn("position: sticky", styles)
self.assertIn(".avatar-inventory-grid", styles)
self.assertIn("min-width: 44px", styles)
self.assertIn("@media (max-width: 899px)", styles)
self.assertIn("@media (prefers-reduced-motion: reduce)", styles)
```

- [ ] **Step 2: Run CSS contract and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: failures for missing workbench CSS.

- [ ] **Step 3: Implement desktop layout and inventory cards**

Add:

```css
.avatar-workbench {
  display: grid;
  grid-template-columns: minmax(320px, 38%) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.avatar-preview-pane {
  position: sticky;
  top: 16px;
  min-width: 0;
}

.avatar-inventory-pane {
  min-width: 0;
  max-height: calc(100vh - 48px);
  overflow: auto;
}

.avatar-inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}
```

Define stable 44-pixel controls, square `.avatar-item-card`, reserved preview
space, cyan selected state, visible `:focus-visible`, disabled state,
drawer overlay, empty/error panel, sentinel, and export status.

- [ ] **Step 4: Implement responsive and reduced-motion rules**

Add:

```css
@media (max-width: 899px) {
  .avatar-workbench { grid-template-columns: 1fr; }
  .avatar-preview-pane { position: static; }
  .avatar-inventory-pane { max-height: none; overflow: visible; }
  .avatar-inventory-toolbar { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-workbench *, .avatar-tools-drawer {
    scroll-behavior: auto;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run CSS contracts and verify GREEN**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: CSS and all existing avatar contracts pass.

### Task 6: Wire Search, Filter, Progressive Grid, and Direct Equip

**Files:**
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`
- Modify: `tests/test_preview_reliability.py`

- [ ] **Step 1: Write failing application contracts**

Require:

```python
self.assertIn("const avatarInventoryState =", source)
self.assertIn("function renderAvatarInventory()", source)
self.assertIn("window.AvatarInventory.filterItems(", source)
self.assertIn("function equipInventoryItem(", source)
self.assertIn("IntersectionObserver", source)
self.assertNotIn("function buildAvatarSlotRows()", source)
self.assertIn('aria-pressed', source)
```

The preview reliability test must assert that inventory card canvases call the
existing `loadTextureImage(texturePath)` and never create a second image cache.

- [ ] **Step 2: Run contracts and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite tests.test_preview_reliability -v
```

Expected: failures for missing inventory rendering.

- [ ] **Step 3: Add inventory DOM state and listeners**

Use:

```javascript
const avatarInventoryState = {
  query: "",
  slot: "All",
  visibleLimit: window.AvatarInventory.DEFAULT_CHUNK_SIZE,
  activeTarget: null,
  toolsOpen: false,
};
```

Populate `avatar-inventory-slot` from
`GTWearableCatalog.SLOT_CONFIG`. Search/filter changes reset `visibleLimit` and
call `renderAvatarInventory`. Clear resets both controls.

- [ ] **Step 4: Render chunked accessible item cards**

`renderAvatarInventory()`:

```javascript
const matches = window.AvatarInventory.filterItems(
  wearableManifest.items,
  { query: avatarInventoryState.query, slot: avatarInventoryState.slot }
);
const visible = matches.slice(0, avatarInventoryState.visibleLimit);
```

For every visible record, build a `<button class="avatar-item-card">` containing
a 32-by-32 canvas plus name and `#ID`. Set `aria-pressed` from
`AvatarInventory.isEquipped`. Draw the real manifest crop using the shared
texture promise and `imageSmoothingEnabled = false`. Failed textures use the
existing non-letter missing-sprite state.

- [ ] **Step 5: Implement equip/toggle and progressive loading**

`equipInventoryItem(item)` assigns:

```javascript
plannerState.equipped = window.AvatarInventory.equipOrToggle(
  plannerState.equipped,
  item
);
avatarInventoryState.activeTarget =
  window.AvatarInventory.resolveActiveTarget(
    plannerState.equipped,
    window.GTWearableCatalog.SLOT_CONFIG.map((slot) => slot.key),
    { slot: item.slot, itemId: item.id }
  );
```

Then refresh the canvas, inventory selected states, equipped chips, active
target, and position controls.

Observe `avatar-inventory-sentinel`; when intersecting, append one chunk and
rerender. Keep the button clickable as the keyboard and unsupported-observer
fallback. Hide it when all matches are visible.

- [ ] **Step 6: Run UI application contracts and all helper tests**

Run:

```powershell
python -m unittest tests.test_avatar_composite tests.test_preview_reliability -v
node --test tests/*.test.js
```

Expected: all tests pass.

### Task 7: Wire the Tools Drawer and Active Position Target

**Files:**
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Write failing drawer/target contracts**

Assert:

```python
self.assertIn("function setAvatarToolsOpen(", source)
self.assertIn('event.key === "Escape"', source)
self.assertIn("function refreshActivePositionControls()", source)
self.assertIn("avatarInventoryState.activeTarget", source)
self.assertIn('setAttribute("aria-expanded"', source)
```

- [ ] **Step 2: Run contract and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: drawer and active-target assertions fail.

- [ ] **Step 3: Implement drawer state**

`setAvatarToolsOpen(open)` updates `toolsOpen`, `hidden`,
`aria-expanded`, and the accessible label. The wrench button toggles it.
Document-level Escape closes it only when open and returns focus to the wrench
button.

- [ ] **Step 4: Move position controls to the active target**

Render one position pad into `avatar-active-position-controls`. Resolve the
equipped record from `activeTarget`; disable all five buttons when absent.
Nudges and Reset Position continue calling `AvatarPositioning.setOffset`,
`resetOffset`, `save`, and `renderAvatarCanvas`.

After Random Set, choose the first equipped item in shared layer order. After
Reset Set, clear the target but preserve position storage. Reset All Positions
keeps equipment and target but updates readout to `X 0 · Y 0`.

- [ ] **Step 5: Run drawer contracts and regression suites**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --test tests/avatar_inventory.test.js tests/avatar_positioning.test.js
```

Expected: all drawer, target, and position behavior passes.

### Task 8: Render and Download Separate Animator Layers

**Files:**
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`
- Modify: `tests/avatar_layer_exporter.test.js`

- [ ] **Step 1: Write failing export integration contracts**

Require:

```python
self.assertIn("async function downloadAvatarLayersZip()", source)
self.assertIn("window.AvatarLayerExporter.buildExportPlan(", source)
self.assertIn("window.AvatarLayerExporter.partitionIdleBodyRgba(", source)
self.assertIn("window.AvatarLayerExporter.createStoredZip(", source)
self.assertIn("function renderExportLayerCanvas(", source)
self.assertIn("function assertExportMatchesComposite(", source)
```

Add Node tests that `assertEqualRgba(actual, expected, layerName)` throws an
error containing `layerName` and the first mismatching pixel index.

- [ ] **Step 2: Run integration contracts and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --test tests/avatar_layer_exporter.test.js
```

Expected: missing export integration and equality helper failures.

- [ ] **Step 3: Render each full-canvas base layer**

Create a fresh 192-by-192 offscreen canvas per descriptor. For the five body
parts:

1. Tint the canonical 32-by-32 idle body.
2. Read its RGBA.
3. Partition with `partitionIdleBodyRgba`.
4. Put one part on a native 32-by-32 canvas.
5. Draw it at `PLAYER_ORIGIN * AVATAR_SCALE` to the full export canvas.

Tint and position head and expression with the same existing helpers used by
the visible preview.

- [ ] **Step 4: Render every wearable at its final user position**

For a wearable descriptor, load its shared texture promise and draw only its
manifest crop:

```javascript
ctx.drawImage(
  image,
  item.tx * profile.sourceWidth,
  item.ty * profile.sourceHeight,
  profile.sourceWidth,
  profile.sourceHeight,
  descriptor.finalLogicalOrigin.x * AVATAR_SCALE,
  descriptor.finalLogicalOrigin.y * AVATAR_SCALE,
  profile.destinationWidth,
  profile.destinationHeight
);
```

Do not mutate crop coordinates or stored offsets.

- [ ] **Step 5: Verify reconstruction before building ZIP**

Draw the independent canvases in plan order into a reconstruction canvas.
Compare its RGBA to a fresh preview composite rendered from the same current
state. Call:

```javascript
window.AvatarLayerExporter.assertEqualRgba(
  reconstructionRgba,
  previewRgba,
  "composite-preview"
);
```

Abort on the first failed texture or pixel mismatch. Show the exact layer error
in `avatar-export-status`; do not download.

- [ ] **Step 6: Encode PNGs, metadata, and ZIP**

Convert each canvas to PNG bytes with:

```javascript
async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("PNG encoding failed")),
      "image/png"
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}
```

Add:

- `composite-preview.png`;
- every base PNG under `base/`;
- equipped PNGs under `wearables/`;
- UTF-8 `layers.json`.

Create the ZIP, download it as
`growtopia-avatar-layers-<timestamp>.zip`, revoke the object URL, and restore
the enabled button/status state in `finally`.

- [ ] **Step 7: Run export and full automated suites**

Run:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/*.test.js
node --check public/app.js
node --check public/avatar_inventory.js
node --check public/avatar_layer_exporter.js
```

Expected: zero failures and zero syntax errors.

### Task 9: Browser and Responsive Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-31-split-workbench-layer-export.md`
  to mark completed checkboxes

- [ ] **Step 1: Verify desktop workbench behavior**

At `http://127.0.0.1:5000/`, inspect at 1280 and 1920 pixels:

1. Existing header/navigation is unchanged.
2. Preview remains sticky while the inventory scrolls.
3. Search `#16012` returns Turbine Wings.
4. Hair filter contains ID 16020 and excludes Hat records.
5. Clicking an item equips/replaces; clicking it again unequips.
6. Selected borders and equipped chips remain synchronized.
7. Progressive loading appends chunks without duplicate cards.

- [ ] **Step 2: Verify tools and persistence**

1. Wrench toggles the drawer and updates `aria-expanded`.
2. Escape closes the drawer and returns focus.
3. Skin and all seven expressions still render correctly.
4. Nudge one wearable to `X 3 · Y -2`, refresh, reselect it, and confirm the
   same offset.
5. Reset Position, Reset Set, and Reset All retain their documented semantics.

- [ ] **Step 3: Verify separate-layer ZIP**

Test three exports:

1. Base character only.
2. One Hair item moved to a nonzero offset.
3. A set with Back, Feet, Pants, Shirt, Chest, Face, Hair, Hat, and Hand.

For each ZIP:

- confirm the seven base files, one PNG per equipped item,
  `composite-preview.png`, and `layers.json`;
- confirm all PNGs are 192 by 192 with transparency;
- confirm metadata user offsets and final destinations;
- stack files in metadata order and compare to the composite;
- confirm no duplicate or missing ZIP paths.

- [ ] **Step 4: Verify responsive behavior**

Inspect widths 375, 700, and 899 pixels:

- preview stacks above inventory;
- toolbar wraps without horizontal page scrolling;
- item targets remain at least 44 pixels;
- drawer does not cover the avatar;
- no content is hidden behind sticky/fixed UI.

- [ ] **Step 5: Check browser logs and run final verification**

Confirm no uncaught errors, failed manifest requests, repeated texture warnings,
or accessibility-label failures. Then run:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/*.test.js
node --check public/app.js
node --check public/avatar_inventory.js
node --check public/avatar_layer_exporter.js
```

Expected: all tests pass and all syntax checks exit `0`.
