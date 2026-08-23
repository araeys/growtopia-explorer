# Complete Wearable Sequence Audit and Compact Controls Design

**Date:** 2026-08-02  
**Status:** Awaiting written-spec approval  
**Scope:** Growtopia Set Planner wearable sequence classification, playback controls, rendering, persistence, and sequence export

## Goal

Classify every one of the 4,029 wearable items as animated, static, or quarantined; remove the incomplete `review_required` state; restore valid sequences such as Aurora Robe; and replace the inefficient per-frame button list with a compact playback control bar.

This design preserves the existing verified content-addressed backup. It does not create another snapshot.

## Confirmed UX

The selected animated item uses one compact row:

`▶/❚❚ · ‹ · scrubber · › · current/total`

- `▶` starts automatic playback from the selected frame.
- `❚❚` pauses on the currently visible frame.
- `‹` and `›` pause playback and select the previous or next frame.
- Moving the scrubber pauses playback and selects that frame.
- Previous and next wrap at the sequence boundaries.
- The counter uses one-based display values, for example `3 / 8`.
- Arrow-key control is available when the scrubber or step controls have focus.
- Static items show a compact static-state message and no disabled sequence controls.
- Accessible names describe Play sequence, Pause sequence, Previous frame, Next frame, and Select frame.

The persisted playback model remains per item. The internal states are `playing` and `paused(frameIndex)`; the UI does not expose the previous Auto, Off, or individual Frame button labels.

## Classification Architecture

The generator processes all 4,029 wearable audit records. Every item must finish in exactly one terminal class:

1. `animated`: an explicit, validated sequence descriptor exists.
2. `static`: the base tile is intentional and adjacent tiles are not part of this wearable.
3. `quarantined`: the available evidence is unsafe, incomplete, blank-looking, discontinuous, or outside the source texture.

`review_required` is an intermediate audit queue only. A completed generation fails if any item remains in that queue.

### Evidence collection

For every candidate horizontal run, the audit records:

- explicit source texture, base tile, and candidate tile coordinates;
- alpha-mask overlap and alpha-bound continuity between adjacent frames;
- pixel/color similarity and changed-pixel ratios;
- empty-tile boundaries before and after the run;
- tiny or blank-looking frames;
- source-rectangle bounds;
- wearable slot and render profile;
- legacy-map evidence, existing override evidence, and visual-review decision.

No single similarity threshold is authoritative. A high-confidence score can promote a candidate into the visual-confirmation queue, but the final classification also requires boundary, alpha, source-bounds, and semantic checks.

### Hybrid full audit

- Existing validated legacy descriptors remain animated unless new evidence invalidates them.
- Known risky entries remain quarantined unless an explicit reviewed override replaces the quarantine.
- High-confidence unmapped candidates receive generated contact sheets and a proposed frame run.
- All remaining unmapped candidates also receive contact sheets and are visually classified one by one.
- Each reviewed decision is stored in a deterministic override file with item ID, class, explicit coordinates when animated, and a short evidence note.
- Overrides are sorted numerically by item ID.
- Aurora Robe `#15078` is a confirmed `replace-frame` sequence with eight frames at horizontal offsets `dx=0..7`, `dy=0` from base tile `(3, 23)` in `player_cosmetics3.png`.

## Descriptor Contract

Runtime rendering accepts only explicit descriptors:

- `replace-frame`: each frame replaces the previous wearable tile.
- `base-plus-overlay`: a fixed base tile is drawn first; each sequence frame is either an explicit overlay tile or `null` for a base-only frame.

Every non-null draw-plan entry contains explicit integer `dx`, `dy`, and role values. A descriptor such as `frames: [null, {"dx": 1, "dy": 0}]` represents base-only followed by base plus a sparkle/effect tile. The generator validates every resolved source rectangle against the actual texture dimensions. Runtime code must never derive a sequence with `tx + currentFrame` unless that exact offset already exists in a validated descriptor.

Static and quarantined items have no runtime descriptor and render only their manifest base tile.

## Data Flow

1. Read the full wearable audit, legacy descriptors, and reviewed overrides.
2. Recompute evidence for all candidate runs.
3. Produce contact sheets and the intermediate review queue.
4. Record a terminal decision for each queued item.
5. Generate the explicit descriptor map and validation report.
6. Fail generation unless all 4,029 items have exactly one terminal classification and `review_required` is zero.
7. Load the generated descriptors in the Set Planner.
8. Resolve the current draw plan from descriptor plus persisted playback state.
9. Use the same draw-plan resolver for canvas preview and sequence ZIP export.

## Error Handling

- A frame outside texture bounds rejects the descriptor during generation.
- Missing textures, blank-looking frames, or severe discontinuity produce a quarantine decision with recorded reasons.
- Malformed persisted playback state normalizes to playing from frame zero.
- A descriptor rejected at runtime is logged once by item ID and the item falls back to its base tile.
- Empty or static selections cannot initiate sequence ZIP export and show a concise status message.
- The renderer never substitutes an adjacent tile after a validation failure.

## Testing

### Generator tests

- Aurora Robe produces exactly eight `replace-frame` entries.
- Magic Magnet preserves its validated `base-plus-overlay` contract.
- Known false-positive items remain static.
- Blank, discontinuous, missing-texture, and out-of-bounds runs are quarantined.
- Every audited item receives exactly one terminal classification.
- `review_required` is zero.
- Two fresh generations produce byte-identical descriptor and validation files.

### Playback tests

- Play/pause toggles a single control state.
- Previous, next, and scrubber input pause at the chosen frame.
- Previous and next wrap correctly.
- Frame values are clamped when persisted data is malformed.
- Playback and paused frame persist independently per item.
- The compact control remains usable for both two-frame and long sequences.

### Integration and browser acceptance

- Equip Aurora Robe and verify all eight distinct frames.
- Verify Magic Magnet base-plus-overlay playback.
- Verify one known static item never displays neighboring tiles.
- Pause, scrub, step, reload, and confirm persisted state.
- Export selected and all-equipped sequences; inspect manifest paths, frame counts, 192×192 dimensions, and nonblank alpha bounds.
- Confirm no console errors and no failed texture requests during the acceptance path.

## Completion Criteria

- All 4,029 wearables have one terminal classification.
- The validation report contains zero `review_required` entries.
- Aurora Robe is present as an eight-frame animated wearable.
- The compact icon playback control replaces the per-frame button list.
- Preview and export share the same explicit draw-plan logic.
- Automated suites, deterministic generation, and browser acceptance all pass.
- The existing verified backup remains the only pre-change snapshot.

## Non-Goals

- Guessing animation at runtime.
- Treating every non-empty adjacent tile as a frame.
- Redesigning unrelated Item Explorer or Set Planner features.
- Creating another backup when the verified snapshot already covers the pre-change files.
