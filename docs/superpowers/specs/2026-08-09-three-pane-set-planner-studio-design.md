# Three-Pane Set Planner Studio Design

**Date:** 2026-08-09  
**Status:** Approved in conversation; awaiting written-spec review  
**Scope:** Growtopia Set Planner layout, control hierarchy, responsive behavior, and regression safety

## Goal

Redesign the Set Planner so users can browse wearables and adjust the current
set without losing sight of the avatar preview. The primary workflow alternates
equally between inventory browsing and item adjustment, so both areas must stay
efficient while the preview remains continuously visible.

This is a presentation and interaction redesign. It must preserve the current
avatar renderer, wearable data, animation behavior, saved sets, positioning,
and export results.

## Mandatory Pre-Implementation Checkpoint

Before the first source-code change:

1. Create a fresh ZIP backup of the current project.
2. Store it outside the active project directory in the established project
   backup location.
3. Record the backup path, byte size, and SHA-256.
4. Confirm the archive can be listed successfully.

An older checkpoint does not satisfy this requirement. Planning documents and
brainstorm mockups may be created before the checkpoint; application source may
not be edited before it.

### Verified checkpoint

- Path: `C:\Users\VICTUS\Documents\Codex\2026-08-09\growtopia-explorer\backups\set-planner-studio-prechange-20260809-010706.zip`
- Size: `250229793` bytes
- SHA-256: `20E7F8334EDEA4F41CDC9E4217B10A11FFC0F6067D463DE52262D5947036E9FD`
- Archive entries verified: `2931`
- Created: `2026-08-09T01:07:06.9119816+07:00`
- Excluded as disposable planning state: `.superpowers/brainstorm`

## Approved Direction

The user selected **A — Three-Pane Studio**.

At desktop width, the workbench is organized from left to right as:

1. Wearable Inventory;
2. Live Preview;
3. Contextual Inspector.

This order supports the dominant loop: choose a wearable, inspect the visual
result, then adjust the selected target.

## Desktop Layout

### Wearable Inventory

The left pane receives the flexible remaining width and contains:

- wearable search;
- slot filter;
- result count and clear action;
- the progressively rendered wearable grid;
- the load-more sentinel and existing empty/error states.

The inventory is the document's primary scrolling content. It must not create a
second full-height nested scroll region on desktop.

### Live Preview

The center pane is sticky within the viewport and contains:

- the existing avatar canvas;
- a concise active-target status;
- equipped-item chips immediately below the canvas.

The preview remains visible while the inventory scrolls. Canvas dimensions,
pixel-perfect rendering, layer order, drag/position behavior, and export scale
are unchanged. CSS may change the displayed canvas size at narrower widths,
but must not alter its internal resolution or exported output.

### Contextual Inspector

The right pane is sticky within the viewport and contains three explicit tabs:

- `Item`;
- `Look`;
- `Export`.

Only the selected tab's controls are visible. Tab selection is persistent for
the current browser session. Selecting an equipped wearable activates `Item`
automatically so its relevant controls are immediately available.

The inspector may scroll internally only when its content cannot fit in the
available viewport. Its tab bar and current-target summary remain visible while
that internal content scrolls.

## Workbench Command Bar

A compact command bar spans the workbench and contains:

- the set-name field;
- `Save`;
- `Saved Sets`;
- one clearly labeled overflow menu trigger.

The overflow menu contains lower-frequency workspace actions:

- Random Set;
- Reset Set;
- Reset Positions;
- Import Set JSON;
- Export Set JSON.

Reset actions are spatially separated from normal actions and use clear text.
They must not rely on color alone. The command bar must not introduce structural
emoji; icons, when used, come from one consistent icon style and retain visible
text or accessible labels.

## Inspector Content

### Item Tab

When an equipped item is selected, the tab displays:

- item preview, name, item ID, and slot;
- an explicit unequip action;
- position controls and X/Y readout;
- reset position for the selected item;
- wearable sequence controls when the item has a valid animation.

Animated-item controls retain the existing behavior:

- play/pause icon button;
- previous and next frame buttons;
- frame slider and frame counter;
- per-wearable speed input in milliseconds.

Static items do not render an empty or disabled animation block. When no item is
selected, the tab shows a concise empty state instructing the user to select an
equipped item.

### Look Tab

The tab contains:

- skin-tone palette;
- facial-expression controls with the existing PNG previews;
- naked-body/body-mode control.

Changing these controls updates the visible center preview immediately.

### Export Tab

The tab contains:

- export-scale selector;
- one primary `Download Set PNG` action;
- current export status and errors;
- an `Advanced exports` disclosure.

The disclosure contains the existing:

- Separate Layers ZIP;
- Selected Sequence ZIP;
- All Equipped Sequences ZIP.

Sequence export controls retain their current availability rules and remain
disabled when no valid sequence exists.

## Responsive Behavior

### Large desktop: 1280 pixels and wider

