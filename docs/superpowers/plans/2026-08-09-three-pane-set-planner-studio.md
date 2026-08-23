# Three-Pane Set Planner Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long Set Planner tools drawer with a responsive three-pane studio that keeps wearable inventory, avatar preview, and contextual controls efficient without changing renderer, sequence, saved-set, or export behavior.

**Architecture:** Recompose the existing DOM into a workbench command bar plus Inventory, Preview, and Inspector regions while preserving every application-owned DOM ID. Add a small UI-state layer in `public/app.js` for inspector/workspace tabs and the overflow menu; reuse existing handlers and rendering functions. CSS owns the large/medium/narrow layout transformations, sticky behavior, and accessible interaction sizing.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Python `unittest` source-contract tests, Node built-in test runner.

---

## File Map

- Modify `public/index.html`: command bar, three-pane DOM order, inspector tabs/panels, medium workspace tabs, overflow menu, cache query.
- Modify `public/styles.css`: large three-column grid, sticky preview/inspector, command bar, tabs, menu, medium two-column mode, narrow stacked mode.
- Modify `public/app.js`: inspector/workspace state, tab/menu interaction, automatic Item-tab activation, Escape/outside-click behavior, compatibility for the retired drawer toggle.
- Modify `tests/test_avatar_composite.py`: structural and behavioral regression contracts for the new UI and cache version.
- Preserve `public/wearable_sequence.js`, renderer/export modules, manifests, and data files unless a failing regression proves a required compatibility adjustment.

The workspace is not a Git repository. Replace commit steps with checkpoint/test evidence; do not initialize Git as part of this feature.

### Task 1: Create and verify the mandatory source checkpoint

**Files:**
- Read: `C:/Users/VICTUS/Downloads/growtopia-explorer/**`
- Create: `C:/Users/VICTUS/Documents/Codex/2026-08-09/growtopia-explorer/backups/set-planner-studio-prechange-<timestamp>.zip`
- Modify: `docs/superpowers/specs/2026-08-09-three-pane-set-planner-studio-design.md`

- [ ] **Step 1: Resolve the exact source and backup paths**

Run:

```powershell
$project = (Resolve-Path 'C:\Users\VICTUS\Downloads\growtopia-explorer').Path
$backupRoot = 'C:\Users\VICTUS\Documents\Codex\2026-08-09\growtopia-explorer\backups'
Write-Output $project
Write-Output $backupRoot
```

Expected: the source resolves to the active project and the backup target is outside it.

- [ ] **Step 2: Create one fresh ZIP without recursive backup content**

Use PowerShell/.NET ZIP creation after creating the exact backup directory. Exclude `.superpowers/brainstorm` because it contains disposable mockup sessions; include all application source, data, assets, tests, and documentation.

- [ ] **Step 3: Verify the archive**

Run a read-only archive listing, `Get-Item`, and `Get-FileHash -Algorithm SHA256`. Expected: non-zero byte size, successful listing, and a 64-character SHA-256.

- [ ] **Step 4: Record evidence in the design spec**

Add a `Verified checkpoint` subsection containing the absolute path, byte size, SHA-256, creation time, and the excluded brainstorm-only path.

### Task 2: Lock the new DOM contract with failing tests

**Files:**
- Modify: `tests/test_avatar_composite.py`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Replace obsolete split-workbench assertions**

Add a test that requires the new permanent regions and preserved controls:

```python
def test_avatar_studio_uses_three_pane_command_bar_and_inspector(self):
    html = (PROJECT_DIR / "public" / "index.html").read_text(encoding="utf-8")

    for marker in (
        'class="avatar-command-bar"',
        'id="avatar-inventory-pane"',
        'id="avatar-preview-pane"',
        'id="avatar-inspector-pane"',
        'id="avatar-inspector-tabs"',
        'id="avatar-inspector-item"',
        'id="avatar-inspector-look"',
        'id="avatar-inspector-export"',
        'id="avatar-set-menu-toggle"',
        'id="avatar-set-menu"',
    ):
        self.assertIn(marker, html)

    inventory = html.index('id="avatar-inventory-pane"')
    preview = html.index('id="avatar-preview-pane"')
    inspector = html.index('id="avatar-inspector-pane"')
    self.assertLess(inventory, preview)
    self.assertLess(preview, inspector)
```

