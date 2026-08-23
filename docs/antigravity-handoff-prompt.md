# Antigravity Handoff Prompt

You are working on `C:\Users\VICTUS\Downloads\growtopia-explorer`.

Be careful. This project has a lot of sprite data, generated manifests, avatar rendering logic, and UI contracts. Do not casually refactor broad files, do not delete generated data, and do not rewrite the UI from scratch. Make the smallest correct change and prove it works.

## Current Important Context

The latest safe checkpoint backup is:

`C:\Users\VICTUS\Documents\Codex\2026-08-02\growtopia-explorer\backups\wearable-ui-checkpoint-20260802-053709.zip`

SHA-256:

`D994A5B37EFFD3C1C0D24A7C9E4F37C067BD1FE1687265250BB119E548A980D5`

Do not overwrite or delete that backup. If you need a new risky change, create a new backup first.

The Downloads folder also has project ZIPs organized here:

`C:\Users\VICTUS\Downloads\Growtopia Explorer Backups`

## What Was Recently Implemented

- Per-wearable animation preview speed.
- Speed range: `50` to `2000` ms.
- Step: `10` ms.
- Default: `150` ms.
- Speed persists per wearable item ID.
- Aurora Robe `#15078` is confirmed animated with 8 frames.
- Magic Magnet `#8304` is also animated and was used to verify separate per-item speed.
- Facial expression buttons now use PNG previews generated from the real `player_eyes.png` sprite, not emoji.
- Skin tone changes refresh expression preview PNGs.
- Avatar action buttons now use:
  - primary visible `Download Set PNG`;
  - advanced ZIP exports under `More export options`;
  - `Random Set`, `Reset Set`, and `Reset Positions` grouped separately.
- Cache buster was bumped to `wearable-ui-speed-v3` because Chrome was still caching old `app.js`.

## Files Most Likely In Scope

- `public/wearable_sequence.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `tests/wearable_sequence.test.js`
- `tests/test_avatar_composite.py`

Do not change unrelated data files, spritesheets, generated manifests, or bulk asset folders unless the task explicitly requires it.

## Guardrails

Before changing anything:

1. Read the current files above.
2. Understand the existing code path.
3. Do not guess based on UI screenshots alone.
4. Preserve existing IDs and handlers unless there is a concrete reason.
5. Do not remove:
   - wearable inventory rendering;
   - avatar canvas rendering;
   - generated wearable manifest loading;
   - sequence export ZIP handlers;
   - expression tinting;
   - `wearable-ui-speed-v3` cache busting.

During implementation:

1. Make one focused change at a time.
2. Prefer fixing the root cause, not symptoms.
3. Keep UI changes scoped to the avatar tools drawer unless asked otherwise.
4. Do not replace the whole layout with a new design.
5. Do not use broad find/replace across the project.
6. Do not delete or regenerate sprite data unless there is a written reason and a backup.
7. If changing JS/CSS loaded by the browser, bump the cache query string in `public/index.html`.

## Required Verification

Run these after every meaningful change:

```powershell
node --test tests/wearable_sequence.test.js
python -m unittest tests.test_avatar_composite
```

Expected current baseline:

- Node sequence tests: `16 pass`
- Python avatar contract tests: `33 pass`

Then verify in browser at:

`http://127.0.0.1:5000/`

Manual checks:

1. Open `GT Set Planner / Avatar Studio`.
2. Open Avatar Tools.
3. Confirm facial expressions show PNG previews and text labels only.
4. Confirm no old emoji expression buttons appear.
5. Search and equip `Aurora Robe`.
6. Confirm selected sequence controls show 8 frames and an `ms` speed input.
7. Set Aurora Robe speed to `80`, reload, confirm it stays `80`.
8. Search and equip `Magic Magnet`.
9. Set Magic Magnet speed to `300`, then select Aurora again and confirm Aurora still shows `80`.
10. Confirm `Download Set PNG` is the main export button.
11. Confirm `More export options` contains the ZIP exports.
12. Confirm browser console has no errors.

If Chrome still shows old UI after changes, do not rewrite the app. First check cache busting in `public/index.html`, then use hard refresh.

## If Something Breaks

Stop immediately and report:

- exact file changed;
- exact error;
- exact test failure;
- browser console error if any;
- whether the issue reproduces after hard refresh.

Do not stack random fixes. Restore from the checkpoint only if asked by the user.
