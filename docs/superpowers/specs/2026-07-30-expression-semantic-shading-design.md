# GT Expression Semantic Shading Design

## Goal

Match the supplied Growtopia reference for the normal face at every semantic
pixel group:

- upper eye-border skin pixels follow the selected skin color;
- lower and side eye-shadow pixels remain neutral gray;
- eye whites and pupils retain their source colors;
- mouth pixels use the darker Growtopia facial-line shade;
- nose rendering and equipment layer ordering remain unchanged.

## Verified Root Cause

The current helper classifies pixels only by RGBA value. In the normal
`player_eyes.png` tile, the same opaque gray value `(230, 230, 230)` represents
three different semantic roles:

1. skin-colored eye border in tile rows 3 and 4;
2. neutral eye shadow in tile rows 5 through 7;
3. the mouth in tile rows 12 and 13.

A color-only rule cannot distinguish those roles. It currently multiplies all
three by the selected skin color, leaving the mouth too light and incorrectly
coloring neutral eye-shadow pixels.

For Tone 6 (`#FFC3AA`), the supplied reference confirms these exact center
pixel results:

- eye-border skin: `(230, 176, 153)`;
- neutral eye shadow: `(230, 230, 230)`;
- mouth: `(120, 92, 80)`;
- eye white: `(255, 255, 255)`;
- pupil: `(0, 0, 0)`.

## Selected Design

Extend the expression-tint helper so it receives tile-local `(x, y)`
coordinates and an expression identifier. For the normal expression:

- grayscale pixels in rows 3 and 4 retain their source intensity and are
  multiplied by the selected skin color;
- grayscale pixels in rows 5 through 7 are preserved unchanged;
- grayscale mouth pixels in rows 12 and 13 are converted to the canonical
  facial-line intensity `120`, then multiplied by the selected skin color;
- pure white, pure black, colored, and transparent pixels are preserved.

Other expressions retain the current grayscale tint behavior until their own
reference-backed semantic masks are defined. This prevents a normal-face fix
from silently changing unrelated expression artwork.

The canvas renderer passes the selected expression identifier into the helper.
No equipment slot, equipment classification, nose coordinate, or layer order
changes.

## Testing

Automated tests must prove that normal-expression pixels produce:

- tinted skin border at an upper-eye coordinate;
- unchanged neutral gray at lower/side eye-shadow coordinates;
- dark skin-relative mouth shade at mouth coordinates;
- unchanged white, black, colored, and transparent pixels;
- unchanged legacy tint behavior for a non-normal expression.

Browser verification must compare Tone 6 normal rendering against the supplied
reference and confirm the three exact output colors above. It must also check
one non-normal expression and confirm zero browser console errors.

## Out of Scope

- Nose changes.
- Equipment layer-order changes.
- Repainting source PNG files.
- Guessing semantic masks for expressions without reference evidence.
