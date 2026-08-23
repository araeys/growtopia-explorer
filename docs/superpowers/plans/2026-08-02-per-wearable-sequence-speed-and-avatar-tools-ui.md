# Per-Wearable Sequence Speed and Avatar Tools UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Because this workspace is not a Git repository, replace commit steps with the checkpoint and verification steps listed in this plan.

**Goal:** Add persisted per-wearable sequence speed, replace facial-expression emoji buttons with PNG previews, and simplify avatar set/export actions using the approved option A layout.

**Architecture:** Keep sequence state and pure timing helpers in `public/wearable_sequence.js`, then wire them through the existing large `public/app.js` UI without restructuring unrelated code. The avatar preview loop becomes elapsed-time based so multiple animated wearables can play at different intervals. HTML/CSS changes stay scoped to the avatar tools drawer.

**Tech Stack:** Plain browser JavaScript, HTML, CSS, Node `node:test`, Python `unittest`/Pillow contract tests.

---

## File Structure

- Modify `public/wearable_sequence.js`: add interval constants, interval normalization, per-item state normalization, elapsed-frame calculation, and setters that preserve `intervalMs`.
- Modify `tests/wearable_sequence.test.js`: add pure unit tests for interval normalization, per-item persistence, elapsed playback, and speed changes preserving frame/playback state.
- Modify `public/app.js`: update expression metadata/rendering, add expression PNG generation, change avatar animation loop to elapsed timing, add sequence speed UI, and preserve existing export/reset handlers.
- Modify `public/index.html`: replace the flat action button block with grouped set controls, primary PNG export, and a native disclosure for advanced ZIP exports.
- Modify `public/styles.css`: style PNG expression buttons, sequence speed controls, grouped action/export controls, disabled states, responsive layout, and focus states.
- Modify `tests/test_avatar_composite.py`: update string-contract tests for PNG previews, per-wearable speed UI, and option A export layout.

Reference spec:

- `docs/superpowers/specs/2026-08-02-per-wearable-sequence-speed-and-avatar-tools-ui-design.md`

Pre-change backup:

- `C:\Users\VICTUS\Documents\Codex\2026-08-02\growtopia-explorer\backups\wearable-ui-checkpoint-20260802-053709.zip`

---

### Task 1: Sequence State and Timing Helpers

**Files:**

- Modify: `tests/wearable_sequence.test.js`
- Modify: `public/wearable_sequence.js`

- [ ] **Step 1: Add failing interval state tests**

Append these tests to `tests/wearable_sequence.test.js`:

```js
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
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
node --test tests/wearable_sequence.test.js
```

Expected result: FAIL because `DEFAULT_INTERVAL_MS`, `normalizeIntervalMs`, `setIntervalMs`, `getVisibleFrameAtTime`, and `changeIntervalForVisibleFrame` are not defined, and existing expected playback objects do not include `intervalMs`.

- [ ] **Step 3: Implement interval helpers in `public/wearable_sequence.js`**

In the factory body, add constants near `VERSION`:

```js
const MIN_INTERVAL_MS = 50;
const MAX_INTERVAL_MS = 2000;
const INTERVAL_STEP_MS = 10;
const DEFAULT_INTERVAL_MS = 150;
```

Replace `normalizePlayback` with:

```js
function normalizeIntervalMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_INTERVAL_MS;
  const stepped =
    Math.round(numeric / INTERVAL_STEP_MS) * INTERVAL_STEP_MS;
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, stepped));
}

function clampFrame(value, frameCount) {
  const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
  return Math.max(
    0,
    Math.min(count - 1, Math.trunc(Number(value)) || 0)
  );
}

function normalizePlayback(value, frameCount) {
  const intervalMs = normalizeIntervalMs(value?.intervalMs);
  const frame = clampFrame(value?.frame, frameCount);
  const output =
    value && value.mode === "paused"
      ? { mode: "paused", frame, intervalMs }
      : { mode: "playing", frame, intervalMs };
  if (output.mode === "playing" && Number.isFinite(Number(value?.startedAtMs))) {
    output.startedAtMs = Number(value.startedAtMs);
  }
  return output;
}
```

Add these helpers after `getVisibleFrame`:

