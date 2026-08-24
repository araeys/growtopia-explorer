/**
 * Growtopia Render Blueprint to Editable Blocks Converter
 * AI Pixel Pattern & Color Signature Matcher for 3200x1920 /renderworld PNG images
 */
(function(window) {
  'use strict';

  const BLOCK_SIGNATURES = [
    {
      id: 10,
      name: 'Bedrock',
      layer: 'fg',
      targetRGB: [22, 22, 26],
      maxDist: 35,
      condition: (r, g, b, varR, varG, varB) => (r < 40 && g < 40 && b < 45)
    },
    {
      id: 4,
      name: 'Lava',
      layer: 'fg',
      targetRGB: [225, 80, 20],
      maxDist: 55,
      condition: (r, g, b) => (r > 165 && g > 40 && g < 130 && b < 50)
    },
    {
      id: 278,
      name: 'Castle Wall',
      layer: 'fg',
      targetRGB: [155, 155, 160],
      maxDist: 40,
      condition: (r, g, b) => (r > 130 && r < 190 && g > 130 && g < 190 && b > 135 && b < 195 && Math.abs(r - g) < 18)
    },
    {
      id: 279,
      name: 'Castle Wall Background',
      layer: 'bg',
      targetRGB: [95, 95, 102],
      maxDist: 35,
      condition: (r, g, b) => (r > 75 && r < 125 && g > 75 && g < 125 && b > 80 && b < 130 && Math.abs(r - g) < 16)
    },
    {
      id: 142,
      name: 'Bookshelf',
      layer: 'fg',
      targetRGB: [120, 65, 35],
      maxDist: 50,
      condition: (r, g, b, varR, varG, varB) => (r > 95 && r < 155 && g > 45 && g < 90 && b > 20 && b < 60 && (varR + varG + varB) > 400)
    },
    {
      id: 20,
      name: 'Wood Block',
      layer: 'fg',
      targetRGB: [135, 78, 36],
      maxDist: 45,
      condition: (r, g, b) => (r > 105 && r < 165 && g > 55 && g < 100 && b > 20 && b < 55)
    },
    {
      id: 18,
      name: 'Wood Background',
      layer: 'bg',
      targetRGB: [82, 48, 22],
      maxDist: 35,
      condition: (r, g, b) => (r > 60 && r < 105 && g > 32 && g < 65 && b > 12 && b < 36)
    },
    {
      id: 2,
      name: 'Dirt',
      layer: 'fg',
      targetRGB: [92, 56, 32],
      maxDist: 42,
      condition: (r, g, b) => (r > 68 && r < 118 && g > 40 && g < 76 && b > 18 && b < 48)
    },
    {
      id: 14,
      name: 'Cave Background',
      layer: 'bg',
      targetRGB: [42, 26, 16],
      maxDist: 30,
      condition: (r, g, b) => (r > 26 && r < 58 && g > 16 && g < 38 && b > 8 && b < 26)
    },
    {
      id: 12,
      name: 'Rock',
      layer: 'fg',
      targetRGB: [112, 108, 102],
      maxDist: 40,
      condition: (r, g, b) => (r > 88 && r < 132 && g > 84 && g < 128 && b > 78 && b < 122 && Math.abs(r - g) < 14)
    },
    {
      id: 16,
      name: 'Grass / Leaves',
      layer: 'fg',
      targetRGB: [52, 165, 42],
      maxDist: 60,
      condition: (r, g, b) => (g > 115 && g > r * 1.35 && g > b * 1.35)
    },
    {
      id: 226,
      name: 'Glass Pane',
      layer: 'fg',
      targetRGB: [130, 210, 240],
      maxDist: 60,
      condition: (r, g, b) => (b > 180 && g > 150 && b >= g && r < 200)
    },
    {
      id: 8,
      name: 'Main Door',
      layer: 'fg',
      targetRGB: [225, 225, 230],
      maxDist: 50,
      condition: (r, g, b) => (r > 195 && g > 195 && b > 195)
    }
  ];

  class GTRenderConverter {
    /**
     * Converts a 3200x1920 world render image into Growtopia world.fg and world.bg arrays
     * @param {HTMLImageElement|HTMLCanvasElement} imageSource - The render image
     * @param {Object} options - Conversion options (width: 100, height: 60, sensitivity: 1.0)
     * @returns {Object} { fg: Uint16Array, bg: Uint16Array, detectedCount, stats }
     */
    static convertRenderToWorldBlocks(imageSource, options = {}) {
      const worldW = options.width || 100;
      const worldH = options.height || 60;
      const sensitivity = options.sensitivity || 1.0;
      const ignoreBorders = options.ignoreBorders !== false;

      const totalTiles = worldW * worldH;
      const fg = new Uint16Array(totalTiles);
      const bg = new Uint16Array(totalTiles);

      // Create high-res offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = worldW * 32; // 3200
      canvas.height = worldH * 32; // 1920
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { fg, bg, detectedCount: 0, stats: {} };

      // Draw image scaled to 3200x1920 grid
      ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

      let detectedCount = 0;
      const stats = { bedrock: 0, castle: 0, dirt: 0, wood: 0, bookshelf: 0, lava: 0, background: 0, other: 0 };

      // Process each 32x32 tile
      for (let ty = 0; ty < worldH; ty++) {
        for (let tx = 0; tx < worldW; tx++) {
          const tileIdx = ty * worldW + tx;

          // 1. Filter out decorative event border frames (e.g. Cinco de Mayo banners, bottom logo)
          if (ignoreBorders) {
            // Top event header banner (rows 0, 1) unless bedrock/castle
            if (ty <= 1 && (tx < 3 || tx > worldW - 4)) continue;
            // Left/Right festive border ribbons (col 0, 1 and col 98, 99)
            if ((tx <= 1 || tx >= worldW - 2) && ty < 55) continue;
            // Bottom-right watermark logo ("Visit START in Growtopia" at x:80..99, y:53..58)
            if (tx >= 80 && ty >= 53 && ty <= 58) continue;
          }

          // 2. Extract 32x32 pixel patch
          const imgData = ctx.getImageData(tx * 32, ty * 32, 32, 32);
          const data = imgData.data;

          // Compute average RGBA and color variance
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          const pixelCount = 32 * 32;

          for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            sumA += data[i + 3];
          }

          const avgR = sumR / pixelCount;
          const avgG = sumG / pixelCount;
          const avgB = sumB / pixelCount;
          const avgA = sumA / pixelCount;

          // If tile is transparent, skip
          if (avgA < 30) continue;

          // Compute color variance
          let varR = 0, varG = 0, varB = 0;
          for (let i = 0; i < data.length; i += 4) {
            varR += Math.pow(data[i] - avgR, 2);
            varG += Math.pow(data[i + 1] - avgG, 2);
            varB += Math.pow(data[i + 2] - avgB, 2);
          }
          varR /= pixelCount;
          varG /= pixelCount;
          varB /= pixelCount;

          // 3. Sky / Backdrop Filter (Light blue / green mountains / clouds)
          // Sky is typically high blue/cyan with low texture variance
          if (avgB > 180 && avgG > 150 && avgR > 90 && (varR + varG + varB) < 120 && ty < 40) {
            continue; // Empty sky
          }
          // Distant green mountains backdrop
          if (avgG > 140 && avgR > 70 && avgB > 60 && (varR + varG + varB) < 80 && ty < 35) {
            continue; // Empty mountain backdrop
          }

          // 4. Match against Block Signatures
          let bestMatch = null;
          let minDistance = Infinity;

          for (const sig of BLOCK_SIGNATURES) {
            const dist = Math.sqrt(
              Math.pow(avgR - sig.targetRGB[0], 2) +
              Math.pow(avgG - sig.targetRGB[1], 2) +
              Math.pow(avgB - sig.targetRGB[2], 2)
            );

            const satisfiesCondition = sig.condition ? sig.condition(avgR, avgG, avgB, varR, varG, varB) : true;

            if (satisfiesCondition && dist <= sig.maxDist * sensitivity && dist < minDistance) {
              minDistance = dist;
              bestMatch = sig;
            }
          }

          // 5. Special Game Rules Override
          // Bottom row (ty = 59) is ALWAYS Bedrock in Growtopia standard world
          if (ty === worldH - 1 && avgR < 60 && avgG < 60 && avgB < 60) {
            bestMatch = { id: 10, layer: 'fg', name: 'Bedrock' };
          }

          // 6. Assign to FG or BG layer
          if (bestMatch) {
            if (bestMatch.layer === 'bg') {
              bg[tileIdx] = bestMatch.id;
              stats.background += 1;
            } else {
              fg[tileIdx] = bestMatch.id;
              if (bestMatch.id === 10) stats.bedrock += 1;
              else if (bestMatch.id === 278) stats.castle += 1;
              else if (bestMatch.id === 2) stats.dirt += 1;
              else if (bestMatch.id === 20) stats.wood += 1;
              else if (bestMatch.id === 142) stats.bookshelf += 1;
              else if (bestMatch.id === 4) stats.lava += 1;
              else stats.other += 1;
            }
            detectedCount += 1;
          }
        }
      }

      return { fg, bg, detectedCount, stats };
    }
  }

  if (typeof window !== 'undefined') {
    window.GTRenderConverter = GTRenderConverter;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTRenderConverter, BLOCK_SIGNATURES };
  }
})(typeof window !== 'undefined' ? window : globalThis);
