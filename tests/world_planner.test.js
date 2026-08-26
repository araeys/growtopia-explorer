const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

let LZString;
try {
  LZString = require("lz-string");
} catch {
  const code = fs.readFileSync(path.join(__dirname, "../public/lz-string.min.js"), "utf8");
  const vm = require("vm");
  const sandbox = {};
  vm.runInNewContext(code, sandbox);
  LZString = sandbox.LZString || globalThis.LZString;
}
const autotile = require("../public/autotile.js");
const catalog = require("../public/world_catalog.js");
const planner = require("../public/world_planner.js");

const itemsDb = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/items_db.json"), "utf8"));

test("GTWorldCatalog: Category classification and placeable filter", () => {
  assert.strictEqual(catalog.WORLD_WIDTH, 100);
  assert.strictEqual(catalog.WORLD_HEIGHT, 60);
  assert.strictEqual(catalog.TILE_SIZE, 32);

  assert.strictEqual(catalog.CATEGORIES.length, 11);
  assert.strictEqual(catalog.WEATHERS.length >= 60, true);

  // Dirt should be placeable building block
  const dirt = itemsDb.find(i => i.id === 2);
  assert.strictEqual(catalog.isPlaceableItem(dirt), true);
  assert.strictEqual(catalog.isBackgroundItem(dirt), false);

  // Cave background (14) should be background item
  const caveBg = itemsDb.find(i => i.id === 14);
  assert.strictEqual(catalog.isPlaceableItem(caveBg), true);
  assert.strictEqual(catalog.isBackgroundItem(caveBg), true);

  // Clothing (action 20 or category Clothing & Cosmetics) should NOT be placeable in world planner
  const clothing = itemsDb.find(i => i.category === "Clothing & Cosmetics" || i.action === 20);
  if (clothing) {
    assert.strictEqual(catalog.isPlaceableItem(clothing), false);
  }

  // Seed (action 19 or category Seeds) should NOT be placeable in world planner
  const seed = itemsDb.find(i => i.category === "Seeds" || i.action === 19);
  if (seed) {
    assert.strictEqual(catalog.isPlaceableItem(seed), false);
  }
});

test("GTWorldCatalog: World Presets generation", () => {
  const std = catalog.createStandardWorld(100, 60);
  assert.strictEqual(std.width, 100);
  assert.strictEqual(std.height, 60);
  assert.strictEqual(std.fg.length, 6000);
  assert.strictEqual(std.bg.length, 6000);
  assert.strictEqual(std.flags.length, 6000);

  // Spawn Door at (50, 23)
  const spawnDoorIdx = 23 * 100 + 50;
  assert.strictEqual(std.fg[spawnDoorIdx], 6); // Main Door

  // Bedrock at bottom rows
  const bedrockIdx = 58 * 100 + 50;
  assert.strictEqual(std.fg[bedrockIdx], 8); // Bedrock

  const blank = catalog.createBlankWorld(100, 60);
  assert.strictEqual(blank.fg[0], 0); // Top row empty
  assert.strictEqual(blank.fg[59 * 100 + 50], 8); // Bottom row bedrock

  const flat = catalog.createFlatWorld(100, 60);
  assert.strictEqual(flat.fg[0], 0); // Sky empty
  assert.strictEqual(flat.fg[40 * 100 + 50], 2); // Dirt ground
});