```js
function getVisibleFrameAtTime(playback, frameCount, nowMs) {
  const state = normalizePlayback(playback, frameCount);
  if (state.mode === "paused") return state.frame;
  const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
  const startedAtMs = Number.isFinite(Number(state.startedAtMs))
    ? Number(state.startedAtMs)
    : Number(nowMs) || 0;
  const elapsedMs = Math.max(0, (Number(nowMs) || 0) - startedAtMs);
  const elapsedFrames = Math.floor(elapsedMs / state.intervalMs);
  return (state.frame + elapsedFrames) % count;
}

function changeIntervalForVisibleFrame(
  playback,
  intervalMs,
  visibleFrame,
  frameCount,
  nowMs
) {
  const state = normalizePlayback(playback, frameCount);
  const frame = clampFrame(visibleFrame, frameCount);
  const nextIntervalMs = normalizeIntervalMs(intervalMs);
  if (state.mode === "paused") {
    return { mode: "paused", frame, intervalMs: nextIntervalMs };
  }
  return {
    mode: "playing",
    frame,
    intervalMs: nextIntervalMs,
    startedAtMs: Number(nowMs) || 0,
  };
}
```

Update `togglePlayback`, `stepPlayback`, and `selectFrame` so returned objects preserve `intervalMs`:

```js
function togglePlayback(playback, visibleFrame, frameCount, nowMs = 0) {
  const state = normalizePlayback(playback, frameCount);
  const frame = clampFrame(visibleFrame, frameCount);
  return state.mode === "playing"
    ? { mode: "paused", frame, intervalMs: state.intervalMs }
    : {
        mode: "playing",
        frame,
        intervalMs: state.intervalMs,
        startedAtMs: Number(nowMs) || 0,
      };
}

function stepPlayback(playback, delta, visibleFrame, frameCount) {
  const state = normalizePlayback(playback, frameCount);
  const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
  const current = clampFrame(visibleFrame, count);
  const step = Math.trunc(Number(delta)) || 0;
  return {
    mode: "paused",
    frame: (current + step + count) % count,
    intervalMs: state.intervalMs,
  };
}

function selectFrame(playback, frame, frameCount) {
  const state = normalizePlayback(playback, frameCount);
  return {
    mode: "paused",
    frame: clampFrame(frame, frameCount),
    intervalMs: state.intervalMs,
  };
}
```

Update legacy migration branches to include `intervalMs: DEFAULT_INTERVAL_MS`:

```js
items[itemId] = { mode: "paused", frame: playback.frame, intervalMs: DEFAULT_INTERVAL_MS };
items[itemId] = { mode: "paused", frame: 0, intervalMs: DEFAULT_INTERVAL_MS };
items[itemId] = { mode: "playing", frame: 0, intervalMs: DEFAULT_INTERVAL_MS };
```

Replace `setPlayback` and add `setIntervalMs`:

```js
function setPlayback(state, itemId, playback, frameCount) {
  const previous = normalizePlayback(
    state?.items?.[String(itemId)],
    frameCount
  );
  return {
    version: VERSION,
    items: {
      ...(state?.items || {}),
      [String(itemId)]: normalizePlayback(
        { ...playback, intervalMs: playback?.intervalMs ?? previous.intervalMs },
        frameCount
      ),
    },
  };
}

function setIntervalMs(state, itemId, intervalMs, frameCount) {
  const previous = normalizePlayback(
    state?.items?.[String(itemId)],
    frameCount
  );
  return setPlayback(
    state,
    itemId,
    { ...previous, intervalMs: normalizeIntervalMs(intervalMs) },
    frameCount
  );
}
```

Export the new constants and helpers:

```js
MIN_INTERVAL_MS,
MAX_INTERVAL_MS,
INTERVAL_STEP_MS,
DEFAULT_INTERVAL_MS,
normalizeIntervalMs,
getVisibleFrameAtTime,
changeIntervalForVisibleFrame,
setIntervalMs,
```

- [ ] **Step 4: Update existing test expectations**

In `tests/wearable_sequence.test.js`, update expected playback objects to include `intervalMs: 150`. For example:

```js
assert.deepEqual(Sequence.normalizePlayback({ mode: "wat" }, 3), {
  mode: "playing",
  frame: 0,
  intervalMs: 150,
});
```

