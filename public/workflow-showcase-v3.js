(() => {
  'use strict';

  const DURATION = 15000;
  const TILE = 32;
  const AVATAR_SCALE = 4;
  const AVATAR_LOGICAL_SIZE = 96;
  const AVATAR_CANVAS_SIZE = AVATAR_LOGICAL_SIZE * AVATAR_SCALE;
  const PLAYER_ORIGIN = Object.freeze({ x: 32, y: 32 });
  const HUMAN_SKIN_TONE = Object.freeze({ name: 'Tone 5', color: '#e1ac96' });
  const WEATHER_PATH = 'weather/SUNNY.png';
  const FLAG_PATH = 'flag_logo.png';
  const PLAY_START_MS = 11200;
  const PLAY_DURATION_SECONDS = (DURATION - PLAY_START_MS) / 1000;

  const LEVEL_WIDTH = 22;
  const LEVEL_HEIGHT = 10;
  const LEVEL_SECTIONS = Object.freeze([
    Object.freeze({ from: 0, to: 4, top: 7 }),
    Object.freeze({ from: 6, to: 9, top: 7 }),
    Object.freeze({ from: 11, to: 14, top: 6 }),
    Object.freeze({ from: 16, to: 21, top: 5 })
  ]);
  const LEVEL_SPAWN = Object.freeze({ x: 1, y: 6 });
  const LEVEL_GOAL = Object.freeze({ x: 20, y: 4 });

  const PLAY_PHASES = Object.freeze([
    Object.freeze({ type: 'idle', start: 0.000, end: 0.045, x0: 1.45, x1: 1.45, row0: 7, row1: 7 }),
    Object.freeze({ type: 'run', start: 0.045, end: 0.155, x0: 1.45, x1: 4.12, row0: 7, row1: 7 }),
    Object.freeze({ type: 'takeoff', start: 0.155, end: 0.180, x0: 4.12, x1: 4.34, row0: 7, row1: 7 }),
    Object.freeze({ type: 'jump', start: 0.180, end: 0.315, x0: 4.34, x1: 6.58, row0: 7, row1: 7, height: 2.02 }),
    Object.freeze({ type: 'land', start: 0.315, end: 0.350, x0: 6.58, x1: 6.75, row0: 7, row1: 7 }),
    Object.freeze({ type: 'run', start: 0.350, end: 0.455, x0: 6.75, x1: 9.12, row0: 7, row1: 7 }),
    Object.freeze({ type: 'takeoff', start: 0.455, end: 0.480, x0: 9.12, x1: 9.34, row0: 7, row1: 7 }),
    Object.freeze({ type: 'jump', start: 0.480, end: 0.615, x0: 9.34, x1: 11.58, row0: 7, row1: 6, height: 2.12 }),
    Object.freeze({ type: 'land', start: 0.615, end: 0.650, x0: 11.58, x1: 11.76, row0: 6, row1: 6 }),
    Object.freeze({ type: 'run', start: 0.650, end: 0.735, x0: 11.76, x1: 14.08, row0: 6, row1: 6 }),
    Object.freeze({ type: 'takeoff', start: 0.735, end: 0.760, x0: 14.08, x1: 14.30, row0: 6, row1: 6 }),
    Object.freeze({ type: 'jump', start: 0.760, end: 0.895, x0: 14.30, x1: 16.55, row0: 6, row1: 5, height: 2.22 }),
    Object.freeze({ type: 'land', start: 0.895, end: 0.930, x0: 16.55, x1: 16.74, row0: 5, row1: 5 }),
    Object.freeze({ type: 'run', start: 0.930, end: 0.978, x0: 16.74, x1: 19.00, row0: 5, row1: 5 }),
    Object.freeze({ type: 'finish', start: 0.978, end: 1.000, x0: 19.00, x1: 19.00, row0: 5, row1: 5 })
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
    paused: false,
    pausedElapsed: 0,
    items: [],
    wearables: [],
    worldLock: null,
    wing: null,
    dirt: null,
    grass: null,
    spawnDoor: null,
    images: new Map(),
    imagePromises: new Map(),
    baseAssets: {},
    avatarParts: {},
    baseLoadPromise: null,
    avatarBaseComposite: null,
    avatarWingComposite: null,
    animatedAvatarCanvas: null,
    weather: null,
    flagLogo: null,
    level: null,
    equipped: false,
    lastScene: -1,
    lastTimelineIndex: -1,
    lastElapsed: 0,
    worldMode: null,
    raf: 0
  };

  const $ = (id) => document.getElementById(id);
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const dots = Array.from(document.querySelectorAll('[data-dot]'));
  const sceneTimeline = [
    { start: 0, end: 2500, scene: 0, label: 'Explore', count: '01 / 05' },
    { start: 2500, end: 4700, scene: 1, label: 'Inspect', count: '02 / 05' },
    { start: 4700, end: 7600, scene: 2, label: 'Style', count: '03 / 05' },
    { start: 7600, end: PLAY_START_MS, scene: 3, label: 'Build', count: '04 / 05' },
    { start: PLAY_START_MS, end: DURATION, scene: 3, label: 'Play', count: '05 / 05' }
  ];

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const smoothstep = (amount) => {
    const t = clamp(amount);
    return t * t * (3 - 2 * t);
  };
  const easeInOutCubic = (amount) => {
    const t = clamp(amount);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const normalizedName = (value) => String(value || '').trim().toLowerCase();
  const findExact = (items, name) => items.find((item) => normalizedName(item.name) === normalizedName(name)) || null;
  const findById = (items, id) => items.find((item) => Number(item.id) === Number(id)) || null;
  const findIncludes = (items, words, predicate = () => true) => {
    const targets = words.map(normalizedName);
    return items.find((item) => predicate(item) && targets.some((word) => normalizedName(item.name).includes(word))) || null;
  };
  const spritePath = (item) => item && item.texture ? `tilesheets/${item.texture}` : '';

  function configurePageMode() {
    const params = new URLSearchParams(window.location.search);
    const captureMode = params.has('capture') || params.get('mode') === 'capture';
    document.documentElement.classList.toggle('capture-mode', captureMode);

    const start = normalizedName(params.get('start'));
    const offsets = {
      explore: 0,
      inspect: 2500,
      style: 4700,
      build: 7600,
      play: PLAY_START_MS
    };
    if (Object.hasOwn(offsets, start)) {
      state.startedAt = performance.now() - offsets[start];
    }
  }

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
    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    return context;
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

    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;
    return { ctx: context, width, height };
  }

  async function drawItem(canvas, item, padding = 0) {
    if (!canvas || !item || !item.texture) return;
    const context = clearCanvas(canvas);
    const image = await loadImage(spritePath(item));
    const sourceX = Number(item.tx || 0) * TILE;
    const sourceY = Number(item.ty || 0) * TILE;
    const size = Math.max(1, Math.min(canvas.width, canvas.height) - padding * 2);
    const destinationX = Math.round((canvas.width - size) / 2);
    const destinationY = Math.round((canvas.height - size) / 2);
    context.drawImage(image, sourceX, sourceY, TILE, TILE, destinationX, destinationY, size, size);
  }

  function setAssetLabels() {
    if (state.worldLock) {
      $('world-lock-name').textContent = state.worldLock.name;
      $('world-lock-id').textContent = `ITEM #${state.worldLock.id}`;
      $('world-lock-texture').textContent = state.worldLock.texture;
      $('inspector-title').textContent = state.worldLock.name;
      $('inspector-id').textContent = `#${state.worldLock.id}`;
      $('inspector-texture').textContent = state.worldLock.texture;
      $('inspector-coords').textContent = `X ${state.worldLock.tx}, Y ${state.worldLock.ty} | 32 x 32`;
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
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }

  function tintTile(image, sx, sy, sw, sh, colorHex) {
    const canvas = cropTile(image, sx, sy, sw, sh);
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    const rgb = hexToRgb(colorHex);

    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0) {
        data[index] = Math.min(255, Math.floor((data[index] / 255) * rgb.r));
        data[index + 1] = Math.min(255, Math.floor((data[index + 1] / 255) * rgb.g));
        data[index + 2] = Math.min(255, Math.floor((data[index + 2] / 255) * rgb.b));
      }
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  function tintExpressionTile(image, sx, sy, sw, sh, colorHex, expressionId) {
    const canvas = cropTile(image, sx, sy, sw, sh);
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, sw, sh);
    window.AvatarTint.tintExpressionImageData(imageData, colorHex, expressionId);
    context.putImageData(imageData, 0, 0);
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
      backHand: tintTile(assets.tanganKanan, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      leftLeg: tintTile(assets.kakiKiri, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      rightLeg: tintTile(assets.kakiKanan, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      body: tintTile(assets.bodyDefault || assets.body, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      eyeWhite: tintTile(assets.bolaMata, 0, 0, TILE, TILE, '#ffffff'),
      pupil: cropTile(assets.pupil, 0, 0, TILE, TILE),
      head: tintTile(assets.headBolong || assets.head, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      mouth: tintTile(assets.mulut, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      eyeCover: tintTile(assets.tutupMata, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color),
      expression: tintExpressionTile(assets.expression, 0, 0, TILE, TILE, HUMAN_SKIN_TONE.color, 0),
      frontHand: tintTile(
        assets.tanganKiri || assets.frontLeftHand,
        0,
        0,
        TILE,
        TILE,
        HUMAN_SKIN_TONE.color
      )
    };
  }

  function drawAvatarPart(context, part, options = {}) {
    if (!part) return;
    const pivotX = (PLAYER_ORIGIN.x + (options.pivotX ?? 16)) * AVATAR_SCALE;
    const pivotY = (PLAYER_ORIGIN.y + (options.pivotY ?? 16)) * AVATAR_SCALE;
    const shiftX = Number(options.shiftX || 0) * AVATAR_SCALE;
    const shiftY = Number(options.shiftY || 0) * AVATAR_SCALE;
    const rotation = Number(options.rotation || 0);
    const scaleX = Number(options.scaleX ?? 1);
    const scaleY = Number(options.scaleY ?? 1);

    context.save();
    context.translate(shiftX, shiftY);
    context.translate(pivotX, pivotY);
    context.rotate(rotation);
    context.scale(scaleX, scaleY);
    context.translate(-pivotX, -pivotY);
    context.drawImage(
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
    context.restore();
  }

  function getRigPose(motion) {
    const time = Number(motion.time || 0);
    const local = clamp(motion.localProgress || 0);
    const phase = time * 14.2;
    const pose = {
      rootBob: 0,
      rootShiftX: 0,
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
      headShiftY: 0,
      wingRotation: 0,
      wingScaleY: 1
    };

    if (motion.state === 'idle') {
      pose.rootBob = Math.sin(time * 2.7) * 0.42;
      pose.backArmRotation = Math.sin(time * 2.3) * 0.018;
      pose.frontArmRotation = -pose.backArmRotation;
      pose.headRotation = Math.sin(time * 1.5) * 0.007;
      pose.wingRotation = Math.sin(time * 3.15) * 0.022;
      pose.wingScaleY = 1 + Math.sin(time * 3.15) * 0.025;
      return pose;
    }

    if (motion.state === 'run') {
      const stride = Math.sin(phase);
      const bounce = Math.abs(Math.sin(phase));
      pose.rootBob = -bounce * 0.68;
      pose.rootShiftX = Math.sin(phase * 0.5) * 0.12;
      pose.rootLean = 0.052;
      pose.leftLegRotation = stride * 0.22;
      pose.rightLegRotation = -stride * 0.22;
      pose.leftLegShiftY = Math.max(0, -stride) * -0.48;
      pose.rightLegShiftY = Math.max(0, stride) * -0.48;
      pose.backArmRotation = -stride * 0.205;
      pose.frontArmRotation = stride * 0.205;
      pose.headRotation = -stride * 0.012;
      pose.wingRotation = Math.sin(phase * 0.5) * 0.045;
      pose.wingScaleY = 1 + Math.sin(phase * 0.5) * 0.042;
      return pose;
    }

    if (motion.state === 'takeoff') {
      const anticipation = Math.sin(local * Math.PI);
      pose.rootBob = anticipation * 0.72;
      pose.rootLean = lerp(0.04, 0.085, local);
      pose.rootScaleX = 1 + anticipation * 0.055;
      pose.rootScaleY = 1 - anticipation * 0.09;
      pose.leftLegRotation = -0.08 * anticipation;
      pose.rightLegRotation = 0.10 * anticipation;
      pose.backArmRotation = 0.16 * anticipation;
      pose.frontArmRotation = -0.18 * anticipation;
      pose.headShiftY = anticipation * 0.35;
      pose.wingRotation = 0.075 * anticipation;
      pose.wingScaleY = 1 - anticipation * 0.07;
      return pose;
    }

    if (motion.state === 'jump') {
      const lift = smoothstep(local);
      pose.rootLean = lerp(0.085, 0.055, lift);
      pose.rootBob = -0.42;
      pose.leftLegRotation = lerp(0.08, 0.24, lift);
      pose.rightLegRotation = lerp(-0.06, -0.18, lift);
      pose.leftLegShiftY = -0.8 * lift;
      pose.rightLegShiftY = -1.35 * lift;
      pose.backArmRotation = lerp(-0.02, -0.24, lift);
      pose.frontArmRotation = lerp(0.02, 0.25, lift);
      pose.headRotation = -0.028;
      pose.wingRotation = -0.095;
      pose.wingScaleY = 1.11;
      return pose;
    }

    if (motion.state === 'fall') {
      const fall = smoothstep(local);
      pose.rootLean = lerp(0.045, 0.018, fall);
      pose.leftLegRotation = lerp(0.19, -0.055, fall);
      pose.rightLegRotation = lerp(-0.15, 0.07, fall);
      pose.leftLegShiftY = lerp(-0.75, -0.08, fall);
      pose.rightLegShiftY = lerp(-1.15, -0.12, fall);
      pose.backArmRotation = lerp(-0.22, -0.29, fall);
      pose.frontArmRotation = lerp(0.23, 0.30, fall);
      pose.headRotation = 0.02;
      pose.wingRotation = lerp(-0.08, 0.09, fall);
      pose.wingScaleY = lerp(1.1, 0.95, fall);
      return pose;
    }

    if (motion.state === 'land') {
      const impact = Math.sin(local * Math.PI);
      pose.rootBob = impact * 0.42;
      pose.rootScaleX = 1 + impact * 0.105;
      pose.rootScaleY = 1 - impact * 0.16;
      pose.rootLean = lerp(0.035, 0, smoothstep(local));
      pose.leftLegRotation = -0.075 * impact;
      pose.rightLegRotation = 0.075 * impact;
      pose.backArmRotation = 0.10 * impact;
      pose.frontArmRotation = -0.10 * impact;
      pose.headShiftY = impact * 0.45;
      pose.wingRotation = 0.075 * impact;
      pose.wingScaleY = 1 - impact * 0.075;
      return pose;
    }

    if (motion.state === 'finish') {
      const cheer = Math.sin(time * 10.5);
      pose.rootBob = -Math.abs(Math.sin(time * 5.4)) * 0.55;
      pose.frontArmRotation = -0.42 + cheer * 0.07;
      pose.backArmRotation = 0.05;
      pose.headRotation = -0.02;
      pose.wingRotation = cheer * 0.095;
      pose.wingScaleY = 1 + cheer * 0.07;
      return pose;
    }

    return pose;
  }

  function renderAvatarRig(context, motion, equipped) {
    const parts = state.avatarParts;
    const pose = getRigPose(motion);
    const rootPivotX = (PLAYER_ORIGIN.x + 16) * AVATAR_SCALE;
    const rootPivotY = (PLAYER_ORIGIN.y + 31) * AVATAR_SCALE;
    const headOptions = {
      pivotX: 16,
      pivotY: 11,
      shiftY: pose.headShiftY,
      rotation: pose.headRotation
    };

    context.save();
    context.translate(rootPivotX, rootPivotY);
    context.translate(pose.rootShiftX * AVATAR_SCALE, pose.rootBob * AVATAR_SCALE);
    context.rotate(pose.rootLean);
    context.scale(pose.rootScaleX, pose.rootScaleY);
    context.translate(-rootPivotX, -rootPivotY);

    if (equipped) {
      drawAvatarPart(context, parts.wing, {
        pivotX: 16,
        pivotY: 14,
        rotation: pose.wingRotation,
        scaleY: pose.wingScaleY
      });
    }

    drawAvatarPart(context, parts.backHand, {
      pivotX: 13,
      pivotY: 13,
      rotation: pose.backArmRotation
    });
    drawAvatarPart(context, parts.leftLeg, {
      pivotX: 14,
      pivotY: 21,
      rotation: pose.leftLegRotation,
      shiftY: pose.leftLegShiftY
    });
    drawAvatarPart(context, parts.rightLeg, {
      pivotX: 19,
      pivotY: 21,
      rotation: pose.rightLegRotation,
      shiftY: pose.rightLegShiftY
    });
    drawAvatarPart(context, parts.body);
    drawAvatarPart(context, parts.eyeWhite, headOptions);
    drawAvatarPart(context, parts.pupil, headOptions);
    drawAvatarPart(context, parts.head, headOptions);
    drawAvatarPart(context, parts.mouth, headOptions);
    drawAvatarPart(context, parts.eyeCover, headOptions);
    drawAvatarPart(context, parts.expression, headOptions);
    drawAvatarPart(context, parts.frontHand, {
      pivotX: 20,
      pivotY: 13,
      rotation: pose.frontArmRotation
    });

    context.restore();
  }

  function buildAvatarComposite(equipped) {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    renderAvatarRig(context, { state: 'idle', time: 0, localProgress: 0 }, equipped);
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

  function renderAnimatedAvatar(motion, equipped = state.equipped) {
    const canvas = state.animatedAvatarCanvas;
    const context = clearCanvas(canvas);
    if (!context) return null;
    renderAvatarRig(context, motion, equipped);
    return canvas;
  }

  function drawAvatarPreview(equipped, timeSeconds) {
    const canvas = $('avatar-demo-canvas');
    const context = clearCanvas(canvas);
    if (!context || !state.animatedAvatarCanvas) return;

    const avatar = renderAnimatedAvatar(
      { state: 'idle', time: timeSeconds, localProgress: (timeSeconds % 1) },
      equipped
    );
    const size = Math.min(canvas.width, canvas.height);
    const destinationX = Math.round((canvas.width - size) / 2);
    const destinationY = Math.round((canvas.height - size) / 2);
    context.drawImage(avatar, 0, 0, avatar.width, avatar.height, destinationX, destinationY, size, size);
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
      for (let y = LEVEL_HEIGHT - 1; y >= section.top; y -= 1) {
        for (let x = section.from; x <= section.to; x += 1) {
          grid[y * LEVEL_WIDTH + x] = itemId;
          buildOrder.push({ x, y, sectionIndex });
        }
      }
    });

    return { itemId, grid, buildOrder };
  }

  function createBuildSnapshot(progress) {
    const total = state.level.buildOrder.length;
    const eased = easeInOutCubic(clamp(progress));
    const visibleCount = Math.min(total, Math.floor(eased * (total + 1)));
    const grid = new Array(LEVEL_WIDTH * LEVEL_HEIGHT).fill(0);

    for (let index = 0; index < visibleCount; index += 1) {
      const tile = state.level.buildOrder[index];
      grid[tile.y * LEVEL_WIDTH + tile.x] = state.level.itemId;
    }

    const activeIndex = Math.max(0, Math.min(total - 1, visibleCount - 1));
    const decorationsVisible = progress >= 0.86;
    return {
      grid,
      activeTile: decorationsVisible ? LEVEL_GOAL : state.level.buildOrder[activeIndex],
      decorationsVisible
    };
  }

  function drawWorldBackground(context, width, height, timeSeconds, playMode) {
    context.clearRect(0, 0, width, height);

    if (state.weather) {
      const imageWidth = state.weather.naturalWidth || state.weather.width;
      const imageHeight = state.weather.naturalHeight || state.weather.height;
      const imageRatio = imageWidth / imageHeight;
      const canvasRatio = width / height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = imageWidth;
      let sourceHeight = imageHeight;

      if (imageRatio > canvasRatio) {
        sourceWidth = imageHeight * canvasRatio;
        sourceX = (imageWidth - sourceWidth) / 2;
      } else {
        sourceHeight = imageWidth / canvasRatio;
        sourceY = (imageHeight - sourceHeight) / 2;
      }

      const drift = playMode ? Math.sin(timeSeconds * 0.24) * Math.min(8, sourceWidth * 0.008) : 0;
      sourceX = clamp(sourceX + drift, 0, Math.max(0, imageWidth - sourceWidth));
      context.drawImage(
        state.weather,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
      );
    } else {
      context.fillStyle = '#0a1320';
      context.fillRect(0, 0, width, height);
    }

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, playMode ? 'rgba(4, 10, 20, 0.04)' : 'rgba(4, 10, 20, 0.10)');
    gradient.addColorStop(0.68, 'rgba(4, 9, 17, 0.03)');
    gradient.addColorStop(1, 'rgba(4, 9, 17, 0.18)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const vignette = context.createRadialGradient(
      width / 2,
      height * 0.45,
      Math.min(width, height) * 0.2,
      width / 2,
      height * 0.45,
      Math.max(width, height) * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, playMode ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.18)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }

  function getWorldMetrics(width, height) {
    const cell = Math.max(
      1,
      Math.min(48, Math.floor(width / LEVEL_WIDTH), Math.floor(height / LEVEL_HEIGHT))
    );
    const gridWidth = cell * LEVEL_WIDTH;
    const gridHeight = cell * LEVEL_HEIGHT;
    const gridX = Math.floor((width - gridWidth) / 2);
    const gridY = Math.floor(height - gridHeight);
    return { width, height, cell, gridX, gridY, gridWidth, gridHeight };
  }

  function drawWorldGrid(context, metrics) {
    const { gridX, gridY, cell, gridWidth, gridHeight } = metrics;
    context.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    context.lineWidth = 1;

    for (let column = 0; column <= LEVEL_WIDTH; column += 1) {
      const x = Math.round(gridX + column * cell) + 0.5;
      context.beginPath();
      context.moveTo(x, gridY);
      context.lineTo(x, gridY + gridHeight);
      context.stroke();
    }

    for (let row = 0; row <= LEVEL_HEIGHT; row += 1) {
      const y = Math.round(gridY + row * cell) + 0.5;
      context.beginPath();
      context.moveTo(gridX, y);
      context.lineTo(gridX + gridWidth, y);
      context.stroke();
    }
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
    const sourceX = (Number(item.tx || 0) + Number(offset.offsetX || 0)) * TILE;
    const sourceY = (Number(item.ty || 0) + Number(offset.offsetY || 0)) * TILE;

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX + TILE > image.naturalWidth ||
      sourceY + TILE > image.naturalHeight
    ) {
      return { sx: baseX, sy: baseY, sw: TILE, sh: TILE };
    }

    return { sx: sourceX, sy: sourceY, sw: TILE, sh: TILE };
  }

  function drawLevel(context, grid, metrics) {
    const image = getLoadedImage(spritePath(state.dirt));
    if (!image) return;
    const { cell, gridX, gridY } = metrics;

    for (let y = 0; y < LEVEL_HEIGHT; y += 1) {
      for (let x = 0; x < LEVEL_WIDTH; x += 1) {
        if (grid[y * LEVEL_WIDTH + x] !== state.level.itemId) continue;
        const source = getTileSourceRect(state.dirt, grid, x, y);
        context.drawImage(
          image,
          source.sx,
          source.sy,
          source.sw,
          source.sh,
          Math.round(gridX + x * cell),
          Math.round(gridY + y * cell),
          Math.round(cell),
          Math.round(cell)
        );
      }
    }
  }

  function drawSpriteTile(context, item, x, y, size) {
    if (!item) return;
    const image = getLoadedImage(spritePath(item));
    if (!image) return;
    context.drawImage(
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

  function drawSpawn(context, metrics, visible, playMode) {
    if (!visible || !state.spawnDoor) return;
    const { cell, gridX, gridY } = metrics;
    const x = gridX + LEVEL_SPAWN.x * cell;
    const y = gridY + LEVEL_SPAWN.y * cell;
    drawSpriteTile(context, state.spawnDoor, x, y, cell);

    if (!playMode) {
      context.save();
      context.fillStyle = 'rgba(4, 10, 18, 0.72)';
      roundedRectPath(context, x - cell * 0.02, y - cell * 0.45, cell * 1.04, Math.max(15, cell * 0.31), 5);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.72)';
      context.font = `700 ${Math.max(9, Math.round(cell * 0.2))}px Inter, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('SPAWN', x + cell / 2, y - cell * 0.295);
      context.restore();
    }
  }

  function drawGoal(context, metrics, timeSeconds, visible, playMode, completed = false) {
    if (!visible || !state.worldLock) return;
    const { cell, gridX, gridY } = metrics;
    const x = gridX + LEVEL_GOAL.x * cell;
    const y = gridY + LEVEL_GOAL.y * cell;
    const pulse = 0.5 + Math.sin(timeSeconds * 5.6) * 0.5;

    context.save();
    context.fillStyle = completed
      ? `rgba(242, 196, 94, ${0.16 + pulse * 0.11})`
      : `rgba(105, 217, 236, ${playMode ? 0.08 + pulse * 0.07 : 0.055})`;
    roundedRectPath(
      context,
      x - cell * 0.13,
      y - cell * 0.13,
      cell * 1.26,
      cell * 1.26,
      Math.max(5, cell * 0.12)
    );
    context.fill();
    drawSpriteTile(context, state.worldLock, x, y, cell);

    context.fillStyle = 'rgba(4, 10, 18, 0.78)';
    roundedRectPath(context, x - cell * 0.04, y - cell * 0.52, cell * 1.08, Math.max(15, cell * 0.33), 5);
    context.fill();
    context.fillStyle = completed ? '#f7d98f' : '#d7f7fb';
    context.font = `800 ${Math.max(9, Math.round(cell * 0.2))}px Inter, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(completed ? 'COMPLETE' : 'GOAL', x + cell / 2, y - cell * 0.355);
    context.restore();
  }

  function drawPlacementPulse(context, metrics, activeTile, progress) {
    if (!activeTile) return;
    const { cell, gridX, gridY } = metrics;
    const x = gridX + activeTile.x * cell;
    const y = gridY + activeTile.y * cell;
    const local = (progress * state.level.buildOrder.length) % 1;
    const pulse = Math.sin(clamp(local) * Math.PI);

    context.save();
    context.strokeStyle = `rgba(105, 217, 236, ${0.25 + pulse * 0.6})`;
    context.lineWidth = Math.max(1.5, cell * 0.05);
    context.strokeRect(
      Math.round(x - pulse * cell * 0.06),
      Math.round(y - pulse * cell * 0.06),
      Math.round(cell * (1 + pulse * 0.12)),
      Math.round(cell * (1 + pulse * 0.12))
    );
    context.restore();
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
      localProgress = motionState === 'jump'
        ? clamp(localProgress / apexProgress)
        : clamp((localProgress - apexProgress) / (1 - apexProgress));
    }

    return {
      x,
      feetRow,
      state: motionState,
      localProgress,
      time: value * PLAY_DURATION_SECONDS,
      airHeight,
      phaseType: phase.type,
      progress: value
    };
  }

  function drawPlayerShadow(context, centerX, feetY, motion, cell) {
    const heightFactor = clamp(motion.airHeight / 2.4);
    const width = cell * lerp(0.36, 0.19, heightFactor);
    const height = cell * lerp(0.095, 0.045, heightFactor);
    context.save();
    context.fillStyle = `rgba(0, 0, 0, ${lerp(0.28, 0.09, heightFactor)})`;
    context.beginPath();
    context.ellipse(centerX, feetY + cell * 0.045, width, height, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawRunDust(context, centerX, feetY, motion, cell) {
    if (motion.state !== 'run') return;
    const cadence = (motion.time * 7.2) % 1;
    if (cadence > 0.48) return;
    const life = cadence / 0.48;
    const direction = Math.sin(motion.time * 14.4) > 0 ? -1 : 1;

    context.save();
    for (let index = 0; index < 3; index += 1) {
      const size = Math.max(2, cell * (0.055 - life * 0.018) * (1 - index * 0.08));
      const spread = direction * cell * (0.08 + life * (0.16 + index * 0.05));
      const lift = life * cell * (0.05 + index * 0.018);
      context.fillStyle = `rgba(227, 222, 204, ${(1 - life) * (0.28 - index * 0.045)})`;
      context.fillRect(
        Math.round(centerX + spread - size / 2),
        Math.round(feetY - lift - size / 2),
        Math.round(size),
        Math.round(size)
      );
    }
    context.restore();
  }

  function drawLandingDust(context, centerX, feetY, motion, cell) {
    if (motion.state !== 'land') return;
    const local = clamp(motion.localProgress);
    const alpha = (1 - local) * 0.55;
    const directions = [-1, -0.62, -0.28, 0.28, 0.62, 1];

    context.save();
    directions.forEach((direction, index) => {
      const spread = direction * cell * (0.18 + local * 0.52);
      const lift = Math.sin(local * Math.PI) * cell * (0.07 + (index % 3) * 0.022);
      const size = Math.max(2, Math.round(cell * (0.052 - local * 0.016)));
      context.fillStyle = `rgba(234, 229, 211, ${alpha * (0.62 + (index % 2) * 0.2)})`;
      context.fillRect(
        Math.round(centerX + spread - size / 2),
        Math.round(feetY - lift - size / 2),
        size,
        size
      );
    });
    context.restore();
  }

  function drawMotionLines(context, centerX, feetY, motion, cell) {
    if (!['run', 'jump', 'fall'].includes(motion.state)) return;
    const intensity = motion.state === 'run' ? 0.7 : 0.42;
    context.save();
    context.strokeStyle = `rgba(255, 255, 255, ${0.07 * intensity})`;
    context.lineWidth = Math.max(1, cell * 0.025);
    context.lineCap = 'round';

    for (let index = 0; index < 3; index += 1) {
      const phase = (motion.time * 1.7 + index * 0.31) % 1;
      const y = feetY - cell * (0.45 + index * 0.34) + Math.sin(motion.time * 4 + index) * cell * 0.03;
      const length = cell * (0.18 + phase * 0.24);
      const x = centerX - cell * (0.64 + phase * 0.28);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y);
      context.stroke();
    }

    context.restore();
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    if (typeof context.roundRect === 'function') {
      context.beginPath();
      context.roundRect(x, y, width, height, safeRadius);
      return;
    }

    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
  }

  function drawPlayerNametag(context, centerX, topY, cell, completed) {
    const label = 'Raey';
    const fontSize = Math.max(10, Math.round(cell * 0.25));
    const flagSize = Math.max(11, Math.round(cell * 0.28));
    const paddingX = Math.max(6, Math.round(cell * 0.13));
    const gap = Math.max(4, Math.round(cell * 0.09));
    const height = Math.max(20, Math.round(cell * 0.44));

    context.save();
    context.font = `800 ${fontSize}px Outfit, Inter, sans-serif`;
    const textWidth = context.measureText(label).width;
    const width = paddingX * 2 + flagSize + gap + textWidth;
    const x = Math.round(centerX - width / 2);
    const y = Math.round(topY - height);

    context.shadowColor = 'rgba(0, 0, 0, 0.38)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    context.fillStyle = 'rgba(3, 7, 13, 0.88)';
    roundedRectPath(context, x, y, width, height, Math.max(6, height * 0.3));
    context.fill();

    context.shadowColor = 'transparent';
    context.strokeStyle = completed ? 'rgba(242, 196, 94, 0.46)' : 'rgba(255, 255, 255, 0.20)';
    context.lineWidth = 1;
    roundedRectPath(context, x + 0.5, y + 0.5, width - 1, height - 1, Math.max(6, height * 0.3));
    context.stroke();

    const flagX = x + paddingX;
    const flagY = y + (height - flagSize) / 2;
    if (state.flagLogo) {
      context.drawImage(state.flagLogo, flagX, flagY, flagSize, flagSize);
    } else {
      context.fillStyle = '#ef4444';
      context.fillRect(flagX, flagY, flagSize, flagSize / 2);
      context.fillStyle = '#ffffff';
      context.fillRect(flagX, flagY + flagSize / 2, flagSize, flagSize / 2);
    }

    context.fillStyle = '#f8fafc';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(label, flagX + flagSize + gap, y + height / 2 + 0.5);
    context.restore();
  }

  function drawPlayer(context, metrics, motion) {
    const { cell, gridX, gridY } = metrics;
    const centerX = gridX + motion.x * cell;
    const feetY = gridY + motion.feetRow * cell;
    const compositeSize = cell * 3;
    const compositeX = centerX - compositeSize / 2;
    const compositeY = feetY - compositeSize * (64 / AVATAR_LOGICAL_SIZE);
    const completed = motion.state === 'finish';
    const avatar = renderAnimatedAvatar(motion, true);

    drawMotionLines(context, centerX, feetY, motion, cell);
    drawPlayerShadow(context, centerX, feetY, motion, cell);
    drawRunDust(context, centerX, feetY, motion, cell);
    drawLandingDust(context, centerX, feetY, motion, cell);

    if (avatar) {
      context.drawImage(
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

    drawPlayerNametag(context, centerX, compositeY + cell * 0.72, cell, completed);
  }

  function getPlayStatus(motion) {
    if (motion.state === 'run') return 'Running the route';
    if (motion.state === 'takeoff') return 'Preparing jump';
    if (motion.state === 'jump') return 'Jumping';
    if (motion.state === 'fall') return 'Landing target locked';
    if (motion.state === 'land') return 'Clean landing';
    if (motion.state === 'finish') return 'Route complete';
    return 'Ready to play';
  }

  function drawWorld(progress, playMode, timeSeconds) {
    const canvas = $('world-demo-canvas');
    const { ctx, width, height } = prepareResponsiveCanvas(canvas);
    const metrics = getWorldMetrics(width, height);
    const snapshot = playMode
      ? { grid: state.level.grid, activeTile: null, decorationsVisible: true }
      : createBuildSnapshot(progress);

    drawWorldBackground(ctx, width, height, timeSeconds, playMode);
    if (!playMode) drawWorldGrid(ctx, metrics);
    drawLevel(ctx, snapshot.grid, metrics);
    drawSpawn(ctx, metrics, snapshot.decorationsVisible, playMode);

    let motion = null;
    if (playMode) {
      motion = evaluatePlayTimeline(progress);
    }

    drawGoal(
      ctx,
      metrics,
      timeSeconds,
      snapshot.decorationsVisible,
      playMode,
      Boolean(motion && motion.state === 'finish')
    );

    if (!playMode) {
      drawPlacementPulse(ctx, metrics, snapshot.activeTile, progress);
    } else {
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
    $('scene-count').textContent = sceneTimeline[timelineIndex]?.count || '01 / 05';
    state.lastScene = sceneIndex;
    state.lastTimelineIndex = timelineIndex;
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
    state.worldMode = null;
    $('world-step-kicker').textContent = '04 · BUILD';
    $('world-scene-title').textContent = 'Design a clean, connected world';
    $('world-scene-description').textContent = 'Place autotiled terrain and prepare a playable route.';
    document.querySelector('.scene-world')?.classList.remove('is-play-mode');
    $('place-cursor').style.opacity = '0';
    drawAvatarPreview(false, 0);
  }

  function setElapsed(offsetMs) {
    state.startedAt = performance.now() - offsetMs;
    state.pausedElapsed = offsetMs;
    state.lastScene = -1;
    state.lastTimelineIndex = -1;
    if (state.paused) drawFrame(offsetMs, performance.now());
  }

  function restart() {
    cancelAnimationFrame(state.raf);
    state.startedAt = performance.now();
    state.pausedElapsed = 0;
    state.paused = false;
    $('toggle-playback').textContent = 'Pause';
    $('toggle-playback').setAttribute('aria-label', 'Pause showcase');
    state.lastScene = -1;
    state.lastTimelineIndex = -1;
    resetSceneState();
    tick();
  }

  function togglePlayback() {
    if (state.paused) {
      state.startedAt = performance.now() - state.pausedElapsed;
      state.paused = false;
      $('toggle-playback').textContent = 'Pause';
      $('toggle-playback').setAttribute('aria-label', 'Pause showcase');
      tick();
      return;
    }

    state.pausedElapsed = state.lastElapsed;
    state.paused = true;
    cancelAnimationFrame(state.raf);
    $('toggle-playback').textContent = 'Resume';
    $('toggle-playback').setAttribute('aria-label', 'Resume showcase');
  }

  function updateSearchScene(elapsed) {
    const searchProgress = clamp(elapsed / 1350);
    const query = 'World Lock';
    $('typed-search').textContent = query.slice(0, Math.ceil(searchProgress * query.length));
    $('world-lock-card').classList.toggle('is-visible', elapsed > 1250);
  }

  function updateAvatarScene(elapsed, timeSeconds) {
    const shouldEquip = elapsed - 4700 > 1150;
    if (shouldEquip !== state.equipped) {
      state.equipped = shouldEquip;
      $('wing-card').classList.toggle('is-equipped', shouldEquip);
      $('equip-status').textContent = shouldEquip ? 'Equipped' : 'Equip';
      $('equipped-pop').classList.toggle('is-visible', shouldEquip);
    }
    drawAvatarPreview(shouldEquip, timeSeconds);
  }

  function updatePlayToast(motion) {
    const toast = $('play-toast');
    const label = toast.querySelector('strong');
    if (label) label.textContent = getPlayStatus(motion);
  }

  function setWorldCopy(playMode) {
    const nextMode = playMode ? 'play' : 'build';
    if (state.worldMode === nextMode) return;
    state.worldMode = nextMode;

    const copy = document.querySelector('.scene-world .scene-copy');
    copy?.classList.remove('is-swapping');
    if (copy) void copy.offsetWidth;

    if (playMode) {
      $('world-step-kicker').textContent = '05 · PLAY';
      $('world-scene-title').textContent = 'Playtest without leaving the editor';
      $('world-scene-description').textContent = 'Run, jump, land, and validate the route instantly.';
    } else {
      $('world-step-kicker').textContent = '04 · BUILD';
      $('world-scene-title').textContent = 'Design a clean, connected world';
      $('world-scene-description').textContent = 'Place autotiled terrain and prepare a playable route.';
    }

    copy?.classList.add('is-swapping');
    window.setTimeout(() => copy?.classList.remove('is-swapping'), 460);
  }

  function updateWorldScene(elapsed) {
    const playMode = elapsed >= PLAY_START_MS;
    $('edit-mode-pill').classList.toggle('is-active', !playMode);
    $('play-mode-pill').classList.toggle('is-active', playMode);
    $('play-toast').classList.toggle('is-visible', playMode);
    document.querySelector('.scene-world')?.classList.toggle('is-play-mode', playMode);
    setWorldCopy(playMode);

    if (!playMode) {
      const progress = clamp((elapsed - 7600) / (PLAY_START_MS - 7600));
      const metrics = drawWorld(progress, false, elapsed / 1000);
      const cursor = $('place-cursor');
      cursor.style.opacity = '1';
      cursor.style.width = `${metrics.cell}px`;
      cursor.style.height = `${metrics.cell}px`;
      cursor.style.left = `${metrics.cursorX}px`;
      cursor.style.top = `${metrics.cursorY}px`;
      return;
    }

    $('place-cursor').style.opacity = '0';
    const progress = clamp((elapsed - PLAY_START_MS) / (PLAY_DURATION_SECONDS * 1000));
    const metrics = drawWorld(progress, true, elapsed / 1000);
    updatePlayToast(metrics.motion);
  }

  function drawFrame(elapsed, now) {
    state.lastElapsed = elapsed;
    const rawIndex = sceneTimeline.findIndex((entry) => elapsed >= entry.start && elapsed < entry.end);
    const timelineIndex = rawIndex < 0 ? sceneTimeline.length - 1 : rawIndex;
    const entry = sceneTimeline[timelineIndex];

    if (entry.scene !== state.lastScene || timelineIndex !== state.lastTimelineIndex) {
      showScene(entry.scene, timelineIndex);
    }

    if (entry.scene === 0) updateSearchScene(elapsed);
    if (entry.scene === 2) updateAvatarScene(elapsed, now / 1000);
    if (entry.scene === 3) updateWorldScene(elapsed);
  }

  function tick(now = performance.now()) {
    if (state.paused) return;
    const elapsed = (now - state.startedAt) % DURATION;
    if (elapsed < 20 && state.lastElapsed > DURATION - 80) {
      resetSceneState();
      state.lastScene = -1;
      state.lastTimelineIndex = -1;
    }

    drawFrame(elapsed, now);
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
      configurePageMode();
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
      state.spawnDoor = findById(state.items, 6) || findExact(state.items, 'Main Door') || findIncludes(state.items, ['main door']);

      if (!state.worldLock || !state.wing || !state.dirt || !state.grass || !state.spawnDoor) {
        throw new Error('One or more showcase assets could not be resolved from the current project database.');
      }

      setAssetLabels();
      state.level = createLevelData(state.dirt);

      const requiredImages = [
        WEATHER_PATH,
        FLAG_PATH,
        spritePath(state.worldLock),
        spritePath(state.wing),
        spritePath(state.dirt),
        spritePath(state.grass),
        spritePath(state.spawnDoor)
      ];

      await Promise.all([
        ensureBaseAvatarAssets(),
        ...requiredImages.map(loadImage)
      ]);
      state.weather = getLoadedImage(WEATHER_PATH);
      state.flagLogo = getLoadedImage(FLAG_PATH);
      await ensureAvatarComposites();

      await Promise.all([
        drawItem($('world-lock-thumb'), state.worldLock, 6),
        drawItem($('world-lock-large'), state.worldLock, 0),
        drawItem($('wing-thumb'), state.wing, 6),
        drawPalette()
      ]);

      drawAvatarPreview(false, 0);
      $('restart-demo').addEventListener('click', restart);
      $('toggle-playback').addEventListener('click', togglePlayback);
      $('world-lock-card').addEventListener('click', () => setElapsed(2550));
      $('to-avatar-hint').addEventListener('click', () => setElapsed(4750));
      $('wing-card').addEventListener('click', () => setElapsed(6100));
      window.addEventListener('resize', () => {
        if (state.lastScene === 3) drawFrame(state.lastElapsed, performance.now());
      });

      tick();
    } catch (error) {
      handleAssetError(error);
    }
  }

  init();
})();