test("GTWorldPlanner: Engine initialization, tools, and undo/redo", () => {
  const dummyCanvas = {
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      fillRect: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    addEventListener: () => {},
    style: {}
  };

  const engine = planner.createEngine({
    canvas: dummyCanvas,
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();

  const hotbar = engine.getHotbar();
  assert.strictEqual(hotbar.length, 10);
  assert.strictEqual(engine.getActiveHotbarIndex(), 0);

  // Test Tool changing
  engine.setTool("eraser");
  assert.strictEqual(engine.getTool(), "eraser");
  engine.setTool("pencil");
  assert.strictEqual(engine.getTool(), "pencil");

  // Test Weather changing
  engine.setWeather("SUNSET");
  assert.strictEqual(engine.getWeather(), "SUNSET");

  // Test Flip toggle
  const flipped = engine.toggleFlip();
  assert.strictEqual(flipped, true);
  assert.strictEqual(engine.isFlipped(), true);

  // Test Undo / Redo
  assert.strictEqual(engine.undo(), true);
  assert.strictEqual(engine.redo(), true);
});

test("GTWorldPlanner: Import World-20260809.dat cross-compatibility", () => {
  const datPath = "C:/Users/VICTUS/Downloads/World-20260809.dat";
  if (!fs.existsSync(datPath)) return;

  const rawDat = fs.readFileSync(datPath, "utf8").trim();

  const dummyCanvas = {
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      fillRect: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    addEventListener: () => {},
    style: {}
  };

  const engine = planner.createEngine({
    canvas: dummyCanvas,
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();
  engine.importFromDAT(rawDat);

  const state = engine.getWorldState();
  assert.strictEqual(state.width, 100);
  assert.strictEqual(state.height, 60);
  assert.strictEqual(state.weather, "EMERALD_CITY");
  assert.strictEqual(state.weatherCode, 80);

  // Check that hotbar contains items from meta.recent
  const importedHotbar = engine.getHotbar();
  assert.strictEqual(importedHotbar[0]?.id, 3446);
  assert.strictEqual(importedHotbar[1]?.id, 6514);
});

test("GTWorldPlanner: Custom World Dimensions & LocalStorage Autosave", () => {
  const dummyCanvas = {
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      fillRect: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {},
      rect: () => {},
      clip: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    addEventListener: () => {},
    style: {}
  };

  const store = new Map();
  global.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const engine = planner.createEngine({
    canvas: dummyCanvas,
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();

  // Test custom world dimension creation
  engine.createCustomWorld(50, 30, "standard", "Mini World");
  const state = engine.getWorldState();
  assert.strictEqual(state.width, 50);
  assert.strictEqual(state.height, 30);
  assert.strictEqual(state.name, "Mini World");
  assert.strictEqual(state.fg.length, 1500);

  // Test manual and automatic save to localStorage
  assert.strictEqual(engine.saveToLocalStorage(), true);
  assert.strictEqual(store.has("gt-world-planner-autosave-v1"), true);

  // Create a new engine instance to test loading from autosave
  const engine2 = planner.createEngine({
    canvas: dummyCanvas,
    itemsDb,
    catalog,
    lzString: LZString
  });
  engine2.init();
  assert.strictEqual(engine2.loadFromLocalStorage(), true);

  const restoredState = engine2.getWorldState();
  assert.strictEqual(restoredState.width, 50);
  assert.strictEqual(restoredState.height, 30);
  assert.strictEqual(restoredState.name, "Mini World");

  // Test upscale PNG export calls
  global.document = {
    createElement: (tag) => {
      if (tag === "canvas") {
        return {
          getContext: () => ({
            clearRect: () => {},
            fillRect: () => {},
            drawImage: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            scale: () => {}
          }),
          toDataURL: () => "data:image/png;base64,mock"
        };
      }
      return {
        click: () => {},
        setAttribute: () => {}
      };
    }
  };

  const fullData1x = engine2.exportToPNG({ onlySelection: false, scale: 1 });
  assert.strictEqual(typeof fullData1x, "string");

  const fullData2x = engine2.exportToPNG({ onlySelection: false, scale: 2 });
  assert.strictEqual(typeof fullData2x, "string");

  const selData4x = engine2.exportToPNG({ onlySelection: true, scale: 4 });
  assert.strictEqual(typeof selData4x, "string");
});

function createTestCanvas() {
  return {
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {},
      arc: () => {},
      ellipse: () => {},
      rect: () => {},
      clip: () => {},
      closePath: () => {},
      setLineDash: () => {},
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    addEventListener: () => {},
    style: {}
  };
}

test("GTWorldPlanner: Clipboard Copy, Cut, Paste, and Mirroring", () => {
  const engine = planner.createEngine({
    canvas: createTestCanvas(),
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();
  engine.loadPreset("blank");

  // Place some test blocks: Dirt (2) at (10, 10), Cave BG (14) at (11, 10)
  const dirtItem = itemsDb.find(i => i.id === 2);
  const caveBg = itemsDb.find(i => i.id === 14);

  engine.setTool("pencil");
  engine.setHotbarItem(0, dirtItem);
  engine.setActiveHotbarIndex(0);

  // Set selection active from (10, 10) to (11, 10)
  const worldState = engine.getWorldState();
  worldState.fg[10 * worldState.width + 10] = 2;
  worldState.bg[10 * worldState.width + 11] = 14;

  engine.setSelection({
    active: true,
    startX: 10,
    startY: 10,
    endX: 11,
    endY: 10
  });

  // Test Copy
  assert.strictEqual(engine.copySelection(), true);
  const clip = engine.getClipboard();
  assert.strictEqual(clip.active, true);
  assert.strictEqual(clip.width, 2);
  assert.strictEqual(clip.height, 1);
  assert.strictEqual(clip.fg[0], 2);
  assert.strictEqual(clip.bg[1], 14);

  // Test Flip Clipboard Horizontal
  engine.flipClipboardHorizontal();
  const flippedClip = engine.getClipboard();
  assert.strictEqual(flippedClip.fg[1], 2);
  assert.strictEqual(flippedClip.bg[0], 14);

  // Test Paste at (20, 20)
  assert.strictEqual(engine.pasteClipboardAt(20, 20), true);
  assert.strictEqual(worldState.bg[20 * worldState.width + 20], 14);
  assert.strictEqual(worldState.fg[20 * worldState.width + 21], 2);

  // Test Cut Selection
  assert.strictEqual(engine.cutSelection(), true);
  assert.strictEqual(worldState.fg[10 * worldState.width + 10], 0);
  assert.strictEqual(worldState.bg[10 * worldState.width + 11], 0);
});

test("GTWorldPlanner: Play Mode & Parkour Physics Simulation", () => {
  const engine = planner.createEngine({
    canvas: createTestCanvas(),
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();
  engine.loadPreset("standard");

  // Toggle play mode
  assert.strictEqual(engine.isPlayMode(), false);
  const active = engine.togglePlayMode();
  assert.strictEqual(active, true);
  assert.strictEqual(engine.isPlayMode(), true);

  // Test respawn
  engine.respawnPlayer("Testing Respawn");
  assert.strictEqual(engine.isPlayMode(), true);

  // Test Moderator Mode
  assert.strictEqual(engine.isModeratorMode(), false);
  const modActive = engine.toggleModeratorMode();
  assert.strictEqual(modActive, true);
  assert.strictEqual(engine.isModeratorMode(), true);

  // Test block placement effect
  engine.spawnBlockPlaceEffect(10, 10, itemsDb[2]);

  // Toggle off Moderator Mode
  engine.toggleModeratorMode(false);
  assert.strictEqual(engine.isModeratorMode(), false);

  // Toggle off play mode
  engine.togglePlayMode(false);
  assert.strictEqual(engine.isPlayMode(), false);
});

test("GTWorldPlanner: Music Sheet Sequencer", () => {
  const engine = planner.createEngine({
    canvas: createTestCanvas(),
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();

  // Test Music BPM setting
  engine.setMusicBpm(140);
  const musicState = engine.getMusicState();
  assert.strictEqual(musicState.bpm, 140);

  // Test Toggle Music
  const isPlaying = engine.toggleMusic();
  assert.strictEqual(isPlaying, true);

  // Stop Music
  engine.toggleMusic(false);
  assert.strictEqual(engine.getMusicState().isPlaying, false);
});

test("GTWorldPlanner: Paint Bucket Coloring & Varnish", () => {
  const engine = planner.createEngine({
    canvas: createTestCanvas(),
    itemsDb,
    catalog,
    lzString: LZString
  });

  engine.init();
  engine.loadPreset("blank");

  const redPaint = itemsDb.find(i => i.id === 3478);
  const yellowPaint = itemsDb.find(i => i.id === 3480);
  const varnish = itemsDb.find(i => i.id === 3492);
  const dirt = itemsDb.find(i => i.id === 2);

  // 1. Place a Dirt block at (10, 10)
  engine.setTile(10, 10, dirt);
  const state = engine.getWorldState();
  assert.strictEqual(state.fg[10 * state.width + 10], 2);

  // 2. Paint it Red (ID 3478)
  engine.setTile(10, 10, redPaint);
  assert.strictEqual(state.paint[10 * state.width + 10], 3478);

  // 3. Paint another tile with Yellow at (11, 10)
  engine.setTile(11, 10, yellowPaint);
  assert.strictEqual(state.paint[10 * state.width + 11], 3480);

  // 4. Undo paint
  engine.undo();
  assert.strictEqual(state.paint[10 * state.width + 11], 0);

  // 5. Redo paint
  engine.redo();
  assert.strictEqual(state.paint[10 * state.width + 11], 3480);

  // 6. Use Varnish to clear paint
  engine.setTile(10, 10, varnish);
  assert.strictEqual(state.paint[10 * state.width + 10], 0);

  // 7. Verify Dirt tile is still preserved underneath
  assert.strictEqual(state.fg[10 * state.width + 10], 2);
});