- [ ] **Step 2: Add control-ownership assertions**

```python
def test_avatar_studio_preserves_each_existing_control_once(self):
    html = (PROJECT_DIR / "public" / "index.html").read_text(encoding="utf-8")
    preserved_ids = (
        "set-name-input", "avatar-save-set", "avatar-saved-sets-toggle",
        "avatar-randomize", "avatar-reset", "avatar-reset-all-positions",
        "avatar-export-set", "avatar-import-set", "avatar-active-position-controls",
        "avatar-active-sequence-controls", "skin-tones-grid", "expressions-grid",
        "naked-body-toggle", "avatar-export-scale", "avatar-download-png",
        "avatar-download-layers", "avatar-download-selected-sequence",
        "avatar-download-all-sequences",
    )
    for element_id in preserved_ids:
        self.assertEqual(1, html.count(f'id="{element_id}"'), element_id)
```

- [ ] **Step 3: Add responsive CSS contract assertions**

```python
def test_avatar_studio_css_has_large_medium_and_narrow_layouts(self):
    styles = (PROJECT_DIR / "public" / "styles.css").read_text(encoding="utf-8")
    self.assertIn(".avatar-studio-grid", styles)
    self.assertIn("grid-template-areas:", styles)
    self.assertIn('"inventory preview inspector"', styles)
    self.assertIn("@media (max-width: 1279px)", styles)
    self.assertIn("@media (max-width: 899px)", styles)
    self.assertIn(".avatar-preview-pane", styles)
    self.assertIn(".avatar-inspector-pane", styles)
    self.assertIn("position: sticky", styles)
```

- [ ] **Step 4: Add interaction-state source assertions**

```python
def test_avatar_studio_tabs_and_menu_are_wired(self):
    source = APP_JS.read_text(encoding="utf-8")
    for marker in (
        "function setAvatarInspectorTab(",
        "function setAvatarWorkspaceTab(",
        "function setAvatarSetMenuOpen(",
        'event.key === "Escape"',
        'setAvatarInspectorTab("item")',
    ):
        self.assertIn(marker, source)
```

- [ ] **Step 5: Run focused tests and confirm failure**

Run:

```powershell
python -m unittest tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_studio_uses_three_pane_command_bar_and_inspector tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_studio_preserves_each_existing_control_once tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_studio_css_has_large_medium_and_narrow_layouts tests.test_avatar_composite.AvatarCompositeContractTests.test_avatar_studio_tabs_and_menu_are_wired
```

Expected: FAIL because the new regions and functions do not exist yet.

### Task 3: Recompose the Set Planner HTML without changing control IDs

**Files:**
- Modify: `public/index.html:148-301`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Add the command bar**

Place this directly inside `#avatar-workbench` before the studio grid:

```html
<header class="avatar-command-bar" aria-label="Set commands">
  <label class="avatar-set-name-field" for="set-name-input">
    <span>Set name</span>
    <input type="text" id="set-name-input" class="set-name-input"
           placeholder="Unnamed Set" maxlength="48" autocomplete="off">
  </label>
  <div class="avatar-command-actions">
    <button id="avatar-save-set" class="btn btn-cyan" type="button">Save</button>
    <button id="avatar-saved-sets-toggle" class="btn btn-secondary" type="button"
            aria-expanded="false" aria-controls="saved-sets-panel">Saved Sets</button>
    <button id="avatar-set-menu-toggle" class="btn btn-secondary avatar-menu-toggle"
            type="button" aria-expanded="false" aria-controls="avatar-set-menu">More</button>
  </div>
  <div id="avatar-set-menu" class="avatar-set-menu" hidden>
    <!-- Move the existing random/reset/reset-position/import/export JSON buttons here. -->
  </div>
  <!-- Move the existing saved-sets-panel here unchanged. -->
</header>
```

