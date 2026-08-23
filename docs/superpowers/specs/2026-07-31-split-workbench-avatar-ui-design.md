# Split Workbench Avatar UI Design

## Goal

Replace only the contents of the GT Set Planner tab with a compact Split
Workbench layout inspired by the supplied Growtopia inventory reference. Keep
the existing application header, navigation, wearable manifest, avatar
compositor, layer order, skin tinting, and per-item positioning behavior.

The finished tab must make the avatar easy to inspect while thousands of
wearables remain fast to search, filter, preview, and equip.

It must also provide an animator-grade separate-layer export whose PNG files
reconstruct the visible avatar exactly while preserving every user-defined
wearable position.

## Approved Direction

The user selected **B — Split Workbench**.

- The left pane is a sticky avatar stage.
- The right pane is a searchable, filterable wearable inventory.
- Existing secondary controls move into a wrench-triggered tools drawer.
- The main site header and navigation remain unchanged.
- On narrow screens, the panes stack vertically.

## Desktop Layout

The planner content is one bounded workbench beneath the existing site
navigation.

### Left Preview Pane

- Uses `minmax(320px, 38%)` as the first workbench grid column.
- Uses a black stage with the avatar centered at its current pixel-perfect
  scale.
- Remains sticky within the viewport while the inventory pane scrolls.
- Shows compact equipped-item chips below the stage.
- Provides a 44-by-44-pixel wrench button in the top-left corner.
- Shows the current editing target and its saved `X/Y` offset near the wrench
  button when an item is selected.

### Right Inventory Pane

- Occupies the remaining workbench width.
- Starts with one toolbar containing:
  - a visible search label and search field;
  - an `All` plus ten-slot filter;
  - a result count;
  - a compact clear-search action.
- Shows a dense responsive grid of square wearable cards.
- Each card contains the actual sprite preview, item name, and item ID.
- The currently equipped item receives a cyan selected border and an explicit
  selected state for assistive technology.
- The latest item clicked becomes the active editing target.
- The inventory pane owns vertical scrolling; the preview remains visible.

## Responsive Layout

At viewport widths below 900 pixels:

- The preview pane moves above the inventory pane.
- The preview is no longer sticky.
- The inventory toolbar wraps without horizontal scrolling.
- The wearable grid reduces its column count while keeping a minimum
  64-by-64-pixel item card and 44-pixel interactive target.
- The tools drawer becomes a full-width panel below the preview toolbar.

No planner control may be hidden behind a fixed element or require horizontal
page scrolling.

## Wearable Catalog Behavior

The inventory consumes the existing `wearables_manifest.json`.

- Default filter: `All`.
- Slot filters: Back, Artifact, Feet, Pants, Shirt, Chest, Face, Hair, Hat, and
  Hand.
- Search matches case-insensitive item names and numeric IDs, including input
  written as `#16020`.
- Search and slot filtering compose: both conditions must match.
- Results use the existing manifest order unless the user searches or filters;
  no new sorting controls are introduced in this pass.
- Results render in deterministic chunks rather than creating all 4,029 card
  canvases at once.
- A visible load-more sentinel automatically appends the next chunk as the
  inventory approaches its bottom.
- Changing search or filter resets the visible chunk to the first page.

## Equip and Selection Behavior

- Clicking a wearable equips it in its manifest-declared slot.
- Equipping a new item replaces the previous item in that same slot.
- Clicking the currently equipped item again unequips it.
- Clicking an equipped chip removes that item.
- Equipping or removing an item rerenders the avatar and selected-card states.
- The most recently clicked equipped item becomes the active editing target.
- When the active editing target is removed, the next equipped item in shared
  slot order becomes active; if none remain, the target becomes empty.
- Random Set uses only manifest records whose `randomizable` field is true.

## Tools Drawer

The wrench button toggles one accessible tools drawer. The drawer contains:

1. Skin color palette.
2. Facial expression choices.
3. Active-item position controls: Up, Left, Reset, Right, Down, and `X/Y`
   readout.
