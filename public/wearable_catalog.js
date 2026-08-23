(function wearableCatalogModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GTWearableCatalog = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createWearableCatalog() {
    const ZERO_OFFSET = Object.freeze({ x: 0, y: 0 });
    const SLOT_CONFIG = Object.freeze([
      Object.freeze({
        key: "Back",
        label: "Back / Wings / Cape",
        icon: "🪽",
        phase: "behind-base",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Artifact",
        label: "Artifact",
        icon: "🔮",
        phase: "behind-base",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Feet",
        label: "Feet / Shoes / Boots",
        icon: "👟",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Pants",
        label: "Pants / Skirt / Shorts",
        icon: "👖",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Shirt",
        label: "Shirt / Jacket / Robe",
        icon: "👕",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Chest",
        label: "Chest / Armor / Vest",
        icon: "🦺",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Face",
        label: "Face / Glasses / Mask",
        icon: "🕶️",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      }),
      Object.freeze({
        key: "Hair",
        label: "Hair / Style",
        icon: "💇",
        phase: "wearable",
        defaultOffset: Object.freeze({ x: 0, y: -9 }),
        randomizable: true
      }),
      Object.freeze({
        key: "Hat",
        label: "Hat / Crown / Helmet",
        icon: "🧢",
        phase: "wearable",
        defaultOffset: Object.freeze({ x: 0, y: -18 }),
        randomizable: true
      }),
      Object.freeze({
        key: "Hand",
        label: "Hand Weapon / Tool",
        icon: "⚔️",
        phase: "wearable",
        defaultOffset: ZERO_OFFSET,
        randomizable: true
      })
    ]);

    const RENDER_PROFILES = Object.freeze({
      standard_32: Object.freeze({
        sourceWidth: 32,
        sourceHeight: 32,
        destinationWidth: 128,
        destinationHeight: 128
      })
    });

    function groupWearablesBySlot(items) {
      const grouped = Object.fromEntries(
        SLOT_CONFIG.map((slot) => [slot.key, []])
      );
      for (const item of Array.isArray(items) ? items : []) {
        if (Object.hasOwn(grouped, item.slot)) {
          grouped[item.slot].push(item);
        }
      }
      return grouped;
    }

    function getRenderProfile(name) {
      return RENDER_PROFILES[name] || RENDER_PROFILES.standard_32;
    }

    function getRenderLayers() {
      return SLOT_CONFIG.slice();
    }

    return Object.freeze({
      SLOT_CONFIG,
      RENDER_PROFILES,
      groupWearablesBySlot,
      getRenderProfile,
      getRenderLayers
    });
  }
);
