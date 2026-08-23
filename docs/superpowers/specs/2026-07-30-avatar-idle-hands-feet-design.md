# GT Avatar Canonical Idle Body Design

## Goal

Match the official Growtopia Set Planner idle character exactly:

- arms and hands remain close to the torso;
- lower legs end in bare skin feet, not shoe sprites;
- all exposed body pixels follow the selected skin color;
- the approved semantic eye and mouth shading stays unchanged;
- equipped clothing and hand items remain above the base body.

The result stays a 32 by 32 native frame scaled pixel-perfectly to the existing
128 by 128 preview canvas.

## Authoritative Source

The canonical idle body is extracted from the default player image embedded in
`gtsetplanner_src/script.js`. The official player occupies an 88 by 128 region
inside a 128 by 128 canvas, equivalent to the expected 22 by 32 native sprite.

`public/character_base_assets/gtsetplanner/player_idle_body.png` stores the
official torso, close arms, hands, lower legs, and bare feet in one transparent
32 by 32 image. Its grayscale values are preserved so the existing
multiplicative tint path retains highlights and shadows.

The following files are deliberately not used for default limbs:

- `tilesheets/player_arm.png`, because independently placing and mirroring it
  produces arms that sit too far from the torso;
- `tilesheets/player_feet.png`, because it is a cosmetic footwear animation
  sheet, not the default bare skin legs.

The head still comes from `tilesheets/player_head.png`. Facial features still
come from `character_base_assets/gtsetplanner/player_eyes.png`.

## Composition and Layer Order

`drawBasePlayerSkin()` tints and draws the full canonical idle body at native
origin `(0, 0)`, then draws the tinted head at the same origin. It does not crop,
mirror, translate, or independently position limb textures.

The complete renderer order is:

1. Clear preview.
2. Equipped `Back` item.
3. Tinted canonical idle body.
4. Tinted head.
5. Selected semantic facial expression.
6. Equipped items in the existing order:
   `Feet`, `Pants`, `Shirt`, `Chest`, `Face`, `Hair`, `Hat`, `Hand`.

This keeps shoes, pants, shirts, chest cosmetics, and hand items above the bare
base character without special-case masking.

## Testing

Automated tests must prove that:

- the canonical idle body exists and is exactly 32 by 32;
- close-hand pixels exist while the former far-out arm pixels are transparent;
- lower-leg and bare-foot pixels exist at the official native coordinates;
- `player_arm.png` and `player_feet.png` are absent from the base texture map;
- one tinted canonical body is drawn before the head and semantic expression;
- equipment ordering remains unchanged.

Browser verification must confirm White and Tone 6 both match the official
silhouette, with close hands, bare feet, correct skin tint, correct face shading,
working equipment coverage, working Reset, and no new console errors.

## Out of Scope

- Hand gesture selection.
- Walk animation.
- Equipment classification changes.
- Canvas-size or preview-scale changes.