Apply the same addition to expected values in tests for toggling, stepping, selecting, persistence, and migration. For `togglePlayback` from paused to playing, include `startedAtMs: 0` when calling without the optional time.

- [ ] **Step 5: Run focused Node tests**

Run:

```powershell
node --test tests/wearable_sequence.test.js
```

Expected result: PASS for all sequence tests.

---

### Task 2: App Playback Loop and Sequence Speed UI

**Files:**

- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add failing contract tests**

Add this test method to `tests/test_avatar_composite.py` near `test_wearable_sequence_animation_is_integrated`:

```python
    def test_wearable_sequence_speed_control_is_integrated(self):
        source = APP_JS.read_text(encoding="utf-8")
        styles = (
            PROJECT_DIR / "public" / "styles.css"
        ).read_text(encoding="utf-8")

        self.assertIn("function getAvatarAnimationNowMs()", source)
        self.assertIn("getVisibleFrameAtTime(", source)
        self.assertIn("changeIntervalForVisibleFrame(", source)
        self.assertIn('className = "sequence-speed-control"', source)
        self.assertIn('speedInput.type = "number"', source)
        self.assertIn('speedInput.min = String(window.GTWearableSequence.MIN_INTERVAL_MS)', source)
        self.assertIn('speedInput.max = String(window.GTWearableSequence.MAX_INTERVAL_MS)', source)
        self.assertIn('speedInput.step = String(window.GTWearableSequence.INTERVAL_STEP_MS)', source)
        self.assertIn(".sequence-speed-control", styles)
        self.assertIn(".sequence-speed-input", styles)
        self.assertIn("grid-template-columns: 38px 34px minmax(96px, 1fr) 34px 58px minmax(142px, auto)", styles)
```

Update `test_wearable_sequence_animation_is_integrated` by replacing the old fixed icon assertion with checks for readable play/pause constants:

```python
        self.assertIn('const PLAY_ICON = "▶"', source)
        self.assertIn('const PAUSE_ICON = "❚❚"', source)
```

- [ ] **Step 2: Run the focused Python test and verify it fails**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_wearable_sequence_speed_control_is_integrated
```

Expected result: FAIL because the speed UI and elapsed-time functions do not exist yet.

- [ ] **Step 3: Replace global tick playback with elapsed time in `public/app.js`**

Add constants near the avatar animation globals:

```js
const PLAY_ICON = "▶";
const PAUSE_ICON = "❚❚";
const AVATAR_ANIMATION_POLL_MS = window.GTWearableSequence.MIN_INTERVAL_MS;
```

Add helper:

```js
function getAvatarAnimationNowMs() {
  return Math.round(performance.now());
}
```

In `getWearablePlayback`, when returning reduced-motion default, include interval:

```js
return {
  mode: "paused",
  frame: 0,
  intervalMs: window.GTWearableSequence.DEFAULT_INTERVAL_MS,
};
```

Replace every preview path that currently calls:

```js
window.GTWearableSequence.getVisibleFrame(playback, frameCount, avatarAnimTick)
```

with:

```js
window.GTWearableSequence.getVisibleFrameAtTime(
  playback,
  frameCount,
  getAvatarAnimationNowMs()
)
```

Keep `avatarAnimTick` only if unrelated code still needs it; otherwise stop mutating it in avatar preview logic.

Replace `startAvatarAnimationLoop` with:

```js
function startAvatarAnimationLoop() {
  if (avatarAnimTimer) return;
  avatarAnimTimer = setInterval(() => {
    const hasEquippedAnim = Object.values(plannerState.equipped).some(item =>
      item &&
      getWearableFrameCount(item) > 1 &&
      getWearablePlayback(item).mode === "playing"
    );
    if (hasEquippedAnim) {
      renderAvatarCanvas();
      updateActiveSequencePlaybackDisplay();
    }
  }, AVATAR_ANIMATION_POLL_MS);
}
```

- [ ] **Step 4: Add speed controls to `refreshActiveSequenceControls`**

Inside `refreshActiveSequenceControls`, set:

```js
const nowMs = getAvatarAnimationNowMs();
const visibleFrame = window.GTWearableSequence.getVisibleFrameAtTime(
  playback,
  frameCount,
  nowMs
);
```

Update `commitPlayback` to pass `nowMs` for play toggles where needed and remove `avatarAnimTick = 0`.

Append speed controls before the counter:

```js
const speed = document.createElement("div");
speed.className = "sequence-speed-control";

