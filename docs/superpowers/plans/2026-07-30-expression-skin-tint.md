# GT Set Planner Expression Skin Tint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tint grayscale skin pixels in facial-expression sprites while preserving white, black, and colored facial details.

**Architecture:** Put the pixel-classification logic in a small browser/CommonJS-compatible helper so it can be tested directly with Node. The canvas renderer crops the selected expression frame, applies the helper to its `ImageData`, and composites the result over the tinted head.

**Tech Stack:** Vanilla JavaScript, Canvas 2D `ImageData`, Node built-in test runner, Python `unittest`, local threaded HTTP server.

---

### Task 1: Add Failing Pixel-Tint Tests

**Files:**
- Create: `tests/avatar_tint.test.js`
- Modify: `tests/test_avatar_composite.py`
- Test: `public/avatar_tint.js`
- Test: `public/app.js`
- Test: `public/index.html`

- [ ] **Step 1: Write direct pixel behavior tests**

Create `tests/avatar_tint.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  tintExpressionPixel
} = require("../public/avatar_tint.js");

test("tints a grayscale facial-skin pixel", () => {
  assert.deepEqual(
    tintExpressionPixel([230, 230, 230, 255], "#FFC3AA"),
    [230, 175, 153, 255]
  );
});

test("preserves pure white eye and tooth pixels", () => {
  assert.deepEqual(
    tintExpressionPixel([255, 255, 255, 255], "#FFC3AA"),
    [255, 255, 255, 255]
  );
});

test("preserves pure black pupil pixels", () => {
  assert.deepEqual(
    tintExpressionPixel([0, 0, 0, 255], "#FFC3AA"),
    [0, 0, 0, 255]
  );
});

test("preserves colored expression details", () => {
  assert.deepEqual(
    tintExpressionPixel([236, 6, 27, 255], "#FFC3AA"),
    [236, 6, 27, 255]
  );
});

test("preserves transparent pixels", () => {
  assert.deepEqual(
    tintExpressionPixel([230, 230, 230, 0], "#FFC3AA"),
    [230, 230, 230, 0]
  );
});
```

- [ ] **Step 2: Add browser integration contracts**

Append to `AvatarCompositeContractTests` in
`tests/test_avatar_composite.py`:

```python
    def test_expression_tint_helper_is_loaded_before_app(self):
        html = (PROJECT_DIR / "public" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertIn('src="avatar_tint.js"', html)
        self.assertLess(
            html.index('src="avatar_tint.js"'),
            html.index('src="app.js"'),
        )

    def test_expression_renderer_receives_skin_color_and_tints_tile(self):
        source = APP_JS.read_text(encoding="utf-8")
        self.assertIn(
            "drawPlayerFacialExpression("
            "ctx, plannerState.expression, plannerState.skinColorHex)",
            source,
        )
        section = source[
            source.index("function drawPlayerFacialExpression("):
            source.index("function drawLayerItemTile(")
        ]
        self.assertIn("tintExpressionTile(", section)
        self.assertIn("colorHex", section)
```

- [ ] **Step 3: Run both focused test groups and verify RED**

Run:

```powershell
node --test tests/avatar_tint.test.js
python -m unittest tests.test_avatar_composite -v
```

Expected:

- Node fails because `public/avatar_tint.js` does not exist.
- Python keeps the four previous avatar tests green and fails the two new
  integration contracts because the helper and skin-color argument are absent.

### Task 2: Implement Selective Expression Tinting

