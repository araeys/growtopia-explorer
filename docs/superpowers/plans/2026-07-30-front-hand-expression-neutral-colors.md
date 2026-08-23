# Front Hand and Expression Neutral Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Draw the preview-left hand above every equipped item and preserve neutral eye and tooth colors across all seven facial expressions.

**Architecture:** Extract a precise transparent foreground-hand mask from the approved canonical idle body and composite its tinted pixels after the equipment loop. Extend the isolated expression tint helper with explicit per-expression semantic classification so only skin-cover grayscale pixels are recolored.

**Tech Stack:** Vanilla JavaScript, Canvas 2D, PNG assets, Node.js test runner, Python `unittest`, Pillow, local HTTP server, in-app browser QA.

---

## File Map

- Create `public/character_base_assets/gtsetplanner/player_front_left_hand.png`:
  32 by 32 canonical screen-left arm/hand foreground mask.
- Modify `public/app.js`: load, tint, and draw the foreground hand after all
  equipment.
- Modify `public/avatar_tint.js`: classify neutral grayscale feature pixels per
  expression before applying skin tint.
- Modify `tests/test_avatar_composite.py`: enforce foreground-hand geometry,
  loading, tinting, and final layer order.
- Modify `tests/avatar_tint.test.js`: cover semantic skin and neutral feature
  pixels for all seven expressions.
- Verify `public/character_base_assets/gtsetplanner/player_idle_body.png`:
  authoritative source for the hand extraction.

### Task 1: Add Failing Foreground-Hand Contracts

**Files:**
- Modify: `tests/test_avatar_composite.py`
- Read: `public/app.js`
- Read: `public/character_base_assets/gtsetplanner/player_idle_body.png`

- [x] **Step 1: Add the required foreground-hand path contract**

Extend `test_avatar_base_uses_body_head_and_expression_textures()`:

```python
self.assertIn(
    '"character_base_assets/gtsetplanner/player_front_left_hand.png"',
    source,
)
```

- [x] **Step 2: Add the foreground-hand PNG geometry contract**

```python
def test_front_left_hand_is_a_precise_native_overlay(self):
    path = (
        PROJECT_DIR / "public" / "character_base_assets"
        / "gtsetplanner" / "player_front_left_hand.png"
    )
    self.assertTrue(path.exists(), f"Missing required avatar asset: {path}")
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        self.assertEqual((32, 32), rgba.size)
        self.assertGreater(rgba.getpixel((7, 24))[3], 0)
        self.assertGreater(rgba.getpixel((11, 24))[3], 0)
        self.assertEqual(0, rgba.getpixel((5, 24))[3])
        self.assertEqual(0, rgba.getpixel((12, 24))[3])
        self.assertEqual(0, rgba.getpixel((11, 19))[3])
        self.assertEqual(0, rgba.getpixel((8, 18))[3])
        self.assertEqual(0, rgba.getpixel((8, 28))[3])
```

- [x] **Step 3: Add the final-layer compositor contract**

```python
def test_front_left_hand_is_tinted_and_drawn_after_equipment(self):
    source = APP_JS.read_text(encoding="utf-8")
    render_section = source[
        source.index("function renderAvatarCanvas()"):
        source.index("function ensureAvatarBaseTextures()")
    ]
    hand_function = source[
        source.index("function drawFrontLeftHand("):
        source.index("function drawPlayerFacialExpression(")
    ]

    self.assertIn(
        "drawFrontLeftHand(ctx, plannerState.skinColorHex)",
        render_section,
    )
    self.assertLess(
        render_section.index("clothesOrder.forEach"),
        render_section.index("drawFrontLeftHand("),
    )
    self.assertIn(
        "tintTile(handImage, 0, 0, 32, 32, colorHex)",
        hand_function,
    )
    self.assertIn(
        "ctx.drawImage(tintedHand, 0, 0, 32, 32, 0, 0, 128, 128)",
        hand_function,
    )
```

- [x] **Step 4: Run the focused contract suite and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: failures for the missing foreground-hand PNG, path registration,
function, and final draw call. Existing avatar contracts remain green.

### Task 2: Add Failing Semantic Expression Tests

**Files:**
- Modify: `tests/avatar_tint.test.js`
- Read: `public/avatar_tint.js`
- Read: `public/character_base_assets/gtsetplanner/player_eyes.png`