4. Random Set.
5. Reset Set.
6. Reset All Positions.
7. Download Set PNG.
8. Download Separate Layers ZIP.

Position controls are disabled when there is no active equipped item. They
continue using the existing versioned `localStorage` state keyed by slot and
item ID. Reset Set clears equipment, skin, and expression but preserves saved
item positions. Reset All Positions clears only saved offsets.

The drawer:

- has `aria-expanded` and `aria-controls` on its trigger;
- can be closed with the wrench button or Escape;
- preserves a visible focus ring;
- does not obscure the avatar;
- does not shift the workbench columns when opened.

## Animator Separate-Layer Export

`Download Separate Layers ZIP` exports the current visible pose as one ZIP.
Every PNG uses the full transparent 192-by-192 canvas, so all files share the
same origin and can be stacked directly in animation or compositing software
without manual realignment.

### Base Character Layers

The canonical tinted idle body is partitioned into non-overlapping pixel masks:

- `body-torso.png`
- `left-arm-hand.png`
- `right-arm-hand.png`
- `left-leg-foot.png`
- `right-leg-foot.png`
- `head.png`
- `expression.png`

`body-torso.png` contains only canonical torso and neck pixels left after both
arm/hand and both leg/foot masks are removed. The head and expression continue
to use their current independent source tiles.

The body split is deterministic and lossless:

- every opaque canonical idle-body pixel belongs to exactly one exported body
  part;
- no canonical pixel is duplicated across two body-part files;
- recombining all body-part files before equipment reproduces the tinted
  canonical idle body pixel-for-pixel.

The current preview-left arm/hand remains the final front-most base-character
layer. The preview-right arm/hand remains at the base-body phase, matching the
approved renderer order.

### Equipped Wearable Layers

Each equipped item receives one independent PNG named:

`<z-index>-<slot>-<item-id>-<safe-name>.png`

Examples:

- `005-back-16012-turbine-wings.png`
- `030-hair-16020-the-princes-hair-and-headband.png`
- `070-hand-98-pickaxe.png`

Each wearable PNG:

- contains only that item;
- uses its manifest source crop;
- includes the slot's systemic default anchor;
- includes the user's saved per-item `X/Y` offset;
- uses the same final destination coordinates as the visible preview;
- preserves transparency outside the layer.

The exporter includes only currently equipped items. Empty slots do not create
empty PNG files.

### ZIP Contents and Metadata

The ZIP contains:

```text
growtopia-avatar-layers/
  composite-preview.png
  layers.json
  base/
    body-torso.png
    left-arm-hand.png
    right-arm-hand.png
    left-leg-foot.png
    right-leg-foot.png
    head.png
    expression.png
  wearables/
    <one positioned PNG per equipped item>
```

`composite-preview.png` is the same final image as the existing Download Set
PNG action. `layers.json` records:

- canvas width and height;
- avatar scale and player origin;
- selected skin tone and expression ID;
- ordered layer entries from back to front;
- filename, layer kind, slot, item ID, item name, z-index, render phase,
  systemic anchor, user offset, and final destination coordinates;
- manifest version and export schema version.

The exporter sorts filenames and metadata deterministically. Safe filenames use
lowercase ASCII letters, digits, and hyphens; duplicate safe names remain
unique because every wearable filename contains its item ID.

### Exact Reconstruction Contract

Stacking all exported PNGs in `layers.json` order with normal source-over alpha
compositing must equal `composite-preview.png` pixel-for-pixel.

The export action waits for every required texture. If any currently visible
layer cannot be rendered, the ZIP is not downloaded and the drawer displays a
specific error naming the failed layer. The exporter never silently creates a
partial animation package.

### Exporter Module Boundary

A new browser/Node-compatible `avatar_layer_exporter.js` module owns:

- canonical idle-body pixel partitioning;
- ordered export-layer planning;
- deterministic filenames and metadata;
- full-canvas layer composition;
- pixel-equality verification;
- ZIP creation using an embedded uncompressed ZIP writer and CRC32 helper.

