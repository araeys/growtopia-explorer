# Complete Wearable Sequence Audit and Compact Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Classify all 4,029 wearables with zero unresolved review entries, restore valid sequences such as Aurora Robe, and replace the per-frame button wall with a compact icon playback bar.

**Architecture:** A deterministic Python audit/review pipeline produces explicit `replace-frame` or `base-plus-overlay` descriptors and terminal static/quarantine decisions. The browser sequence module owns a versioned `playing`/`paused` state machine, while `app.js` binds it to one play/pause toggle, previous/next buttons, a range scrubber, and the existing safe draw-plan renderer/exporter.

**Tech Stack:** Python 3.11, Pillow, `unittest`, browser JavaScript, Node `node:test`, Canvas 2D, localStorage, existing stored-ZIP exporter.

**Repository note:** This directory is not a Git repository. Do not initialize Git and do not create another backup. Use the verified pre-change snapshot `C:\Users\VICTUS\Documents\Codex\2026-07-30\oi\backups\growtopia-explorer\snapshot-566caa938798ca57.zip`. Replace commit steps with focused tests, SHA-256 checkpoints, and plan checkbox updates.

---

### Task 1: Deterministic candidate evidence and contact-sheet generator

**Files:**
- Create: `build_wearable_sequence_review.py`
- Create: `tests/test_wearable_sequence_review.py`
- Read: `C:\Users\VICTUS\Documents\Codex\2026-07-30\oi\outputs\wearable-sequence-audit-2026-08-01.json`
- Read: `public/tilesheets/*.png`

- [x] **Step 1: Write failing evidence tests**

Add tests for minimum/average adjacency similarity, alpha continuity fields, deterministic item ordering, and Aurora's eight-tile run:

```python
from build_wearable_sequence_review import build_review_queue

def test_builds_sorted_candidate_evidence(self):
    queue = build_review_queue(self.audit)
    self.assertEqual([entry["id"] for entry in queue], [44, 15078])
    self.assertEqual(queue[1]["candidate_frames"], 8)
    self.assertAlmostEqual(queue[1]["min_similarity"], 0.955607)
    self.assertEqual(queue[1]["proposed_frames"], [
        {"dx": index, "dy": 0} for index in range(8)
    ])
```

- [x] **Step 2: Run the test and verify RED**

Run:

```powershell
python -m unittest tests.test_wearable_sequence_review -v
```

Expected: import failure because `build_wearable_sequence_review.py` does not exist.

- [x] **Step 3: Implement the evidence queue**

Implement these public functions:

```python
def build_review_queue(audit: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []
    for item in audit.get("items", []):
        if "unmapped_candidate_run" not in set(item.get("risk_flags") or []):
            continue
        scores = [float(value) for value in item.get("adjacency_scores") or []]
        count = int(item.get("raw_nonempty_run") or 0)
        candidates.append({
            "id": int(item["id"]),
            "name": str(item.get("name") or ""),
            "slot": str(item.get("slot") or ""),
            "texture": str(item.get("texture") or ""),
            "tx": int(item.get("tx") or 0),
            "ty": int(item.get("ty") or 0),
            "candidate_frames": count,
            "min_similarity": min(scores) if scores else 0.0,
            "average_similarity": sum(scores) / len(scores) if scores else 0.0,
            "tiny_frames": list(item.get("tiny_frames") or []),
            "proposed_frames": [{"dx": index, "dy": 0} for index in range(count)],
        })
    return sorted(candidates, key=lambda entry: entry["id"])
```

Add `render_contact_sheet(entry, texture_root, output_path)` using Pillow. Each 32Ã—32 tile must be scaled with nearest-neighbor, labeled with item ID/name and `1..N`, and placed on a checkerboard background so alpha changes are visible.

- [x] **Step 4: Test deterministic PNG output**

Create a synthetic RGBA sheet in the test, render twice, and assert identical SHA-256 bytes and expected dimensions:

