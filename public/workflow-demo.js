(() => {
  'use strict';

  const DURATION = 15000;
  const TILE = 32;
  const AVATAR_SCALE = 4;
  const AVATAR_LOGICAL_SIZE = 96;
  const AVATAR_CANVAS_SIZE = AVATAR_LOGICAL_SIZE * AVATAR_SCALE;
  const PLAYER_ORIGIN = Object.freeze({ x: 32, y: 32 });
  const DEFAULT_SKIN_COLOR = '#f0f0f0';
  const WEATHER_PATH = 'weather/SUNNY.png';
  const PLAY_DURATION_SECONDS = 3.9;

  const LEVEL_WIDTH = 22;
  const LEVEL_HEIGHT = 10;
  const LEVEL_SECTIONS = Object.freeze([
    Object.freeze({ from: 0, to: 4, top: 7 }),
    Object.freeze({ from: 6, to: 9, top: 7 }),
    Object.freeze({ from: 11, to: 14, top: 6 }),
    Object.freeze({ from: 16, to: 21, top: 5 })
  ]);
  const LEVEL_GOAL = Object.freeze({ x: 20, y: 4 });

  const PLAY_PHASES = Object.freeze([
    Object.freeze({ type: 'idle', start: 0.000, end: 0.050, x0: 1.35, x1: 1.35, row0: 7, row1: 7 }),
    Object.freeze({ type: 'run', start: 0.050, end: 0.180, x0: 1.35, x1: 4.30, row0: 7, row1: 7 }),
    Object.freeze({ type: 'jump', start: 0.180, end: 0.320, x0: 4.30, x1: 6.65, row0: 7, row1: 7, height: 2.05 }),
    Object.freeze({ type: 'land', start: 0.320, end: 0.355, x0: 6.65, x1: 6.80, row0: 7, row1: 7 }),
    Object.freeze({ type: 'run', start: 0.355, end: 0.460, x0: 6.80, x1: 9.30, row0: 7, row1: 7 }),
    Object.freeze({ type: 'jump', start: 0.460, end: 0.605, x0: 9.30, x1: 11.65, row0: 7, row1: 6, height: 2.20 }),
    Object.freeze({ type: 'land', start: 0.605, end: 0.640, x0: 11.65, x1: 11.82, row0: 6, row1: 6 }),
    Object.freeze({ type: 'run', start: 0.640, end: 0.725, x0: 11.82, x1: 14.30, row0: 6, row1: 6 }),
    Object.freeze({ type: 'jump', start: 0.725, end: 0.865, x0: 14.30, x1: 16.65, row0: 6, row1: 5, height: 2.35 }),
    Object.freeze({ type: 'land', start: 0.865, end: 0.900, x0: 16.65, x1: 16.82, row0: 5, row1: 5 }),
    Object.freeze({ type: 'run', start: 0.900, end: 0.965, x0: 16.82, x1: 18.35, row0: 5, row1: 5 }),
    Object.freeze({ type: 'finish', start: 0.965, end: 1.000, x0: 18.35, x1: 18.35, row0: 5, row1: 5 })
  ]);

  const AVATAR_BASE_TEXTURE_PATHS = Object.freeze({
    body: 'character_base_assets/gtsetplanner/player_idle_body.png',
    head: 'tilesheets/player_head.png',
    expression: 'character_base_assets/gtsetplanner/player_eyes.png',
    frontLeftHand: 'character_base_assets/gtsetplanner/player_front_left_hand.png',
    bodyNaked: 'Base Set GT/Body Naked.png',
    bodyDefault: 'Base Set GT/Body.png',
    bolaMata: 'Base Set GT/Bola Mata.png',
    headBolong: 'Base Set GT/Head Bolong.png',
    headUtuh: 'Base Set GT/Head utuh.png',
    kakiKanan: 'Base Set GT/Kaki Kanan.png',
    kakiKiri: 'Base Set GT/Kaki Kiri.png',
    mulut: 'Base Set GT/Mulut.png',
    pupil: 'Base Set GT/Pupil.png',
    tanganKanan: 'Base Set GT/Tangan Kanan.png',
    tanganKiri: 'Base Set GT/Tangan Kiri.png',
    tutupMata: 'Base Set GT/Tutup Mata.png'
  });

  const state = {
    startedAt: performance.now(),
    items: [],
    wearables: [],
    worldLock: null,
    wing: null,
    dirt: null,
    grass: null,
    images: new Map(),
    imagePromises: new Map(),
    baseAssets: {},
    avatarParts: {},
    baseLoadPromise: null,
    avatarBaseComposite: null,
    avatarWingComposite: null,
    animatedAvatarCanvas: null,
    weather: null,
    level: null,
    equipped: false,
    lastScene: -1,
    raf: 0
  };

  const $ = (id) => document.getElementById(id);
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const dots = Array.from(document.querySelectorAll('[data-dot]'));
  const sceneTimeline = [
    { start: 0, end: 2600, scene: 0, label: 'Item Explorer' },
    { start: 2600, end: 4700, scene: 1, label: 'Sprite Inspector' },
    { start: 4700, end: 7300, scene: 2, label: 'Avatar Studio' },
    { start: 7300, end: 10800, scene: 3, label: 'World Planner' },
    { start: 10800, end: 15000, scene: 3, label: 'Play Mode' }
  ];

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const smoothstep = (amount) => {
    const t = clamp(amount);
    return t * t * (3 - 2 * t);
  };
  const normalizedName = (value) => String(value || '').trim().toLowerCase();
  const findExact = (items, name) => items.find((item) => normalizedName(item.name) === normalizedName(name)) || null;
  const findIncludes = (items, words, predicate = () => true) => {
    const targets = words.map(normalizedName);
    return items.find((item) => predicate(item) && targets.some((word) => normalizedName(item.name).includes(word))) || null;
  };
  const spritePath = (item) => item && item.texture ? `tilesheets/${item.texture}` : '';

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-workflow-module="${src}"]`);
      if (existing) {
        if (!globalName || window[globalName]) {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.workflowModule = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadImage(src) {
    if (!src) return Promise.reject(new Error('Missing image source'));
    if (state.images.has(src)) return Promise.resolve(state.images.get(src));
    if (state.imagePromises.has(src)) return state.imagePromises.get(src);

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        state.images.set(src, image);
        state.imagePromises.delete(src);
        resolve(image);
      };
      image.onerror = () => {
        state.imagePromises.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      image.src = src;
    });
    state.imagePromises.set(src, promise);
    return promise;
  }

  function getLoadedImage(src) {
    return state.images.get(src) || null;
  }

  function clearCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  function prepareResponsiveCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { ctx, width, height };
  }

  async function drawItem(canvas, item, padding = 0) {
    if (!canvas || !item || !item.texture) return;
    const ctx = clearCanvas(canvas);
    const image = await loadImage(spritePath(item));
    const sourceX = Number(item.tx || 0) * TILE;
    const sourceY = Number(item.ty || 0) * TILE;
    const size = Math.max(1, Math.min(canvas.width, canvas.height) - padding * 2);
    const dx = Math.round((canvas.width - size) / 2);
    const dy = Math.round((canvas.height - size) / 2);
    ctx.drawImage(image, sourceX, sourceY, TILE, TILE, dx, dy, size, size);
  }

  function setAssetLabels() {
    const worldLock = state.worldLock;
    if (worldLock) {
      $('world-lock-name').textContent = worldLock.name;
      $('world-lock-id').textContent = `ITEM #${worldLock.id}`;
      $('world-lock-texture').textContent = worldLock.texture;
      $('inspector-title').textContent = worldLock.name;
      $('inspector-id').textContent = `#${worldLock.id}`;
      $('inspector-texture').textContent = worldLock.texture;
      $('inspector-coords').textContent = `X ${worldLock.tx}, Y ${worldLock.ty} | 32x32`;
    }
    if (state.wing) $('wing-name').textContent = state.wing.name;
    if (state.dirt) $('dirt-name').textContent = state.dirt.name;
    if (state.grass) $('grass-name').textContent = state.grass.name;
    $('database-count').textContent = state.items.length.toLocaleString('en-US');
  }

  async function ensureBaseAvatarAssets() {
    if (state.baseLoadPromise) return state.baseLoadPromise;
    const entries = Object.entries(AVATAR_BASE_TEXTURE_PATHS);
    state.baseLoadPromise = Promise.all(
      entries.map(async ([key, src]) => [key, await loadImage(src)])
    ).then((loadedEntries) => {
      state.baseAssets = Object.fromEntries(loadedEntries);
      return state.baseAssets;
    });
    return state.baseLoadPromise;
  }

  function hexToRgb(hex) {
    let value = String(hex || '#ffffff').replace('#', '');
    if (value.length === 3) value = value.split('').map((part) => part + part).join('');
    const number = Number.parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  function cropTile(image, sx = 0, sy = 0, sw = TILE, sh = TILE) {
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }

  function tintTile(image, sx, sy, sw, sh, colorHex) {
    const canvas = cropTile(image, sx, sy, sw, sh);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    const rgb = hexToRgb(colorHex);
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0) {
        data[index] = Math.min(255, Math.floor((data[index] / 255) * rgb.r));
        data[index + 1] = Math.min(255, Math.floor((data[index + 1] / 255) * rgb.g));
        data[index + 2] = Math.min(255, Math.floor((data[index + 2] / 255) * rgb.b));
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function tintExpressionTile(image, sx, sy, sw, sh, colorHex, expressionId) {
    const canvas = cropTile(image, sx, sy, sw, sh);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sw, sh);
    window.AvatarTint.tintExpressionImageData(imageData, colorHex, expressionId);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function buildAvatarParts() {
    const assets = state.baseAssets;
    const wingProfile = window.GTWearableCatalog.getRenderProfile(state.wing.render_profile);
    const wingImage = getLoadedImage(spritePath(state.wing));
    const wingSourceX = Number(state.wing.tx || 0) * wingProfile.sourceWidth;
    const wingSourceY = Number(state.wing.ty || 0) * wingProfile.sourceHeight;

    state.avatarParts = {
      wing: cropTile(
        wingImage,
        wingSourceX,
        wingSourceY,
        wingProfile.sourceWidth,
        wingProfile.sourceHeight
      ),
      backHand: tintTile(assets.tanganKanan, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      leftLeg: tintTile(assets.kakiKiri, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      rightLeg: tintTile(assets.kakiKanan, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      body: tintTile(assets.bodyDefault || assets.body, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      eyeWhite: tintTile(assets.bolaMata, 0, 0, TILE, TILE, '#ffffff'),
      pupil: cropTile(assets.pupil, 0, 0, TILE, TILE),
      head: tintTile(assets.headBolong || assets.head, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      mouth: tintTile(assets.mulut, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      eyeCover: tintTile(assets.tutupMata, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR),
      expression: tintExpressionTile(assets.expression, 0, 0, TILE, TILE, DEFAULT_SKIN_COLOR, 0),
      frontHand: tintTile(
        assets.tanganKiri || assets.frontLeftHand,
        0,
        0,
        TILE,
        TILE,
        DEFAULT_SKIN_COLOR
      )
    };
  }

  function drawAvatarPart(ctx, part, options = {}) {
    if (!part) return;
    const pivotX = (PLAYER_ORIGIN.x + (options.pivotX ?? 16)) * AVATAR_SCALE;
    const pivotY = (PLAYER_ORIGIN.y + (options.pivotY ?? 16)) * AVATAR_SCALE;
    const shiftX = Number(options.shiftX || 0) * AVATAR_SCALE;
    const shiftY = Number(options.shiftY || 0) * AVATAR_SCALE;
    const rotation = Number(options.rotation || 0);
    const scaleX = Number(options.scaleX ?? 1);
    const scaleY = Number(options.scaleY ?? 1);

    ctx.save();
    ctx.translate(shiftX, shiftY);
    ctx.translate(pivotX, pivotY);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(
      part,
      0,
      0,
      part.width,
      part.height,
      PLAYER_ORIGIN.x * AVATAR_SCALE,
      PLAYER_ORIGIN.y * AVATAR_SCALE,
      TILE * AVATAR_SCALE,
      TILE * AVATAR_SCALE
    );
    ctx.restore();
  }

  function getRigPose(motion) {
    const time = Number(motion.time || 0);
    const local = clamp(motion.localProgress || 0);
    const phase = time * 12.2;
    const pose = {
      rootBob: 0,
      rootLean: 0,
      rootScaleX: 1,
      rootScaleY: 1,
      leftLegRotation: 0,
      rightLegRotation: 0,
      leftLegShiftY: 0,
      rightLegShiftY: 0,
      backArmRotation: 0,
      frontArmRotation: 0,
      headRotation: 0,
      wingRotation: 0,
      wingScaleY: 1
    };

    if (motion.state === 'idle') {
      pose.rootBob = Math.sin(time * 2.6) * 0.45;
      pose.backArmRotation = Math.sin(time * 2.2) * 0.018;
      pose.frontArmRotation = -pose.backArmRotation;
      pose.wingRotation = Math.sin(time * 3.1) * 0.022;
      pose.wingScaleY = 1 + Math.sin(time * 3.1) * 0.025;
      return pose;
    }

    if (motion.state === 'run') {
      const stride = Math.sin(phase);
      pose.rootBob = -Math.abs(Math.sin(phase)) * 0.62;
      pose.rootLean = 0.045;
      pose.leftLegRotation = stride * 0.145;
      pose.rightLegRotation = -stride * 0.145;
      pose.backArmRotation = -stride * 0.115;
      pose.frontArmRotation = stride * 0.115;
      pose.headRotation = -stride * 0.008;
      pose.wingRotation = Math.sin(phase * 0.5) * 0.035;
      pose.wingScaleY = 1 + Math.sin(phase * 0.5) * 0.035;
      return pose;
    }

    if (motion.state === 'jump') {
      const lift = smoothstep(local);
      pose.rootLean = 0.075;
      pose.rootBob = -0.35;
      pose.leftLegRotation = lerp(0.05, 0.18, lift);
      pose.rightLegRotation = lerp(-0.04, -0.13, lift);
      pose.leftLegShiftY = -0.8 * lift;
      pose.rightLegShiftY = -1.25 * lift;
      pose.backArmRotation = lerp(-0.02, -0.17, lift);
      pose.frontArmRotation = lerp(0.02, 0.18, lift);
      pose.headRotation = -0.025;
      pose.wingRotation = -0.075;
      pose.wingScaleY = 1.08;
      return pose;
    }

    if (motion.state === 'fall') {
      const fall = smoothstep(local);
      pose.rootLean = 0.035;
      pose.leftLegRotation = lerp(0.12, -0.035, fall);
      pose.rightLegRotation = lerp(-0.09, 0.045, fall);
      pose.leftLegShiftY = lerp(-0.7, 0, fall);
      pose.rightLegShiftY = lerp(-1.0, 0, fall);
      pose.backArmRotation = lerp(-0.16, -0.22, fall);
      pose.frontArmRotation = lerp(0.17, 0.23, fall);
      pose.headRotation = 0.018;
      pose.wingRotation = lerp(-0.06, 0.075, fall);
      pose.wingScaleY = lerp(1.08, 0.96, fall);
      return pose;
    }

    if (motion.state === 'land') {
      const impact = Math.sin(local * Math.PI);
      pose.rootScaleX = 1 + impact * 0.075;
      pose.rootScaleY = 1 - impact * 0.13;
      pose.rootLean = lerp(0.035, 0, smoothstep(local));
      pose.leftLegRotation = -0.055 * impact;
      pose.rightLegRotation = 0.055 * impact;
      pose.backArmRotation = 0.075 * impact;
      pose.frontArmRotation = -0.075 * impact;
      pose.wingRotation = 0.055 * impact;
      pose.wingScaleY = 1 - impact * 0.05;
      return pose;
    }

    if (motion.state === 'finish') {
      pose.rootBob = -Math.abs(Math.sin(time * 5.2)) * 0.5;
      pose.frontArmRotation = -0.34 + Math.sin(time * 10.5) * 0.055;
      pose.backArmRotation = 0.04;
      pose.headRotation = -0.018;
      pose.wingRotation = Math.sin(time * 9.5) * 0.07;
      pose.wingScaleY = 1 + Math.sin(time * 9.5) * 0.06;
      return pose;
    }

    return pose;
  }

  function renderAvatarRig(ctx, motion, equipped) {
    const parts = state.avatarParts;
    const pose = getRigPose(motion);
    const rootPivotX = (PLAYER_ORIGIN.x + 16) * AVATAR_SCALE;
    const rootPivotY = (PLAYER_ORIGIN.y + 32) * AVATAR_SCALE;
    const headOptions = {
      pivotX: 16,
      pivotY: 11,
      rotation: pose.headRotation
    };

    ctx.save();
    ctx.translate(rootPivotX, rootPivotY);
    ctx.translate(0, pose.rootBob * AVATAR_SCALE);
    ctx.rotate(pose.rootLean);
    ctx.scale(pose.rootScaleX, pose.rootScaleY);
    ctx.translate(-rootPivotX, -rootPivotY);

    if (equipped) {
      drawAvatarPart(ctx, parts.wing, {
        pivotX: 16,
        pivotY: 14,
        rotation: pose.wingRotation,
        scaleY: pose.wingScaleY
      });
    }

    drawAvatarPart(ctx, parts.backHand, {
      pivotX: 13,
      pivotY: 14,
      rotation: pose.backArmRotation
    });
    drawAvatarPart(ctx, parts.leftLeg, {
      pivotX: 14,
      pivotY: 22,
      rotation: pose.leftLegRotation,
      shiftY: pose.leftLegShiftY
    });
    drawAvatarPart(ctx, parts.rightLeg, {
      pivotX: 19,
      pivotY: 22,
      rotation: pose.rightLegRotation,
      shiftY: pose.rightLegShiftY
    });
    drawAvatarPart(ctx, parts.body);
    drawAvatarPart(ctx, parts.eyeWhite, headOptions);
    drawAvatarPart(ctx, parts.pupil, headOptions);
    drawAvatarPart(ctx, parts.head, headOptions);
    drawAvatarPart(ctx, parts.mouth, headOptions);
    drawAvatarPart(ctx, parts.eyeCover, headOptions);
    drawAvatarPart(ctx, parts.expression, headOptions);
    drawAvatarPart(ctx, parts.frontHand, {
      pivotX: 20,
      pivotY: 14,
      rotation: pose.frontArmRotation
    });

    ctx.restore();
  }

  function buildAvatarComposite(equipped) {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderAvatarRig(ctx, { state: 'idle', time: 0, localProgress: 0 }, equipped);
    return canvas;
  }

  async function ensureAvatarComposites() {
    await ensureBaseAvatarAssets();
    buildAvatarParts();
    state.avatarBaseComposite = buildAvatarComposite(false);
    state.avatarWingComposite = buildAvatarComposite(true);
    state.animatedAvatarCanvas = document.createElement('canvas');
    state.animatedAvatarCanvas.width = AVATAR_CANVAS_SIZE;
    state.animatedAvatarCanvas.height = AVATAR_CANVAS_SIZE;
  }

  function drawAvatar(equipped) {
    const canvas = $('avatar-demo-canvas');
    const ctx = clearCanvas(canvas);
    const composite = equipped ? state.avatarWingComposite : state.avatarBaseComposite;
    if (!ctx || !composite) return;
    const size = Math.min(canvas.width, canvas.height);
    const dx = Math.round((canvas.width - size) / 2);
    const dy = Math.round((canvas.height - size) / 2);
    ctx.drawImage(composite, 0, 0, composite.width, composite.height, dx, dy, size, size);
  }

  function renderAnimatedAvatar(motion) {
    const canvas = state.animatedAvatarCanvas;
    const ctx = clearCanvas(canvas);
    if (!ctx) return null;
    renderAvatarRig(ctx, motion, state.equipped);
    return canvas;
  }

  async function drawPalette() {
    await Promise.all([
      drawItem($('dirt-palette'), state.dirt, 4),
      drawItem($('grass-palette'), state.grass, 4)
    ]);
  }

  function createLevelData(item) {
    const itemId = Number(item.id);
    const grid = new Array(LEVEL_WIDTH * LEVEL_HEIGHT).fill(0);
    const buildOrder = [];

    LEVEL_SECTIONS.forEach((section, sectionIndex) => {
      for (let x = section.from; x <= section.to; x += 1) {
        for (let y = LEVEL_HEIGHT - 1; y >= section.top; y -= 1) {
          grid[y * LEVEL_WIDTH + x] = itemId;
          buildOrder.push({ x, y, sectionIndex });
        }
      }
    });

    return { itemId, grid, buildOrder };
  }

  function createBuildSnapshot(progress) {
    const total = state.level.buildOrder.length;
    const eased = smoothstep(clamp(progress));
    const visibleCount = Math.min(total, Math.floor(eased * (total + 1)));
    const grid = new Array(LEVEL_WIDTH * LEVEL_HEIGHT).fill(0);

    for (let index = 0; index < visibleCount; index += 1) {
      const tile = state.level.buildOrder[index];
      grid[tile.y * LEVEL_WIDTH + tile.x] = state.level.itemId;
    }

    const activeIndex = Math.max(0, Math.min(total - 1, visibleCount - 1));
    const goalVisible = progress >= 0.94;
    return {
      grid,
      activeTile: goalVisible ? LEVEL_GOAL : state.level.buildOrder[activeIndex],
      goalVisible
    };
  }

  function drawWorldBackground(ctx, width, height, timeSeconds, playMode) {
    ctx.clearRect(0, 0, width, height);
    if (state.weather) {
      const imageWidth = state.weather.naturalWidth || state.weather.width;
      const imageHeight = state.weather.naturalHeight || state.weather.height;
      const imageRatio = imageWidth / imageHeight;
      const canvasRatio = width / height;
      let sx = 0;
      let sy = 0;
      let sw = imageWidth;
      let sh = imageHeight;

      if (imageRatio > canvasRatio) {
        sw = imageHeight * canvasRatio;
        sx = (imageWidth - sw) / 2;
      } else {
        sh = imageWidth / canvasRatio;
        sy = (imageHeight - sh) / 2;
      }

      const drift = playMode ? Math.sin(timeSeconds * 0.28) * Math.min(8, sw * 0.01) : 0;
      sx = clamp(sx + drift, 0, Math.max(0, imageWidth - sw));
      ctx.drawImage(state.weather, sx, sy, sw, sh, 0, 0, width, height);
      ctx.fillStyle = playMode ? 'rgba(4, 10, 20, 0.07)' : 'rgba(4, 10, 20, 0.14)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawWorldGrid(ctx, metrics) {
    const { gridX, gridY, cell, gridWidth, gridHeight } = metrics;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let column = 0; column <= LEVEL_WIDTH; column += 1) {
      const x = Math.round(gridX + column * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(x, gridY + gridHeight);
      ctx.stroke();
    }
    for (let row = 0; row <= LEVEL_HEIGHT; row += 1) {
      const y = Math.round(gridY + row * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX + gridWidth, y);
      ctx.stroke();
    }
  }

  function getWorldMetrics(width, height) {
    const cell = Math.max(
      1,
      Math.min(48, Math.floor(width / LEVEL_WIDTH), Math.floor(height / LEVEL_HEIGHT))
    );
    const gridWidth = cell * LEVEL_WIDTH;
    const gridHeight = cell * LEVEL_HEIGHT;
    const gridX = Math.floor((width - gridWidth) / 2);
    const gridY = height - gridHeight;
    return { width, height, cell, gridX, gridY, gridWidth, gridHeight };
  }

  function getTileSourceRect(item, grid, x, y) {
    const image = getLoadedImage(spritePath(item));
    const baseX = Number(item.tx || 0) * TILE;
    const baseY = Number(item.ty || 0) * TILE;
    if (!window.GTAutotile || !image) {
      return { sx: baseX, sy: baseY, sw: TILE, sh: TILE };
    }

    const itemForAutotile = {
      ...item,
      spread_type: item.spread_type ?? item.spreadType ?? item.spread ?? 0
    };
    const mask = window.GTAutotile.computeNeighborMask(
      grid,
      LEVEL_WIDTH,
      LEVEL_HEIGHT,
      x,
      y,
      Number(item.id),
      false
    );
    const offset = window.GTAutotile.getTileOffset(itemForAutotile, mask);
    const sx = (Number(item.tx || 0) + Number(offset.offsetX || 0)) * TILE;
    const sy = (Number(item.ty || 0) + Number(offset.offsetY || 0)) * TILE;

    if (sx < 0 || sy < 0 || sx + TILE > image.naturalWidth || sy + TILE > image.naturalHeight) {
      return { sx: baseX, sy: baseY, sw: TILE, sh: TILE };
    }
    return { sx, sy, sw: TILE, sh: TILE };
  }

  function drawLevel(ctx, grid, metrics) {
    const image = getLoadedImage(spritePath(state.dirt));
    if (!image) return;
    const { cell, gridX, gridY } = metrics;

    for (let y = 0; y < LEVEL_HEIGHT; y += 1) {
      for (let x = 0; x < LEVEL_WIDTH; x += 1) {
        if (grid[y * LEVEL_WIDTH + x] !== state.level.itemId) continue;
        const source = getTileSourceRect(state.dirt, grid, x, y);
        ctx.drawImage(
          image,
          source.sx,
          source.sy,
          source.sw,
          source.sh,
          Math.round(gridX + x * cell),
          Math.round(gridY + y * cell),
          cell,
          cell
        );
      }
    }
  }

  function drawSpriteTile(ctx, item, x, y, size) {
    if (!item) return;
    const image = getLoadedImage(spritePath(item));
    if (!image) return;
    ctx.drawImage(
      image,
      Number(item.tx || 0) * TILE,
      Number(item.ty || 0) * TILE,
      TILE,
      TILE,
      Math.round(x),
      Math.round(y),
      Math.round(size),
      Math.round(size)
    );
  }

  function drawGoal(ctx, metrics, timeSeconds, visible, playMode) {
    if (!visible || !state.worldLock) return;
    const { cell, gridX, gridY } = metrics;
    const x = gridX + LEVEL_GOAL.x * cell;
    const y = gridY + LEVEL_GOAL.y * cell;
    const pulse = 0.5 + Math.sin(timeSeconds * 5.5) * 0.5;

    ctx.save();
    ctx.fillStyle = `rgba(34, 211, 238, ${playMode ? 0.08 + pulse * 0.08 : 0.06})`;
    ctx.fillRect(Math.round(x - cell * 0.12), Math.round(y - cell * 0.12), Math.round(cell * 1.24), Math.round(cell * 1.24));
    drawSpriteTile(ctx, state.worldLock, x, y, cell);
    ctx.fillStyle = 'rgba(4, 15, 24, 0.78)';
    ctx.fillRect(Math.round(x - cell * 0.05), Math.round(y - cell * 0.50), Math.round(cell * 1.10), Math.max(15, Math.round(cell * 0.35)));
    ctx.fillStyle = 'rgba(165, 243, 252, 0.98)';
    ctx.font = `800 ${Math.max(10, Math.round(cell * 0.23))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GOAL', Math.round(x + cell / 2), Math.round(y - cell * 0.33));
    ctx.restore();
  }

  function evaluatePlayTimeline(progress) {
    const value = clamp(progress);
    const phase = PLAY_PHASES.find((entry, index) => (
      value >= entry.start && (value < entry.end || index === PLAY_PHASES.length - 1)
    )) || PLAY_PHASES[PLAY_PHASES.length - 1];
    const duration = Math.max(0.0001, phase.end - phase.start);
    let localProgress = clamp((value - phase.start) / duration);
    const travelProgress = ['idle', 'land', 'finish'].includes(phase.type)
      ? smoothstep(localProgress)
      : localProgress;
    const x = lerp(phase.x0, phase.x1, travelProgress);
    let feetRow = lerp(phase.row0, phase.row1, smoothstep(localProgress));
    let motionState = phase.type;
    let airHeight = 0;

    if (phase.type === 'jump') {
      const baseline = lerp(phase.row0, phase.row1, localProgress);
      const arc = Number(phase.height || 2) * 4 * localProgress * (1 - localProgress);
      feetRow = baseline - arc;
      airHeight = arc;
      const height = Number(phase.height || 2);
      const derivative = (phase.row1 - phase.row0) - height * 4 * (1 - 2 * localProgress);
      const apexProgress = clamp((1 - (phase.row1 - phase.row0) / (4 * height)) / 2, 0.35, 0.65);
      motionState = derivative < 0 ? 'jump' : 'fall';
      if (motionState === 'jump') {
        localProgress = clamp(localProgress / apexProgress);
      } else {
        localProgress = clamp((localProgress - apexProgress) / (1 - apexProgress));
      }
    }

    return {
      x,
      feetRow,
      state: motionState,
      localProgress,
      time: value * PLAY_DURATION_SECONDS,
      airHeight,
      phaseType: phase.type
    };
  }

  function drawPlayerShadow(ctx, centerX, feetY, motion, cell) {
    const heightFactor = clamp(motion.airHeight / 2.4);
    const width = cell * lerp(0.38, 0.20, heightFactor);
    const height = cell * lerp(0.105, 0.055, heightFactor);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${lerp(0.30, 0.11, heightFactor)})`;
    ctx.beginPath();
    ctx.ellipse(centerX, feetY + cell * 0.055, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLandingDust(ctx, centerX, feetY, motion, cell) {
    if (motion.state !== 'land') return;
    const t = clamp(motion.localProgress);
    const alpha = (1 - t) * 0.58;
    const directions = [-1, -0.58, -0.25, 0.25, 0.58, 1];

    ctx.save();
    directions.forEach((direction, index) => {
      const spread = direction * cell * (0.20 + t * 0.54);
      const lift = Math.sin(t * Math.PI) * cell * (0.08 + (index % 3) * 0.025);
      const size = Math.max(2, Math.round(cell * (0.055 - t * 0.018)));
      ctx.fillStyle = `rgba(230, 226, 207, ${alpha * (0.65 + (index % 2) * 0.22)})`;
      ctx.fillRect(
        Math.round(centerX + spread - size / 2),
        Math.round(feetY - lift - size / 2),
        size,
        size
      );
    });
    ctx.restore();
  }

  function drawPlayer(ctx, metrics, motion) {
    const { cell, gridX, gridY } = metrics;
    const centerX = gridX + motion.x * cell;
    const feetY = gridY + motion.feetRow * cell;
    const compositeSize = cell * 3;
    const compositeX = centerX - compositeSize / 2;
    const compositeY = feetY - compositeSize * (64 / AVATAR_LOGICAL_SIZE);
    const avatar = renderAnimatedAvatar(motion);

    drawPlayerShadow(ctx, centerX, feetY, motion, cell);
    drawLandingDust(ctx, centerX, feetY, motion, cell);

    if (avatar) {
      ctx.drawImage(
        avatar,
        0,
        0,
        avatar.width,
        avatar.height,
        Math.round(compositeX),
        Math.round(compositeY),
        Math.round(compositeSize),
        Math.round(compositeSize)
      );
    }

    ctx.save();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.98)';
    ctx.font = `800 ${Math.max(11, Math.round(cell * 0.27))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Raey', Math.round(centerX), Math.round(compositeY + cell * 0.72));
    ctx.restore();
  }

  function getPlayStatus(motion) {
    if (motion.state === 'run') return 'RUNNING | CLEAN ROUTE';
    if (motion.state === 'jump') return 'JUMP | TAKEOFF';
    if (motion.state === 'fall') return 'AIR | LANDING TARGET';
    if (motion.state === 'land') return 'LAND | IMPACT';
    if (motion.state === 'finish') return 'GOAL REACHED';
    return 'READY';
  }

  function drawWorld(progress, playMode, timeSeconds) {
    const canvas = $('world-demo-canvas');
    const { ctx, width, height } = prepareResponsiveCanvas(canvas);
    const metrics = getWorldMetrics(width, height);
    const snapshot = playMode
      ? { grid: state.level.grid, activeTile: null, goalVisible: true }
      : createBuildSnapshot(progress);

    drawWorldBackground(ctx, width, height, timeSeconds, playMode);
    if (!playMode) drawWorldGrid(ctx, metrics);
    drawLevel(ctx, snapshot.grid, metrics);
    drawGoal(ctx, metrics, timeSeconds, snapshot.goalVisible, playMode);

    let motion = null;
    if (playMode) {
      motion = evaluatePlayTimeline(progress);
      drawPlayer(ctx, metrics, motion);
    }

    const activeTile = snapshot.activeTile || LEVEL_GOAL;
    return {
      ...metrics,
      cursorX: metrics.gridX + activeTile.x * metrics.cell,
      cursorY: metrics.gridY + activeTile.y * metrics.cell,
      motion
    };
  }

  function showScene(sceneIndex, timelineIndex) {
    scenes.forEach((scene, index) => scene.classList.toggle('is-active', index === sceneIndex));
    dots.forEach((dot, index) => dot.classList.toggle('is-active', index === timelineIndex));
    state.lastScene = sceneIndex;
  }

  function resetSceneState() {
    state.equipped = false;
    $('typed-search').textContent = '';
    $('world-lock-card').classList.remove('is-visible');
    $('wing-card').classList.remove('is-equipped');
    $('equip-status').textContent = 'Equip';
    $('equipped-pop').classList.remove('is-visible');
    $('edit-mode-pill').classList.add('is-active');
    $('play-mode-pill').classList.remove('is-active');
    $('play-toast').classList.remove('is-visible');
    $('world-scene-title').textContent = 'Build a clean route';
    $('place-cursor').style.opacity = '0';
    drawAvatar(false);
  }

  function restart() {
    cancelAnimationFrame(state.raf);
    state.startedAt = performance.now();
    state.lastScene = -1;
    resetSceneState();
    tick();
  }

  function updateSearchScene(elapsed) {
    const searchT = clamp(elapsed / 1450);
    const query = 'World Lock';
    $('typed-search').textContent = query.slice(0, Math.ceil(searchT * query.length));
    $('world-lock-card').classList.toggle('is-visible', elapsed > 1350);
  }

  function updateAvatarScene(elapsed) {
    const shouldEquip = elapsed - 4700 > 1100;
    if (shouldEquip !== state.equipped) {
      state.equipped = shouldEquip;
      $('wing-card').classList.toggle('is-equipped', shouldEquip);
      $('equip-status').textContent = shouldEquip ? 'Equipped' : 'Equip';
      $('equipped-pop').classList.toggle('is-visible', shouldEquip);
      drawAvatar(shouldEquip);
    }
  }

  function updatePlayToast(motion) {
    const toast = $('play-toast');
    const label = toast.querySelector('span');
    if (label) label.textContent = getPlayStatus(motion);
  }

  function updateWorldScene(elapsed) {
    const playMode = elapsed >= 10800;
    $('edit-mode-pill').classList.toggle('is-active', !playMode);
    $('play-mode-pill').classList.toggle('is-active', playMode);
    $('play-toast').classList.toggle('is-visible', playMode);
    $('world-scene-title').textContent = playMode ? 'Playtest the parkour' : 'Build a clean route';

    if (!playMode) {
      const progress = clamp((elapsed - 7300) / 3000);
      const metrics = drawWorld(progress, false, elapsed / 1000);
      const cursor = $('place-cursor');
      cursor.style.opacity = '1';
      cursor.style.width = `${metrics.cell}px`;
      cursor.style.height = `${metrics.cell}px`;
      cursor.style.left = `${metrics.cursorX}px`;
      cursor.style.top = `${metrics.cursorY}px`;
    } else {
      $('place-cursor').style.opacity = '0';
      const progress = clamp((elapsed - 10800) / (PLAY_DURATION_SECONDS * 1000));
      const metrics = drawWorld(progress, true, elapsed / 1000);
      updatePlayToast(metrics.motion);
    }
  }

  function tick(now = performance.now()) {
    const elapsed = (now - state.startedAt) % DURATION;
    if (elapsed < 20 && now - state.startedAt > DURATION) {
      state.startedAt = now;
      resetSceneState();
    }

    const rawIndex = sceneTimeline.findIndex((entry) => elapsed >= entry.start && elapsed < entry.end);
    const timelineIndex = rawIndex < 0 ? sceneTimeline.length - 1 : rawIndex;
    const entry = sceneTimeline[timelineIndex];
    if (entry.scene !== state.lastScene) showScene(entry.scene, timelineIndex);
    else dots.forEach((dot, index) => dot.classList.toggle('is-active', index === timelineIndex));

    $('scene-label').textContent = entry.label;
    $('demo-progress-bar').style.width = `${(elapsed / DURATION) * 100}%`;
    $('time-label').textContent = `00:${String(Math.floor(elapsed / 1000)).padStart(2, '0')} / 00:15`;

    if (entry.scene === 0) updateSearchScene(elapsed);
    if (entry.scene === 2) updateAvatarScene(elapsed);
    if (entry.scene === 3) updateWorldScene(elapsed);
    state.raf = requestAnimationFrame(tick);
  }

  function handleAssetError(error) {
    console.error('[workflow-demo]', error);
    $('asset-error-text').textContent = error && error.message ? error.message : 'Unknown asset error';
    $('asset-error').hidden = false;
    cancelAnimationFrame(state.raf);
  }

  async function init() {
    try {
      await Promise.all([
        loadScriptOnce('avatar_tint.js', 'AvatarTint'),
        loadScriptOnce('wearable_catalog.js', 'GTWearableCatalog'),
        loadScriptOnce('autotile.js', 'GTAutotile')
      ]);

      if (!window.AvatarTint || !window.GTWearableCatalog || !window.GTAutotile) {
        throw new Error('The original avatar or autotile modules could not be initialized.');
      }

      const [itemsResponse, wearablesResponse] = await Promise.all([
        fetch('items_db.json'),
        fetch('wearables_manifest.json')
      ]);
      if (!itemsResponse.ok) throw new Error(`items_db.json: HTTP ${itemsResponse.status}`);
      if (!wearablesResponse.ok) throw new Error(`wearables_manifest.json: HTTP ${wearablesResponse.status}`);

      state.items = await itemsResponse.json();
      const wearableData = await wearablesResponse.json();
      state.wearables = Array.isArray(wearableData) ? wearableData : (wearableData.items || []);
      state.worldLock = findExact(state.items, 'World Lock') || findIncludes(state.items, ['world lock']);
      state.wing = findExact(state.wearables, 'Angel Wings') ||
        findIncludes(
          state.wearables,
          ['angel wings'],
          (item) => normalizedName(item.slot) === 'back'
        ) ||
        null;
      state.dirt = findExact(state.items, 'Dirt') || findIncludes(state.items, ['dirt']);
      state.grass = findExact(state.items, 'Grass') || findIncludes(state.items, ['grass']) || state.dirt;

      if (!state.worldLock || !state.wing || !state.dirt || !state.grass) {
        throw new Error('One or more required project assets could not be resolved from the current database.');
      }

      setAssetLabels();
      state.level = createLevelData(state.dirt);
      const requiredImages = [
        WEATHER_PATH,
        spritePath(state.worldLock),
        spritePath(state.wing),
        spritePath(state.dirt),
        spritePath(state.grass)
      ];
      await Promise.all([
        ensureBaseAvatarAssets(),
        ...requiredImages.map(loadImage)
      ]);
      state.weather = getLoadedImage(WEATHER_PATH);
      await ensureAvatarComposites();

      await Promise.all([
        drawItem($('world-lock-thumb'), state.worldLock, 6),
        drawItem($('world-lock-large'), state.worldLock, 0),
        drawItem($('wing-thumb'), state.wing, 6),
        drawPalette()
      ]);
      drawAvatar(false);

      $('restart-demo').addEventListener('click', restart);
      $('world-lock-card').addEventListener('click', () => { state.startedAt = performance.now() - 2700; });
      $('to-avatar-hint').addEventListener('click', () => { state.startedAt = performance.now() - 4800; });
      $('wing-card').addEventListener('click', () => { state.startedAt = performance.now() - 6000; });
      tick();
    } catch (error) {
      handleAssetError(error);
    }
  }

  init();
})();
