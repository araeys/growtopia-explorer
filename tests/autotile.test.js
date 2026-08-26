const assert = require('assert');
const autotile = require('../public/autotile.js');
const catalog = require('../public/world_catalog.js');

console.log('🧪 Starting Autotiling & Categorization Test Suite...');

// 1. Test Bitmask Mapping & computeNeighborMask
{
  const width = 3;
  const height = 3;
  // 3x3 grid of Dirt (ID 2)
  const grid = new Uint16Array([
    2, 2, 2,
    2, 2, 2,
    2, 2, 2
  ]);

  // Center tile (1, 1) has all 8 neighbors
  const centerMask = autotile.computeNeighborMask(grid, width, height, 1, 1, 2);
  assert.strictEqual(centerMask, 255, 'Center tile should have mask 255 (all 8 neighbors)');

  // Top-left tile (0, 0) has Right (16), Bottom (64), Bottom-Right (128)
  const tlMask = autotile.computeNeighborMask(grid, width, height, 0, 0, 2);
  assert.strictEqual(tlMask, 16 | 64 | 128, 'Top-left tile mask should be 208');

  // Top-middle tile (1, 0) has Left (8), Right (16), BL (32), B (64), BR (128)
  const tmMask = autotile.computeNeighborMask(grid, width, height, 1, 0, 2);
  assert.strictEqual(tmMask, 8 | 16 | 32 | 64 | 128, 'Top-middle tile mask should be 248');

  console.log('✅ computeNeighborMask tests passed!');
}

// 2. Test ST2 Terrain Autotiling (Dirt, Rock, Soil)
{
  const dirtItem = { id: 2, name: 'Dirt', spread_type: 2, action: 17 };

  // Case A: Isolated Dirt Block (mask 0)
  const soloOffset = autotile.getTileOffset(dirtItem, 0);
  assert.deepStrictEqual(soloOffset, { offsetX: 4, offsetY: 1 }, 'Isolated dirt should map to [4, 1]');

  // Case B: Fully Surrounded Center Dirt Block (mask 255)
  const centerOffset = autotile.getTileOffset(dirtItem, 255);
  assert.deepStrictEqual(centerOffset, { offsetX: 0, offsetY: 0 }, 'Full dirt center should map to [0, 0]');

  // Case C: Continuous Top Grass Row (Left = 8, Right = 16, BL = 32, B = 64, BR = 128 -> mask 248)
  const topGrassOffset = autotile.getTileOffset(dirtItem, 248);
  assert.deepStrictEqual(topGrassOffset, { offsetX: 1, offsetY: 0 }, 'Top grass middle should map to [1, 0]');

  // Case D: Top-Left Grass Corner (Right = 16, Bottom = 64, Bottom-Right = 128 -> mask 208)
  const tlGrassOffset = autotile.getTileOffset(dirtItem, 208);
  assert.deepStrictEqual(tlGrassOffset, { offsetX: 5, offsetY: 0 }, 'Top-left grass corner should map to [5, 0]');

  // Case E: Top-Right Grass Corner (Left = 8, Bottom = 64, Bottom-Left = 32 -> mask 104)
  const trGrassOffset = autotile.getTileOffset(dirtItem, 104);
  assert.deepStrictEqual(trGrassOffset, { offsetX: 6, offsetY: 0 }, 'Top-right grass corner should map to [6, 0]');

  console.log('✅ ST2 Terrain Autotiling tests passed!');
}

// 3. Test ST14 Horizontal Connectables (Table, Couch, Platform)
{
  const tableItem = { id: 222, name: 'Wooden Table', spread_type: 3, action: 14 };

  // Isolated table (no neighbors)
  const soloTable = autotile.getTileOffset(tableItem, 0);
  assert.deepStrictEqual(soloTable, { offsetX: 3, offsetY: 0 }, 'Isolated table should be standalone [3, 0]');

  // Left end (connected to Right only -> bit 16)
  const leftTable = autotile.getTileOffset(tableItem, 16);
  assert.deepStrictEqual(leftTable, { offsetX: 0, offsetY: 0 }, 'Left table end should map to [0, 0]');

  // Middle (connected to Left 8 and Right 16 -> bit 24)
  const midTable = autotile.getTileOffset(tableItem, 24);
  assert.deepStrictEqual(midTable, { offsetX: 1, offsetY: 0 }, 'Middle table segment should map to [1, 0]');

  // Right end (connected to Left only -> bit 8)
  const rightTable = autotile.getTileOffset(tableItem, 8);
  assert.deepStrictEqual(rightTable, { offsetX: 2, offsetY: 0 }, 'Right table end should map to [2, 0]');

  console.log('✅ ST14 Horizontal Connectables tests passed!');
}

// 4. Test ST7 Vertical Connectables (Vines, Poles, Pipes)
{
  const vineItem = { id: 278, name: 'Vine', spread_type: 7, action: 21 };

  // Isolated (no neighbors)
  const soloVine = autotile.getTileOffset(vineItem, 0);
  assert.deepStrictEqual(soloVine, { offsetX: 3, offsetY: 0 }, 'Isolated vine should be [3, 0]');

  // Middle (Top bit 2 + Bottom bit 64 = 66)
  const midVine = autotile.getTileOffset(vineItem, 66);
  assert.deepStrictEqual(midVine, { offsetX: 1, offsetY: 0 }, 'Middle vine should be [1, 0]');

  // Top end (Bottom only bit 64)
  const topVine = autotile.getTileOffset(vineItem, 64);
  assert.deepStrictEqual(topVine, { offsetX: 2, offsetY: 0 }, 'Top vine end should be [2, 0]');

  // Bottom end (Top only bit 2)
  const botVine = autotile.getTileOffset(vineItem, 2);
  assert.deepStrictEqual(botVine, { offsetX: 0, offsetY: 0 }, 'Bottom vine end should be [0, 0]');

  console.log('✅ ST7 Vertical Connectables tests passed!');
}

