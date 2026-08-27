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
    baseLoadPromise: null,
    avatarBaseComposite: null,
    avatarWingComposite: null,
    weather: null,
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
      $('inspector-coords').textContent = `X ${worldLock.tx}, Y ${worldLock.ty} · 32×32`;
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

  function tintTile(image, sx, sy, sw, sh, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

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
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const imageData = ctx.getImageData(0, 0, sw, sh);
    window.AvatarTint.tintExpressionImageData(imageData, colorHex, expressionId);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function drawTintedBasePart(ctx, image, colorHex) {
    if (!image) return;
    const dx = PLAYER_ORIGIN.x * AVATAR_SCALE;
    const dy = PLAYER_ORIGIN.y * AVATAR_SCALE;
    const size = TILE * AVATAR_SCALE;
    const tinted = tintTile(image, 0, 0, TILE, TILE, colorHex);
    ctx.drawImage(tinted, 0, 0, TILE, TILE, dx, dy, size, size);
  }

  function drawBasePlayerSkin(ctx, colorHex) {
    const assets = state.baseAssets;

    drawTintedBasePart(ctx, assets.tanganKanan, colorHex);
    drawTintedBasePart(ctx, assets.kakiKiri, colorHex);
    drawTintedBasePart(ctx, assets.kakiKanan, colorHex);
    drawTintedBasePart(ctx, assets.bodyDefault || assets.body, colorHex);

    drawTintedBasePart(ctx, assets.bolaMata, '#ffffff');

    if (assets.pupil) {
      const dx = PLAYER_ORIGIN.x * AVATAR_SCALE;
      const dy = PLAYER_ORIGIN.y * AVATAR_SCALE;
      const size = TILE * AVATAR_SCALE;
      ctx.drawImage(assets.pupil, 0, 0, TILE, TILE, dx, dy, size, size);
    }

    drawTintedBasePart(ctx, assets.headBolong || assets.head, colorHex);
    drawTintedBasePart(ctx, assets.mulut, colorHex);
    drawTintedBasePart(ctx, assets.tutupMata, colorHex);
  }

  function drawPlayerFacialExpression(ctx, expressionId, colorHex) {
    const image = state.baseAssets.expression;
    if (!image) return;
    const coordinates = [
      { x: 0, y: 0 },
      { x: 0, y: 32 },
      { x: 128, y: 32 },
      { x: 96, y: 32 },
      { x: 128, y: 64 },
      { x: 64, y: 64 },
      { x: 192, y: 64 }
    ];
    const coord = coordinates[expressionId] || coordinates[0];
    const tinted = tintExpressionTile(
      image,
      coord.x,
      coord.y,
      TILE,
      TILE,
      colorHex,
      expressionId
    );
    const dx = PLAYER_ORIGIN.x * AVATAR_SCALE;
    const dy = PLAYER_ORIGIN.y * AVATAR_SCALE;
    const size = TILE * AVATAR_SCALE;
    ctx.drawImage(tinted, 0, 0, TILE, TILE, dx, dy, size, size);
  }

  function drawFrontLeftHand(ctx, colorHex) {
    drawTintedBasePart(
      ctx,
      state.baseAssets.tanganKiri || state.baseAssets.frontLeftHand,
      colorHex
    );
  }

  function drawBackWearable(ctx) {
    if (!state.wing || !window.GTWearableCatalog) return;
    const image = getLoadedImage(spritePath(state.wing));
    if (!image) return;

    const slot = window.GTWearableCatalog
      .getRenderLayers()
      .find((entry) => entry.key === 'Back');
    const profile = window.GTWearableCatalog.getRenderProfile(state.wing.render_profile);
    const sx = Number(state.wing.tx || 0) * profile.sourceWidth;
    const sy = Number(state.wing.ty || 0) * profile.sourceHeight;
    const dx = (PLAYER_ORIGIN.x + (slot?.defaultOffset?.x || 0)) * AVATAR_SCALE;
    const dy = (PLAYER_ORIGIN.y + (slot?.defaultOffset?.y || 0)) * AVATAR_SCALE;

    if (
      sx < 0 ||
      sy < 0 ||
      sx + profile.sourceWidth > image.naturalWidth ||
      sy + profile.sourceHeight > image.naturalHeight
    ) {
      throw new RangeError(`Wearable #${state.wing.id} source frame is outside texture bounds`);
    }

    ctx.drawImage(
      image,
      sx,
      sy,
      profile.sourceWidth,
      profile.sourceHeight,
      dx,
      dy,
      profile.destinationWidth,
      profile.destinationHeight
    );
  }

  function buildAvatarComposite(equipped) {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (equipped) drawBackWearable(ctx);
    drawBasePlayerSkin(ctx, DEFAULT_SKIN_COLOR);
    drawPlayerFacialExpression(ctx, 0, DEFAULT_SKIN_COLOR);
    drawFrontLeftHand(ctx, DEFAULT_SKIN_COLOR);
    return canvas;
  }

  async function ensureAvatarComposites() {
    await ensureBaseAvatarAssets();
    if (!state.avatarBaseComposite) state.avatarBaseComposite = buildAvatarComposite(false);
    if (!state.avatarWingComposite) state.avatarWingComposite = buildAvatarComposite(true);
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

  async function drawPalette() {
    await Promise.all([
      drawItem($('dirt-palette'), state.dirt, 4),
      drawItem($('grass-palette'), state.grass, 4)
    ]);
  }

  function drawWorldBackground(ctx, width, height) {
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

      ctx.drawImage(state.weather, sx, sy, sw, sh, 0, 0, width, height);
      ctx.fillStyle = 'rgba(4, 10, 20, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawWorldGrid(ctx, width, height, cell) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += cell) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
      ctx.stroke();
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

  function getWorldMetrics(width, height) {
    const cell = Math.max(32, Math.min(48, Math.floor(width / 18)));
    const groundY = Math.floor((height - cell) / cell) * cell;
    return { cell, groundY };
  }

  function drawWorld(progress, playMode) {
    const canvas = $('world-demo-canvas');
    const { ctx, width, height } = prepareResponsiveCanvas(canvas);
    const { cell, groundY } = getWorldMetrics(width, height);
    drawWorldBackground(ctx, width, height);
    drawWorldGrid(ctx, width, height, cell);

    for (let x = 0; x < width; x += cell) {
      drawSpriteTile(ctx, state.dirt, x, groundY, cell);
    }

    const platforms = [
      { column: 3, level: 1 },
      { column: 4, level: 1 },
      { column: 6, level: 2 },
      { column: 7, level: 2 },
      { column: 9, level: 3 },
      { column: 10, level: 3 },
      { column: 12, level: 2 },
      { column: 13, level: 2 },
      { column: 15, level: 1 },
      { column: 16, level: 1 }
    ];
    const visibleCount = playMode
      ? platforms.length
      : Math.min(platforms.length, Math.floor(progress * (platforms.length + 1)));

    for (let index = 0; index < visibleCount; index += 1) {
      const platform = platforms[index];
      const x = platform.column * cell;
      const y = groundY - platform.level * cell;
      if (x >= width) continue;
      drawSpriteTile(ctx, state.dirt, x, y, cell);
      drawSpriteTile(ctx, state.grass, x, y, cell);
    }

    for (const column of [2, 5, 11, 14]) {
      const x = column * cell;
      if (x < width) drawSpriteTile(ctx, state.grass, x, groundY - cell, cell);
    }

    if (playMode) {
      const t = Math.max(0, Math.min(1, progress));
      const maxTravel = Math.max(cell * 5, Math.min(width - cell * 4, cell * 13));
      const bodyX = cell * 2 + t * maxTravel;
      const jumpPhase = (t * 3.35) % 1;
      const jump = Math.max(0, Math.sin(jumpPhase * Math.PI)) * cell * 1.45;
      const compositeSize = cell * 3;
      const compositeX = bodyX - cell;
      const compositeY = groundY - cell * 2 - jump;
      const playerComposite = state.equipped
        ? state.avatarWingComposite
        : state.avatarBaseComposite;

      if (playerComposite) {
        ctx.drawImage(
          playerComposite,
          0,
          0,
          playerComposite.width,
          playerComposite.height,
          Math.round(compositeX),
          Math.round(compositeY),
          Math.round(compositeSize),
          Math.round(compositeSize)
        );
      }

      ctx.fillStyle = 'rgba(34, 211, 238, 0.96)';
      ctx.font = '700 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Raey', Math.round(bodyX + cell / 2), Math.round(compositeY + cell - 6));
      ctx.textAlign = 'start';
    }

    return { width, height, cell, groundY };
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
    $('world-scene-title').textContent = 'Place blocks';
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
    const searchT = Math.max(0, Math.min(1, elapsed / 1450));
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

  function updateWorldScene(elapsed) {
    const playMode = elapsed >= 10800;
    $('edit-mode-pill').classList.toggle('is-active', !playMode);
    $('play-mode-pill').classList.toggle('is-active', playMode);
    $('play-toast').classList.toggle('is-visible', playMode);
    $('world-scene-title').textContent = playMode ? 'Test the parkour' : 'Place blocks';

    if (!playMode) {
      const progress = Math.max(0, Math.min(1, (elapsed - 7300) / 3000));
      const metrics = drawWorld(progress, false);
      const cursor = $('place-cursor');
      cursor.style.opacity = '1';
      cursor.style.width = `${metrics.cell}px`;
      cursor.style.height = `${metrics.cell}px`;
      cursor.style.left = `${metrics.width * (0.22 + 0.58 * progress)}px`;
      cursor.style.top = `${metrics.height * (0.46 - 0.14 * Math.sin(progress * Math.PI * 2))}px`;
    } else {
      $('place-cursor').style.opacity = '0';
      drawWorld(Math.max(0, Math.min(1, (elapsed - 10800) / 3900)), true);
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
        loadScriptOnce('wearable_catalog.js', 'GTWearableCatalog')
      ]);

      if (!window.AvatarTint || !window.GTWearableCatalog) {
        throw new Error('The original avatar renderer modules could not be initialized.');
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