**Files:**
- Create: `public/avatar_tint.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Test: `tests/avatar_tint.test.js`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Implement the pure pixel helper**

Create `public/avatar_tint.js`:

```javascript
(function exposeAvatarTint(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AvatarTint = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  function parseHexColor(hex) {
    let value = hex.replace("#", "");
    if (value.length === 3) {
      value = value.split("").map(char => char + char).join("");
    }
    const number = parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  function tintExpressionPixel(pixel, colorHex) {
    const [r, g, b, a] = pixel;
    const isTintableGray = a > 0 && r === g && g === b && r > 0 && r < 255;
    if (!isTintableGray) return [r, g, b, a];

    const target = parseHexColor(colorHex);
    return [
      Math.floor((r / 255) * target.r),
      Math.floor((g / 255) * target.g),
      Math.floor((b / 255) * target.b),
      a
    ];
  }

  function tintExpressionImageData(imageData, colorHex) {
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const tinted = tintExpressionPixel(
        [data[index], data[index + 1], data[index + 2], data[index + 3]],
        colorHex
      );
      data[index] = tinted[0];
      data[index + 1] = tinted[1];
      data[index + 2] = tinted[2];
      data[index + 3] = tinted[3];
    }
    return imageData;
  }

  return { tintExpressionPixel, tintExpressionImageData };
});
```

- [ ] **Step 2: Load the helper before the main app**

In `public/index.html`, immediately before the existing `app.js` script:

```html
<script src="avatar_tint.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 3: Add the canvas crop-and-tint function**

In `public/app.js`, add beside `tintTile()`:

```javascript
function tintExpressionTile(img, sx, sy, sw, sh, colorHex) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempContext = tempCanvas.getContext("2d");
  tempContext.imageSmoothingEnabled = false;
  tempContext.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const imageData = tempContext.getImageData(0, 0, sw, sh);
  window.AvatarTint.tintExpressionImageData(imageData, colorHex);
  tempContext.putImageData(imageData, 0, 0);
  return tempCanvas;
}
```

- [ ] **Step 4: Pass skin color into the expression renderer**

Change the render call to:

```javascript
drawPlayerFacialExpression(
  ctx,
  plannerState.expression,
  plannerState.skinColorHex
);
```

Change the function signature and final draw to:

```javascript
function drawPlayerFacialExpression(ctx, expId, colorHex) {
  const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.expression];
  const eyeMap = [
    { x: 0, y: 0 },
    { x: 0, y: 32 },
    { x: 128, y: 32 },
    { x: 96, y: 32 },
    { x: 128, y: 64 },
    { x: 64, y: 64 },
    { x: 192, y: 64 }
  ];
  const coord = eyeMap[expId] || { x: 0, y: 0 };
  const tintedExpression = tintExpressionTile(
    img, coord.x, coord.y, 32, 32, colorHex
  );
  ctx.drawImage(tintedExpression, 0, 0, 32, 32, 0, 0, 128, 128);
}
```

- [ ] **Step 5: Run focused tests and syntax checks**

Run:

```powershell
node --test tests/avatar_tint.test.js
python -m unittest tests.test_avatar_composite -v
node --check public/avatar_tint.js
node --check public/app.js
```

Expected: eleven focused checks pass with zero failures.

- [ ] **Step 6: Run the complete regression suite**

Run:

```powershell
node --test tests/avatar_tint.test.js
python -m unittest tests.test_avatar_composite tests.test_preview_reliability tests.test_asset_sync -v
```

Expected: five Node tests and twelve Python tests pass.

This project is not a Git repository, so no commit step is available.

### Task 3: Verify the Corrected Colors in the Browser

**Files:**
- Verify: `public/avatar_tint.js`
- Verify: `public/app.js`
- Verify: `public/index.html`

- [ ] **Step 1: Reload localhost with a cache-busting URL**

Open:

```text
http://127.0.0.1:5000/?expression-tint=1
```

Select `GT Set Planner / Avatar Studio`.

- [ ] **Step 2: Verify the normal expression**

Select Tone 6 or another peach skin. Confirm:

- Gray pixels around the eyes follow the peach skin.
- The mouth shading follows the peach skin.
- Eye whites remain white.
- Pupils remain black.

- [ ] **Step 3: Verify another expression and Reset**

Select Angry or Wink and confirm its grayscale shading follows the selected
skin while colored details remain unchanged. Press Reset and confirm the
complete neutral character returns.

- [ ] **Step 4: Verify helper delivery**

Run:

```powershell
$response = Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:5000/avatar_tint.js" `
  -TimeoutSec 15
"$($response.StatusCode) $($response.RawContentLength)"
```

Expected: status `200` and a non-zero response length.
