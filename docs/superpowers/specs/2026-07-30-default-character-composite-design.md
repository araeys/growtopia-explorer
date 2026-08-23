# GT Set Planner Default Character Composite Design

## Goal

Repair the default GT Set Planner preview so it matches the normal Growtopia
character pose: a complete head and body with the selected facial expression.
Skin colors and expression choices must remain dynamic. Equipment layer ordering
is explicitly deferred to a later task.

## Root Cause

The current renderer draws `player_body_only.png` and then
`player_eyes.png`. The body texture contains only the torso and legs, so the
facial expression is rendered above a headless body. The available
`player_head.png` texture is never used.

## Selected Approach

Compose the default character at runtime from the official extracted textures:

1. `tilesheets/player_body_only.png`
2. `tilesheets/player_head.png`
3. `character_base_assets/gtsetplanner/player_eyes.png`

The body and head use the first 32 by 32 frame and receive the same selected skin
tint. The expression remains untinted and uses the existing expression-to-frame
mapping.

## Render Flow

The base-character renderer requests all three images through the shared image
loader. It does not paint a partial character while any required base texture is
still loading.

Once all textures are ready, the 128 by 128 planner canvas is rendered with
pixel smoothing disabled:

1. Clear canvas.
2. Draw an equipped back item if present, preserving current behavior.
3. Draw the tinted body frame.
4. Draw the tinted head frame above the body.
5. Draw the selected facial expression.
6. Draw existing equipment using the current order without changing that order.

Each 32 by 32 source frame is scaled to 128 by 128.

## Loading and Failure Behavior

- Reuse the existing Promise-based shared texture loader.
- Trigger one avatar rerender after all required base images resolve.
- Do not display a knowingly incomplete headless character during loading.
- If a required base texture fails, keep the canvas clear for that base and log
  the failed texture path. Do not substitute unrelated cosmetic textures.
- A later successful render request may retry after the failed loader entry has
  been cleared.

## Testing

Automated regression tests must prove that:

- The base renderer references both `player_body_only.png` and
  `player_head.png`.
- It waits for both skin layers and the expression texture.
- Body is drawn before head, and head before expression.
- The selected skin color is applied to both body and head.
- Existing equipment order is unchanged.
- All referenced texture files exist and are valid PNG images.

Browser verification must confirm:

- The default preview has a complete head and body.
- The result visually matches the normal pose supplied by the user.
- Changing skin color affects both head and body.
- Changing expression does not remove the head.
- Reset restores the complete default character.

## Out of Scope

- Changing equipment or clothing layer order.
- Reclassifying item slots.
- Changing the avatar canvas size.
- Replacing the current expression map.
- Generating new Growtopia art assets.