- [x] **Step 1: Replace the legacy non-Normal expectation with semantic cases**

Add this table-driven test:

```javascript
test("preserves neutral grayscale expression features", () => {
  const cases = [
    ["Happy lower eye shadow", 1, 12, 5, 230],
    ["Angry lower eye shadow", 2, 12, 5, 230],
    ["Angry mouth detail", 2, 15, 11, 196],
    ["Surprised lower eye shadow", 3, 12, 5, 230],
    ["Wink stroke", 4, 12, 4, 212],
    ["Wink mouth detail", 4, 19, 13, 230],
    ["Sleeping eye stroke", 5, 12, 6, 212],
    ["Sleeping lower eyelid", 5, 13, 7, 230],
    ["Derp eye detail", 6, 12, 5, 230],
    ["Derp tooth shadow", 6, 16, 11, 230],
    ["Derp side detail", 6, 8, 5, 212]
  ];

  for (const [label, expressionId, x, y, gray] of cases) {
    assert.deepEqual(
      tint([gray, gray, gray, 255], "#FFC3AA", {
        expressionId, x, y
      }),
      [gray, gray, gray, 255],
      label
    );
  }
});
```

- [x] **Step 2: Prove skin-cover pixels still tint in every expression**

```javascript
test("tints semantic skin-cover pixels in every expression", () => {
  const cases = [
    [0, 13, 3],
    [1, 13, 3],
    [2, 13, 3],
    [3, 13, 2],
    [4, 21, 3],
    [5, 13, 3]
  ];

  for (const [expressionId, x, y] of cases) {
    assert.deepEqual(
      tint([230, 230, 230, 255], "#FFC3AA", {
        expressionId, x, y
      }),
      [230, 175, 153, 255]
    );
  }
});
```

- [x] **Step 3: Run the Node suite and verify RED**

Run:

```powershell
node --test tests/avatar_tint.test.js
```

Expected: the new neutral-feature table fails because non-Normal grayscale
pixels are still unconditionally multiplied by the skin color. Existing pure
white, pure black, colored, transparent, and Normal tests remain green.

### Task 3: Extract and Composite the Foreground Hand

**Files:**
- Create: `public/character_base_assets/gtsetplanner/player_front_left_hand.png`
- Modify: `public/app.js`
- Test: `tests/test_avatar_composite.py`

- [x] **Step 1: Extract the exact native hand mask**

Use Pillow to copy the exact per-row hand silhouette:

```python
from pathlib import Path
from PIL import Image

root = Path(r"C:\Users\VICTUS\Downloads\growtopia-explorer")
source_path = (
    root / "public" / "character_base_assets"
    / "gtsetplanner" / "player_idle_body.png"
)
output_path = source_path.with_name("player_front_left_hand.png")

with Image.open(source_path) as source:
    rgba = source.convert("RGBA")
    overlay = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    ranges = {
        **{y: range(7, 11) for y in range(19, 24)},
        **{y: range(6, 12) for y in range(24, 27)},
        27: range(7, 12),
    }
    for y, xs in ranges.items():
        for x in xs:
            overlay.putpixel((x, y), rgba.getpixel((x, y)))
    overlay.save(output_path)
```

- [x] **Step 2: Register the foreground texture**

Set the texture map in `public/app.js` to:

```javascript
const AVATAR_BASE_TEXTURE_PATHS = {
  body: "character_base_assets/gtsetplanner/player_idle_body.png",
  head: "tilesheets/player_head.png",
  expression: "character_base_assets/gtsetplanner/player_eyes.png",
  frontLeftHand:
    "character_base_assets/gtsetplanner/player_front_left_hand.png"
};
```

- [x] **Step 3: Add the isolated hand compositor**

Insert after `drawBasePlayerSkin()` and before
`drawPlayerFacialExpression()`:

```javascript
function drawFrontLeftHand(ctx, colorHex) {
  const handImage =
    textureImageCache[AVATAR_BASE_TEXTURE_PATHS.frontLeftHand];
  const tintedHand = tintTile(handImage, 0, 0, 32, 32, colorHex);
  ctx.drawImage(tintedHand, 0, 0, 32, 32, 0, 0, 128, 128);
}
```

- [x] **Step 4: Draw the hand after the equipment loop**

