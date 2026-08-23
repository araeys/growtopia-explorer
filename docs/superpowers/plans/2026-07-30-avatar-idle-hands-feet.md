# GT Avatar Canonical Idle Body Implementation Plan

**Goal:** Replace the incorrectly assembled arm and footwear layers with the
official default Set Planner idle body.

**Architecture:** Use one transparent 32 by 32 canonical body frame extracted
from the embedded official Set Planner default image. Tint and draw it as the
sole body layer, followed by the existing head and semantic facial-expression
layers.

## Task 1: Add Regression Contracts

- [x] Require
  `character_base_assets/gtsetplanner/player_idle_body.png`.
- [x] Reject `player_arm.png` and `player_feet.png` as base textures.
- [x] Verify the canonical PNG is 32 by 32.
- [x] Verify close-arm and bare-foot alpha geometry.
- [x] Verify one tinted body draw before the head and facial expression.
- [x] Preserve the existing equipment order.
- [x] Run the focused suite and observe the expected RED state before changing
  the renderer.

## Task 2: Extract and Integrate the Official Frame

- [x] Decode the embedded default image from `gtsetplanner_src/script.js`.
- [x] Extract native rows 16 through 31 from the official 32 by 32 player canvas.
- [x] Convert the black background to transparency while preserving grayscale
  shading.
- [x] Save the result as
  `public/character_base_assets/gtsetplanner/player_idle_body.png`.
- [x] Replace the old body, arm, and feet texture registrations with the
  canonical body path.
- [x] Simplify `drawBasePlayerSkin()` to tint/draw the body and head only.
- [x] Run focused Python tests, JavaScript syntax validation, and semantic tint
  tests.

## Task 3: Regression and Browser Verification

- [x] Run:

  ```powershell
  python -m unittest tests.test_avatar_composite tests.test_preview_reliability tests.test_asset_sync -v
  ```

- [x] Reload `http://127.0.0.1:5000/?expression-semantic-shading=1`.
- [x] Verify White and Tone 6 have close hands and bare feet.
- [x] Verify eye and mouth semantic shading remains correct.
- [x] Equip one Feet item and one Hand item to verify coverage.
- [x] Reset to the completed White + Normal character.

This project is not a Git repository, so the verified changes remain in place
without a commit step.
