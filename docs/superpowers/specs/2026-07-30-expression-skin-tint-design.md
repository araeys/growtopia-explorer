# GT Set Planner Expression Skin Tint Design

## Goal

Make the skin-colored pixels carried by facial-expression sprites follow the
selected avatar skin color. Eye whites, teeth, black pupils, and colored facial
details must retain their original colors. Equipment layer ordering remains out
of scope.

## Verified Root Cause

`player_eyes.png` is not a transparent details-only atlas. Its expression tiles
also contain opaque grayscale pixels around the eyes and mouth. The renderer
currently draws the expression tile without tinting it, so those grayscale
pixels overwrite the already-tinted head with gray.

The normal 32 by 32 expression frame contains:

- 43 opaque gray pixels with RGB 230, 230, 230.
- 18 opaque white pixels.
- 8 opaque black pixels.

## Selected Approach

Add a dedicated expression tint operation after cropping the selected 32 by 32
expression frame.

For every opaque pixel:

1. If red, green, and blue are equal and the value is strictly between 0 and
   255, treat it as tintable grayscale facial shading and multiply it by the
   selected skin color.
2. If it is pure white, preserve it for eye whites and teeth.
3. If it is pure black, preserve it for pupils and black line details.
4. If it is not grayscale, preserve it so colored expression details remain
   unchanged.

The tinted expression tile is then drawn over the tinted body and head using
the existing expression coordinates.

## Rendering Flow

The relevant base-character order remains:

1. Tinted body.
2. Tinted head.
3. Selectively tinted expression.

The expression renderer receives `plannerState.skinColorHex` explicitly. No
equipment slot, equipment classification, or equipment draw order changes.

## Testing

Automated tests must prove that:

- The expression renderer receives the selected skin color.
- A gray pixel changes according to the selected skin color.
- Pure white and pure black remain unchanged.
- A saturated colored pixel remains unchanged.
- The expression is still drawn after the head.
- Existing avatar, preview, and asset regression tests remain green.

Browser verification must cover:

- A peach or green skin no longer has gray eye-border or mouth pixels.
- Eye whites remain white.
- Pupils remain black.
- Normal and at least one non-default expression render correctly.
- Reset restores the complete neutral default character.

## Out of Scope

- Nose-specific coordinate masking.
- Equipment layer ordering.
- New facial-expression artwork.
- Pre-generating one expression atlas per skin color.
