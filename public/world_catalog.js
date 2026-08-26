(function worldCatalogModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GTWorldCatalog = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createWorldCatalog() {
    const WORLD_WIDTH = 100;
    const WORLD_HEIGHT = 60;
    const TILE_SIZE = 32;

    const CATEGORIES = Object.freeze([
      { key: "all", label: "All", icon: "🌐" },
      { key: "building", label: "Building Blocks", icon: "🧱" },
      { key: "wallpaper", label: "Wallpaper", icon: "🖼️" },
      { key: "hazard", label: "Hazard", icon: "🔥" },
      { key: "door", label: "Door & Portal", icon: "🚪" },
      { key: "sign", label: "Sign & Board", icon: "🪧" },
      { key: "platform", label: "Platform & Stairs", icon: "🪜" },
      { key: "lock", label: "Lock & Machine", icon: "🔒" },
      { key: "furniture", label: "Furniture & Items", icon: "🪑" },
      { key: "music", label: "Music", icon: "🎵" }
    ]);

    const WEATHERS = Object.freeze([
      { id: "TRANSPARENT", name: "✨ Transparent (No Background)", file: "", code: 999 },
      { id: "EMERALD_CITY", name: "Emerald City", file: "EMERALD_CITY.png", code: 80 },
      { id: "SUNNY", name: "Sunny Sky", file: "SUNNY.png", code: 1 },
      { id: "NIGHT", name: "Night", file: "NIGHT.png", code: 2 },
      { id: "SUNSET", name: "Sunset", file: "SUNSET.png", code: 3 },
      { id: "DESERT", name: "Arid / Desert", file: "DESERT.png", code: 4 },
      { id: "UNDERSEA", name: "Undersea", file: "UNDERSEA.png", code: 5 },
      { id: "VOLCANO", name: "Volcano", file: "VOLCANO.png", code: 6 },
      { id: "SNOWY", name: "Snowy", file: "SNOWY.png", code: 7 },
      { id: "SNOWY_NIGHT", name: "Snowy Night", file: "SNOWY_NIGHT.png", code: 8 },
      { id: "AUTUMN", name: "Autumn", file: "AUTUMN.png", code: 9 },
      { id: "SPRING", name: "Spring", file: "SPRING.png", code: 10 },
      { id: "SPOOKY", name: "Spooky", file: "SPOOKY.png", code: 11 },
      { id: "MARS", name: "Mars", file: "MARS.png", code: 12 },
      { id: "MOUNT_GROWMORE", name: "Mt. Growmore", file: "MOUNT_GROWMORE.png", code: 13 },
      { id: "JUNGLE", name: "Jungle", file: "JUNGLE.png", code: 14 },
      { id: "ICE_AGE", name: "Epoch: Ice Age", file: "ICE_AGE.png", code: 15 },
      { id: "FLOATING_ISLANDS", name: "Floating Islands", file: "FLOATING_ISLANDS.png", code: 16 },
      { id: "CANDY_LAND", name: "Candyland Blast", file: "CANDY_LAND.png", code: 17 },
      { id: "NEBULA", name: "Nebula", file: "NEBULA.png", code: 18 },
      { id: "NEPTUNES_ATLANTIS", name: "Neptune's Atlantis", file: "NEPTUNES_ATLANTIS.png", code: 19 },
      { id: "PAGODA", name: "Pagoda", file: "PAGODA.png", code: 20 },
      { id: "PLAZA", name: "Plaza", file: "PLAZA.png", code: 21 },
      { id: "POP_CITY", name: "Pop City", file: "POP_CITY.png", code: 22 },
      { id: "RAD_CITY", name: "Radical City Lock", file: "RAD_CITY.png", code: 23 },
      { id: "RAINY_CITY", name: "Rainy City", file: "RAINY_CITY.png", code: 24 },
      { id: "APOCALYPSE", name: "Apocalypse", file: "APOCALYPSE.png", code: 25 },
      { id: "ASCENDED", name: "Ascended Ship", file: "ASCENDED.png", code: 26 },
      { id: "ANCESTRAL_PLANE", name: "Ancestral Plane", file: "ANCESTRAL_PLANE.png", code: 27 },
      { id: "BALLOON_WARZ", name: "Balloon Warz", file: "BALLOON_WARZ.png", code: 28 },
      { id: "BLACK_DIGITAL_RAIN", name: "Black Digital Rain", file: "BLACK_DIGITAL_RAIN.png", code: 29 },
      { id: "BLACK_HOLE", name: "Black Hole", file: "BLACK_HOLE.png", code: 30 },
      { id: "BLOOD_DRAGON", name: "Blood Dragon Lock", file: "BLOOD_DRAGON.png", code: 31 },
      { id: "BOUNTIFUL", name: "Bountiful", file: "BOUNTIFUL.png", code: 32 },
      { id: "COMET2", name: "Comet", file: "COMET2.png", code: 33 },
      { id: "CONCERT_LIGHTS", name: "Concert Lights", file: "CONCERT_LIGHTS.png", code: 34 },
      { id: "CRACK_IN_REALITY", name: "Crack in Reality", file: "CRACK_IN_REALITY.png", code: 35 },
      { id: "DARK_MOUNTAINS", name: "Dark Mountains", file: "DARK_MOUNTAINS.png", code: 36 },
      { id: "DIGITAL_RAIN", name: "Digital Rain", file: "DIGITAL_RAIN.png", code: 37 },
      { id: "DRAGONS_KEEP", name: "Dragon's Keep", file: "DRAGONS_KEEP.png", code: 38 },
      { id: "ENCHANTED_LOCK", name: "Enchanted Lock", file: "ENCHANTED_LOCK.png", code: 39 },
      { id: "FENYX_LOCK", name: "Immortals Fenyx Rising", file: "FENYX_LOCK.png", code: 40 },
      { id: "FRUIT_KINGDOM", name: "Fruit Kingdom", file: "FRUIT_KINGDOM.png", code: 41 },
      { id: "GEMS", name: "Rainin' Gems", file: "GEMS.png", code: 42 },
      { id: "GROWTOPIA_SIGN", name: "Celebrity Hills", file: "GROWTOPIA_SIGN.png", code: 43 },
      { id: "HARVEST", name: "Harvest Moon", file: "HARVEST.png", code: 44 },
      { id: "HEART", name: "Heart", file: "HEART.png", code: 45 },
      { id: "HOLIDAY_HAVEN", name: "Holiday Haven", file: "HOLIDAY_HAVEN.png", code: 46 },
      { id: "LEGENDARY_CITY", name: "Legendary City", file: "LEGENDARY_CITY.png", code: 47 },
      { id: "METEOR", name: "Meteor Shower", file: "METEOR.png", code: 48 },
      { id: "MONOCHROME", name: "Monochrome", file: "MONOCHROME.png", code: 49 },
      { id: "PARTY", name: "Party", file: "PARTY.png", code: 50 },
      { id: "PINEAPPLE", name: "Pineapples", file: "PINEAPPLE.png", code: 51 },
      { id: "PINUSKI_PETAL_PURRFECT_HAVEN", name: "Pinuski's Petal Haven", file: "PINUSKI_PETAL_PURRFECT_HAVEN.png", code: 52 },
      { id: "PROTOSTAR", name: "Protostar Landing", file: "PROTOSTAR.png", code: 53 },
      { id: "RAYMAN_LOCK", name: "Rayman Lock", file: "RAYMAN_LOCK.png", code: 54 },
      { id: "REALM_OF_SPIRITS", name: "Realm of Spirits", file: "REALM_OF_SPIRITS.png", code: 55 },
      { id: "ROYAL_ENCHANTED_LOCK", name: "Royal Enchanted Lock", file: "ROYAL_ENCHANTED_LOCK.png", code: 56 },
      { id: "SOUTH_POLE_WINTERFEST", name: "South Pole Winterfest", file: "SOUTH_POLE_WINTERFEST.png", code: 57 },
      { id: "STEAMPUNK", name: "Steampunk", file: "STEAMPUNK.png", code: 58 },
      { id: "STPATRICKS", name: "St. Patrick's", file: "STPATRICKS.png", code: 59 },
      { id: "SURGERY", name: "Surgery", file: "SURGERY.png", code: 60 },
      { id: "TREASURE", name: "Treasure", file: "TREASURE.png", code: 61 },
      { id: "WARP", name: "Warp", file: "WARP.png", code: 62 },
      { id: "WOLF", name: "Howling Sky", file: "WOLF.png", code: 63 },
      { id: "BLANK", name: "Nothingness (Black)", file: "BLANK.png", code: 0 }
    ]);

    function isPlaceableItem(item) {
      if (!item || !item.name || item.id === 0 || !item.texture) return false;
      const name = String(item.name).trim();
      if (name.startsWith("Item #") || name === "") return false;

      const act = item.action || 0;
      const tex = String(item.texture || "").toLowerCase();
      const cat = String(item.category || "");

      // Exclude Seeds, Wearables/Clothing, and Consumables/Currencies
      if (act === 19 || act === 20 || cat === "Seeds" || cat === "Clothing & Cosmetics" || cat === "Consumables & Currencies") {
        return false;
      }
      if (tex.startsWith("player_") || tex.includes("player_cosmetics") || tex.includes("player_feet") || tex.includes("player_shirt") || tex.includes("player_hair") || tex.includes("player_hat") || tex.includes("player_faceitem") || tex.includes("player_back") || tex.includes("player_eyes") || tex.includes("player_chest")) {
        return false;
      }
      if (act === 1 || act === 4) return false;

      return true;
    }

    function isBackgroundItem(item) {
      if (!item) return false;
      // In Growtopia items.dat: action === 18 is Wallpaper / Background
      if (Number(item.action) === 18) return true;
      if (item.layer === 0 && item.action !== 0 && item.action !== 17) return true;
      return false;
    }

    function getItemCategoryKey(item) {
      if (!item) return "all";
      const action = Number(item.action) || 0;
      const name = String(item.name || "").toLowerCase();
      const cat = String(item.category || "").toLowerCase();

      if (action === 18 || isBackgroundItem(item)) return "wallpaper";
      if (action === 16 || name.includes("spike") || name.includes("hazard")) return "hazard";
      if (action === 1 || action === 2 || action === 26 || name.includes("door") || name.includes("portal") || name.includes("gate")) return "door";
      if (action === 4 || action === 27 || name.includes("sign") || name.includes("checkpoint")) return "sign";
      if (action === 21 || name.includes("platform") || name.includes("ladder") || name.includes("bridge")) return "platform";
      if ([3, 6, 7, 8, 97].includes(action) || name.includes("lock") || name.includes("vending") || name.includes("display")) return "lock";
      if (action === 28 || name.includes("music note") || name.includes("piano")) return "music";
      if ([12, 14, 15, 37, 38, 120].includes(action) || cat.includes("furniture") || name.includes("chair") || name.includes("table") || name.includes("couch") || name.includes("bench") || name.includes("desk")) return "furniture";
      if (action === 17 || action === 22 || item.spread_type === 2 || cat.includes("building") || cat.includes("blocks")) return "building";

      return "building";
    }

    function isFlippableItem(item) {
      if (!item) return false;
      const catKey = getItemCategoryKey(item);
      return catKey === "furniture" || catKey === "door" || catKey === "sign";
    }

    function filterPlaceableItems(allItems, { query = "", category = "all" } = {}) {
      const q = query.trim().toLowerCase();
      return allItems.filter(item => {
        if (!isPlaceableItem(item)) return false;
        if (category !== "all") {
          const itemCat = getItemCategoryKey(item);
          if (itemCat !== category) return false;
        }
        if (q) {
          const name = String(item.name || "").toLowerCase();
          const id = String(item.id || "");
          if (!name.includes(q) && !id.includes(q)) return false;
        }
        return true;
      });
    }

    function createStandardWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const airCutoff = Math.floor(height * 0.4);
      const bedrockRows = Math.max(1, Math.min(6, Math.floor(height * 0.1)));
      const bedrockCutoff = height - bedrockRows;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (y < airCutoff) {
            fg[idx] = 0;
            bg[idx] = 0;
          } else if (y < bedrockCutoff) {
            fg[idx] = 2; // Dirt
            bg[idx] = 0;
          } else {
            fg[idx] = 8; // Bedrock
            bg[idx] = 0;
          }
        }
      }

      // Main Door at spawn (x: center, y: ground surface - 1)
      const spawnX = Math.floor(width / 2);
      const spawnY = Math.max(0, airCutoff - 1);
      const doorIdx = spawnY * width + spawnX;
      fg[doorIdx] = 6; // Main Door
      bg[doorIdx] = 0;

      return {
        width,
        height,
        name: "World",
        weather: "SUNNY",
        weatherCode: 1,
        fg,
        bg,
        flags
      };
    }

    function createBlankWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const flags = new Uint8Array(total);

      // Bedrock only at bottom row
      for (let x = 0; x < width; x++) {
        const idx = (height - 1) * width + x;
        fg[idx] = 8;
      }

      return {
        width,
        height,
        name: "Blank World",
        weather: "SUNNY",
        weatherCode: 1,
        fg,
        bg,
        flags
      };
    }

    function createFlatWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const airCutoff = Math.floor(height * 0.55);
      const bedrockRows = Math.max(1, Math.min(5, Math.floor(height * 0.1)));
      const bedrockCutoff = height - bedrockRows;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (y < airCutoff) {
            fg[idx] = 0;
            bg[idx] = 0;
          } else if (y < bedrockCutoff) {
            fg[idx] = 2; // Dirt
            bg[idx] = 14; // Cave BG
          } else {
            fg[idx] = 8; // Bedrock
            bg[idx] = 14;
          }
        }
      }

      // Door at spawn (x: center, y: ground surface - 1)
      const spawnX = Math.floor(width / 2);
      const spawnY = Math.max(0, airCutoff - 1);
      const doorIdx = spawnY * width + spawnX;
      fg[doorIdx] = 6;
      bg[doorIdx] = 14;

      return {
        width,
        height,
        name: "Flat World",
        weather: "SUNNY",
        weatherCode: 1,
        fg,
        bg,
        flags
      };
    }

    function getWeathers() {
      return WEATHERS;
    }

    function getWeatherById(id) {
      return WEATHERS.find(w => w.id === id || w.file === id || String(w.code) === String(id)) || WEATHERS[0];
    }

    return Object.freeze({
      WORLD_WIDTH,
      WORLD_HEIGHT,
      TILE_SIZE,
      CATEGORIES,
      WEATHERS,
      getWeathers,
      isPlaceableItem,
      isBackgroundItem,
      getItemCategoryKey,
      isFlippableItem,
      filterPlaceableItems,
      createStandardWorld,
      createBlankWorld,
      createFlatWorld,
      getWeatherById
    });
  }
);