const speedMinus = document.createElement("button");
speedMinus.type = "button";
speedMinus.className = "sequence-speed-step";
speedMinus.textContent = "−";
speedMinus.setAttribute("aria-label", "Decrease sequence speed interval");

const speedInput = document.createElement("input");
speedInput.type = "number";
speedInput.className = "sequence-speed-input";
speedInput.min = String(window.GTWearableSequence.MIN_INTERVAL_MS);
speedInput.max = String(window.GTWearableSequence.MAX_INTERVAL_MS);
speedInput.step = String(window.GTWearableSequence.INTERVAL_STEP_MS);
speedInput.value = String(playback.intervalMs);
speedInput.setAttribute("aria-label", "Sequence speed in milliseconds");

const speedUnit = document.createElement("span");
speedUnit.className = "sequence-speed-unit";
speedUnit.textContent = "ms";

const speedPlus = document.createElement("button");
speedPlus.type = "button";
speedPlus.className = "sequence-speed-step";
speedPlus.textContent = "+";
speedPlus.setAttribute("aria-label", "Increase sequence speed interval");

const commitInterval = rawValue => {
  const currentFrame = window.GTWearableSequence.getVisibleFrameAtTime(
    getWearablePlayback(item),
    frameCount,
    getAvatarAnimationNowMs()
  );
  const nextPlayback =
    window.GTWearableSequence.changeIntervalForVisibleFrame(
      getWearablePlayback(item),
      rawValue,
      currentFrame,
      frameCount,
      getAvatarAnimationNowMs()
    );
  wearableSequenceState = window.GTWearableSequence.setPlayback(
    wearableSequenceState,
    item.id,
    nextPlayback,
    frameCount
  );
  window.GTWearableSequence.saveState(window.localStorage, wearableSequenceState);
  refreshActiveSequenceControls();
  renderAvatarCanvas();
};

speedMinus.addEventListener("click", () => {
  commitInterval(Number(speedInput.value) - window.GTWearableSequence.INTERVAL_STEP_MS);
});
speedPlus.addEventListener("click", () => {
  commitInterval(Number(speedInput.value) + window.GTWearableSequence.INTERVAL_STEP_MS);
});
speedInput.addEventListener("change", () => {
  commitInterval(Number(speedInput.value));
});

speed.append(speedMinus, speedInput, speedUnit, speedPlus);
```

Update append order:

```js
controls.append(toggle, previous, slider, next, counter, speed);
```

Update `updateActiveSequencePlaybackDisplay` to use `getVisibleFrameAtTime` and to keep the input synced:

```js
const speedInput = avatarActiveSequenceControls.querySelector(
  ".sequence-speed-input"
);
if (speedInput && document.activeElement !== speedInput) {
  speedInput.value = String(playback.intervalMs);
}
```

- [ ] **Step 5: Style sequence speed controls**

Update the sequence control CSS in `public/styles.css`:

```css
.wearable-sequence-controls {
  display: grid;
  grid-template-columns: 38px 34px minmax(96px, 1fr) 34px 58px minmax(142px, auto);
  align-items: center;
  gap: 8px;
}

.sequence-speed-control {
  display: grid;
  grid-template-columns: 30px minmax(58px, 72px) auto 30px;
  align-items: center;
  gap: 5px;
}

.sequence-speed-step,
.sequence-speed-input {
  min-height: 36px;
  border: 1px solid #477f9f;
  border-radius: 8px;
  background: #142e3f;
  color: #dcecff;
}

.sequence-speed-step {
  display: grid;
  min-width: 30px;
  place-items: center;
  cursor: pointer;
}

.sequence-speed-input {
  width: 100%;
  padding: 0 6px;
  font: inherit;
  text-align: center;
}

.sequence-speed-unit {
  color: #b7cedd;
  font-size: 0.72rem;
}

