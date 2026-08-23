# Wearable Sequence Integrity, Controls, and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace unsafe numeric wearable animation guesses with validated per-item sequence descriptors, add per-item Auto/Off/frame controls, and export positioned sequence frames for one item or all equipped animated items.

**Architecture:** A small UMD module owns descriptor validation, persistent playback state, frame draw plans, and deterministic export manifests. `app.js` remains the browser integration layer: it loads descriptors, renders one or two tiles according to the draw plan, wires controls, and creates PNG ZIPs. A Python generator consumes the full 4,029-item audit and legacy map, quarantines risky entries, emits explicit tile coordinates, and preserves review diagnostics rather than silently treating ambiguous adjacent sprites as animation.

**Tech Stack:** Browser JavaScript, Node `node:test`, Python `unittest`, Canvas 2D, stored ZIP helper already in `avatar_layer_exporter.js`.

**Repository note:** This folder is intentionally not a Git repository. Use the verified content-addressed snapshot `snapshot-566caa938798ca57.zip` as the pre-change checkpoint; do not initialize Git.

---

### Task 1: Sequence domain model and persistent per-item playback state

**Files:**
- Create: `public/wearable_sequence.js`
- Create: `tests/wearable_sequence.test.js`
- Modify: `public/index.html`

- [x] **Step 1: Write failing model tests**

Test explicit `replace-frame` and `base-plus-overlay` descriptors, reject missing/out-of-range tile coordinates, resolve `auto` by tick, resolve `off` to frame zero, resolve a pinned frame, and round-trip state through a storage stub.

```js
const sequence = require("../public/wearable_sequence.js");
const descriptor = { mode: "replace-frame", frames: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }] };
assert.deepEqual(sequence.resolveDrawPlan(descriptor, { mode: "auto" }, 3), [{ dx: 1, dy: 0, role: "replace" }]);
assert.deepEqual(sequence.resolveDrawPlan(descriptor, { mode: "off" }, 99), [{ dx: 0, dy: 0, role: "replace" }]);
```

- [x] **Step 2: Run `node --test tests/wearable_sequence.test.js`**

Expected: FAIL because `public/wearable_sequence.js` does not exist.

- [x] **Step 3: Implement the minimal UMD module**

Export `normalizeDescriptor`, `getFrameCount`, `normalizePlayback`, `resolveDrawPlan`, `loadState`, `saveState`, `getPlayback`, `setPlayback`, and `buildSequenceExportManifest`. Use storage key `gt-set-planner:wearable-sequences:v1`; never derive frames from adjacent tiles at runtime.

- [x] **Step 4: Load the module before `app.js` and rerun the test**

Expected: all sequence model tests PASS.

### Task 2: Generate explicit descriptors from the full audit

**Files:**
- Create: `build_wearable_sequence_descriptors.py`
- Create: `tests/test_wearable_sequence_descriptors.py`
- Modify: `public/wearables_anim_map.json`
- Create: `public/wearables_sequence_validation.json`

- [x] **Step 1: Write failing generator tests**

Cover numeric-map conversion to explicit `frames`, quarantine of `missing_texture`, `severe_visual_discontinuity`, and `tiny_or_blank_looking_frame`, preservation of an explicit `base-plus-overlay` override, stable item-ID ordering, and summary counts.

```python
self.assertEqual(result["descriptors"]["42"]["frames"], [{"dx": 0, "dy": 0}, {"dx": 1, "dy": 0}])
self.assertNotIn("43", result["descriptors"])
self.assertEqual(result["validation"]["quarantined"][0]["id"], 43)
```

- [x] **Step 2: Run `python -m unittest tests.test_wearable_sequence_descriptors -v`**

Expected: FAIL because the generator module does not exist.

- [x] **Step 3: Implement deterministic generation**

Accept `--audit`, `--legacy-map`, `--overrides`, `--output`, and `--validation-output`. Existing non-risky animations become `replace-frame` descriptors with explicit horizontal offsets. Risky entries are static and recorded with reasons. Unmapped candidates remain `review_required` unless an override explicitly classifies them; this prevents false positives such as 3D Glasses and Twin Swords from leaking neighboring sprites.

