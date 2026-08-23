# Preview Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render real sprites reliably and keep all sheet previews responsive.

**Architecture:** A Promise-based image loader fans one loaded image out to every waiting canvas. A threaded localhost server handles concurrent image requests, while runtime catalog counts and complete modal CSS keep the sheet UI accurate.

**Tech Stack:** Vanilla JavaScript, HTML5 Canvas, CSS, Python `http.server`, Python `unittest`

---

### Task 1: Regression tests

**Files:**
- Create: `tests/test_preview_reliability.py`
- Modify: `public/app.js`
- Modify: `server.py`

- [ ] Add a test that reads `app.js` and requires a shared Promise cache, `loadTextureImage()`, and Promise-based canvas rendering without `drawPlaceholder()` in the loading branch.
- [ ] Add a test that imports `server.py` and asserts its server class subclasses `socketserver.ThreadingMixIn`, enables address reuse, and binds to `127.0.0.1`.
- [ ] Run `python -m unittest tests.test_preview_reliability -v`; expect failures because these contracts do not exist.
- [ ] Implement only the contracts required by the failing tests.
- [ ] Re-run the focused suite and expect all tests to pass.

### Task 2: Runtime counts and sheet modal styles

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `tests/test_preview_reliability.py`

- [ ] Add failing assertions for runtime count element IDs and CSS selectors for `.mode-tab`, `.sheet-modal-viewport`, `.sequence-player-box`, and `.zoom-controls-bar`.
- [ ] Run the focused suite and confirm the new assertions fail.
- [ ] Add runtime count targets, update their text from `allSheets.length`, and add explicit responsive modal styles.
- [ ] Run the complete Python and JavaScript syntax suites.

### Task 3: Live verification

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `public/index.html`
- Modify: `server.py`

- [ ] Stop the exact old project server on port 5000 and start the updated server.
- [ ] Open a fresh page and assert 80 item canvases render after shared textures load.
- [ ] Open the sheet tab and assert the count is 1,968 with zero broken loaded images.
- [ ] Open `bg_PPH_Cat1-Tail.png`, test full and sequence modes, and confirm visible previews and styled controls.
- [ ] Confirm browser console errors are empty and HTTP requests remain responsive.