Show all three panes simultaneously. Inventory uses flexible width; preview and
inspector use bounded columns sized to keep the avatar and controls readable.
Preview and inspector remain sticky.

### Medium: 900–1279 pixels

Use a two-column layout:

- sticky preview on the left;
- one right workspace with `Wearables` and `Inspector` tabs.

Switching workspace tabs must preserve inventory query, slot filter, rendered
chunk, inventory scroll position, active inspector tab, and selected item.

### Narrow: below 900 pixels

Stack a compact sticky preview above a tabbed content area. The content tabs
provide inventory and inspector access without horizontal scrolling. The
preview must not cover content or controls, and the page must reserve space for
the sticky region.

At every breakpoint:

- no horizontal page overflow;
- buttons, tabs, menu items, and cards expose an interactive hit area of at
  least 44 by 44 pixels; slider thumbs may render smaller but retain an
  equivalent usable hit area;
- keyboard focus follows visual order;
- sticky elements do not cover focused controls;
- layout changes do not reset user state;
- reduced-motion preference is respected.

## State and Compatibility Contract

The redesign must preserve existing state and file contracts for:

- equipped items and slot replacement;
- selected item and per-item offsets;
- skin tone, expression, and body mode;
- per-wearable animation frame, playback state, and `intervalMs`;
- saved-set creation, loading, renaming, deletion, import, and export;
- PNG, layer ZIP, selected-sequence ZIP, and all-sequences ZIP output;
- `wearables_manifest.json` and wearable sequence descriptors;
- canvas composition, systemic anchors, and render order.

Existing DOM IDs referenced by application code or tests must be retained, and
their established event-handler behavior must remain unchanged. DOM nodes may
move into new visual containers, but control ownership and event wiring must
remain explicit. The implementation must not duplicate controls with competing
handlers.

## Interaction Details

- Selecting or equipping a wearable makes it the active target and opens the
  `Item` inspector tab.
- Removing the active item uses the existing fallback-selection behavior.
- Equipped chips remain a fast removal/selection affordance.
- Inspector tabs expose selected state semantically and are keyboard operable.
- The overflow menu closes on outside click, Escape, or after choosing an
  action, and restores focus to its trigger.
- Destructive actions retain their current semantics and provide clear feedback.
- Export actions show busy, success, and actionable error states without
  silently producing partial output.

## Error and Empty States

- Manifest failure leaves preview and non-inventory controls usable.
- No inventory results show the active query/filter and a clear recovery action.
- No active item shows guidance rather than inactive position/sequence clutter.
- Failed export identifies the failed operation and restores button state.
- Missing wearable textures retain the existing placeholder and deduplicated
  reporting behavior.

## Implementation Boundaries

Likely files in scope:

- `public/index.html` for the workbench and inspector structure;
- `public/styles.css` for three-pane, sticky, tabs, menu, and responsive layout;
- `public/app.js` for tab/menu state and moving existing controls into the new
  interaction hierarchy;
- focused tests under `tests/`.

The implementation should prefer moving and regrouping existing functionality
over rewriting unrelated rendering or export code.

Out of scope:

- wearable reclassification or new sequence discovery;
- changing animation descriptors or frame timing semantics;
- changing avatar composition, source crops, anchors, or export file formats;
- redesigning other application tabs;
- adding cloud accounts or server-side persistence.

## Verification

### Automated regression checks

- Existing wearable-sequence tests remain green.
- Existing avatar-composite and Set Planner contract tests remain green.
- New structural tests cover the command bar, inspector tabs, control ownership,
  and breakpoint classes.
- New interaction tests cover automatic `Item` activation, workspace/tab state
  preservation, overflow-menu dismissal, and unchanged handler execution.

### Browser acceptance

Verify at large desktop, medium desktop/tablet, and narrow mobile widths:

1. Search, filter, equip, replace, unequip, and chip interactions.
2. Preview remains visible during inventory browsing.
3. Position controls update the selected item immediately.
4. Aurora Robe exposes its sequence controls and persists custom speed/frame
   behavior after reload.
5. Static wearables do not show irrelevant animation controls.
6. Skin tone, PNG expressions, and body mode update the preview.
7. Save, load, rename, delete, JSON import, and JSON export preserve set data.
8. PNG, layer ZIP, selected-sequence ZIP, and all-sequences ZIP actions work.
9. Keyboard navigation, focus visibility, Escape behavior, and disabled states.
10. No horizontal overflow, clipped labels, missing assets, uncaught JavaScript
    errors, or repeated console-error spam.

### Cache safety

If application JavaScript or CSS changes, update the asset cache-busting query
in `public/index.html` so Chrome does not continue serving the prior UI.

## Completion Criteria

- A fresh pre-implementation backup is verified and recorded.
- Large desktop shows Inventory, Preview, and Inspector simultaneously.
- Preview stays visible during inventory browsing.
- Item, Look, and Export controls are reachable without a long drawer scroll.
- Existing data, rendering, animation, saved-set, and export behavior is
  preserved.
- Automated tests and browser acceptance pass with no console errors.
