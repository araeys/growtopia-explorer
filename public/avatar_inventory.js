(function avatarInventoryModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AvatarInventory = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createAvatarInventory() {
    const DEFAULT_CHUNK_SIZE = 120;

    function normalizeQuery(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^#/, "");
    }

    function filterItems(items, { query = "", slot = "All" } = {}) {
      const needle = normalizeQuery(query);
      return (Array.isArray(items) ? items : []).filter(item => {
        const slotMatches = slot === "All" || item.slot === slot;
        const queryMatches =
          !needle ||
          String(item.id) === needle ||
          String(item.name || "").toLowerCase().includes(needle);
        return slotMatches && queryMatches;
      });
    }

    function nextVisibleLimit(
      current,
      total,
      chunkSize = DEFAULT_CHUNK_SIZE
    ) {
      const safeCurrent =
        Number.isInteger(current) && current > 0 ? current : 0;
      const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
      const safeChunk =
        Number.isInteger(chunkSize) && chunkSize > 0
          ? chunkSize
          : DEFAULT_CHUNK_SIZE;
      return Math.min(safeTotal, safeCurrent + safeChunk);
    }

    function equipOrToggle(equipped, item) {
      const next = { ...(equipped || {}) };
      if (!item || !item.slot) return next;
      const current = next[item.slot];
      next[item.slot] =
        current && Number(current.id) === Number(item.id) ? null : item;
      return next;
    }

    function isEquipped(equipped, item) {
      if (!item || !item.slot) return false;
      const current = equipped && equipped[item.slot];
      return Boolean(
        current && Number(current.id) === Number(item.id)
      );
    }

    function resolveActiveTarget(equipped, slotOrder, preferred) {
      if (
        preferred &&
        preferred.slot &&
        equipped &&
        equipped[preferred.slot] &&
        Number(equipped[preferred.slot].id) === Number(preferred.itemId)
      ) {
        return {
          slot: preferred.slot,
          itemId: Number(preferred.itemId)
        };
      }

      for (const slot of Array.isArray(slotOrder) ? slotOrder : []) {
        const item = equipped && equipped[slot];
        if (item) {
          return { slot, itemId: Number(item.id) };
        }
      }
      return null;
    }

    return Object.freeze({
      DEFAULT_CHUNK_SIZE,
      normalizeQuery,
      filterItems,
      nextVisibleLimit,
      equipOrToggle,
      isEquipped,
      resolveActiveTarget
    });
  }
);
