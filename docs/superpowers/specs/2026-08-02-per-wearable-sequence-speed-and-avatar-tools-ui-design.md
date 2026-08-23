# Per-Wearable Sequence Speed and Avatar Tools UI Design

**Date:** 2026-08-02  
**Status:** Awaiting written-spec approval  
**Scope:** Growtopia Set Planner wearable sequence playback speed, facial expression buttons, and avatar action/export controls

## Checkpoint

A fresh pre-change backup was created before source edits for this design:

- `C:\Users\VICTUS\Documents\Codex\2026-08-02\growtopia-explorer\backups\wearable-ui-checkpoint-20260802-053709.zip`
- Size: `250005831` bytes
- SHA-256: `D994A5B37EFFD3C1C0D24A7C9E4F37C067BD1FE1687265250BB119E548A980D5`

No source implementation changes are part of this spec.

## Goal

Make wearable animation playback more controllable and make the Set Planner controls easier to understand:

- let users set animation speed in milliseconds per animated wearable;
- replace facial-expression emoji labels with actual expression PNG previews;
- redesign the crowded action/export buttons so the main action is clear and advanced exports are tucked away without removing existing functionality.

## Confirmed UX

### Per-wearable sequence speed

Animated wearable controls include a compact sequence-speed control when the selected wearable has a valid sequence. The control appears alongside the existing play/pause, previous, scrubber, next, and frame counter controls.

The speed control uses:

- minus button;
- numeric input;
- plus button;
- visible `ms` unit label.

The value contract is:

- minimum: `50 ms`;
- maximum: `2000 ms`;
- step: `10 ms`;
- default: `150 ms`;
- persisted per wearable item ID.

Changing speed updates preview playback immediately for that wearable only. It does not change the currently selected frame, does not reset other animated wearables, and does not affect exported ZIP frame counts. Export still writes the actual sequence frames; `intervalMs` is preview playback state only.

Static items and items without a valid sequence do not show the speed control.

### Facial expression PNG previews

Facial-expression buttons no longer use emoji. Each button contains:

- a small PNG preview of the actual expression that will be applied;
- the expression name as text.

The expression list remains:

- Normal;
- Happy;
- Angry;
- Surprised;
- Wink;
- Sleeping;
- Derp.

The preview is generated from the same expression source and coordinates used by the avatar renderer so the button preview matches the applied face. If the current avatar skin tint affects the rendered expression, the preview is regenerated when the tint changes.

Each preview has fixed dimensions, pixelated rendering, and an accessible text label. Active, hover, focus, and disabled states remain visually clear. No structural emoji remain in the expression control.

### Action and export controls

The action area is split into two groups:

- set controls;
- export controls.

Set controls remain visible and concise:

- `Random Set`;
- `Reset Set`;
- `Reset Positions`.

Export controls use the selected option A layout:

- the primary visible export action is `Download Set PNG`;
- advanced ZIP exports live under a `More export options` disclosure.

The expanded advanced export list contains:

- `Download Separate Layers ZIP`;
- `Download Selected Sequence ZIP`;
- `Download All Equipped Sequences ZIP`.

Sequence ZIP actions are disabled when no valid animated wearable sequence is available. Disabled states must be obvious and must not look broken. The layout uses consistent spacing, one primary call to action, and responsive wrapping so the controls do not feel spammy on desktop or mobile.

`Reset Positions` is visually separated from download/export actions because it changes the workspace state instead of producing a file.

## State Contract

Wearable sequence UI state stores `intervalMs` per item. Older persisted state that does not include `intervalMs` normalizes to `150`.

The normalized per-item state supports:

- `playing`;
- `paused(frameIndex)`;
- `intervalMs`.

Invalid persisted values are normalized:

- non-numeric values fall back to `150`;
- values below `50` clamp to `50`;
- values above `2000` clamp to `2000`;
- values between bounds round to the nearest supported `10 ms` step.

Frame index and playback mode continue to normalize according to the existing sequence state rules.

## Playback Runtime

The runtime must support multiple equipped animated wearables playing at different speeds at the same time. A single fixed `150 ms` interval is no longer sufficient.

The playback loop resolves the visible frame for each animated wearable from that wearable's own state. Changing one item's `intervalMs` updates only that item's playback timing. Paused items remain paused.

The implementation must preserve the currently visible frame when speed changes by adjusting that wearable's local playback timing rather than restarting every animation from frame zero.

## Rendering Contract

Expression previews use PNG image output. The implementation may use generated data URLs from a canvas as long as the rendered button contains an image element with a PNG source and the output is based on the same sprite coordinates as the avatar expression renderer.

Sequence speed affects canvas preview playback only. It does not alter:

- item manifests;
- sequence descriptors;
- frame source rectangles;
- selected/exported PNG dimensions;
- ZIP file structure;
- export frame order.

## Accessibility and Responsiveness

All new controls have visible labels or accessible names.

The UI must support:

- keyboard focus states;
- touch targets at least `44px` high where practical;
- no horizontal overflow at narrow mobile widths;
- no button text clipping;
- predictable disabled states;
- reduced-motion friendliness by avoiding extra decorative animation.

The speed input exposes its bounds and step through native input attributes where possible.

## Testing

### Sequence state tests

- Missing `intervalMs` defaults to `150`.
- Values clamp to `50` and `2000`.
- Values round to a `10 ms` step.
- `intervalMs` persists independently per item ID.
- Changing speed preserves play/pause state and selected frame.

### Runtime playback tests

- Two animated wearables can advance at different intervals.
- Paused items do not advance while another item plays.
- Updating one item's interval does not mutate another item's state.
- Malformed persisted state cannot break playback.

### Expression UI tests

- Expression buttons render image previews, not emoji labels.
- Each expression preview uses the expected expression ID/source coordinate.
- Active expression state remains visible.
- Skin-tint or avatar-color changes refresh the preview when applicable.

### Action/export UI tests

- `Download Set PNG` remains the primary visible export button.
- ZIP exports are reachable through `More export options`.
- Existing export handlers still fire for all export types.
- Sequence ZIP buttons disable when no valid sequence exists.
- Reset/random handlers still call their existing behavior.

### Browser acceptance

- Equip an animated wearable such as Aurora Robe and verify the speed control appears.
- Set a custom interval, play, pause, reload, and confirm the value persists for that wearable.
- Equip a second animated wearable, set a different interval, and confirm both previews use their own timing.
- Switch expressions and confirm the buttons show PNG previews matching the applied expression.
- Expand advanced exports and verify all previous ZIP actions are still available.
- Check desktop and mobile widths for no overlap, clipping, or console errors.

## Completion Criteria

- A verified pre-change backup exists and is referenced in this spec.
- Animated wearables support persisted per-item `intervalMs`.
- The fixed global `150 ms` preview assumption is removed from sequence playback.
- Facial-expression buttons use PNG previews and no emoji labels.
- Action/export buttons follow the approved option A layout.
- Existing export and reset functionality remains available.
- Automated tests and browser acceptance pass.

## Non-Goals

- Changing sequence descriptors or reclassifying wearable animations.
- Changing exported sequence timing metadata; exports remain frame-based PNG output.
- Redesigning unrelated Item Explorer or catalog UI.
- Adding new expression types beyond the existing seven expression IDs.
