# Growtopia Asset Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recursively synchronize all local Growtopia RTTEX assets into the explorer as PNG while honoring cache overrides.

**Architecture:** `convert_all_rttex.py` owns deterministic source discovery, output mapping, RTTEX decoding, and sync reporting. `generate_tilesheets_info.py` recursively catalogs the resulting PNG tree using URL-safe relative paths.

**Tech Stack:** Python 3.11, Pillow, `unittest`, JSON, zlib

---

### Task 1: Source discovery and precedence

**Files:**
- Create: `tests/test_asset_sync.py`
- Modify: `convert_all_rttex.py`

- [ ] Write a failing `unittest` that creates installed and cache RTTEX paths and asserts `discover_sources()` maps game-root files to a flat output, preserves nested folders, and selects cache for duplicate output paths.
- [ ] Run `python -m unittest tests.test_asset_sync -v` and confirm it fails because `discover_sources` does not exist.
- [ ] Implement `output_relative_path()` and `discover_sources()` with installed-first/cache-last precedence.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Safe conversion and synchronization

**Files:**
- Modify: `tests/test_asset_sync.py`
- Modify: `convert_all_rttex.py`

- [ ] Write failing tests that malformed RTTEX input returns a failed conversion and that an up-to-date PNG is skipped.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Refactor conversion to validate RTTXTR dimensions and payload size, create parent directories, skip current outputs, and return structured counts.
- [ ] Run `python -m unittest tests.test_asset_sync -v` and confirm all tests pass.

### Task 3: Recursive catalog

**Files:**
- Modify: `tests/test_asset_sync.py`
- Modify: `generate_tilesheets_info.py`

- [ ] Write a failing test that a nested PNG appears as `pets/example.png` in catalog output.
- [ ] Run the focused test and confirm the current non-recursive generator fails.
- [ ] Implement recursive PNG discovery and forward-slash relative catalog names.
- [ ] Re-run all asset-sync tests and confirm they pass.

### Task 4: Live synchronization and verification

**Files:**
- Generate: `public/tilesheets/**/*.png`
- Modify: `public/tilesheets_info.json`

- [ ] Run `python convert_all_rttex.py` against `%LOCALAPPDATA%\Growtopia`.
- [ ] Confirm failed conversions are zero and the selected source count matches generated outputs.
- [ ] Run `python generate_tilesheets_info.py`.
- [ ] Verify every catalog path exists, every item texture reference resolves, JSON parses, Python compiles, and JavaScript syntax checks pass.
- [ ] Start the local server, request the app and representative nested assets, then stop the server.

