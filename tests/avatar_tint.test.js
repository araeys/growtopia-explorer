const test = require("node:test");
const assert = require("node:assert/strict");
let tintExpressionPixel;
try {
  ({ tintExpressionPixel } = require("../public/avatar_tint.js"));
} catch {
  tintExpressionPixel = undefined;
}

function tint(pixel, colorHex, context) {
  assert.equal(
    typeof tintExpressionPixel,
    "function",
    "avatar_tint.js must export tintExpressionPixel"
  );
  return tintExpressionPixel(pixel, colorHex, context);
}

test("tints a grayscale facial-skin pixel", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA"),
    [230, 175, 153, 255]
  );
});

test("preserves pure white eye and tooth pixels", () => {
  assert.deepEqual(
    tint([255, 255, 255, 255], "#FFC3AA"),
    [255, 255, 255, 255]
  );
});

test("preserves pure black pupil pixels", () => {
  assert.deepEqual(
    tint([0, 0, 0, 255], "#FFC3AA"),
    [0, 0, 0, 255]
  );
});

test("preserves colored expression details", () => {
  assert.deepEqual(
    tint([236, 6, 27, 255], "#FFC3AA"),
    [236, 6, 27, 255]
  );
});

test("preserves transparent pixels", () => {
  assert.deepEqual(
    tint([230, 230, 230, 0], "#FFC3AA"),
    [230, 230, 230, 0]
  );
});

test("normal expression tints the upper eye skin border", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 13, y: 3
    }),
    [230, 176, 153, 255]
  );
});

test("normal expression preserves the neutral lower eye shadow", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 12, y: 5
    }),
    [230, 230, 230, 255]
  );
});

test("normal expression uses the dark facial-line shade for the mouth", () => {
  assert.deepEqual(
    tint([230, 230, 230, 255], "#FFC3AA", {
      expressionId: 0, x: 17, y: 13
    }),
    [120, 92, 80, 255]
  );
});

test("preserves neutral grayscale expression features", () => {
  const cases = [
    ["Happy lower eye shadow", 1, 12, 5, 230],
    ["Angry lower eye shadow", 2, 12, 5, 230],
    ["Angry mouth detail", 2, 15, 11, 196],
    ["Surprised lower eye shadow", 3, 12, 5, 230],
    ["Wink stroke", 4, 12, 4, 212],
    ["Wink mouth detail", 4, 19, 13, 230],
    ["Sleeping eye stroke", 5, 12, 6, 212],
    ["Sleeping lower eyelid", 5, 13, 7, 230],
    ["Derp eye detail", 6, 12, 5, 230],
    ["Derp tooth shadow", 6, 16, 11, 230],
    ["Derp side detail", 6, 8, 5, 212]
  ];

  for (const [label, expressionId, x, y, gray] of cases) {
    assert.deepEqual(
      tint([gray, gray, gray, 255], "#FFC3AA", {
        expressionId, x, y
      }),
      [gray, gray, gray, 255],
      label
    );
  }
});

test("tints semantic skin-cover pixels in expression tiles", () => {
  const cases = [
    [0, 13, 3],
    [1, 13, 3],
    [2, 13, 3],
    [3, 13, 2],
    [4, 21, 3],
    [5, 13, 3]
  ];

  for (const [expressionId, x, y] of cases) {
    const expectedGreen = expressionId === 0 ? 176 : 175;
    assert.deepEqual(
      tint([230, 230, 230, 255], "#FFC3AA", {
        expressionId, x, y
      }),
      [230, expectedGreen, 153, 255]
    );
  }
});
