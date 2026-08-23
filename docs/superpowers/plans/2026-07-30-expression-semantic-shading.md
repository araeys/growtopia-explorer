# GT Expression Semantic Shading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the normal Growtopia face match the supplied reference by separating skin-colored eye borders, neutral eye shadows, and dark mouth pixels.

**Architecture:** Keep the reusable pixel transform in `public/avatar_tint.js`, but pass tile-local coordinates and the expression ID into it. Apply the semantic coordinate rules only to expression `0`; retain the existing color-only behavior for other expressions until reference-backed masks exist.

**Tech Stack:** Browser Canvas `ImageData`, vanilla JavaScript/CommonJS, Node built-in test runner, Python `unittest`, local Flask site.

---

## File Structure

- Modify `public/avatar_tint.js`: classify and tint expression pixels using expression ID and tile-local coordinates.
- Modify `public/app.js`: pass the selected expression ID into the image-data helper.
- Modify `tests/avatar_tint.test.js`: direct regression coverage for semantic eye and mouth pixels.
- Modify `tests/test_avatar_composite.py`: integration contract proving the renderer forwards the expression ID.

### Task 1: Add Semantic Pixel Regression Tests

**Files:**
- Modify: `tests/avatar_tint.test.js`
- Test: `tests/avatar_tint.test.js`

- [ ] **Step 1: Add failing normal-expression pixel tests**

Add:

```javascript
test("normal expression tints the upper eye skin border", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 13, y: 3
    }),
    [230, 176, 153, 255]
  );
});

test("normal expression preserves the neutral lower eye shadow", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 12, y: 5
    }),
    [230, 230, 230, 255]
  );
});

test("normal expression uses the dark facial-line shade for the mouth", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 17, y: 13
    }),
    [120, 92, 80, 255]
  );
});

test("non-normal expressions retain legacy grayscale tinting", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 2, x: 12, y: 5
    }),
    [230, 175, 153, 255]
  );
});
```

Update the local test wrapper to accept and forward context:

```javascript
function tint(pixel, colorHex, context) {
  assert.equal(
    typeof tintExpressionPixel,
    "function",
    "avatar_tint.js must export tintExpressionPixel"
  );
  return tintExpressionPixel(pixel, colorHex, context);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests\avatar_tint.test.js
```

Expected: the upper-border test reports the old floor-rounded green channel,
the eye-shadow test reports a skin-tinted value, and the mouth test reports the
old light shade.

### Task 2: Implement Coordinate-Aware Expression Tinting

**Files:**
- Modify: `public/avatar_tint.js`
- Test: `tests/avatar_tint.test.js`

- [ ] **Step 1: Add the semantic normal-face transform**

Add these focused helpers:

```javascript
function multiplyGrayByColor(gray, target, rounding) {
  const applyRounding = rounding === "round" ? Math.round : Math.floor;
  return [
    applyRounding((gray / 255) * target.r),
    applyRounding((gray / 255) * target.g),
    applyRounding((gray / 255) * target.b)
  ];
}

function normalExpressionGrayMode(x, y) {
  if (y >= 5 && y <= 7) return "neutral";
  if (y >= 12 && y <= 13) return "mouth";
  return "skin";
}
```

Update the pixel transform:

```javascript
function tintExpressionPixel(pixel, colorHex, context) {
  const [r, g, b, a] = pixel;
  const isTintableGray = a > 0 && r === g && g === b && r > 0 && r < 255;
  if (!isTintableGray) return [r, g, b, a];

  const target = parseHexColor(colorHex);
  const semanticContext = context || {};

  if (semanticContext.expressionId === 0) {
    const mode = normalExpressionGrayMode(semanticContext.x, semanticContext.y);
    if (mode === "neutral") return [r, g, b, a];
    const gray = mode === "mouth" ? 120 : r;
    const tinted = multiplyGrayByColor(gray, target, "round");
    return [tinted[0], tinted[1], tinted[2], a];
  }

  const tinted = multiplyGrayByColor(r, target, "floor");
  return [tinted[0], tinted[1], tinted[2], a];
}
```