```python
self.assertEqual(first.read_bytes(), second.read_bytes())
with Image.open(first) as image:
    self.assertEqual((8 * 96, 132), image.size)
```

- [x] **Step 5: Run focused tests and record the checkpoint**

Run:

```powershell
python -m unittest tests.test_wearable_sequence_review -v
```

Expected: all review-generator tests pass.

### Task 2: Terminal classification contract with a strict zero-review gate

**Files:**
- Modify: `build_wearable_sequence_descriptors.py`
- Modify: `tests/test_wearable_sequence_descriptors.py`
- Create: `data/wearables/sequence_review_decisions.json`

- [x] **Step 1: Replace the old unresolved-review expectation with failing terminal-class tests**

Add tests proving reviewed static, animated, and quarantined decisions are terminal and strict generation rejects a missing decision:

```python
def test_strict_generation_rejects_unreviewed_candidate(self):
    with self.assertRaisesRegex(ValueError, "unresolved wearable sequence reviews: #44"):
        build_descriptors(self.audit, {}, {}, strict=True)

def test_reviewed_quarantine_is_terminal(self):
    decisions = {"44": {
        "classification": "quarantined",
        "reasons": ["adjacent independent sprites"],
        "evidence": "contact-sheet review",
    }}
    result = build_descriptors(self.audit, {}, decisions, strict=True)
    self.assertEqual(result["validation"]["summary"]["review_required"], 0)
    self.assertEqual(result["validation"]["quarantined"][0]["id"], 44)
```

- [x] **Step 2: Run the descriptor tests and verify RED**

Run:

```powershell
python -m unittest tests.test_wearable_sequence_descriptors -v
```

Expected: failure because `strict` and terminal quarantine decisions are unsupported.

- [x] **Step 3: Implement terminal decisions and completeness validation**

Change the signature to:

```python
def build_descriptors(
    audit: dict[str, Any],
    legacy_map: dict[str, Any],
    decisions: dict[str, Any],
    *,
    strict: bool = False,
) -> dict[str, Any]:
```

Accept exactly these decision classes:

```python
TERMINAL_CLASSES = {"animated", "static", "quarantined"}
```

For `animated`, reuse `_validate_override`. For `static`, append the evidence to `reviewed_static`. For `quarantined`, require a non-empty `reasons` array and append it to `quarantined`. Collect unresolved candidate IDs; when `strict=True`, raise one deterministic error listing every unresolved ID in numeric order.

For `base-plus-overlay`, allow a frame entry to be `null`. It represents a base-only sequence frame and is valid without source coordinates. Every non-null overlay frame still requires integer offsets inside the audited run. Require at least two total sequence frames so a base-only/single-overlay effect remains a real two-state animation.

- [x] **Step 4: Add a full-classification invariant**

The validation report must include:

```python
"summary": {
    "audited": audited_count,
    "animated": len(descriptors),
    "static": static_count,
    "quarantined": len(quarantined),
    "review_required": len(review_required),
    "classified": animated_count + static_count + quarantined_count,
}
```

Assert `classified == audited` and each item ID occurs in exactly one terminal bucket. Legacy non-animated items with no candidate run count as implicit static and must be included in the static total without bloating the detailed reviewed-static list.

- [x] **Step 5: Wire strict CLI behavior**

Add `--strict` as an `argparse` flag and pass it to `build_descriptors`. Production generation must use `--strict`; focused exploratory generation may omit it to emit the queue.

- [x] **Step 6: Run focused tests and record the checkpoint**

Run:

```powershell
python -m unittest tests.test_wearable_sequence_descriptors -v
```

Expected: all descriptor tests pass, including strict rejection and terminal-count invariants.

### Task 3: Review every unresolved candidate and encode explicit decisions

**Files:**
- Modify: `data/wearables/sequence_review_decisions.json`
- Generate for review only: `outputs/wearable-sequence-review/index.json`
- Generate for review only: `outputs/wearable-sequence-review/batch-*.png`
- Modify: `docs/superpowers/plans/2026-08-02-complete-wearable-sequence-audit-and-compact-controls.md`

