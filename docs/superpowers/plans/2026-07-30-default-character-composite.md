# GT Set Planner Default Character Composite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a complete default Growtopia character from body, head, and expression textures while preserving dynamic skin colors and expressions.

**Architecture:** Gate avatar painting on a shared Promise load of the three required base textures. Once ready, composite the first 32 by 32 body and head frames with the same tint, then draw the selected untinted expression. Leave the existing equipment order unchanged.

**Tech Stack:** Vanilla JavaScript Canvas 2D, PNG spritesheets, Python `unittest`, local threaded HTTP server, in-app browser QA.

---

### Task 1: Add Base-Character Regression Contracts

**Files:**
- Create: `tests/test_avatar_composite.py`
- Read: `public/app.js`
- Read: `public/tilesheets/player_body_only.png`
- Read: `public/tilesheets/player_head.png`
- Read: `public/character_base_assets/gtsetplanner/player_eyes.png`

- [ ] **Step 1: Write the failing source and asset tests**

```python
import struct
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
APP_JS = PROJECT_DIR / "public" / "app.js"


def png_dimensions(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"{path} is not a PNG")
    return struct.unpack(">II", data[16:24])


class AvatarCompositeContractTests(unittest.TestCase):
    def test_avatar_base_uses_body_head_and_expression_textures(self):
        source = APP_JS.read_text(encoding="utf-8")
        self.assertIn('"tilesheets/player_body_only.png"', source)
        self.assertIn('"tilesheets/player_head.png"', source)
        self.assertIn(
            '"character_base_assets/gtsetplanner/player_eyes.png"',
            source,
        )
        self.assertIn("function ensureAvatarBaseTextures()", source)
        self.assertIn("Promise.all", source)

    def test_base_composite_draws_body_before_head(self):
        source = APP_JS.read_text(encoding="utf-8")
        self.assertIn("function drawBasePlayerSkin(", source)
        section = source[
            source.index("function drawBasePlayerSkin("):
            source.index("function drawPlayerFacialExpression(")
        ]
        self.assertLess(
            section.index("ctx.drawImage(tintedBody"),
            section.index("ctx.drawImage(tintedHead"),
        )
        self.assertGreaterEqual(section.count("tintTile("), 2)

    def test_equipment_order_is_unchanged(self):
        source = APP_JS.read_text(encoding="utf-8")
        self.assertIn(
            'const clothesOrder = ["Feet", "Pants", "Shirt", "Chest", '
            '"Face", "Hair", "Hat", "Hand"];',
            source,
        )

    def test_required_base_pngs_exist_and_contain_32px_frames(self):
        paths = (
            PROJECT_DIR / "public" / "tilesheets" / "player_body_only.png",
            PROJECT_DIR / "public" / "tilesheets" / "player_head.png",
            PROJECT_DIR / "public" / "character_base_assets"
            / "gtsetplanner" / "player_eyes.png",
        )
        for path in paths:
            with self.subTest(path=path.name):
                width, height = png_dimensions(path)
                self.assertGreaterEqual(width, 32)
                self.assertGreaterEqual(height, 32)
                self.assertEqual(0, width % 32)
                self.assertEqual(0, height % 32)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
```

Expected: the asset checks pass, while renderer contracts fail because
`player_head.png`, `ensureAvatarBaseTextures()`, and `drawBasePlayerSkin()` are
not yet present.

### Task 2: Load and Composite the Complete Base Character

**Files:**
- Modify: `public/app.js:42-59`
- Modify: `public/app.js:901-1018`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add base texture constants and load state**

Add beside `plannerState`:

```javascript
const AVATAR_BASE_TEXTURE_PATHS = {
  body: "tilesheets/player_body_only.png",
  head: "tilesheets/player_head.png",
  expression: "character_base_assets/gtsetplanner/player_eyes.png"
};
let avatarBaseLoadPromise = null;
```