@media (max-width: 420px) {
  .wearable-sequence-controls {
    grid-template-columns: 36px 32px minmax(72px, 1fr) 32px 52px;
    gap: 5px;
  }

  .sequence-speed-control {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
node --test tests/wearable_sequence.test.js
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_wearable_sequence_speed_control_is_integrated
```

Expected result: PASS.

---

### Task 3: Facial Expression PNG Preview Buttons

**Files:**

- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add failing expression PNG contract test**

Add this test method to `tests/test_avatar_composite.py`:

```python
    def test_expression_buttons_use_png_previews_without_emoji_labels(self):
        source = APP_JS.read_text(encoding="utf-8")
        styles = (
            PROJECT_DIR / "public" / "styles.css"
        ).read_text(encoding="utf-8")

        self.assertIn('{ id: 0, name: "Normal" }', source)
        self.assertIn('{ id: 6, name: "Derp" }', source)
        self.assertNotIn('name: "😃 Normal"', source)
        self.assertNotIn('icon: "🙂"', source)
        self.assertIn("function createExpressionPreviewPng(", source)
        self.assertIn('preview.src = createExpressionPreviewPng(exp.id)', source)
        self.assertIn('preview.alt = `${exp.name} expression preview`', source)
        self.assertIn('className = "expr-preview"', source)
        self.assertIn('label.className = "expr-label"', source)
        self.assertIn(".expr-preview", styles)
        self.assertIn("image-rendering: pixelated", styles)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_expression_buttons_use_png_previews_without_emoji_labels
```

Expected result: FAIL because expression metadata still contains emoji and no PNG preview helper exists.

- [ ] **Step 3: Replace expression metadata and add PNG preview helper**

Replace `EXPRESSIONS` in `public/app.js` with:

```js
const EXPRESSIONS = [
  { id: 0, name: "Normal" },
  { id: 1, name: "Happy" },
  { id: 2, name: "Angry" },
  { id: 3, name: "Surprised" },
  { id: 4, name: "Wink" },
  { id: 5, name: "Sleeping" },
  { id: 6, name: "Derp" },
];
```

Add this helper after `tintExpressionTile`:

```js
function createExpressionPreviewPng(expressionId) {
  const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.expression];
  const coord = getAvatarExpressionCoord(expressionId);
  const tile = tintExpressionTile(
    img,
    coord.x,
    coord.y,
    32,
    32,
    plannerState.skinColorHex,
    expressionId
  );
  return tile.toDataURL("image/png");
}
```

- [ ] **Step 4: Render expression buttons with images**

Replace the expression button rendering inside `setupEventListeners` with:

```js
EXPRESSIONS.forEach(exp => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `expr-btn ${exp.id === plannerState.expression ? "active" : ""}`;
  btn.dataset.expressionId = exp.id.toString();
  btn.setAttribute("aria-label", `Use ${exp.name} expression`);

  const preview = document.createElement("img");
  preview.className = "expr-preview";
  preview.width = 32;
  preview.height = 32;
  preview.src = createExpressionPreviewPng(exp.id);
  preview.alt = `${exp.name} expression preview`;

  const label = document.createElement("span");
  label.className = "expr-label";
  label.textContent = exp.name;

  btn.append(preview, label);
  btn.addEventListener("click", () => {
    document.querySelectorAll(".expr-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    plannerState.expression = exp.id;
    renderAvatarCanvas();
    refreshExpressionPreviews();
  });
  exprGrid.appendChild(btn);
});
```

Add this helper after the expression render block or near other UI refresh helpers:

```js
function refreshExpressionPreviews() {
  document.querySelectorAll(".expr-btn").forEach(button => {
    const id = Number(button.dataset.expressionId);
    const preview = button.querySelector(".expr-preview");
    if (preview) preview.src = createExpressionPreviewPng(id);
  });
}
```

After any skin-tone click handler changes `plannerState.skinColorHex`, call:

```js
refreshExpressionPreviews();
```

After `resetAvatarOutfit()` updates selected expression and skin tone, call:

```js
refreshExpressionPreviews();
```

- [ ] **Step 5: Style expression PNG controls**

Replace the expression CSS block in `public/styles.css` with:

```css
.expressions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 0.45rem;
}