Use text labels rather than the existing emoji prefixes. Keep the existing button IDs and file input exactly once.

- [ ] **Step 2: Create the permanent three-pane order**

```html
<div class="avatar-studio-grid">
  <section id="avatar-inventory-pane" class="avatar-inventory-pane" aria-label="Wearable inventory">
    <!-- Existing inventory header, toolbar, status, count, grid, and sentinel. -->
  </section>

  <section id="avatar-preview-pane" class="avatar-preview-pane" aria-label="Avatar preview">
    <!-- Existing active target, canvas, and equipped chips. -->
  </section>

  <aside id="avatar-inspector-pane" class="avatar-inspector-pane" aria-label="Avatar inspector">
    <!-- Inspector tabs and panels from the next step. -->
  </aside>
</div>
```

Remove the wrench image button from the visible workflow but retain a hidden compatibility button with `id="avatar-tools-toggle"` only if current tests or initialization still require it during the JS transition. The final JS task removes that dependency.

- [ ] **Step 3: Add accessible inspector tabs and panels**

```html
<div id="avatar-inspector-tabs" class="avatar-inspector-tabs" role="tablist" aria-label="Avatar inspector">
  <button class="avatar-inspector-tab" type="button" role="tab" data-inspector-tab="item" aria-controls="avatar-inspector-item" aria-selected="true">Item</button>
  <button class="avatar-inspector-tab" type="button" role="tab" data-inspector-tab="look" aria-controls="avatar-inspector-look" aria-selected="false">Look</button>
  <button class="avatar-inspector-tab" type="button" role="tab" data-inspector-tab="export" aria-controls="avatar-inspector-export" aria-selected="false">Export</button>
</div>
<section id="avatar-inspector-item" class="avatar-inspector-panel" role="tabpanel" data-inspector-panel="item">
  <div id="avatar-active-position-controls"></div>
  <div id="avatar-active-sequence-controls"></div>
</section>
<section id="avatar-inspector-look" class="avatar-inspector-panel" role="tabpanel" data-inspector-panel="look" hidden>
  <div id="skin-tones-grid" class="skin-tones-grid"></div>
  <div id="expressions-grid" class="expressions-grid"></div>
  <!-- Existing body-mode button. -->
</section>
<section id="avatar-inspector-export" class="avatar-inspector-panel" role="tabpanel" data-inspector-panel="export" hidden>
  <!-- Existing export scale, PNG, advanced ZIP controls, and status. -->
</section>
```

Keep `#avatar-active-target` at the top of the Item panel and retain the existing group labels.

- [ ] **Step 4: Add medium workspace tabs**

Add `Wearables` and `Inspector` buttons with `data-workspace-tab` attributes. They are visually hidden at large width and become the right-column switcher below 1280px.

- [ ] **Step 5: Run focused HTML tests**

Run the two new HTML tests. Expected: PASS. Existing handler-oriented tests may still fail until Task 5.

### Task 4: Implement the responsive studio CSS

**Files:**
- Modify: `public/styles.css:2024-2520`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Replace the old workbench grid with explicit areas**

```css
.avatar-workbench {
  display: grid;
  gap: 12px;
}

.avatar-command-bar {
  position: relative;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: end;
  gap: 12px;
}

.avatar-studio-grid {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 430px) minmax(300px, 350px);
  grid-template-areas: "inventory preview inspector";
  align-items: start;
  gap: 12px;
}

.avatar-inventory-pane { grid-area: inventory; }
.avatar-preview-pane { grid-area: preview; position: sticky; top: 16px; }
.avatar-inspector-pane { grid-area: inspector; position: sticky; top: 16px; }
```

Use the existing dark surfaces, cyan accents, radii, and shadow tokens rather than introducing a new visual language.

- [ ] **Step 2: Remove desktop nested inventory scrolling**

Set desktop inventory `max-height: none` and `overflow: visible`. Keep its search/filter toolbar sticky within the page when it does not conflict with the main header.

- [ ] **Step 3: Style tabs, command menu, and panels**

