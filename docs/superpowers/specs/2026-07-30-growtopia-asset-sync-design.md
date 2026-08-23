# Growtopia Asset Sync Design

## Goal

Synchronize every RTTEX asset from the active local Growtopia installation into
the explorer project as PNG, including game, pets, interface, GameData, and
downloaded cache overrides.

## Source precedence and paths

Installed assets are discovered first from `game`, `interface`, and `GameData`.
Assets under `cache` are discovered last and replace an installed source only
when they map to the same output path. Root game textures remain directly under
`public/tilesheets` for compatibility with `items_db.json`; nested game paths
such as `game/pets/p_tv.rttex` become
`public/tilesheets/pets/p_tv.png`. Interface and GameData keep their top-level
names, for example `interface/large/foo.rttex` becomes
`public/tilesheets/interface/large/foo.png`.

## Conversion behavior

The synchronizer recursively discovers RTTEX files, decompresses RTPACK payloads,
validates RTTXTR dimensions and RGBA payload length, vertically flips the decoded
texture, and writes PNG output. Existing PNGs are skipped unless the selected
source is newer. Conversion failures are reported and cause a non-zero exit.

## Catalog

`tilesheets_info.json` is regenerated recursively. Its `filename` values use
forward-slash relative paths so the existing browser URL construction continues
to work on Windows and when served over HTTP.

## Safety and verification

The sync never deletes project assets. Tests cover path mapping, cache
precedence, nested catalog paths, and RTTEX conversion failure behavior.
Verification compares the selected source map against generated PNGs, checks all
item texture references, parses the catalog, and loads the application over HTTP.