- [ ] **Step 2: Gate the canvas on complete base asset loading**

Add:

```javascript
function ensureAvatarBaseTextures() {
  const paths = Object.values(AVATAR_BASE_TEXTURE_PATHS);
  const allReady = paths.every(path => {
    const image = textureImageCache[path];
    return image && image.complete && image.naturalWidth > 0;
  });
  if (allReady) return true;

  if (!avatarBaseLoadPromise) {
    avatarBaseLoadPromise = Promise.all(paths.map(loadTextureImage))
      .then(() => {
        avatarBaseLoadPromise = null;
        renderAvatarCanvas();
      })
      .catch(error => {
        avatarBaseLoadPromise = null;
        paths.forEach(path => delete textureImageCache[path]);
        console.error("Gagal memuat base character:", error);
      });
  }
  return false;
}
```

Immediately after clearing the avatar canvas, return while the three base
textures are incomplete:

```javascript
ctx.clearRect(0, 0, 128, 128);
if (!ensureAvatarBaseTextures()) return;
```

- [ ] **Step 3: Replace the body-only renderer with a complete skin composite**

Replace `drawBasePlayerSkinBody()` with:

```javascript
function drawBasePlayerSkin(ctx, colorHex) {
  const bodyImage = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.body];
  const headImage = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.head];
  const tintedBody = tintTile(bodyImage, 0, 0, 32, 32, colorHex);
  const tintedHead = tintTile(headImage, 0, 0, 32, 32, colorHex);

  ctx.drawImage(tintedBody, 0, 0, 32, 32, 0, 0, 128, 128);
  ctx.drawImage(tintedHead, 0, 0, 32, 32, 0, 0, 128, 128);
}
```

Update `renderAvatarCanvas()` to call:

```javascript
drawBasePlayerSkin(ctx, plannerState.skinColorHex);
drawPlayerFacialExpression(ctx, plannerState.expression);
```

Update `drawPlayerFacialExpression()` to read the already-loaded expression
image from `AVATAR_BASE_TEXTURE_PATHS.expression`; retain the current `eyeMap`
and draw coordinates.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
python -m unittest tests.test_avatar_composite -v
node --check public/app.js
```

Expected: four avatar tests pass and JavaScript syntax exits with code 0.

- [ ] **Step 5: Run the full regression suite**

Run:

```powershell
python -m unittest tests.test_avatar_composite tests.test_preview_reliability tests.test_asset_sync -v
```

Expected: ten tests pass with zero failures.

This project is not a Git repository, so no commit step is possible. Preserve
the verified files in place.

### Task 3: Browser Verification Against the Approved Visual

**Files:**
- Verify: `public/app.js`
- Verify: `public/index.html`

- [ ] **Step 1: Reload the existing localhost**

Open or reload:

```text
http://127.0.0.1:5000
```

Select `GT Set Planner / Avatar Studio` and wait for the preview to finish
loading.

- [ ] **Step 2: Verify the default pose**

Confirm visually that the canvas contains:

- A complete large head.
- A connected torso and legs.
- Normal eyes and mouth positioned on the head.
- No floating facial features.

Capture a screenshot for direct comparison with the user-supplied reference.

- [ ] **Step 3: Verify skin tint and expression controls**

Select one visibly different skin tone and confirm that both head and body
change together. Select a non-default expression and confirm the head remains
visible. Press Reset and confirm the complete white default character returns.

- [ ] **Step 4: Verify server resources**

Run:

```powershell
$urls = @(
  "http://127.0.0.1:5000/tilesheets/player_body_only.png",
  "http://127.0.0.1:5000/tilesheets/player_head.png",
  "http://127.0.0.1:5000/character_base_assets/gtsetplanner/player_eyes.png"
)
$urls | ForEach-Object {
  (Invoke-WebRequest -UseBasicParsing -Uri $_ -TimeoutSec 15).StatusCode
}
```

Expected: three `200` responses.
