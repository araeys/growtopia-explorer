(function wearableSequenceModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GTWearableSequence = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createWearableSequence() {
    const VERSION = 2;
    const STORAGE_KEY = "gt-set-planner:wearable-sequences:v2";
    const LEGACY_STORAGE_KEY = "gt-set-planner:wearable-sequences:v1";
    const MIN_INTERVAL_MS = 50;
    const MAX_INTERVAL_MS = 2000;
    const INTERVAL_STEP_MS = 10;
    const DEFAULT_INTERVAL_MS = 150;

    function normalizeTile(tile) {
      if (
        !tile ||
        !Number.isInteger(tile.dx) ||
        !Number.isInteger(tile.dy)
      ) {
        throw new TypeError("Sequence frame requires an integer tile offset");
      }
      return { dx: tile.dx, dy: tile.dy };
    }

    function normalizeDescriptor(value) {
      if (!value || typeof value !== "object") {
        throw new TypeError("Sequence descriptor must be an object");
      }
      if (value.mode === "replace-frame") {
        if (!Array.isArray(value.frames) || value.frames.length < 2) {
          throw new RangeError("Replacement sequence needs at least two frames");
        }
        return {
          mode: value.mode,
          frames: value.frames.map(normalizeTile),
        };
      }
      if (value.mode === "base-plus-overlay") {
        if (!Array.isArray(value.frames) || value.frames.length < 2) {
          throw new RangeError("Overlay sequence needs at least two frames");
        }
        return {
          mode: value.mode,
          base: normalizeTile(value.base),
          frames: value.frames.map(frame =>
            frame === null ? null : normalizeTile(frame)
          ),
        };
      }
      throw new TypeError(`Unsupported sequence mode: ${value.mode}`);
    }

    function getFrameCount(descriptor) {
      return normalizeDescriptor(descriptor).frames.length;
    }

    function normalizeIntervalMs(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return DEFAULT_INTERVAL_MS;
      const stepped =
        Math.round(numeric / INTERVAL_STEP_MS) * INTERVAL_STEP_MS;
      return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, stepped));
    }

    function clampFrame(value, frameCount) {
      const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
      return Math.max(
        0,
        Math.min(count - 1, Math.trunc(Number(value)) || 0)
      );
    }

    function normalizePlayback(value, frameCount) {
      const intervalMs = normalizeIntervalMs(value?.intervalMs);
      const frame = clampFrame(value?.frame, frameCount);
      const output =
        value && value.mode === "paused"
          ? { mode: "paused", frame, intervalMs }
          : { mode: "playing", frame, intervalMs };
      if (
        output.mode === "playing" &&
        Number.isFinite(Number(value?.startedAtMs))
      ) {
        output.startedAtMs = Number(value.startedAtMs);
      }
      return output;
    }

    function getVisibleFrame(playback, frameCount, tick) {
      const state = normalizePlayback(playback, frameCount);
      if (state.mode === "paused") return state.frame;
      const safeTick = Math.max(0, Math.trunc(Number(tick)) || 0);
      return (state.frame + safeTick) % frameCount;
    }

    function getVisibleFrameAtTime(playback, frameCount, nowMs) {
      const state = normalizePlayback(playback, frameCount);
      if (state.mode === "paused") return state.frame;
      const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
      const startedAtMs = Number.isFinite(Number(state.startedAtMs))
        ? Number(state.startedAtMs)
        : Number(nowMs) || 0;
      const elapsedMs = Math.max(0, (Number(nowMs) || 0) - startedAtMs);
      const elapsedFrames = Math.floor(elapsedMs / state.intervalMs);
      return (state.frame + elapsedFrames) % count;
    }

    function changeIntervalForVisibleFrame(
      playback,
      intervalMs,
      visibleFrame,
      frameCount,
      nowMs
    ) {
      const state = normalizePlayback(playback, frameCount);
      const frame = clampFrame(visibleFrame, frameCount);
      const nextIntervalMs = normalizeIntervalMs(intervalMs);
      if (state.mode === "paused") {
        return { mode: "paused", frame, intervalMs: nextIntervalMs };
      }
      return {
        mode: "playing",
        frame,
        intervalMs: nextIntervalMs,
        startedAtMs: Number(nowMs) || 0,
      };
    }

    function togglePlayback(playback, visibleFrame, frameCount, nowMs = 0) {
      const state = normalizePlayback(playback, frameCount);
      const frame = clampFrame(visibleFrame, frameCount);
      return state.mode === "playing"
        ? { mode: "paused", frame, intervalMs: state.intervalMs }
        : {
            mode: "playing",
            frame,
            intervalMs: state.intervalMs,
            startedAtMs: Number(nowMs) || 0,
          };
    }

    function stepPlayback(playback, delta, visibleFrame, frameCount) {
      const state = normalizePlayback(playback, frameCount);
      const count = Math.max(1, Math.trunc(Number(frameCount)) || 1);
      const current = clampFrame(visibleFrame, count);
      const step = Math.trunc(Number(delta)) || 0;
      return {
        mode: "paused",
        frame: (current + step + count) % count,
        intervalMs: state.intervalMs,
      };
    }

    function selectFrame(playback, frame, frameCount) {
      const state = normalizePlayback(playback, frameCount);
      return {
        mode: "paused",
        frame: clampFrame(frame, frameCount),
        intervalMs: state.intervalMs,
      };
    }

    function resolveDrawPlan(descriptorValue, playback, tick) {
      const descriptor = normalizeDescriptor(descriptorValue);
      const index = getVisibleFrame(
        playback,
        descriptor.frames.length,
        tick
      );
      if (descriptor.mode === "base-plus-overlay") {
        const overlay = descriptor.frames[index];
        return overlay === null
          ? [{ ...descriptor.base, role: "base" }]
          : [
              { ...descriptor.base, role: "base" },
              { ...overlay, role: "overlay" },
            ];
      }
      return [{ ...descriptor.frames[index], role: "replace" }];
    }

    function emptyState() {
      return { version: VERSION, items: {} };
    }

    function deserialize(raw) {
      try {
        const value = JSON.parse(raw);
        if (!value || typeof value.items !== "object") return emptyState();
        return { version: VERSION, items: { ...value.items } };
      } catch {
        return emptyState();
      }
    }

    function migrateLegacyState(raw) {
      try {
        const value = JSON.parse(raw);
        const items = {};
        for (const [itemId, playback] of Object.entries(value?.items || {})) {
          if (playback?.mode === "frame") {
            items[itemId] = {
              mode: "paused",
              frame: playback.frame,
              intervalMs: DEFAULT_INTERVAL_MS,
            };
          } else if (playback?.mode === "off") {
            items[itemId] = {
              mode: "paused",
              frame: 0,
              intervalMs: DEFAULT_INTERVAL_MS,
            };
          } else {
            items[itemId] = {
              mode: "playing",
              frame: 0,
              intervalMs: DEFAULT_INTERVAL_MS,
            };
          }
        }
        return { version: VERSION, items };
      } catch {
        return emptyState();
      }
    }

    function loadState(storage) {
      try {
        const current = storage.getItem(STORAGE_KEY);
        if (current) return deserialize(current);
        const legacy = storage.getItem(LEGACY_STORAGE_KEY);
        return legacy ? migrateLegacyState(legacy) : emptyState();
      } catch {
        return emptyState();
      }
    }

    function saveState(storage, state) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    }

    function getPlayback(state, itemId, frameCount) {
      return normalizePlayback(state?.items?.[String(itemId)], frameCount);
    }

    function setPlayback(state, itemId, playback, frameCount) {
      const previous = normalizePlayback(
        state?.items?.[String(itemId)],
        frameCount
      );
      return {
        version: VERSION,
        items: {
          ...(state?.items || {}),
          [String(itemId)]: normalizePlayback(
            {
              ...playback,
              intervalMs: playback?.intervalMs ?? previous.intervalMs,
            },
            frameCount
          ),
        },
      };
    }

    function setIntervalMs(state, itemId, intervalMs, frameCount) {
      const previous = normalizePlayback(
        state?.items?.[String(itemId)],
        frameCount
      );
      return setPlayback(
        state,
        itemId,
        { ...previous, intervalMs: normalizeIntervalMs(intervalMs) },
        frameCount
      );
    }

    function safeSlug(value) {
      return (
        String(value || "item")
          .normalize("NFKD")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/['’]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "item"
      );
    }

    function buildSequenceExportManifest({ canvas, items }) {
      const width = Number(canvas?.width);
      const height = Number(canvas?.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new RangeError("Sequence export canvas dimensions must be positive");
      }
      const outputItems = [];
      for (const entry of Array.isArray(items) ? items : []) {
        if (!entry?.item || !entry.descriptor) continue;
        const descriptor = normalizeDescriptor(entry.descriptor);
        const item = entry.item;
        const id = Number(item.id);
        const root = `items/${id}-${safeSlug(item.name)}`;
        const frames = descriptor.frames.map((unused, index) => ({
          index,
          filename: `${root}/frame-${String(index + 1).padStart(3, "0")}.png`,
          drawPlan: resolveDrawPlan(
            descriptor,
            { mode: "paused", frame: index },
            0
          ),
        }));
        outputItems.push({
          id,
          name: String(item.name || `Item ${id}`),
          slot: String(item.slot || entry.slot || ""),
          mode: descriptor.mode,
          finalLogicalOrigin: {
            x: Number(entry.finalLogicalOrigin?.x) || 0,
            y: Number(entry.finalLogicalOrigin?.y) || 0,
          },
          frames,
        });
      }
      outputItems.sort((left, right) => left.id - right.id);
      return {
        schemaVersion: VERSION,
        canvas: { width, height },
        items: outputItems,
      };
    }

    return Object.freeze({
      VERSION,
      STORAGE_KEY,
      LEGACY_STORAGE_KEY,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS,
      INTERVAL_STEP_MS,
      DEFAULT_INTERVAL_MS,
      normalizeDescriptor,
      getFrameCount,
      normalizeIntervalMs,
      normalizePlayback,
      getVisibleFrame,
      getVisibleFrameAtTime,
      changeIntervalForVisibleFrame,
      togglePlayback,
      stepPlayback,
      selectFrame,
      resolveDrawPlan,
      loadState,
      saveState,
      getPlayback,
      setPlayback,
      setIntervalMs,
      buildSequenceExportManifest,
    });
  }
);
