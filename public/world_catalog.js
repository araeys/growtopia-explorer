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
      { key: "platform", label: "Platform & Stairs", icon: "🪜" },
      { key: "door", label: "Door & Portal", icon: "🚪" },
      { key: "sign", label: "Sign & Board", icon: "🪧" },
      { key: "hazard", label: "Hazard", icon: "🔥" },
      { key: "paint", label: "Paint & Colors", icon: "🎨" },
      { key: "lock", label: "Lock & Machine", icon: "🔒" },
      { key: "furniture", label: "Furniture & Items", icon: "🪑" },
      { key: "music", label: "Music", icon: "🎵" }
    ]);

    const PAINT_COLORS = Object.freeze({
      3478: "#ff2222", // Red
      3480: "#ffea00", // Yellow
      3482: "#00e676", // Green
      3484: "#00e5ff", // Aqua
      3486: "#2979ff", // Blue
      3488: "#d500f9", // Purple
      3490: "#212121", // Charcoal
      3492: null       // Varnish (Removes paint)
    });

    function isPaintItem(item) {
      if (!item) return false;
      const id = Number(item.id);
      if (PAINT_COLORS.hasOwnProperty(id)) return true;
      const name = String(item.name || "").toLowerCase();
      return name.includes("paint bucket") || name === "varnish";
    }

    function getPaintColor(item) {
      if (!item) return null;
      const id = Number(item.id);
      if (PAINT_COLORS.hasOwnProperty(id)) return PAINT_COLORS[id];
      const name = String(item.name || "").toLowerCase();
      if (name.includes("red")) return "#ff2222";
      if (name.includes("yellow")) return "#ffea00";
      if (name.includes("green")) return "#00e676";
      if (name.includes("aqua")) return "#00e5ff";
      if (name.includes("blue")) return "#2979ff";
      if (name.includes("purple")) return "#d500f9";
      if (name.includes("charcoal")) return "#212121";
      return null;
    }

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

      // Paint Buckets are always placeable
      if (isPaintItem(item)) return true;

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
      const act = Number(item.action) || 0;
      // In Growtopia items.dat: action === 18 is Wallpaper / Background
      if (act === 18) return true;
      if (item.layer === 0 && act !== 0 && act !== 17 && act !== 15 && act !== 22) return true;
      return false;
    }

    function getItemCategoryKey(item) {
      if (!item) return "all";
      const action = Number(item.action) || 0;
      const name = String(item.name || "").toLowerCase();
      const cat = String(item.category || "").toLowerCase();

      // 0. Paint Buckets & Colors
      if (isPaintItem(item)) {
        return "paint";
      }

      // 1. Wallpaper / Background
      if (action === 18 || isBackgroundItem(item)) {
        return "wallpaper";
      }

      // 2. Hazards (Spikes, Lava, Acid, Deathtraps, Storm Clouds)
      if (
        action === 16 || action === 126 || action === 136 ||
        name.includes("spike") || name.includes("lava") || name.includes("hazard") || name.includes("deathtrap")
      ) {
        return "hazard";
      }

      // 3. Doors & Portals (Main Door, Dungeon Door, VIP Entrance, Portals, Gates)
      if (
        action === 1 || action === 2 || action === 26 || action === 43 || action === 84 ||
        action === 104 || action === 105 || action === 106 || action === 142 ||
        name.includes("door") || name.includes("portal") || name.includes("gate") || name.includes("entrance")
      ) {
        return "door";
      }

      // 4. Signs & Boards (Sign, Pointy Sign, Crappy Sign, Bulletin Board, Checkpoints)
      if (
        action === 4 || action === 10 || action === 27 || action === 34 ||
        name.includes("sign") || name.includes("bulletin") || name.includes("guestbook") || name.includes("checkpoint")
      ) {
        return "sign";
      }

      // 5. Platforms & Stairs (Wooden Platform, Ladder, Stairs, Bridges, Climbing Wall)
      if (
        action === 21 || action === 145 ||
        name.includes("platform") || name.includes("ladder") || name.includes("stairs") ||
        name.includes("bridge") || name.includes("lattice") || name.includes("bannister")
      ) {
        return "platform";
      }

      // 6. Locks, Vending & Machines (WL, DL, Weather Machines, Vending, Generators, Magplant, Gaia, Safe)
      if (
        [3, 6, 7, 8, 41, 50, 53, 62, 80, 81, 89, 91, 92, 95, 96, 100, 103, 111, 116, 117, 123, 125, 130, 134].includes(action) ||
        name.includes("lock") || name.includes("weather machine") || name.includes("machine") ||
        name.includes("vending") || name.includes("generator") || name.includes("display") ||
        name.includes("camera") || name.includes("processor") || name.includes("safe") || name.includes("magplant")
      ) {
        return "lock";
      }

      // 7. Music & Audio (Notes, Pianos, Drums, Boomboxes, Audio Racks, Organ)
      if (
        action === 12 || action === 28 || action === 71 || action === 99 ||
        name.includes("music") || name.includes("piano") || name.includes("drum") ||
        name.includes("note") || name.includes("boombox") || name.includes("audio") || name.includes("speaker")
      ) {
        return "music";
      }

      // 8. Furniture & Decorative Items (Tables, Couches, Chairs, Desks, Ovens, Statues, Crops, Beds, Storage)
      if (
        [14, 35, 36, 38, 39, 47, 49, 55, 58, 59, 61, 73, 76, 77, 83, 87, 88, 94, 97, 98, 118, 120, 122, 138, 140].includes(action) ||
        cat.includes("furniture") || name.includes("chair") || name.includes("table") || name.includes("couch") ||
        name.includes("bench") || name.includes("desk") || name.includes("shelf") || name.includes("bed") ||
        name.includes("statue") || name.includes("oven") || name.includes("mannequin") || name.includes("portrait") ||
        name.includes("box") || name.includes("light") || name.includes("plant") || name.includes("tree")
      ) {
        return "furniture";
      }

      // 9. Building Blocks (Solid Blocks, Bedrock, Soil, Bricks, Tiles, Starship Hull, Minerals)
      if (
        [15, 17, 22, 25, 60, 69, 90, 108, 110, 127, 128, 141, 144].includes(action) ||
        item.spread_type === 2 || cat.includes("building") || cat.includes("blocks")
      ) {
        return "building";
      }

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
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const surfaceY = Math.floor(height * 0.40);
      const bedrockRows = 6;
      const bedrockCutoff = height - bedrockRows;

      // Deterministic PRNG for reliable procedural generation
      let seed = 48271;
      function rnd() {
        seed = (seed * 16807 + 7) % 2147483647;
        return (seed - 1) / 2147483646;
      }

      // 1. Fill base terrain (Dirt + Cave Background + Bedrock floor)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (y >= surfaceY) {
            if (y < bedrockCutoff) {
              fg[idx] = 2; // Dirt
              bg[idx] = 14; // Cave BG
            } else {
              fg[idx] = 8; // Bedrock
              bg[idx] = 14; // Cave BG
            }
          }
        }
      }

      // 2. Procedural Rock Clusters (ID 10)
      const numRockClusters = Math.floor((width * (bedrockCutoff - surfaceY)) / 40);
      for (let c = 0; c < numRockClusters; c++) {
        const cx = Math.floor(rnd() * width);
        const cy = surfaceY + 2 + Math.floor(rnd() * (bedrockCutoff - surfaceY - 3));
        const clusterSize = 3 + Math.floor(rnd() * 5);
        for (let i = 0; i < clusterSize; i++) {
          const ox = cx + Math.floor(rnd() * 3) - 1;
          const oy = cy + Math.floor(rnd() * 3) - 1;
          if (ox >= 0 && ox < width && oy >= surfaceY && oy < bedrockCutoff) {
            fg[oy * width + ox] = 10; // Rock
          }
        }
      }

      // 3. Deep Lava Veins (ID 4)
      const lavaStartDepth = surfaceY + Math.floor((bedrockCutoff - surfaceY) * 0.45);
      const numLavaClusters = Math.floor(width / 6);
      for (let c = 0; c < numLavaClusters; c++) {
        const cx = Math.floor(rnd() * width);
        const cy = lavaStartDepth + Math.floor(rnd() * (bedrockCutoff - lavaStartDepth - 2));
        const clusterSize = 4 + Math.floor(rnd() * 7);
        for (let i = 0; i < clusterSize; i++) {
          const ox = cx + Math.floor(rnd() * 3) - 1;
          const oy = cy + Math.floor(rnd() * 3) - 1;
          if (ox >= 0 && ox < width && oy >= surfaceY && oy < bedrockCutoff) {
            fg[oy * width + ox] = 4; // Lava
          }
        }
      }

      // 4. Main Spawn Door (Center Surface) + 1 Bedrock tile directly underneath
      const spawnX = Math.floor(width / 2);
      const spawnY = surfaceY - 1;
      fg[spawnY * width + spawnX] = 6; // Main Door
      bg[spawnY * width + spawnX] = 0;
      fg[(spawnY + 1) * width + spawnX] = 8; // Bedrock block under main door

      // 5. Surface trees & wooden plants
      for (const tx of [spawnX - 12, spawnX + 14, spawnX - 28, spawnX + 30]) {
        if (tx >= 3 && tx < width - 3) {
          fg[(surfaceY - 1) * width + tx] = 100; // Wood Block
          fg[(surfaceY - 2) * width + tx] = 100;
          fg[(surfaceY - 3) * width + tx] = 16; // Grass crown
          fg[(surfaceY - 3) * width + (tx - 1)] = 16;
          fg[(surfaceY - 3) * width + (tx + 1)] = 16;
        }
      }

      return {
        width,
        height,
        name: "World",
        weather: "SUNNY",
        weatherCode: 1,
        fg,
        bg,
        paint,
        flags
      };
    }

    function createBlankWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
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
        paint,
        flags
      };
    }

    function createFlatWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const airCutoff = Math.floor(height * 0.55);
      const bedrockCutoff = height - Math.max(1, Math.min(5, Math.floor(height * 0.1)));

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
        paint,
        flags
      };
    }

    function createNatureWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const baseGroundY = Math.floor(height * 0.58);
      const bedrockCutoff = height - Math.max(1, Math.min(5, Math.floor(height * 0.1)));

      // 1. Natural Rolling Hills Terrain with Soil & Cave BG
      const surfaceProfile = new Int32Array(width);
      for (let x = 0; x < width; x++) {
        const hillOffset = Math.round(
          Math.sin((x / width) * Math.PI * 4) * 4 +
          Math.sin((x / width) * Math.PI * 8) * 2 +
          Math.cos((x / width) * Math.PI * 2) * 3
        );
        const surfaceY = Math.max(12, baseGroundY + hillOffset);
        surfaceProfile[x] = surfaceY;

        for (let y = 0; y < height; y++) {
          const idx = y * width + x;
          if (y >= surfaceY) {
            if (y === surfaceY) {
              fg[idx] = 16; // Grass top layer
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
      }

      // 2. Wildflowers & Mushrooms along grassy slopes
      const flowerIds = [190, 22, 188, 194]; // Rose, Daisy, Poppy, Mushroom
      for (let x = 2; x < width - 2; x++) {
        const sy = surfaceProfile[x];
        if (sy > 2 && (x % 3 === 0 || x % 7 === 2)) {
          fg[(sy - 1) * width + x] = flowerIds[(x * 5) % flowerIds.length];
        }
      }

      // 3. Cozy Woodland Cottage (Center Village, X: center - 12 .. center + 12)
      const lodgeLeft = Math.floor(width / 2) - 10;
      const lodgeRight = lodgeLeft + 20;
      const lodgeGroundY = surfaceProfile[Math.floor(width / 2)];
      const lodgeFloorY = lodgeGroundY - 1;
      const lodgeRoofY = lodgeFloorY - 9;

      // Cottage Foundation & Brick Chimney
      for (let x = lodgeLeft; x <= lodgeRight; x++) {
        for (let y = lodgeFloorY; y <= lodgeGroundY; y++) {
          fg[y * width + x] = 116; // Bricks
        }
      }

      // Cottage Interior & Walls
      for (let y = lodgeRoofY; y < lodgeFloorY; y++) {
        for (let x = lodgeLeft; x <= lodgeRight; x++) {
          const idx = y * width + x;
          const isOuterWall = (x === lodgeLeft || x === lodgeRight || y === lodgeRoofY);
          if (isOuterWall) {
            fg[idx] = 100; // Wood Block wall
          } else {
            bg[idx] = 118; // Brick Wallpaper interior
            if (y === lodgeFloorY - 4) {
              fg[idx] = 102; // Wooden Platform second floor
            }
            // Windows
            if ((y === lodgeFloorY - 2 || y === lodgeFloorY - 6) && (x === lodgeLeft + 4 || x === lodgeRight - 4)) {
              fg[idx] = 56; // Glass Pane window
            }
          }
        }
      }

      // Gabled Roof
      for (let rx = lodgeLeft - 2; rx <= lodgeRight + 2; rx++) {
        const offset = Math.min(rx - (lodgeLeft - 2), (lodgeRight + 2) - rx);
        const ry = lodgeRoofY - Math.floor(offset / 2);
        if (ry >= 0) {
          fg[ry * width + rx] = 100; // Wood Block roof
        }
      }

      // Cottage Chimney & Torches
      for (let cy = lodgeRoofY - 4; cy <= lodgeFloorY; cy++) {
        fg[cy * width + (lodgeRight - 2)] = 116; // Brick Chimney
      }
      fg[(lodgeFloorY - 1) * width + lodgeLeft] = 696; // Lantern Torch
      fg[(lodgeFloorY - 1) * width + lodgeRight] = 696; // Lantern Torch
      fg[(lodgeFloorY - 1) * width + (lodgeLeft + 2)] = 24; // Pointy Sign "Cozy Cottage"

      // Cottage Porch & House Entrance / Main Spawn Door
      const spawnX = lodgeLeft + 8;
      fg[(lodgeFloorY - 1) * width + spawnX] = 6; // Main Door
      fg[(lodgeFloorY - 1) * width + (spawnX + 6)] = 224; // House Entrance

      // 4. Grand Ancient Canopy Trees (Left: X 8..20, Right: X width - 22..width - 10)
      function buildGiantTree(trunkX) {
        const tGroundY = surfaceProfile[trunkX];
        const trunkH = 10;
        const crownTop = tGroundY - trunkH - 4;

        // Trunk
        for (let y = tGroundY - trunkH; y < tGroundY; y++) {
          fg[y * width + trunkX] = 100;
          fg[y * width + (trunkX + 1)] = 100;
        }

        // Tree Canopy Foliage (Grass ID 16) & Platforms
        for (let cy = crownTop; cy <= tGroundY - trunkH + 2; cy++) {
          const radius = 6 - Math.abs(cy - (crownTop + 3));
          for (let cx = trunkX - radius; cx <= trunkX + radius + 1; cx++) {
            if (cx >= 0 && cx < width && cy >= 0) {
              const cIdx = cy * width + cx;
              if (fg[cIdx] === 0) {
                if (cy === tGroundY - trunkH && (cx === trunkX - 2 || cx === trunkX + 3)) {
                  fg[cIdx] = 102; // Treehouse wooden platform
                } else {
                  fg[cIdx] = 16; // Foliage
                }
              }
            }
          }
        }
      }

      buildGiantTree(12);
      buildGiantTree(width - 16);

      // 5. Wooden Suspension Bridges connecting trees to cottage roof
      for (let bx = 16; bx < lodgeLeft - 1; bx++) {
        const by = lodgeRoofY + 2;
        fg[by * width + bx] = 102; // Wooden Platform Bridge
      }
      for (let bx = lodgeRight + 2; bx < width - 16; bx++) {
        const by = lodgeRoofY + 2;
        fg[by * width + bx] = 102; // Wooden Platform Bridge
      }

      return {
        width,
        height,
        name: "Nature World",
        weather: "SPRING",
        weatherCode: 10,
        fg,
        bg,
        paint,
        flags
      };
    }

    function createParkourWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      // 1. Deadly Bottom Abyss (Lava Sea at Y 58 + Bedrock at Y 59)
      const bedrockY = height - 1;
      const lavaY = height - 2;
      for (let x = 0; x < width; x++) {
        fg[bedrockY * width + x] = 8; // Bedrock floor
        fg[lavaY * width + x] = 4;   // Lava sea
      }

      // 2. Sector 0: Starting Castle Lobby (X: 3..15, Y: 46..54)
      const lobbyLeft = 4;
      const lobbyRight = 16;
      const lobbyFloorY = height - 8;

      for (let x = lobbyLeft; x <= lobbyRight; x++) {
        for (let y = lobbyFloorY; y < height - 2; y++) {
          fg[y * width + x] = 116; // Bricks base
          bg[y * width + x] = 118; // Brick BG
        }
      }
      // Castle battlements on lobby
      fg[(lobbyFloorY - 1) * width + lobbyLeft] = 116;
      fg[(lobbyFloorY - 1) * width + (lobbyLeft + 2)] = 116;
      fg[(lobbyFloorY - 1) * width + (lobbyRight - 2)] = 116;
      fg[(lobbyFloorY - 1) * width + lobbyRight] = 116;
      fg[(lobbyFloorY - 2) * width + lobbyLeft] = 696; // Torch
      fg[(lobbyFloorY - 2) * width + lobbyRight] = 696; // Torch

      // Spawn Door & Welcome Sign
      const spawnX = lobbyLeft + 4;
      fg[(lobbyFloorY - 1) * width + spawnX] = 6; // Main Door
      fg[(lobbyFloorY - 1) * width + (spawnX + 4)] = 24; // Pointy Sign "PARKOUR ARENA - Jump to the Sky!"

      // 3. Multi-Tiered Floating Obstacle Course Structure
      // Array of platforms & challenges
      const parkourObstacles = [
        // Stage 1: Cloud Steps (Ascending gentle jumps)
        { x: 19, y: height - 10, w: 4, type: "cloud" },
        { x: 25, y: height - 13, w: 3, type: "cloud" },
        { x: 30, y: height - 16, w: 4, type: "cloud" },
        { x: 36, y: height - 19, w: 3, type: "platform" },
        
        // Stage 2: Tower 1 & Checkpoint 1
        { x: 41, y: height - 23, w: 6, type: "brick_tower", checkpoint: true },
        
        // Stage 3: The Spike Gauntlet (Precision gaps over spikes)
        { x: 49, y: height - 25, w: 3, type: "cloud" },
        { x: 54, y: height - 28, w: 4, type: "spikes_bridge" },
        { x: 60, y: height - 31, w: 3, type: "platform" },
        { x: 65, y: height - 34, w: 5, type: "spikes_bridge" },
        
        // Stage 4: Tower 2 & Checkpoint 2
        { x: 72, y: height - 37, w: 6, type: "brick_tower", checkpoint: true },

        // Stage 5: High Altitude Clouds
        { x: 66, y: height - 41, w: 3, type: "cloud" },
        { x: 60, y: height - 44, w: 3, type: "cloud" },
        { x: 53, y: height - 47, w: 4, type: "platform" },
        { x: 45, y: height - 49, w: 3, type: "cloud" },
        { x: 38, y: height - 51, w: 4, type: "spikes_bridge" },
        { x: 31, y: height - 52, w: 3, type: "cloud" },

        // Stage 6: Grand Apex Victory Sky Castle (X: 10..26, Y: 4..12)
        { x: 10, y: 12, w: 18, type: "victory_citadel" }
      ];

      parkourObstacles.forEach(ob => {
        if (ob.type === "cloud") {
          for (let i = 0; i < ob.w; i++) {
            const px = ob.x + i;
            if (px < width && ob.y < height) {
              fg[ob.y * width + px] = 728; // Clouds
              if (ob.y + 1 < height) fg[(ob.y + 1) * width + px] = 728;
            }
          }
        } else if (ob.type === "platform") {
          for (let i = 0; i < ob.w; i++) {
            const px = ob.x + i;
            if (px < width && ob.y < height) {
              fg[ob.y * width + px] = 102; // Wooden Platform
            }
          }
        } else if (ob.type === "spikes_bridge") {
          for (let i = 0; i < ob.w; i++) {
            const px = ob.x + i;
            if (px < width && ob.y < height) {
              fg[ob.y * width + px] = 116; // Brick base
              if (i === 1 && ob.y > 1) {
                fg[(ob.y - 1) * width + px] = 162; // Death Spikes
              }
            }
          }
        } else if (ob.type === "brick_tower") {
          for (let i = 0; i < ob.w; i++) {
            const px = ob.x + i;
            for (let ty = ob.y; ty <= ob.y + 4 && ty < height - 2; ty++) {
              if (px < width) {
                fg[ty * width + px] = 116; // Bricks
                bg[ty * width + px] = 118; // Brick BG
              }
            }
          }
          if (ob.checkpoint && ob.y > 1) {
            fg[(ob.y - 1) * width + (ob.x + 2)] = 30; // Checkpoint Dungeon Door
            fg[(ob.y - 1) * width + (ob.x + 5)] = 696; // Torch
          }
        } else if (ob.type === "victory_citadel") {
          // Grand floating castle in the sky
          for (let i = 0; i < ob.w; i++) {
            const px = ob.x + i;
            for (let ty = ob.y; ty <= ob.y + 4; ty++) {
              if (px < width) {
                fg[ty * width + px] = 116; // Bricks
                bg[ty * width + px] = 118; // Brick BG
              }
            }
          }
          // Battlements, Finish Portcullis & Winner Pedestals
          fg[(ob.y - 1) * width + ob.x] = 116;
          fg[(ob.y - 1) * width + (ob.x + ob.w - 1)] = 116;
          fg[(ob.y - 2) * width + ob.x] = 696;
          fg[(ob.y - 2) * width + (ob.x + ob.w - 1)] = 696;
          fg[(ob.y - 1) * width + (ob.x + Math.floor(ob.w / 2))] = 60; // Portcullis finish
          fg[(ob.y - 1) * width + (ob.x + Math.floor(ob.w / 2) + 3)] = 24; // Sign "VICTORY! YOU DID IT!"
        }
      });

      return {
        width,
        height,
        name: "Parkour Arena",
        weather: "FLOATING_ISLANDS",
        weatherCode: 16,
        fg,
        bg,
        paint,
        flags
      };
    }

    function createHorrorWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      const castleLeft = 6;
      const castleRight = width - 6;
      const castleTopY = 8;
      const floor1Y = 20;
      const floor2Y = 34;
      const floor3Y = 48;
      const lavaFloorY = height - 3;
      const bedrockY = height - 1;

      // 1. Bedrock base & Subterranean Lava Chasms
      for (let x = 0; x < width; x++) {
        fg[bedrockY * width + x] = 8;
        if (x >= 14 && x <= width - 14) {
          fg[lavaFloorY * width + x] = 4; // Boiling Lava Lake
          fg[(lavaFloorY + 1) * width + x] = 4;
        } else {
          fg[lavaFloorY * width + x] = 666; // Dark Granite
        }
      }

      // 2. Full Interior Stone Wall Wallpaper (ID 336)
      for (let y = castleTopY; y < lavaFloorY; y++) {
        for (let x = castleLeft; x <= castleRight; x++) {
          bg[y * width + x] = 336; // Stone Wall BG
        }
      }

      // 3. Castle Outer Walls, Towers & Crenellations
      for (let y = castleTopY; y <= lavaFloorY; y++) {
        fg[y * width + castleLeft] = 666; // Granite left wall
        fg[y * width + (castleLeft + 1)] = 248; // Evil Bricks
        fg[y * width + (castleRight - 1)] = 248; // Evil Bricks
        fg[y * width + castleRight] = 666; // Granite right wall
      }
      // Top Battlements & Gargoyle Torches
      for (let x = castleLeft - 2; x <= castleRight + 2; x += 3) {
        fg[(castleTopY - 1) * width + x] = 666;
        if (x === castleLeft || x === castleRight) {
          fg[(castleTopY - 2) * width + x] = 696; // Torch
        }
      }

      // 4. Floor 1: Grand Vampire Citadel & Entrance Hall (Y: 20)
      for (let x = castleLeft; x <= castleRight; x++) {
        fg[floor1Y * width + x] = (x % 4 === 0) ? 666 : 248; // Alternating Granite & Evil Bricks
      }
      // Gothic arched stained windows
      for (let wx = castleLeft + 8; wx <= castleRight - 8; wx += 14) {
        fg[(floor1Y - 4) * width + wx] = 56; // Glass Pane window
        fg[(floor1Y - 5) * width + wx] = 56;
      }
      // Grand Entrance Dungeon Door & Torches
      const spawnX = Math.floor(width / 2);
      fg[(floor1Y - 1) * width + spawnX] = 30; // Dungeon Door Spawn
      fg[(floor1Y - 1) * width + (spawnX - 3)] = 696; // Torch
      fg[(floor1Y - 1) * width + (spawnX + 3)] = 696; // Torch
      fg[(floor1Y - 1) * width + (spawnX + 6)] = 24; // Pointy Sign "CASTLE OF SHADOWS"

      // 5. Floor 2: Prison Dungeons & Torture Chambers (Y: 34)
      for (let x = castleLeft; x <= castleRight; x++) {
        if (x < castleLeft + 8 || x > castleRight - 8 || (x > spawnX - 14 && x < spawnX + 14)) {
          fg[floor2Y * width + x] = 666; // Granite
        } else {
          fg[floor2Y * width + x] = 102; // Wooden Platform catwalks over the drop
        }
      }
      // Dungeon Cell Bars (Portcullis ID 60) & Death Spikes (ID 162)
      for (let cellX of [castleLeft + 6, castleLeft + 18, castleRight - 18, castleRight - 6]) {
        for (let py = floor2Y - 5; py < floor2Y; py++) {
          fg[py * width + cellX] = 60; // Portcullis Iron Bars
        }
        fg[(floor2Y - 1) * width + (cellX - 2)] = 162; // Spikes inside cell
        fg[(floor2Y - 1) * width + (cellX + 2)] = 696; // Torch
      }

      // 6. Floor 3: Ancient Underworld Crypt & Sacrificial Altar (Y: 48)
      for (let x = castleLeft; x <= castleRight; x++) {
        if (x > castleLeft + 12 && x < castleRight - 12) {
          fg[floor3Y * width + x] = 248; // Evil Bricks altar platform
        } else {
          fg[floor3Y * width + x] = 102; // Wooden Platforms
        }
      }
      // Crypt Altar & Torches
      fg[(floor3Y - 1) * width + spawnX] = 666; // Altar stone
      fg[(floor3Y - 2) * width + spawnX] = 696; // Altar flame
      fg[(floor3Y - 1) * width + (spawnX - 4)] = 30; // Crypt Door
      fg[(floor3Y - 1) * width + (spawnX + 4)] = 162; // Altar spikes

      return {
        width,
        height,
        name: "Horror Dungeon",
        weather: "SPOOKY",
        weatherCode: 11,
        fg,
        bg,
        paint,
        flags
      };
    }

    function createSciFiWorld(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
      width = Math.max(10, Math.min(200, parseInt(width, 10) || WORLD_WIDTH));
      height = Math.max(10, Math.min(200, parseInt(height, 10) || WORLD_HEIGHT));
      const total = width * height;
      const fg = new Uint16Array(total);
      const bg = new Uint16Array(total);
      const paint = new Uint16Array(total);
      const flags = new Uint8Array(total);

      // Bedrock at bottom floor
      for (let x = 0; x < width; x++) {
        fg[(height - 1) * width + x] = 8;
      }

      const shipLeft = 8;
      const shipRight = width - 8;
      const shipTopY = 10;
      const shipBottomY = height - 12;
      const bridgeFloorY = 22;
      const deck2FloorY = 34;

      // 1. Outer Reinforced Steel Hull Structure (ID 186)
      for (let y = shipTopY; y <= shipBottomY; y++) {
        fg[y * width + shipLeft] = 186; // Left outer hull
        fg[y * width + (shipLeft + 1)] = 186;
        fg[y * width + (shipRight - 1)] = 186;
        fg[y * width + shipRight] = 186; // Right outer hull
      }
      for (let x = shipLeft; x <= shipRight; x++) {
        fg[shipTopY * width + x] = 186; // Roof hull
        fg[shipBottomY * width + x] = 186; // Bottom keel hull
      }

      // Interior Wallpaper (Glass Pane BG / Windows into Nebula)
      for (let y = shipTopY + 1; y < shipBottomY; y++) {
        for (let x = shipLeft + 2; x < shipRight - 1; x++) {
          bg[y * width + x] = 56; // Glass Pane BG
        }
      }

      // 2. Main Flight Deck & Command Bridge (Deck 1, Y: 22)
      for (let x = shipLeft + 2; x < shipRight - 1; x++) {
        fg[bridgeFloorY * width + x] = (x % 6 === 0) ? 186 : 102; // Steel pillars & Platform floors
      }
      // Panoramic Observation Windows
      for (let wx = shipLeft + 12; wx <= shipRight - 12; wx += 8) {
        fg[(bridgeFloorY - 4) * width + wx] = 56; // Glass Pane
        fg[(bridgeFloorY - 5) * width + wx] = 56;
      }

      // 3. Crew Quarters & Engineering Lab (Deck 2, Y: 34)
      for (let x = shipLeft + 2; x < shipRight - 1; x++) {
        fg[deck2FloorY * width + x] = 186; // Steel floor
      }

      // 4. Left Wing: Airlock & Cargo Docking Bay (X: shipLeft..shipLeft + 20)
      const airlockDoorX = shipLeft + 6;
      fg[(bridgeFloorY - 1) * width + airlockDoorX] = 6; // Main Airlock Door Spawn
      fg[(bridgeFloorY - 1) * width + (airlockDoorX + 4)] = 28; // Danger Sign "AIRLOCK - DECOMPRESSION HAZARD"
      fg[(bridgeFloorY - 1) * width + (airlockDoorX + 8)] = 696; // Beacon Torch

      // 5. Center Core: Command Hologram & Computer Consoles
      const centerBridgeX = Math.floor(width / 2);
      fg[(bridgeFloorY - 1) * width + centerBridgeX] = 24; // Pointy Sign "USS STARGAZER - BRIDGE"
      fg[(bridgeFloorY - 1) * width + (centerBridgeX - 3)] = 56; // Hologram display
      fg[(bridgeFloorY - 1) * width + (centerBridgeX + 3)] = 56;

      // 6. Right Wing: Superheated Fusion Core Reactor (X: shipRight - 22..shipRight - 4, Y: 24..33)
      const reactorLeft = shipRight - 18;
      const reactorRight = shipRight - 4;
      for (let ry = bridgeFloorY + 2; ry <= deck2FloorY - 2; ry++) {
        for (let rx = reactorLeft; rx <= reactorRight; rx++) {
          const isContainment = (rx === reactorLeft || rx === reactorRight || ry === bridgeFloorY + 2 || ry === deck2FloorY - 2);
          if (isContainment) {
            fg[ry * width + rx] = 186; // Steel containment
          } else {
            fg[ry * width + rx] = 4; // Glowing Lava Plasma Core!
          }
        }
      }
      fg[(deck2FloorY - 1) * width + (reactorLeft - 2)] = 28; // Danger Sign "CORE OVERLOAD HAZARD"
      fg[(deck2FloorY - 1) * width + (reactorLeft - 4)] = 30; // Reactor Chamber Door

      // 7. External Radiator Solar Panels & Antenna Arrays
      for (let ax = shipLeft - 6; ax < shipLeft; ax++) {
        fg[bridgeFloorY * width + ax] = 102; // Solar wing platform
        if (ax % 2 === 0) fg[(bridgeFloorY - 1) * width + ax] = 56; // Solar cell
      }
      for (let ax = shipRight + 1; ax <= shipRight + 6 && ax < width; ax++) {
        fg[bridgeFloorY * width + ax] = 102;
        if (ax % 2 === 0) fg[(bridgeFloorY - 1) * width + ax] = 56;
      }

      return {
        width,
        height,
        name: "Sci-Fi Station",
        weather: "NEBULA",
        weatherCode: 18,
        fg,
        bg,
        paint,
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
      PAINT_COLORS,
      WEATHERS,
      getWeathers,
      isPlaceableItem,
      isBackgroundItem,
      isPaintItem,
      getPaintColor,
      getItemCategoryKey,
      isFlippableItem,
      filterPlaceableItems,
      createStandardWorld,
      createBlankWorld,
      createFlatWorld,
      createNatureWorld,
      createParkourWorld,
      createHorrorWorld,
      createSciFiWorld,
      getWeatherById
    });
  }
);
