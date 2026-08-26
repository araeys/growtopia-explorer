/**
 * Growtopia Bitmask Autotiling Engine
 * Implements official 8-neighbor bitmask scoring for spread types ST2, ST5, ST14, and ST7.
 */
(function autotileModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GTAutotile = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createAutotileEngine() {
    // 8-neighbor Bitmask mapping:
    // 1: Top-Left, 2: Top, 4: Top-Right
    // 8: Left,               16: Right
    // 32: Bottom-Left, 64: Bottom, 128: Bottom-Right
    const BIT_TL = 1;
    const BIT_T  = 2;
    const BIT_TR = 4;
    const BIT_L  = 8;
    const BIT_R  = 16;
    const BIT_BL = 32;
    const BIT_B  = 64;
    const BIT_BR = 128;

    // ST2 Table: 47 rules for 8-way terrain (Dirt, Rock, Granite, Soil, etc.)
    // Format: [requiredMask, colOffset, rowOffset, weight]
    const ST2 = [
      [255, 0, 0, 8], [248, 1, 0, 5], [31, 2, 0, 5], [214, 3, 0, 5], [107, 4, 0, 5],
      [208, 5, 0, 3], [104, 6, 0, 3], [22, 7, 0, 3], [11, 0, 1, 3], [66, 1, 1, 2],
      [64, 2, 1, 1], [2, 3, 1, 1], [0, 4, 1, 0], [254, 5, 1, 7], [251, 6, 1, 7],
      [223, 7, 1, 7], [127, 0, 2, 7], [250, 1, 2, 6], [95, 2, 2, 6], [222, 3, 2, 6],
      [123, 4, 2, 6], [126, 5, 2, 6], [219, 6, 2, 6], [91, 7, 2, 5], [94, 0, 3, 5],
      [122, 1, 3, 5], [218, 2, 3, 5], [90, 3, 3, 4], [24, 4, 3, 2], [16, 5, 3, 1],
      [8, 6, 3, 1], [210, 7, 3, 4], [86, 0, 4, 4], [82, 1, 4, 3], [106, 2, 4, 4],
      [75, 3, 4, 4], [74, 4, 4, 3], [120, 6, 4, 4], [88, 7, 4, 3], [30, 0, 5, 4],
      [27, 1, 5, 4], [26, 2, 5, 3], [18, 3, 5, 2], [10, 4, 5, 2], [80, 5, 5, 2], [72, 6, 5, 2]
    ];

    // ST5 Table: Cave Walls / Cave Dirt autotiling
    const ST5 = [
      [255, 0, 0, 8], [248, 1, 0, 5], [31, 2, 0, 5], [214, 3, 0, 5], [107, 4, 0, 5],
      [208, 5, 0, 3], [104, 6, 0, 3], [22, 7, 0, 3], [11, 0, 1, 3], [66, 1, 1, 2],
      [64, 2, 1, 1], [2, 3, 1, 1], [0, 4, 1, 0], [24, 5, 1, 2], [16, 6, 1, 1], [8, 7, 1, 1]
    ];

    // ST14 Table: Horizontal Connectables (Couches, Tables, Desks, Platforms, Bars, Benches, Counters)
    const ST14 = [
      [24, 1, 0, 2], // Left (8) + Right (16) -> Middle piece
      [16, 0, 0, 1], // Right only (16) -> Left end piece
      [8, 2, 0, 1],  // Left only (8) -> Right end piece
      [0, 3, 0, 0]   // Standalone / Isolated
    ];

    const AUTOTILE_EDGE = { 2: 10, 8: 10, 16: 10, 64: 10 };
    const HORIZ_BITS = new Set([8, 16]);
    const VERT_BITS = new Set([2, 64]);
    const DIAG_BITS = new Set([1, 4, 32, 128]);

    function scoreRule(activeMask, reqMask) {
      let s = 0;
      for (let b = 1; b <= 128; b <<= 1) {
        const w = AUTOTILE_EDGE[b] || 1;
        const inRule = (reqMask & b) !== 0;
        const inActive = (activeMask & b) !== 0;
        if (inRule) {
          s += inActive ? w : -w * 2;
        } else if (inActive) {
          s -= w;
        }
      }
      return s;
    }

    function bestAutotile(rules, activeMask, isolX = 4, isolY = 1) {
      let bc = isolX;
      let br = isolY;
      let bs = -Infinity;
      for (let i = 0; i < rules.length; i++) {
        const [req, c, r] = rules[i];
        if (req === 0) continue;
        const s = scoreRule(activeMask, req);
        if (s > bs) {
          bs = s;
          bc = c;
          br = r;
        }
      }
      return bs > 0 ? [bc, br] : [isolX, isolY];
    }

    function bestAutotileAxis(rules, activeMask, isolC = 3, isolR = 0) {
      let bc = isolC;
      let br = isolR;
      let bs = -Infinity;
      for (let i = 0; i < rules.length; i++) {
        const [req, c, r] = rules[i];
        if (req === 0) continue;

        let hasH = Boolean((req & 8) || (req & 16));
        let hasV = Boolean((req & 2) || (req & 64));
        let hasD = Boolean((req & 1) || (req & 4) || (req & 32) || (req & 128));

        let s = 0;
        for (let b = 1; b <= 128; b <<= 1) {
          const w = AUTOTILE_EDGE[b] || 1;
          if (req & b) {
            s += (activeMask & b) ? w : -w * 2;
          } else if (activeMask & b) {
            if (HORIZ_BITS.has(b) && !hasH) continue;
            if (VERT_BITS.has(b) && !hasV) continue;
            if (DIAG_BITS.has(b) && !hasD) continue;
            s -= w;
          }
        }
        if (s > bs) {
          bs = s;
          bc = c;
          br = r;
        }
      }
      return bs > 0 ? [bc, br] : [isolC, isolR];
    }

    /**
     * Compute 8-neighbor bitmask for a tile at (x, y) in a 1D grid array.
     */
    function computeNeighborMask(grid, width, height, x, y, targetId) {
      if (!grid || x < 0 || y < 0 || x >= width || y >= height) return 0;
      let mask = 0;

      const matches = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return false;
        }
        return grid[ny * width + nx] === targetId;
      };

      if (matches(x - 1, y - 1)) mask |= BIT_TL;
      if (matches(x,     y - 1)) mask |= BIT_T;
      if (matches(x + 1, y - 1)) mask |= BIT_TR;
      if (matches(x - 1, y    )) mask |= BIT_L;
      if (matches(x + 1, y    )) mask |= BIT_R;
      if (matches(x - 1, y + 1)) mask |= BIT_BL;
      if (matches(x,     y + 1)) mask |= BIT_B;
      if (matches(x + 1, y + 1)) mask |= BIT_BR;

      return mask;
    }

    /**
     * Get the relative texture tile offset (offsetX, offsetY) for an item based on its spread type and neighbor mask.
     */
    function getTileOffset(item, activeMask) {
      if (!item) return { offsetX: 0, offsetY: 0 };
      const st = Number(item.spread_type) || 0;

      if (st === 2) {
        const [c, r] = bestAutotile(ST2, activeMask, 4, 1);
        return { offsetX: c, offsetY: r };
      }
      if (st === 5) {
        const [c, r] = bestAutotile(ST5, activeMask, 4, 1);
        return { offsetX: c, offsetY: r };
      }
      if (st === 3 || st === 14) {
        const [c, r] = bestAutotileAxis(ST14, activeMask, 3, 0);
        return { offsetX: c, offsetY: r };
      }
      if (st === 7) {
        // Vertical connectable (Vine, Pole, Pipe)
        const hasTop = Boolean(activeMask & BIT_T);
        const hasBot = Boolean(activeMask & BIT_B);
        let c = 3, r = 0;
        if (hasTop && hasBot) c = 1;      // Middle
        else if (hasTop && !hasBot) c = 0;// Bottom tip
        else if (!hasTop && hasBot) c = 2;// Top tip
        return { offsetX: c, offsetY: r };
      }

      return { offsetX: 0, offsetY: 0 };
    }

    return {
      BIT_TL,
      BIT_T,
      BIT_TR,
      BIT_L,
      BIT_R,
      BIT_BL,
      BIT_B,
      BIT_BR,
      ST2,
      ST5,
      ST14,
      scoreRule,
      bestAutotile,
      bestAutotileAxis,
      computeNeighborMask,
      getTileOffset
    };
  }
);
