(function avatarPositioningModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AvatarPositioning = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createAvatarPositioning() {
    const VERSION = 2;
    const STORAGE_KEY = "gt-set-planner:item-positions:v2";
    const MIN_OFFSET = -32;
    const MAX_OFFSET = 32;

    function emptyState() {
      return { version: VERSION, positions: {} };
    }

    function normalizeAxis(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
      }
      return Math.max(
        MIN_OFFSET,
        Math.min(MAX_OFFSET, Math.trunc(value))
      );
    }

    function normalizeOffset(offset) {
      const value = offset && typeof offset === "object" ? offset : {};
      return {
        x: normalizeAxis(value.x),
        y: normalizeAxis(value.y)
      };
    }

    function getOffset(state, slot, itemId) {
      const stored = state
        && state.positions
        && state.positions[slot]
        && state.positions[slot][String(itemId)];
      return normalizeOffset(stored);
    }

    function setOffset(state, slot, itemId, offset) {
      const base = state && state.version === VERSION ? state : emptyState();
      return {
        version: VERSION,
        positions: {
          ...base.positions,
          [slot]: {
            ...(base.positions[slot] || {}),
            [String(itemId)]: normalizeOffset(offset)
          }
        }
      };
    }

    function resetOffset(state, slot, itemId) {
      const base = state && state.version === VERSION ? state : emptyState();
      const slotPositions = { ...(base.positions[slot] || {}) };
      delete slotPositions[String(itemId)];
      const positions = { ...base.positions };
      if (Object.keys(slotPositions).length) {
        positions[slot] = slotPositions;
      } else {
        delete positions[slot];
      }
      return { version: VERSION, positions };
    }

    function resetAll() {
      return emptyState();
    }

    function serialize(state) {
      return JSON.stringify(
        state && state.version === VERSION ? state : emptyState()
      );
    }

    function deserialize(value) {
      try {
        const parsed = JSON.parse(value);
        if (
          !parsed
          || parsed.version !== VERSION
          || !parsed.positions
          || typeof parsed.positions !== "object"
          || Array.isArray(parsed.positions)
        ) {
          return emptyState();
        }
        let normalized = emptyState();
        for (const [slot, items] of Object.entries(parsed.positions)) {
          if (!items || typeof items !== "object" || Array.isArray(items)) {
            continue;
          }
          for (const [itemId, offset] of Object.entries(items)) {
            normalized = setOffset(normalized, slot, itemId, offset);
          }
        }
        return normalized;
      } catch {
        return emptyState();
      }
    }

    function load(storage) {
      try {
        const value = storage && storage.getItem(STORAGE_KEY);
        return value ? deserialize(value) : emptyState();
      } catch {
        return emptyState();
      }
    }

    function save(storage, state) {
      try {
        storage.setItem(STORAGE_KEY, serialize(state));
        return true;
      } catch {
        return false;
      }
    }

    return Object.freeze({
      VERSION,
      STORAGE_KEY,
      MIN_OFFSET,
      MAX_OFFSET,
      emptyState,
      normalizeOffset,
      getOffset,
      setOffset,
      resetOffset,
      resetAll,
      serialize,
      deserialize,
      load,
      save
    });
  }
);