Append to `renderAvatarCanvas()` after `clothesOrder.forEach(...)`:

```javascript
drawFrontLeftHand(ctx, plannerState.skinColorHex);
```

- [x] **Step 5: Run the focused Python suite and verify GREEN**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --check public/app.js
```

Expected: all avatar composite contracts pass and JavaScript syntax exits zero.

### Task 4: Implement Per-Expression Neutral Feature Semantics

**Files:**
- Modify: `public/avatar_tint.js`
- Test: `tests/avatar_tint.test.js`

- [x] **Step 1: Add an explicit grayscale mode classifier**

Add below `normalExpressionGrayMode()`:

```javascript
function expressionGrayMode(expressionId, x, y, gray) {
  if (expressionId === 0) return normalExpressionGrayMode(x, y);

  if (gray === 212 || gray === 196) return "neutral";

  if (expressionId === 1) {
    return y >= 5 && y <= 7 ? "neutral" : "skin";
  }
  if (expressionId === 2) {
    if (y >= 5 && y <= 7) return "neutral";
    if (y >= 11 && y <= 14) return "neutral";
    return "skin";
  }
  if (expressionId === 3) {
    return y >= 5 && y <= 8 ? "neutral" : "skin";
  }
  if (expressionId === 4) {
    if (y >= 5 && y <= 7) return "neutral";
    if (y === 13) return "neutral";
    return "skin";
  }
  if (expressionId === 5) {
    return y >= 6 && y <= 7 ? "neutral" : "skin";
  }
  if (expressionId === 6) {
    if (y >= 5 && y <= 6) return "neutral";
    if (y === 11 || y === 13) return "neutral";
    return "skin";
  }
  return "skin";
}
```

- [x] **Step 2: Route every grayscale pixel through the classifier**

Replace the expression-specific branch in `tintExpressionPixel()` with:

```javascript
const mode = expressionGrayMode(
  semanticContext.expressionId,
  semanticContext.x,
  semanticContext.y,
  r
);
if (mode === "neutral") return [r, g, b, a];

const gray = mode === "mouth" ? 120 : r;
const rounding = semanticContext.expressionId === 0 ? "round" : "floor";
const tinted = multiplyGrayByColor(gray, target, rounding);
return [tinted[0], tinted[1], tinted[2], a];
```

- [x] **Step 3: Run the Node suite and verify GREEN**

Run:

```powershell
node --test tests/avatar_tint.test.js
node --check public/avatar_tint.js
```

Expected: all semantic expression cases and previous color-preservation tests
pass with zero failures.

### Task 5: Full Regression and Browser Verification

**Files:**
- Verify: `public/app.js`
- Verify: `public/avatar_tint.js`
- Verify: `public/character_base_assets/gtsetplanner/player_front_left_hand.png`

- [x] **Step 1: Run all automated regressions**

Run:

```powershell
python -m unittest tests.test_avatar_composite tests.test_preview_reliability tests.test_asset_sync -v
node --test tests/avatar_tint.test.js
node --check public/app.js
node --check public/avatar_tint.js
```

Expected: all Python and Node tests pass and both syntax checks exit zero.

- [x] **Step 2: Verify the foreground-hand resource over HTTP**

Run:

```powershell
$response = Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:5000/character_base_assets/gtsetplanner/player_front_left_hand.png" `
  -TimeoutSec 15
"Status=$($response.StatusCode) Bytes=$($response.Content.Length)"
```

Expected: `Status=200` with a non-zero byte count.

- [x] **Step 3: Verify all expressions in the browser**

Reload:

```text
http://127.0.0.1:5000/?expression-semantic-all=1
```

Select Tone 6, then verify Normal, Happy, Angry, Surprised, Wink, Sleeping, and
Derp. Eye whites, pupils, eyelid shadows, teeth, and tooth shadows must remain
neutral while skin-cover pixels follow Tone 6.

- [x] **Step 4: Verify final hand order**

Equip one Shirt, one Chest item, and one Hand item. Confirm the preview-left
hand remains above all three while the preview-right hand remains in the base
layer.

- [x] **Step 5: Verify Reset**

Press Reset and confirm White + Normal, no equipped items, close idle arms, bare
feet, and the preview-left hand still present.

This project is not a Git repository, so no commit steps are included.