All buttons/tabs/menu rows have at least a 44px hit area, visible focus, stable borders, and no layout-shifting hover transforms. The active tab uses text weight, border/indicator, and color rather than color alone.

- [ ] **Step 4: Add medium mode**

```css
@media (max-width: 1279px) {
  .avatar-studio-grid {
    grid-template-columns: minmax(340px, 430px) minmax(0, 1fr);
    grid-template-areas: "preview inventory";
  }
  .avatar-preview-pane { grid-area: preview; }
  .avatar-inventory-pane,
  .avatar-inspector-pane { grid-area: inventory; }
  .avatar-workspace-tabs { display: flex; }
  [data-workspace-hidden="true"] { display: none; }
}
```

- [ ] **Step 5: Add narrow mode**

```css
@media (max-width: 899px) {
  .avatar-command-bar { grid-template-columns: 1fr; }
  .avatar-studio-grid {
    grid-template-columns: 1fr;
    grid-template-areas: "preview" "inventory";
  }
  .avatar-preview-pane {
    top: 0;
    z-index: 8;
  }
  #avatar-canvas { width: min(240px, 66vw); height: min(240px, 66vw); }
}
```

Reserve document flow space for the sticky preview; do not use fixed positioning.

- [ ] **Step 6: Run the focused CSS test**

Expected: PASS.

### Task 5: Add inspector, workspace, and menu interaction state

**Files:**
- Modify: `public/app.js:55-65, 180-230, 1000-1130, 1280-1390`
- Test: `tests/test_avatar_composite.py`

- [ ] **Step 1: Extend UI-only state**

```javascript
Object.assign(avatarInventoryState, {
  inspectorTab: "item",
  workspaceTab: "wearables",
  setMenuOpen: false
});
```

Do not add these values to saved-set JSON or wearable sequence storage.

- [ ] **Step 2: Cache the new DOM nodes**

```javascript
const avatarInspectorTabs = Array.from(document.querySelectorAll("[data-inspector-tab]"));
const avatarInspectorPanels = Array.from(document.querySelectorAll("[data-inspector-panel]"));
const avatarWorkspaceTabs = Array.from(document.querySelectorAll("[data-workspace-tab]"));
const avatarInventoryPane = document.getElementById("avatar-inventory-pane");
const avatarInspectorPane = document.getElementById("avatar-inspector-pane");
const avatarSetMenuToggle = document.getElementById("avatar-set-menu-toggle");
const avatarSetMenu = document.getElementById("avatar-set-menu");
```

- [ ] **Step 3: Implement inspector tab switching**

```javascript
function setAvatarInspectorTab(tab) {
  const nextTab = ["item", "look", "export"].includes(tab) ? tab : "item";
  avatarInventoryState.inspectorTab = nextTab;
  avatarInspectorTabs.forEach((button) => {
    const selected = button.dataset.inspectorTab === nextTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  avatarInspectorPanels.forEach((panel) => {
    panel.hidden = panel.dataset.inspectorPanel !== nextTab;
  });
}
```

Wire click plus ArrowLeft/ArrowRight/Home/End keyboard movement without changing focus order outside the tab list.

- [ ] **Step 4: Implement medium/narrow workspace switching**

`setAvatarWorkspaceTab("wearables" | "inspector")` updates `aria-selected` and sets `data-workspace-hidden` on only the inventory/inspector panes. It must not rebuild the inventory or reset `visibleLimit`, query, slot, or active target.

- [ ] **Step 5: Implement overflow-menu behavior**

`setAvatarSetMenuOpen(open, { restoreFocus = false } = {})` synchronizes `hidden` and `aria-expanded`. Toggle on button click; close on outside pointerdown, Escape, and after any menu action. Escape restores focus to the trigger.

- [ ] **Step 6: Activate Item controls on selection**

In the successful equip/select path, call:

```javascript
setAvatarInspectorTab("item");
setAvatarWorkspaceTab("inspector");
```

Do not call these during inventory rendering or filtering.

- [ ] **Step 7: Retire drawer-only state safely**

