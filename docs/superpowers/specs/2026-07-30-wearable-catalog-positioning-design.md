# Wearable Catalog and Per-Item Positioning Design

## Goal

Replace the current name-keyword clothing classification with a complete,
maintainable wearable catalog. Every supported wearable must appear in its
correct Set Planner slot, randomized sets must only select compatible items,
and users must be able to nudge an equipped item without changing the source
asset or every other item in that slot.

## Root Causes

The current planner decides slots from partially corrupted item names and broad
category labels. This puts unrelated sprites into Hat, Hair, Face, and other
slots. It also limits every slot dropdown to the first 400 matches.

The renderer already crops the local player spritesheet cell identified by the
item database and draws it on the common 32 by 32 avatar coordinate system.
Those sprites normally contain their intended in-cell positioning, so globally
centering their opaque pixels would damage wide, asymmetric, or intentionally
offset wearables.

The locally installed game currently exposes 3,983 action-20 records. The
official Set Planner metadata supplies clean names and authoritative slot types
for 3,948 wearable records, while newer records require a local fallback.

## Selected Approach

Use a generated local hybrid manifest:

1. Official Set Planner metadata is the authoritative source for clean item
   names and slot types when an item ID is present.
2. Local `items.dat` and converted spritesheets remain authoritative for item
   ID, decrypted name, texture filename, player-sprite coordinates, animation
   metadata, clothing type, and asset availability.
3. Wearable records absent from the official metadata are classified from the
   exact local `clothing_type` enum.
4. Ambiguous records are listed in a validation report and excluded from random
   selection until a small explicit override resolves them.

The runtime web app reads the generated manifest only. It must not require an
internet connection or parse `items.dat` in the browser. Catalog generation
stores the downloaded official metadata as a dated source snapshot, so the
checked result is reproducible and a temporary upstream outage does not break
an already generated project.

## Catalog Schema

Each generated wearable record contains:

- `id`
- `name`
- `slot`
- `texture`
- `tx`
- `ty`
- `frames`
- `has_anim`
- `classification_source`: `official`, `local_clothing_type`, or `override`
- `classification_confidence`
- `render_profile`, defaulting to `standard_32`

Supported slots are:

1. Back
2. Artifact
3. Feet
4. Pants
5. Shirt
6. Chest
7. Face
8. Hair
9. Hat
10. Hand

Generation is deterministic. Item IDs are unique, slots use a fixed enum, and
items are sorted by clean display name then item ID. The generator emits a
summary with counts per slot, unresolved IDs, missing textures, invalid crop
coordinates, and duplicate IDs.

## Classification Rules

Official `Type` wins whenever available. Fallback classification uses exact
local `clothing_type` values: `0=Hat`, `1=Shirt`, `2=Pants`, `3=Feet`,
`4=Face`, `5=Hand`, `6=Back`, `7=Hair`, and `8=Chest`. Artifact remains an
official metadata classification because the local enum represents its
underlying attachment slot. Classification must not use fuzzy name keywords or
blanket rules for mixed cosmetics sheets.

Overrides are data, not renderer branches. They are reserved for exceptional
or newly released items and remain small enough to review.

## Planner UI

Every slot row contains:

- its item selector;
- a compact four-direction nudge pad;
- current `X` and `Y` offset values;
- a `Reset Position` control.

Position controls are disabled while the slot is empty. One press moves the
equipped sprite by one source pixel, which appears as four screen pixels in the
current 4x preview. Holding a direction may repeat, but each stored value
remains an integer source-pixel offset.

Artifact receives a visible row like the other slots. Dropdowns expose the full
slot catalog and show clean names with item IDs. Searchable selectors are
preferred if the existing native selects become impractical, but catalog
correctness is not allowed to depend on UI virtualization.

## Position State and Persistence

Offsets are stored per slot and item ID:

```text
positionOverrides[slot][itemId] = { x, y }
```

Moving one hat therefore does not move other hats. Switching away and back
restores that item's saved offset. Reset Position deletes only the active
item's override. Reset Set unequips the set and restores skin/expression
defaults but does not erase the user's saved item positioning. A separate
`Reset All Positions` action clears all saved offsets after explicit user
activation.

Position overrides are persisted in `localStorage` under a versioned key.
Malformed, non-integer, or out-of-range values are ignored. Offsets are clamped
to a conservative range so an item cannot become permanently unreachable.

## Rendering and Layer Order

All layer behavior is declared in one ordered configuration rather than
duplicated arrays:

1. Back
2. Artifact behind-base profile, when applicable
3. Base body and head
4. Facial expression
5. Feet
6. Pants
7. Shirt
8. Chest
9. Face
10. Hair
11. Hat
12. Hand item
13. Front-left base hand

The default wearable crop remains one 32 by 32 player-sprite cell. The item
offset changes only the destination position. It never mutates `tx`, `ty`, the
source PNG, or other items.

The manifest assigns named render profiles to proven special cases. Render
profiles are declarative crop, scale, and layer-phase rules; the compositor
must not accumulate item-ID conditionals. This design does not infer placement
from opaque-pixel bounding boxes.

## Randomize and Reset Behavior

Random Set chooses at most one item from each visible slot's validated catalog.
It does not select unresolved, missing-texture, or invalid-crop records.
Randomization resets the active set's temporary equipment choices but preserves
saved per-item offsets.

All slot iteration, rendering, randomization, reset, and equipped-chip display
must share the same slot configuration.

## Failure Behavior

- If the manifest cannot load, the planner shows a clear catalog error and
  keeps the base character usable.
- A missing wearable texture skips that layer and reports its item ID once.
- An invalid saved offset falls back to `{x: 0, y: 0}`.
- Unresolved items remain visible in the generated validation report but do not
  silently enter the wrong slot.

## Verification

Automated tests must prove that:

- all official records map to their authoritative slot;
- every manifest record has a valid slot and unique item ID;
- local fallback maps all clothing-type enum values without item-name
  substrings or spritesheet guesses;
- catalog generation produces the same manifest from the same local game data
  and official source snapshot;
- every referenced texture exists and crop coordinates stay within the image;
- no selector retains the 400-item truncation;
- randomization uses only the requested slot catalog;
- all planner operations consume one shared slot configuration;
- offsets are isolated per item, clamped, resettable, and applied only to the
  destination;
- persistence safely handles missing or malformed storage;
- the front-left base hand remains the final foreground layer.

Browser verification covers:

- representative Hat, Hair, Face, Back, Hand, and Artifact items;
- random sets with no cross-slot sprites;
- one-pixel movement in all four directions;
- item switching and refresh persistence;
- per-item reset, set reset, and reset-all behavior;
- PNG export matching the visible preview.

## Out of Scope

- Repainting or regenerating Growtopia wearable artwork.
- Automatically centering sprites from their alpha bounds.
- Reproducing animation or special visual effects not represented by the
  existing static player-sprite cell.
- Cloud accounts or server-side storage for personal offsets.