- [x] **Step 1: Generate the complete queue and contact sheets**

Run:

```powershell
python build_wearable_sequence_review.py `
  --audit 'C:\Users\VICTUS\Documents\Codex\2026-07-30\oi\outputs\wearable-sequence-audit-2026-08-01.json' `
  --texture-root public\tilesheets `
  --output-dir outputs\wearable-sequence-review `
  --batch-size 24
```

Expected: `index.json` contains exactly the 394 current candidate IDs, sorted numerically, and contact sheets cover each ID exactly once.

- [x] **Step 2: Seed confirmed decisions without blanket promotion**

Move the existing reviewed entries from `data/wearables/sequence_overrides.json` into the new decision ledger without changing their semantic class. Add Aurora Robe explicitly:

```json
"15078": {
  "classification": "animated",
  "mode": "replace-frame",
  "frames": [
    {"dx": 0, "dy": 0}, {"dx": 1, "dy": 0},
    {"dx": 2, "dy": 0}, {"dx": 3, "dy": 0},
    {"dx": 4, "dy": 0}, {"dx": 5, "dy": 0},
    {"dx": 6, "dy": 0}, {"dx": 7, "dy": 0}
  ],
  "evidence": "eight-frame contact-sheet review; continuous robe animation"
}
```

- [x] **Step 3: Review batches sequentially**

For each `batch-*.png` in numeric order:

1. Inspect the full-resolution contact sheet.
2. Compare every tile run for coherent silhouette, alpha bounds, palette, and motion.
3. Record `animated` only when all included tiles belong to the same wearable.
4. Record `static` when adjacent tiles are independent sprites.
5. Record `quarantined` when evidence is damaged, blank, discontinuous, missing, or cannot be safely resolved.
6. For animated runs, record explicit `mode`, `frames`, optional `base`, and evidence.
7. Update the plan checkbox for that batch only after every ID in it has a decision.

Do not infer a decision from item name alone and do not promote an entire batch from a similarity threshold.

- [x] **Step 4: Validate ledger coverage after every batch**

Add and run:

```powershell
python build_wearable_sequence_review.py `
  --audit 'C:\Users\VICTUS\Documents\Codex\2026-07-30\oi\outputs\wearable-sequence-audit-2026-08-01.json' `
  --decisions data\wearables\sequence_review_decisions.json `
  --check-coverage
```

Expected during progress: a deterministic list of remaining candidate IDs. Expected at completion: `394/394 candidate decisions; 0 unresolved`.

- [x] **Step 5: Run strict generation as the audit gate**

Run:

```powershell
python build_wearable_sequence_descriptors.py `
  --audit 'C:\Users\VICTUS\Documents\Codex\2026-07-30\oi\outputs\wearable-sequence-audit-2026-08-01.json' `
  --legacy-map data\wearables\legacy_anim_map.json `
  --overrides data\wearables\sequence_review_decisions.json `
  --output public\wearables_anim_map.json `
  --validation-output public\wearables_sequence_validation.json `
  --strict
```

Expected: exit 0, audited `4029`, classified `4029`, review required `0`, and descriptor `15078` has eight frames.

### Task 4: Versioned playing/paused playback state machine

**Files:**
- Modify: `public/wearable_sequence.js`
- Modify: `tests/wearable_sequence.test.js`

- [x] **Step 1: Write failing playback transition tests**

Replace Auto/Off/frame expectations with:

```js
test("toggles playing and paused on the current frame", () => {
  assert.deepEqual(Sequence.togglePlayback({ mode: "playing" }, 3, 8), {
    mode: "paused", frame: 3,
  });
  assert.deepEqual(Sequence.togglePlayback({ mode: "paused", frame: 3 }, 3, 8), {
    mode: "playing", frame: 3,
  });
});