Remove `toolsOpen` and `setAvatarToolsOpen()` after all call sites are replaced. Remove the wrench DOM dependency and update the obsolete drawer contract tests. Preserve Escape for the new menu and tab semantics.

- [ ] **Step 8: Run interaction source-contract tests**

Expected: PASS.

### Task 6: Preserve controls, refine empty states, and bump cache keys

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `tests/test_avatar_composite.py`

- [ ] **Step 1: Make Item empty/static/animated states concise**

Reuse `refreshActivePositionControls()` and `refreshActiveSequenceControls()`. No target shows one guidance block. A static target omits the sequence block via `hidden` rather than displaying a second error sentence. Animated targets show the existing controls unchanged.

- [ ] **Step 2: Preserve export availability and status**

Keep `refreshAvatarExportAvailability()` and all existing export handlers. Ensure status remains inside the Export panel and is visible while export buttons are busy.

- [ ] **Step 3: Remove structural emoji from moved command buttons**

Visible command labels become `Save`, `Saved Sets`, `Export Set`, and `Import Set`. Do not change IDs or handler wiring.

- [ ] **Step 4: Bump browser cache keys**

Change the three Set Planner assets in `public/index.html` from `wearable-ui-speed-v5` to `avatar-studio-v6`:

```html
<link rel="stylesheet" href="styles.css?v=avatar-studio-v6">
<script src="wearable_sequence.js?v=avatar-studio-v6"></script>
<script src="app.js?v=avatar-studio-v6"></script>
```

Update exact cache assertions in `tests/test_avatar_composite.py`.

- [ ] **Step 5: Run all Python contract tests**

Run:

```powershell
python -m unittest tests.test_avatar_composite
```

Expected: all tests PASS.

### Task 7: Full regression and browser acceptance

**Files:**
- Verify: `public/index.html`
- Verify: `public/styles.css`
- Verify: `public/app.js`
- Verify: `public/wearable_sequence.js`
- Verify: `tests/test_avatar_composite.py`
- Verify: `tests/wearable_sequence.test.js`

- [ ] **Step 1: Run the wearable-sequence suite**

```powershell
node --test tests/wearable_sequence.test.js
```

Expected baseline: 16 tests pass.

- [ ] **Step 2: Run the full avatar suite**

```powershell
python -m unittest tests.test_avatar_composite
```

Expected baseline before new tests: 33 tests pass; final total is higher and all pass.

- [ ] **Step 3: Check for stale UI/cache markers**

```powershell
rg -n "wearable-ui-speed-v5|avatar-tools-drawer|toolsOpen|ðŸ’¾|ðŸ“‚|ðŸ“¤|ðŸ“¥" public tests
```

Expected: no obsolete Set Planner UI markers, except intentional historical text outside the active planner if documented.

- [ ] **Step 4: Large desktop acceptance**

At 1280px and a wider desktop viewport, confirm all three panes are visible; inventory scroll does not move preview/inspector out of view; selecting Aurora Robe opens Item controls; position, play/pause, frame, and speed work.

- [ ] **Step 5: Medium acceptance**

At 1024px, confirm preview remains visible and Wearables/Inspector switching preserves query, slot, visible items, active target, and inspector tab.

- [ ] **Step 6: Narrow acceptance**

At 375px and 700px, confirm compact sticky preview, no horizontal overflow, no content hidden under sticky UI, 44px controls, and usable tab/menu focus.

- [ ] **Step 7: Saved-set and export acceptance**

Exercise save, load, rename, delete, JSON import/export, PNG export, layer ZIP, selected-sequence ZIP, and all-sequences ZIP. Confirm downloaded output still uses existing content contracts.

- [ ] **Step 8: Runtime health acceptance**

Reload the app, confirm `avatar-studio-v6` assets are requested, and confirm zero uncaught console errors or repeated missing-texture/error spam.

- [ ] **Step 9: Record completion evidence**

Report the backup path/hash, changed files, test totals, browser viewports, and any remaining non-blocking limitation. Do not claim completion if a required flow is unverified.
