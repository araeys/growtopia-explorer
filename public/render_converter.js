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
      maxDist: 40,
      condition: (r, g, b) => (r < 45 && g < 45 && b < 50)
    },
    {
      id: 4,
      name: 'Lava',
      layer: 'fg',
      targetRGB: [225, 80, 20],
      maxDist: 60,
      condition: (r, g, b) => (r > 165 && g > 35 && g < 135 && b < 55)
    },
    {
      id: 278,
      name: 'Castle Wall',
      layer: 'fg',
      targetRGB: [155, 155, 160],
      maxDist: 45,
      condition: (r, g, b) => (r > 125 && r < 195 && g > 125 && g < 195 && b > 130 && b < 200 && Math.abs(r - g) < 22)
    },
    {
      id: 279,
      name: 'Castle Wall Background',
      layer: 'bg',
      targetRGB: [95, 95, 102],
      maxDist: 38,
      condition: (r, g, b) => (r > 70 && r < 125 && g > 70 && g < 125 && b > 75 && b < 130 && Math.abs(r - g) < 18)
    },
    {
      id: 142,
      name: 'Bookshelf',
      layer: 'fg',
      targetRGB: [120, 65, 35],
      maxDist: 55,
      condition: (r, g, b, varR, varG, varB) => (r > 90 && r < 160 && g > 40 && g < 95 && b > 15 && b < 65 && (varR + varG + varB) > 250)
    },
    {
      id: 20,
      name: 'Wood Block',
      layer: 'fg',
      targetRGB: [135, 78, 36],
      maxDist: 48,
      condition: (r, g, b) => (r > 100 && r < 170 && g > 50 && g < 105 && b > 15 && b < 60)
    },
    {
      id: 18,
      name: 'Wood Background',
      layer: 'bg',
      targetRGB: [82, 48, 22],
      maxDist: 38,
      condition: (r, g, b) => (r > 55 && r < 110 && g > 30 && g < 70 && b > 10 && b < 40)
    },
    {
      id: 28,
      name: 'Ladder',
      layer: 'fg',
      targetRGB: [140, 90, 45],
      maxDist: 50,
      condition: (r, g, b, varR, varG, varB) => (r > 110 && g > 70 && b > 30 && varR > 400)
    },
    {
      id: 2,
      name: 'Dirt',
      layer: 'fg',
      targetRGB: [92, 56, 32],
      maxDist: 45,
      condition: (r, g, b) => (r > 65 && r < 122 && g > 38 && g < 80 && b > 15 && b < 52)
    },
    {
      id: 14,
      name: 'Cave Background',
      layer: 'bg',
      targetRGB: [42, 26, 16],
      maxDist: 32,
      condition: (r, g, b) => (r > 24 && r < 62 && g > 14 && g < 42 && b > 6 && b < 30)
    },
    {
      id: 12,
      name: 'Rock',
      layer: 'fg',
      targetRGB: [112, 108, 102],
      maxDist: 42,
      condition: (r, g, b) => (r > 85 && r < 135 && g > 80 && g < 130 && b > 75 && b < 125 && Math.abs(r - g) < 16)
    },
    {
      id: 16,
      name: 'Grass / Leaves',
      layer: 'fg',
      targetRGB: [52, 165, 42],
      maxDist: 65,
      condition: (r, g, b) => (g > 105 && g > r * 1.25 && g > b * 1.25)
    },
    {
      id: 226,
      name: 'Glass Pane',
      layer: 'fg',
      targetRGB: [130, 210, 240],
      maxDist: 65,
      condition: (r, g, b) => (b > 175 && g > 145 && b >= g && r < 210)
    },
    {
      id: 8,
      name: 'Main Door',
      layer: 'fg',
      targetRGB: [225, 225, 230],
      maxDist: 55,
      condition: (r, g, b) => (r > 190 && g > 190 && b > 190)
    }
  ];

  class GTRenderConverter {
    static convertRenderToWorldBlocks(imageSource, options = {}) {
      const worldW = options.width || 100;
      const worldH = options.height || 60;
      const sensitivity = options.sensitivity || 1.1;
      const ignoreBorders = options.ignoreBorders !== false;

      const totalTiles = worldW * worldH;
      const fg = new Uint16Array(totalTiles);
      const bg = new Uint16Array(totalTiles);

      const canvas = document.createElement('canvas');
      canvas.width = worldW * 32;
      canvas.height = worldH * 32;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { fg, bg, detectedCount: 0, stats: {} };

      ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

      let detectedCount = 0;
      const stats = { bedrock: 0, castle: 0, dirt: 0, wood: 0, bookshelf: 0, lava: 0, background: 0, other: 0 };

      for (let ty = 0; ty < worldH; ty++) {
        for (let tx = 0; tx < worldW; tx++) {
          const tileIdx = ty * worldW + tx;

          // 1. Filter decorative event border frames (Cinco de Mayo banners, side ribbons, bottom watermark)
          if (ignoreBorders) {
            if (ty <= 1 && (tx < 3 || tx > worldW - 4)) continue;
            if ((tx <= 1 || tx >= worldW - 2) && ty < 55) continue;
            if (tx >= 80 && ty >= 53 && ty <= 58) continue;
          }

          const imgData = ctx.getImageData(tx * 32, ty * 32, 32, 32);
          const data = imgData.data;

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

          if (avgA < 30) continue;

          let varR = 0, varG = 0, varB = 0;
          for (let i = 0; i < data.length; i += 4) {
            varR += Math.pow(data[i] - avgR, 2);
            varG += Math.pow(data[i + 1] - avgG, 2);
            varB += Math.pow(data[i + 2] - avgB, 2);
          }
          varR /= pixelCount;
          varG /= pixelCount;
          varB /= pixelCount;

          // 2. Sky & Mountain Backdrop Filter
          if (avgB > 170 && avgG > 140 && avgR > 80 && (varR + varG + varB) < 160 && ty < 40) {
            continue;
          }
          if (avgG > 135 && avgR > 65 && avgB > 55 && (varR + varG + varB) < 90 && ty < 35) {
            continue;
          }

          // 3. Match against Block Signatures
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

          // 4. Game Rules: Bottom row is always Bedrock
          if (ty >= worldH - 2 && avgR < 55 && avgG < 55 && avgB < 60) {
            bestMatch = { id: 10, layer: 'fg', name: 'Bedrock' };
          }

          // 5. Assign to FG or BG layer
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
