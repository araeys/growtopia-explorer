(function exposeAvatarTint(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AvatarTint = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  function parseHexColor(hex) {
    let value = hex.replace("#", "");
    if (value.length === 3) {
      value = value.split("").map(char => char + char).join("");
    }
    const number = parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  function multiplyGrayByColor(gray, target, rounding) {
    const applyRounding = rounding === "round" ? Math.round : Math.floor;
    return [
      applyRounding((gray / 255) * target.r),
      applyRounding((gray / 255) * target.g),
      applyRounding((gray / 255) * target.b)
    ];
  }

  function normalExpressionGrayMode(x, y) {
    if (y >= 5 && y <= 7) return "neutral";
    if (y >= 12 && y <= 13) return "mouth";
    return "skin";
  }

  function expressionGrayMode(expressionId, x, y, gray) {
    if (expressionId === 0) return normalExpressionGrayMode(x, y);

    if (gray === 212 || gray === 196) return "neutral";

    if (expressionId === 1) {
      return y >= 5 && y <= 7 ? "neutral" : "skin";
    }
    if (expressionId === 2) {
      if (y >= 5 && y <= 7) return "neutral";
      if (y >= 11 && y <= 14) return "neutral";
      return "skin";
    }
    if (expressionId === 3) {
      return y >= 5 && y <= 8 ? "neutral" : "skin";
    }
    if (expressionId === 4) {
      if (y >= 5 && y <= 7) return "neutral";
      if (y === 13) return "neutral";
      return "skin";
    }
    if (expressionId === 5) {
      return y >= 6 && y <= 7 ? "neutral" : "skin";
    }
    if (expressionId === 6) {
      if (y >= 5 && y <= 6) return "neutral";
      if (y === 11 || y === 13) return "neutral";
      return "skin";
    }
    return "skin";
  }

  function tintExpressionPixel(pixel, colorHex, context) {
    const [r, g, b, a] = pixel;
    const isTintableGray = a > 0 && r === g && g === b && r > 0 && r < 255;
    if (!isTintableGray) return [r, g, b, a];

    const target = parseHexColor(colorHex);
    const semanticContext = context || {};
    const mode = expressionGrayMode(
      semanticContext.expressionId,
      semanticContext.x,
      semanticContext.y,
      r
    );
    if (mode === "neutral") return [r, g, b, a];

    const gray = mode === "mouth" ? 120 : r;
    const rounding = semanticContext.expressionId === 0 ? "round" : "floor";
    const tinted = multiplyGrayByColor(gray, target, rounding);
    return [tinted[0], tinted[1], tinted[2], a];
  }

  function tintExpressionImageData(imageData, colorHex, expressionId) {
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const pixelIndex = index / 4;
      const tinted = tintExpressionPixel(
        [data[index], data[index + 1], data[index + 2], data[index + 3]],
        colorHex,
        {
          expressionId,
          x: pixelIndex % imageData.width,
          y: Math.floor(pixelIndex / imageData.width)
        }
      );
      data[index] = tinted[0];
      data[index + 1] = tinted[1];
      data[index + 2] = tinted[2];
      data[index + 3] = tinted[3];
    }
    return imageData;
  }

  return { tintExpressionPixel, tintExpressionImageData };
});
