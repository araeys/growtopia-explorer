# Front Hand and Expression Neutral Colors Design

## Goal

Correct the remaining Set Planner compositing differences:

- the hand and arm visible on the left side of the preview must be the final,
  front-most character layer;
- eye whites, pupils, teeth, and their neutral grayscale detail pixels must not
  inherit the selected skin color;
- skin-cover pixels around facial features must continue to match the selected
  skin color;
- the approved Normal-expression eye shadow, nose, and dark mouth behavior must
  remain unchanged.

The rules apply to all seven selectable expressions and every skin color.

## Root Cause

The canonical idle body currently contains both arms in one image. It is drawn
before facial features and equipment, so the left-side arm cannot independently
appear in front of later clothing and Hand layers.

The expression tint helper preserves pure white, pure black, colored, and
transparent pixels. For non-Normal expressions it still tints every non-pure
grayscale pixel. The source expression sheet uses neutral grayscale values such
as 230, 212, and 196 inside eyelids, eye shadows, mouth details, and tooth
shadows. Those feature pixels are therefore incorrectly recolored as skin.

## Front-Hand Asset

Create:

`public/character_base_assets/gtsetplanner/player_front_left_hand.png`

The image is a transparent 32 by 32 native frame extracted from the approved
canonical body:

`public/character_base_assets/gtsetplanner/player_idle_body.png`

Only the visible left-side arm and hand are copied. The mask follows the
official silhouette exactly: columns 7 through 10 in rows 19 through 23, then
columns 6 through 11 in rows 24 through 26, then columns 7 through 11 in row
27. Every other pixel is transparent. Source grayscale values and alpha are
copied exactly; no painted or generated pixels are introduced.

The complete body remains unchanged and continues to contain both arms. Drawing
the extracted pixels again at the end raises only the selected arm to the front
without creating gaps in the default body.

## Layer Order

The final renderer order is:

1. Clear the preview.
2. Equipped `Back` item.
3. Tinted canonical idle body.
4. Tinted head.
5. Selected facial expression.
6. Equipped items in the existing order:
   `Feet`, `Pants`, `Shirt`, `Chest`, `Face`, `Hair`, `Hat`, `Hand`.
7. Tinted `player_front_left_hand.png`.

The front-hand layer is always last. It therefore appears above shirts, chest
items, and Hand equipment exactly as requested.

The new image joins the required avatar-base texture map and uses the same
Promise-based loading and cache-retry behavior as the body, head, and expression
textures.

## Expression Color Semantics

The tint helper first preserves these pixels for every expression:

- alpha zero;
- pure white `(255, 255, 255)`;
- pure black `(0, 0, 0)`;
- non-grayscale colored details.

Non-pure grayscale pixels are then classified by expression, coordinate, and
source shade.

### Normal

Retain the approved behavior:

- upper eye skin-cover pixels are tinted;
- lower eye shadow rows 5 through 7 stay neutral;
- mouth rows 12 through 13 use the approved dark skin-relative facial-line
  shade;
- all other grayscale cover pixels are tinted as skin.

### Happy

- upper eye cover rows 3 through 4 are tinted as skin;
- lower eye shadow rows 5 through 7 stay neutral;
- the white smile and teeth stay pure white.

### Angry

- upper brow and eye-cover rows 3 through 4 are tinted as skin;
- lower eye shadow rows 5 through 7 stays neutral;
- the grayscale mouth-detail shade 196 in rows 11 through 14 stays neutral;
- existing colored eye details remain unchanged.

### Surprised

- upper eye-cover rows 2 through 4 are tinted as skin;
- lower eye shadow rows 5 through 8 stays neutral;
- the black open mouth remains pure black.

### Wink

- the grayscale wink stroke at row 4 stays neutral;
- the open eye's upper cover rows 3 through 4 are tinted as skin;
- its lower eye shadow rows 5 through 7 stays neutral;
- grayscale mouth detail in row 13 stays neutral.

### Sleeping

- upper eye-cover rows 3 through 5 are tinted as skin;
- closed-eye strokes in row 6 and lower eyelid pixels in row 7 stay neutral;
- the mouth keeps its original white and black pixels.

### Derp

- grayscale eye feature pixels in rows 5 through 6 stay neutral;
- grayscale tooth-shadow cells in rows 11 and 13 stay neutral;
- grayscale shade 212 used by the side facial/drool detail stays neutral;
- pure white teeth and black tooth separators remain unchanged;
- other grayscale cover pixels are tinted as skin.

The classifier must be explicit and testable. It must not globally preserve all
light grayscale pixels, because that would stop legitimate skin-cover pixels
from following the selected skin color.

## Testing

### Automated

Add failing tests before implementation that prove:

- the front-hand PNG exists, is 32 by 32, contains pixels inside the approved
  native hand area, and is transparent outside it;
- the front-hand texture is loaded and tinted;
- its draw call occurs after the complete equipment loop;
- existing equipment order is unchanged;
- representative skin-cover pixels still tint for every expression tile that
  contains a tintable skin-cover region;
- representative neutral eye, eyelid, mouth, and tooth-detail pixels keep their
  source grayscale values;
- pure white, pure black, colored, and transparent pixels stay unchanged;
- all previous Normal semantic shading tests continue to pass.

### Browser

Verify at least White and Tone 6:

- the left-side hand is above a Shirt, Chest, and Hand item;
- the right-side hand remains in the existing base layer;
- Normal retains the approved eye shadow and dark mouth;
- Happy, Angry, Surprised, Wink, Sleeping, and Derp keep neutral eye and tooth
  colors while their skin-cover pixels follow the selected skin tone;
- Reset returns White + Normal with no equipped items;
- the preview contains no broken-image fallback.

## Out of Scope

- Changing the right-side hand order.
- Adding gestures or arm animation.
- Reclassifying equipment.
- Changing expression coordinates or artwork.
- Changing canvas dimensions or scale.