- [x] **Step 4: Add reviewed overrides**

Encode known false positives as static and encode confirmed overlay cases such as Magic Magnet as `base-plus-overlay`. Overrides must contain explicit tile offsets and a short evidence note.

- [x] **Step 5: Generate twice and verify byte stability**

Run the generator twice against `wearable-sequence-audit-2026-08-01.json`; assert identical SHA-256 hashes, 4,029 audited records in validation, zero risky descriptor entries, and no descriptor frame outside the audited non-empty run.

### Task 3: Safe renderer and per-item controls

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [x] **Step 1: Add failing integration assertions**

Assert the sequence script load order, a selected-item sequence control container, Auto/Off/frame controls, state persistence calls, and use of `GTWearableSequence.resolveDrawPlan` in the shared renderer.

- [x] **Step 2: Run `python -m unittest tests.test_avatar_composite -v`**

Expected: FAIL on the new integration assertions.

- [x] **Step 3: Integrate descriptor loading and playback state**

Replace `getWearableFrameCount` numeric fallback with the sequence module. Only increment animation ticks when an equipped descriptor is in Auto mode. Refresh controls whenever active target/equipment changes.

- [x] **Step 4: Render the resolved draw plan**

For `replace-frame`, draw exactly one explicit tile. For `base-plus-overlay`, draw base first and the selected overlay second. Clamp every source rectangle to the loaded texture dimensions; an invalid descriptor is skipped once with an item-ID warning rather than drawing a neighboring sprite.

- [x] **Step 5: Add accessible selected-item controls**

Animated selected items show Auto, Off (base/frame 1), and one button per frame. Static items show no sequence controls. Persist per-item selection and rerender immediately.

- [x] **Step 6: Run Node and Python suites**

Run `node --test tests/*.test.js` and `python -m unittest discover -s tests -v`; expected PASS.

### Task 4: Positioned per-item and all-equipped sequence ZIP export

**Files:**
- Modify: `public/wearable_sequence.js`
- Modify: `tests/wearable_sequence.test.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [x] **Step 1: Write failing export-manifest tests**

Assert deterministic paths `items/<id>-<slug>/frame-001.png`, one folder per item, explicit frame roles, 192x192 canvas size, and final user-position coordinates. Empty/static selections must produce no item folders.

- [x] **Step 2: Run the focused tests and confirm the expected failures**

Run both sequence Node tests and avatar integration Python tests.

- [x] **Step 3: Implement selected-item export**

Render every descriptor frame onto a transparent 192x192 canvas at `PLAYER_ORIGIN + slot defaultOffset + saved item offset`; include `sequence.json`; download only when the active equipped item is animated.

- [x] **Step 4: Implement all-equipped export**

Repeat selected-item rendering for every equipped animated item, keeping each item in its own folder and position. Do not flatten multiple wearables into a shared frame.

- [x] **Step 5: Verify ZIP names and PNG dimensions in browser**

Intercept the generated bytes, list stored ZIP names, decode representative PNGs, and assert 192x192 dimensions plus the expected alpha bounds after a nonzero user offset.

### Task 5: Full verification and audit handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-08-01-wearable-sequence-integrity-controls-export.md`

- [x] **Step 1: Run the complete automated suite**

Run `python -m unittest discover -s tests -v` and `node --test tests/*.test.js`; capture exact counts and failures.

- [x] **Step 2: Verify the generated data**

Regenerate twice, compare SHA-256, confirm 4,029 audited items, confirm no descriptor references blank/risky frames, and report quarantined/review-required totals explicitly.

- [x] **Step 3: Browser acceptance test**

Open Set Planner, equip one replace-frame and one base-plus-overlay item, verify Auto/Off/pinned frame independently, nudge position, refresh, and verify persistence. Download selected and all-equipped ZIPs and inspect filenames, metadata, dimensions, and nonblank pixels. Confirm zero console errors and zero failed image requests.

- [x] **Step 4: Mark completed checkboxes and report evidence**

Do not claim every ambiguous candidate is authoritative. Report implemented descriptors, quarantined risky legacy entries, and review-required candidates so the remaining semantic review is visible and cannot silently reintroduce leaks.