Update `tintExpressionImageData` to receive `expressionId`, calculate tile-local
coordinates from `imageData.width`, and forward:

```javascript
function tintExpressionImageData(imageData, colorHex, expressionId) {
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const pixelIndex = index / 4;
    const tinted = tintExpressionPixel(
      [data[index], data[index + 1], data[index + 2], data[index + 3]],
      colorHex,
      {
        expressionId,
        x: pixelIndex % imageData.width,
        y: Math.floor(pixelIndex / imageData.width)
      }
    );
    data[index] = tinted[0];
    data[index + 1] = tinted[1];
    data[index + 2] = tinted[2];
    data[index + 3] = tinted[3];
  }
  return imageData;
}
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests\avatar_tint.test.js
```

Expected: all nine pixel tests pass.

### Task 3: Forward Expression Identity Through the Canvas Renderer

**Files:**
- Modify: `public/app.js`
- Modify: `tests/test_avatar_composite.py`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add a failing integration contract**

Extend `test_expression_renderer_receives_skin_color_and_tints_tile` with:

```python
self.assertIn(
    "window.AvatarTint.tintExpressionImageData("
    "imageData, colorHex, expressionId)",
    source,
)
self.assertIn(
    "img, coord.x, coord.y, 32, 32, colorHex, expId",
    source,
)
```

- [ ] **Step 2: Run the focused integration test and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_expression_renderer_receives_skin_color_and_tints_tile -v
```

Expected: FAIL because `tintExpressionTile` does not yet accept or forward
`expressionId`.

- [ ] **Step 3: Forward the expression ID**

Change the canvas helper signature and call:

```javascript
function tintExpressionTile(img, sx, sy, sw, sh, colorHex, expressionId) {
  // existing crop logic
  window.AvatarTint.tintExpressionImageData(
    imageData, colorHex, expressionId
  );
  // existing putImageData and return
}
```

Update `drawPlayerFacialExpression`:

```javascript
const tintedExpression = tintExpressionTile(
  img, coord.x, coord.y, 32, 32, colorHex, expId
);
```

- [ ] **Step 4: Run the focused integration test and verify GREEN**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_expression_renderer_receives_skin_color_and_tints_tile -v
```

Expected: PASS.

### Task 4: Full Regression and Browser Verification

**Files:**
- Verify: `public/avatar_tint.js`
- Verify: `public/app.js`
- Test: `tests/avatar_tint.test.js`
- Test: `tests/test_avatar_composite.py`
- Test: `tests/test_preview_reliability.py`
- Test: `tests/test_asset_sync.py`

- [ ] **Step 1: Run complete automated verification**

Run:

```powershell
node --test tests\avatar_tint.test.js
python -m unittest tests.test_avatar_composite tests.test_preview_reliability tests.test_asset_sync -v
node --check public\avatar_tint.js
node --check public\app.js
```

Expected: nine Node tests pass, all Python regression tests pass, and both
syntax checks exit successfully.

- [ ] **Step 2: Verify Tone 6 normal face in localhost**

Reload:

```text
http://127.0.0.1:5000/?expression-semantic-shading=1
```

Select Tone 6 and Normal. Sample the 128 by 128 avatar canvas at the
corresponding scaled pixel centers and verify:

```text
upper eye border = rgb(230, 176, 153)
lower eye shadow = rgb(230, 230, 230)
mouth             = rgb(120, 92, 80)
eye white         = rgb(255, 255, 255)
pupil             = rgb(0, 0, 0)
```

- [ ] **Step 3: Verify regression behavior**

Select Angry and confirm its colored details remain visible. Use Reset and
confirm White plus Normal are selected. Read browser console logs and require
zero warnings or errors.

## Repository Note

`C:\Users\VICTUS\Downloads\growtopia-explorer` is not a Git repository.
Therefore commit steps are intentionally omitted; no branch, commit, or pull
request operation is available.