// 5. Test ST4 Directional Surface Attachment (Spikes, Crystal Spikes, Gargoyles)
{
  const spikeItem = { id: 162, name: 'Death Spikes', spread_type: 4, action: 6 };

  // Case A: Placed on Floor (Solid block below -> bit 64)
  const floorSpike = autotile.getTileOffset(spikeItem, autotile.BIT_B);
  assert.deepStrictEqual(floorSpike, { offsetX: 3, offsetY: 0 }, 'Floor spike must point UP with offsetX 3');

  // Case B: Placed on Ceiling (Solid block above -> bit 2)
  const ceilingSpike = autotile.getTileOffset(spikeItem, autotile.BIT_T);
  assert.deepStrictEqual(ceilingSpike, { offsetX: 1, offsetY: 0 }, 'Ceiling spike must point DOWN with offsetX 1');

  // Case C: Placed on Left Wall (Solid block left -> bit 8)
  const leftWallSpike = autotile.getTileOffset(spikeItem, autotile.BIT_L);
  assert.deepStrictEqual(leftWallSpike, { offsetX: 0, offsetY: 0 }, 'Left wall spike must point RIGHT with offsetX 0');

  // Case D: Placed on Right Wall (Solid block right -> bit 16)
  const rightWallSpike = autotile.getTileOffset(spikeItem, autotile.BIT_R);
  assert.deepStrictEqual(rightWallSpike, { offsetX: 2, offsetY: 0 }, 'Right wall spike must point LEFT with offsetX 2');

  // Case E: Solo floating block -> Default upright (offsetX 3)
  const soloSpike = autotile.getTileOffset(spikeItem, 0);
  assert.deepStrictEqual(soloSpike, { offsetX: 3, offsetY: 0 }, 'Solo spike defaults to upright with offsetX 3');

  console.log('✅ ST4 Directional Spikes tests passed!');
}

// 6. Test World Catalog Categorization & Layer Isolation
{
  const dirt = { id: 2, name: 'Dirt', action: 17, spread_type: 2, category: 'Blocks & Building', texture: 'tiles_page1.png' };
  const caveBg = { id: 14, name: 'Cave Background', action: 18, spread_type: 2, category: 'Weather & Backgrounds', texture: 'tiles_page1.png' };
  const woodTable = { id: 222, name: 'Wooden Table', action: 14, spread_type: 3, category: 'Furniture & Items', texture: 'tiles_page1.png' };
  const mainDoor = { id: 6, name: 'Main Door', action: 2, spread_type: 1, category: 'Doors & Portals', texture: 'tiles_page1.png' };
  const spike = { id: 24, name: 'Spike', action: 16, spread_type: 1, category: 'Hazards', texture: 'tiles_page1.png' };
  const seed = { id: 3, name: 'Dirt Seed', action: 19, spread_type: 1, category: 'Seeds', texture: 'tiles_page1.png' };
  const shirt = { id: 200, name: 'Red Shirt', action: 20, spread_type: 1, category: 'Clothing & Cosmetics', texture: 'player_shirt.png' };

  // Dirt must NOT be background
  assert.strictEqual(catalog.isBackgroundItem(dirt), false, 'Dirt is a solid block, NOT background');
  assert.strictEqual(catalog.getItemCategoryKey(dirt), 'building', 'Dirt category should be building');

  // Cave BG MUST be background
  assert.strictEqual(catalog.isBackgroundItem(caveBg), true, 'Cave Background is background');
  assert.strictEqual(catalog.getItemCategoryKey(caveBg), 'wallpaper', 'Cave Background category should be wallpaper');

  // Table must be furniture
  assert.strictEqual(catalog.getItemCategoryKey(woodTable), 'furniture', 'Table should be furniture');

  // Door must be door
  assert.strictEqual(catalog.getItemCategoryKey(mainDoor), 'door', 'Main door should be door');

  // Spike must be hazard
  assert.strictEqual(catalog.getItemCategoryKey(spike), 'hazard', 'Spike should be hazard');

  // Placeable items checks
  assert.strictEqual(catalog.isPlaceableItem(dirt), true, 'Dirt should be placeable');
  assert.strictEqual(catalog.isPlaceableItem(seed), false, 'Seed should NOT be placeable in World Planner');
  assert.strictEqual(catalog.isPlaceableItem(shirt), false, 'Shirt should NOT be placeable in World Planner');

  // Paint item checks
  const redPaint = { id: 3478, name: 'Paint Bucket - Red', action: 8, category: 'Blocks & Building' };
  const varnish = { id: 3492, name: 'Paint Bucket - Varnish', action: 8, category: 'Blocks & Building' };
  assert.strictEqual(catalog.isPaintItem(redPaint), true, 'Red Paint is paint item');
  assert.strictEqual(catalog.isPaintItem(varnish), true, 'Varnish is paint item');
  assert.strictEqual(catalog.getPaintColor(redPaint), '#ff2222', 'Red paint color should be #ff2222');
  assert.strictEqual(catalog.getPaintColor(varnish), null, 'Varnish paint color should be null');
  assert.strictEqual(catalog.getItemCategoryKey(redPaint), 'paint', 'Red paint category should be paint');

  console.log('✅ World Catalog Categorization & Paint tests passed!');
}

console.log('🎉 ALL 6 AUTOTILING, CATEGORIZATION & PAINT TEST SUITES PASSED PERFECTLY!');