.expr-btn {
  display: inline-grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  min-height: 44px;
  gap: 0.45rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(30, 41, 59, 0.8);
  color: var(--text-main);
  cursor: pointer;
  font-size: 0.775rem;
  text-align: left;
}

.expr-preview {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: rgba(2, 6, 23, 0.55);
  image-rendering: pixelated;
}

.expr-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expr-btn.active {
  border-color: #67e8f9;
  background: linear-gradient(135deg, #00e5ff, #3b82f6);
  color: #05080f;
  font-weight: 700;
}

.expr-btn:focus-visible {
  outline: 2px solid #67e8f9;
  outline-offset: 2px;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_expression_buttons_use_png_previews_without_emoji_labels
```

Expected result: PASS.

---

### Task 4: Action and Export Button Layout

**Files:**

- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add failing action layout contract test**

Add this method to `tests/test_avatar_composite.py`:

```python
    def test_avatar_actions_use_grouped_primary_and_advanced_export_layout(self):
        html = (
            PROJECT_DIR / "public" / "index.html"
        ).read_text(encoding="utf-8")
        source = APP_JS.read_text(encoding="utf-8")
        styles = (
            PROJECT_DIR / "public" / "styles.css"
        ).read_text(encoding="utf-8")

        self.assertIn('class="avatar-tools-actions"', html)
        self.assertIn('class="avatar-set-actions"', html)
        self.assertIn('class="avatar-export-actions"', html)
        self.assertIn('<summary class="avatar-export-more-summary">More export options</summary>', html)
        self.assertLess(
            html.index('id="avatar-download-png"'),
            html.index('id="avatar-download-layers"'),
        )
        self.assertIn("function refreshAvatarExportAvailability()", source)
        self.assertIn("avatarDownloadSelectedSequenceBtn.disabled =", source)
        self.assertIn("avatarDownloadAllSequencesBtn.disabled =", source)
        self.assertIn(".avatar-set-actions", styles)
        self.assertIn(".avatar-export-actions", styles)
        self.assertIn(".avatar-export-more-summary", styles)
        self.assertIn(".btn-danger-lite", styles)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_actions_use_grouped_primary_and_advanced_export_layout
```

Expected result: FAIL because the HTML still uses one flat grid and no availability helper exists.

- [ ] **Step 3: Replace the avatar action HTML**

Replace the current `<div class="avatar-tools-actions">...</div>` block in `public/index.html` with:

```html
            <div class="avatar-tools-actions">
              <div class="avatar-set-actions" aria-label="Set controls">
                <button id="avatar-randomize" class="btn btn-purple" type="button">Random Set</button>
                <button id="avatar-reset" class="btn btn-secondary" type="button">Reset Set</button>
                <button id="avatar-reset-all-positions" class="btn btn-secondary btn-danger-lite" type="button">Reset Positions</button>
              </div>

              <div class="avatar-export-actions" aria-label="Export controls">
                <button id="avatar-download-png" class="btn btn-primary avatar-primary-export" type="button">Download Set PNG</button>
                <details class="avatar-export-more">
                  <summary class="avatar-export-more-summary">More export options</summary>
                  <div class="avatar-export-more-list">
                    <button id="avatar-download-layers" class="btn btn-green" type="button">Download Separate Layers ZIP</button>
                    <button id="avatar-download-selected-sequence" class="btn btn-purple" type="button">Download Selected Sequence ZIP</button>
                    <button id="avatar-download-all-sequences" class="btn btn-green" type="button">Download All Equipped Sequences ZIP</button>
                  </div>
                </details>
              </div>
            </div>
```

- [ ] **Step 4: Add export availability refresh in `public/app.js`**

Add this helper near other export functions:

```js
function refreshAvatarExportAvailability() {
  const selectedEntries = getEquippedWearableSequenceEntries(true);
  const allEntries = getEquippedWearableSequenceEntries(false);
  avatarDownloadSelectedSequenceBtn.disabled = selectedEntries.length === 0;
  avatarDownloadAllSequencesBtn.disabled = allEntries.length === 0;
}
```

Call it:

- after `refreshActivePositionControls();`
- after `renderAvatarInventory();`
- after `randomizeAvatarOutfit()` changes equipped items;
- after `resetAvatarOutfit()` clears equipped items;
- after `equipAvatarInventoryItem(...)` changes equipped items;
- inside `runWearableSequenceExport` `finally`, instead of blindly setting both sequence buttons to `false`.

Use this `finally` block:

```js
  } finally {
    refreshAvatarExportAvailability();
  }
```

- [ ] **Step 5: Style grouped action/export controls**

Replace the old `.avatar-tools-actions` CSS block with:

```css
.avatar-tools-actions {
  display: grid;
  gap: 0.7rem;
}

.avatar-set-actions,
.avatar-export-actions,
.avatar-export-more-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.avatar-tools-actions .btn {
  min-height: 44px;
  padding: 0.65rem;
  justify-content: center;
}

.avatar-primary-export,
.avatar-export-more,
.avatar-export-more-list {
  grid-column: 1 / -1;
}

.avatar-export-more {
  border: 1px solid rgba(125, 211, 252, 0.22);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.44);
}