The ZIP writer has no network or CDN dependency. `app.js` supplies loaded
textures, current planner state, and saved offsets, then triggers the returned
ZIP download. Pure exporter functions remain directly testable in Node.

## Sprite Preview Rendering

Wearable cards reuse the existing manifest crop coordinates and standard
32-pixel render profile.

- Previews use image smoothing disabled.
- One shared texture promise is reused per tilesheet.
- Failed textures render a consistent missing-sprite placeholder.
- A failed texture path is reported only once.
- Missing or invalid textures do not enter Random Set.
- Preview loading reserves the full card area to avoid layout shift.

## State Boundaries

New UI state is kept separate from avatar engine state:

- `inventoryQuery`: current normalized search string.
- `inventorySlot`: `All` or one declared slot key.
- `inventoryVisibleLimit`: current chunk boundary.
- `activeEditingTarget`: `{ slot, itemId }` or `null`.
- `toolsDrawerOpen`: boolean.

Existing state remains authoritative for:

- equipped items;
- skin tone and skin color;
- facial expression;
- per-item offsets.

Filtering never mutates equipped state. Rebuilding the visible inventory never
reloads or re-parses the manifest.

## Error and Empty States

- Manifest load failure leaves the base avatar and tools usable and shows an
  inline retry message in the inventory pane.
- No search results show the query and active slot filter with a clear-search
  action.
- A missing texture shows a placeholder card, not a broken image or initial
  letter.
- Drawer actions that require an active item remain visibly disabled.
- Existing avatar texture failure logging remains deduplicated.

## Accessibility and Interaction Quality

- All icon-only buttons receive explicit accessible labels.
- All interactive targets are at least 44 by 44 pixels.
- Search has a persistent label rather than placeholder-only labeling.
- Card selection is conveyed by border, text/state, and `aria-pressed`, not by
  color alone.
- Keyboard users can reach toolbar, cards, chips, drawer controls, and actions
  in visual order.
- Hover, active, focus, disabled, and selected states do not change component
  dimensions.
- Motion is limited to 150–250 milliseconds and disabled when
  `prefers-reduced-motion` is enabled.

## Testing

### Automated JavaScript Tests

- Search matches name, plain ID, and `#ID`.
- Slot filter and search compose correctly.
- Chunk reset and append behavior are deterministic.
- Equip replaces only the matching slot.
- Clicking an equipped item toggles it off.
- Active editing target falls back correctly after removal.
- Drawer state and Escape behavior work.
- The idle body split is non-overlapping and lossless.
- Exported wearable layers use systemic anchors plus saved user offsets.
- ZIP paths and `layers.json` ordering are deterministic.
- Recombining exported layers equals the final composite pixel-for-pixel.
- A failed required texture aborts export with the failing layer identified.

### Existing Contract Tests

- The runtime catalog remains the only source of slot configuration.
- Avatar render ordering and systemic Hair/Hat anchors do not change.
- Per-item offsets remain destination-only and persistent.
- Reset Set and Reset All Positions keep their existing semantics.

### Browser Verification

- Desktop layout at 1280 and 1920 pixels.
- Responsive stacked layout at 375, 700, and 899 pixels.
- Search, filter, equip, toggle, chip removal, Random, Reset, and Download.
- Separate Layers ZIP with no equipment, one moved item, and a complete
  multi-slot set.
- Import the exported PNGs in `layers.json` order and compare the result with
  `composite-preview.png`.
- Drawer keyboard behavior and visible focus.
- Progressive loading through all 4,029 wearables.
- No uncaught JavaScript errors or repeated failed-texture log spam.

## Out of Scope

- Changing the global site header or navigation.
- Changing wearable classification or manifest generation.
- Reworking avatar sprite crops, systemic anchors, or layer order.
- Drag-and-drop positioning.
- Separating fingers, facial subfeatures, or individual pixels beyond the
  declared torso, limb, head, and expression layers.
- Adding server-side search, accounts, or cloud persistence.
- Redesigning the Item Explorer, raw spritesheet, audio, character-parts, or
  import tabs.