test("manual stepping pauses and wraps", () => {
  assert.deepEqual(Sequence.stepPlayback({ mode: "playing" }, -1, 0, 8), {
    mode: "paused", frame: 7,
  });
  assert.deepEqual(Sequence.selectFrame({ mode: "playing" }, 9, 8), {
    mode: "paused", frame: 7,
  });
});
```

- [x] **Step 2: Run Node tests and verify RED**

Run:

```powershell
node --test tests/wearable_sequence.test.js
```

Expected: missing `togglePlayback`, `stepPlayback`, and `selectFrame` functions.

- [x] **Step 3: Implement version 2 state and migration**

Set `VERSION = 2` and storage key `gt-set-planner:wearable-sequences:v2`. Add a legacy-key fallback for v1:

```js
function migrateLegacyPlayback(value, frameCount) {
  if (value?.mode === "frame") return normalizePlayback({ mode: "paused", frame: value.frame }, frameCount);
  if (value?.mode === "off") return { mode: "paused", frame: 0 };
  return { mode: "playing", frame: 0 };
}
```

Normalize malformed state to `{ mode: "playing", frame: 0 }`. Export `getVisibleFrame`, `togglePlayback`, `stepPlayback`, and `selectFrame`. `resolveDrawPlan` must use the paused frame or `tick % frameCount` while playing.

- [x] **Step 4: Preserve overlay semantics and export determinism**

Update export manifest calls to resolve each explicit frame via `{ mode: "paused", frame: index }`. Confirm a null overlay frame draws only the base and a non-null overlay frame draws the base plus exactly one overlay.

- [x] **Step 5: Run focused Node tests and record the checkpoint**

Run:

```powershell
node --test tests/wearable_sequence.test.js
```

Expected: all sequence model, migration, overlay, and export tests pass.

### Task 5: Compact icon playback control bar

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `public/index.html`
- Modify: `tests/test_avatar_composite.py`

- [x] **Step 1: Write failing integration assertions**

Update the avatar composite contract test:

```python
self.assertIn('className = "sequence-playback-toggle"', source)
self.assertIn('textContent = playback.mode === "playing" ? "âšâš" : "â–¶"', source)
self.assertIn('type = "range"', source)
self.assertIn('className = "sequence-frame-slider"', source)
self.assertIn('className = "sequence-frame-counter"', source)
self.assertIn("window.GTWearableSequence.togglePlayback(", source)
self.assertIn("window.GTWearableSequence.stepPlayback(", source)
self.assertIn("window.GTWearableSequence.selectFrame(", source)
self.assertNotIn("const choices = [", source)
```

- [x] **Step 2: Run the integration test and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_wearable_sequence_animation_is_integrated -v
```

Expected: failure because the old per-frame button list is still present.

- [x] **Step 3: Replace the button wall with one control bar**

In `refreshActiveSequenceControls()` create:

```js
const toggle = document.createElement("button");
toggle.type = "button";
toggle.className = "sequence-playback-toggle";
toggle.textContent = playback.mode === "playing" ? "âšâš" : "â–¶";
toggle.setAttribute("aria-label", playback.mode === "playing" ? "Pause sequence" : "Play sequence");

const previous = document.createElement("button");
previous.type = "button";
previous.className = "sequence-step sequence-previous";
previous.textContent = "â€¹";
previous.setAttribute("aria-label", "Previous frame");

const slider = document.createElement("input");
slider.type = "range";
slider.className = "sequence-frame-slider";
slider.min = "0";
slider.max = String(frameCount - 1);
slider.step = "1";
slider.value = String(visibleFrame);
slider.setAttribute("aria-label", "Select frame");

const next = document.createElement("button");
next.type = "button";
next.className = "sequence-step sequence-next";
next.textContent = "â€º";
next.setAttribute("aria-label", "Next frame");

const counter = document.createElement("output");
counter.className = "sequence-frame-counter";
counter.textContent = `${visibleFrame + 1} / ${frameCount}`;
```

Wire toggle, previous, next, and slider through the pure state-machine functions, then save state and rerender. Slider `input` must pause and update immediately.