.avatar-export-more-summary {
  min-height: 44px;
  padding: 0.7rem 0.8rem;
  color: var(--text-main);
  cursor: pointer;
  font-weight: 700;
}

.avatar-export-more-list {
  padding: 0 0.7rem 0.7rem;
}

.btn-danger-lite {
  border-color: rgba(248, 113, 113, 0.35);
  color: #fecaca;
}

.btn:disabled {
  cursor: not-allowed;
  filter: grayscale(0.55);
  opacity: 0.48;
  transform: none;
}

@media (max-width: 560px) {
  .avatar-set-actions,
  .avatar-export-actions,
  .avatar-export-more-list {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_actions_use_grouped_primary_and_advanced_export_layout
```

Expected result: PASS.

---

### Task 5: Full Verification and Browser Acceptance

**Files:**

- Modify only if verification exposes a defect in files already listed above.

- [ ] **Step 1: Run automated suites**

Run:

```powershell
node --test tests/wearable_sequence.test.js
python -m unittest tests.test_avatar_composite
```

Expected result: both suites PASS.

- [ ] **Step 2: Start the local app**

Run:

```powershell
python server.py
```

If port `5000` is already occupied by the same project server, reuse `http://127.0.0.1:5000/` and do not start a second server.

Expected result: the Set Planner opens without 404s for `app.js`, `styles.css`, `wearable_sequence.js`, `wearables_manifest.json`, and `wearables_anim_map.json`.

- [ ] **Step 3: Manual browser acceptance**

In the Set Planner:

1. Equip Aurora Robe.
2. Select Aurora Robe as the active equipped item.
3. Confirm the sequence row shows play/pause, previous, slider, next, frame count, and `ms` speed input.
4. Set speed to `80 ms`, play, pause, reload, and confirm Aurora Robe still shows `80`.
5. Equip another animated wearable, set it to `300 ms`, and confirm Aurora Robe keeps `80`.
6. Switch facial expressions and confirm every expression button uses a PNG preview and text label only.
7. Change skin tone and confirm expression previews refresh.
8. Confirm `Download Set PNG` is the only primary visible export action.
9. Expand `More export options` and confirm all three ZIP buttons exist.
10. Confirm sequence ZIP buttons are disabled when no valid animated sequence is selected/equipped.
11. Check a narrow viewport around `375px` wide for no clipped buttons or horizontal overflow.

- [ ] **Step 4: Final source scan**

Run:

```powershell
Select-String -LiteralPath .\public\app.js -Pattern '😃','😊','😠','😮','😜','😴','🤪','Auto' -SimpleMatch
Select-String -LiteralPath .\public\index.html -Pattern 'Reset All Positions','Download Selected Sequence ZIP','More export options' -SimpleMatch
```

Expected result:

- no emoji expression metadata remains in `public/app.js`;
- no `Auto` label remains in the selected item sequence UI;
- `Reset All Positions` no longer appears in the avatar action group;
- `More export options` appears in `public/index.html`.

- [ ] **Step 5: Report completion against the spec**

Final implementation report must include:

- backup path and SHA from the spec;
- changed files;
- test commands and pass/fail results;
- browser acceptance result;
- any residual risk, especially if browser acceptance could not be run.