- [x] **Step 4: Keep the control synchronized during playback**

When the animation tick advances, update slider value and counter for the selected item without rebuilding the entire tools drawer. Only schedule animation frames while at least one equipped descriptor is in `playing` mode.

- [x] **Step 5: Implement compact responsive styling**

Use a five-column grid:

```css
.wearable-sequence-controls {
  display: grid;
  grid-template-columns: 38px 34px minmax(96px, 1fr) 34px 58px;
  align-items: center;
  gap: 8px;
}
.sequence-playback-toggle,
.sequence-step {
  min-width: 34px;
  min-height: 36px;
}
.sequence-frame-counter {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

At panel widths below 420px, keep the same single row and reduce gaps to 5px. Respect `prefers-reduced-motion` by starting newly initialized items paused at frame zero when the media query matches; persisted explicit user state still wins.

- [x] **Step 6: Cache-bust the sequence module and data as version 2**

Change script/data query strings from `wearable-sequence-v1` to `wearable-sequence-v2` in `public/index.html`, `public/app.js`, and their contract tests.

- [x] **Step 7: Run focused integration tests**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --test tests/wearable_sequence.test.js
```

Expected: compact-control integration and state-machine tests pass.

### Task 6: Final data generation, regression, and browser acceptance

**Files:**
- Modify: `public/wearables_anim_map.json`
- Modify: `public/wearables_sequence_validation.json`
- Modify: `public/wearables_manifest.json` only if the UI badge source still relies on its `has_anim` field
- Modify: `docs/superpowers/plans/2026-08-02-complete-wearable-sequence-audit-and-compact-controls.md`

- [x] **Step 1: Generate twice into separate files**

Run strict generation once to public outputs and once to verification outputs in the workspace root. Compare SHA-256 hashes for both descriptor and validation files. Delete only the two explicitly named verification files afterward.

Expected: each public/verification pair has identical hashes.

- [x] **Step 2: Verify final classification invariants**

Run a focused PowerShell check that asserts:

```powershell
$validation.summary.audited -eq 4029
$validation.summary.classified -eq 4029
$validation.summary.review_required -eq 0
$map.'15078'.mode -eq 'replace-frame'
$map.'15078'.frames.Count -eq 8
```

Also verify every descriptor source rectangle is within its source texture and no quarantined item ID exists in the descriptor map.

- [x] **Step 3: Run the complete automated suite**

Run:

```powershell
node --test tests/*.test.js
python -m unittest discover -s tests -p 'test_*.py'
```

Expected: exit 0, zero failures, zero errors.

- [x] **Step 4: Browser acceptance â€” Aurora and controls**

Open Set Planner, search `#15078`, equip Aurora Robe, and verify the `8f` badge. Test:

1. `âšâš` pauses the visible frame.
2. `â€¹` and `â€º` wrap and update the counter.
3. Scrubbing to frame 6 shows `6 / 8` and pauses.
4. Reload restores frame 6 paused.
5. `â–¶` resumes playback and the counter advances.

Reset the acceptance-test state afterward.

- [x] **Step 5: Browser acceptance â€” renderer safety and export**

Equip Magic Magnet and confirm base-plus-overlay still renders without base disappearance. Inspect one known static false positive and confirm it never draws adjacent sprites. Export selected Aurora and all-equipped sequences; inspect ZIP entries, manifest frame counts, 192Ã—192 dimensions, and nonblank alpha bounds.

- [x] **Step 6: Browser diagnostics**

Read browser console logs at warning/error levels and confirm zero application errors. Confirm no failed image/texture requests on the tested path.

- [x] **Step 7: Final checkpoint and report**

Mark every completed checkbox only after its evidence exists. Report exact animated/static/quarantined totals, test counts, deterministic hashes, Aurora's eight-frame descriptor, and acceptance ZIP contents. State any quarantined items explicitly; do not describe them as animated or silently omit their reasons.

