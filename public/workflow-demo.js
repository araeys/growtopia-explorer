(() => {
  'use strict';

  const DURATION = 15000;
  const TILE = 32;
  const state = {
    startedAt: performance.now(),
    items: [],
    wearables: [],
    worldLock: null,
    wing: null,
    dirt: null,
    grass: null,
    textures: new Map(),
    body: null,
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

  function loadImage(src) {
    if (!src) return Promise.reject(new Error('Missing image source'));
    if (state.textures.has(src)) return state.textures.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}`));
      image.src = src;
    });
    state.textures.set(src, promise);
    return promise;
  }

  function clearCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  async function drawItem(canvas, item, padding = 0) {
    if (!canvas || !item || !item.texture) return;
    const ctx = clearCanvas(canvas);
    const img = await loadImage(spritePath(item));
    const sourceX = Number(item.tx || 0) * TILE;
    const sourceY = Number(item.ty || 0) * TILE;
    const size = Math.max(1, Math.min(canvas.width, canvas.height) - padding * 2);
    const dx = Math.round((canvas.width - size) / 2);
    const dy = Math.round((canvas.height - size) / 2);
    ctx.drawImage(img, sourceX, sourceY, TILE, TILE, dx, dy, size, size);
  }

  function setAssetLabels() {
    const wl = state.worldLock;
    if (wl) {
      $('world-lock-name').textContent = wl.name;
      $('world-lock-id').textContent = `ITEM #${wl.id}`;
      $('world-lock-texture').textContent = wl.texture;
      $('inspector-title').textContent = wl.name;
      $('inspector-id').textContent = `#${wl.id}`;
      $('inspector-texture').textContent = wl.texture;
      $('inspector-coords').textContent = `X ${wl.tx}, Y ${wl.ty} · 32×32`;
    }
    if (state.wing) $('wing-name').textContent = state.wing.name;
    if (state.dirt) $('dirt-name').textContent = state.dirt.name;
    if (state.grass) $('grass-name').textContent = state.grass.name;
    $('database-count').textContent = state.items.length.toLocaleString('en-US');
  }

  async function drawAvatar(equipped) {
    const canvas = $('avatar-demo-canvas');
    const ctx = clearCanvas(canvas);
    const scale = 4;
    const origin = { x: 32 * scale, y: 32 * scale };
    const layerSize = TILE * scale;

    if (equipped && state.wing) {
      const wingImage = await loadImage(spritePath(state.wing));
      ctx.drawImage(
        wingImage,
        Number(state.wing.tx || 0) * TILE,
        Number(state.wing.ty || 0) * TILE,
        TILE,
        TILE,
        origin.x,
        origin.y,
        layerSize,
        layerSize
      );
    }

    if (!state.body) state.body = await loadImage('character_base_assets/gtsetplanner/player_idle_body.png');
    ctx.drawImage(state.body, origin.x, origin.y, layerSize, layerSize);
  }

  async function drawPalette() {
    await Promise.all([
      drawItem($('dirt-palette'), state.dirt, 4),
      drawItem($('grass-palette'), state.grass, 4)
    ]);
  }

  function drawWorldBackground(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.weather) {
      const imageRatio = state.weather.width / state.weather.height;
      const canvasRatio = canvas.width / canvas.height;
      let sx = 0;
      let sy = 0;
      let sw = state.weather.width;
      let sh = state.weather.height;
      if (imageRatio > canvasRatio) {
        sw = state.weather.height * canvasRatio;
        sx = (state.weather.width - sw) / 2;
      } else {
        sh = state.weather.width / canvasRatio;
        sy = (state.weather.height - sh) / 2;
      }
      ctx.drawImage(state.weather, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(4,10,20,.24)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.strokeStyle = 'rgba(255,255,255,.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  async function drawSpriteTile(ctx, item, x, y, size = 48) {
    if (!item) return;
    const img = await loadImage(spritePath(item));
    ctx.drawImage(img, Number(item.tx || 0) * TILE, Number(item.ty || 0) * TILE, TILE, TILE, x, y, size, size);
  }

  async function drawWorld(progress, playMode) {
    const canvas = $('world-demo-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawWorldBackground(ctx, canvas);

    const cell = 48;
    const baseY = canvas.height - cell * 2;
    const ground = [];
    for (let x = 0; x < canvas.width; x += cell) ground.push([x, baseY + cell]);
    const parkour = [
      [cell * 4, baseY], [cell * 5, baseY],
      [cell * 8, baseY - cell], [cell * 9, baseY - cell],
      [cell * 12, baseY - cell * 2], [cell * 13, baseY - cell * 2],
      [cell * 16, baseY - cell], [cell * 17, baseY - cell]
    ];

    for (const [x, y] of ground) await drawSpriteTile(ctx, state.dirt, x, y, cell);
    const visiblePlatforms = playMode ? parkour.length : Math.min(parkour.length, Math.floor(progress * (parkour.length + 2)));
    for (let i = 0; i < visiblePlatforms; i += 1) {
      const [x, y] = parkour[i];
      await drawSpriteTile(ctx, i % 3 === 0 ? state.grass : state.dirt, x, y, cell);
    }

    if (playMode) {
      const t = Math.max(0, Math.min(1, progress));
      const travel = t * 13.2;
      const x = cell * 2 + travel * cell;
      const jumpPhase = (t * 3.35) % 1;
      const jump = Math.sin(jumpPhase * Math.PI) * cell * 1.55;
      const y = baseY + cell - 96 - Math.max(0, jump);
      if (!state.body) state.body = await loadImage('character_base_assets/gtsetplanner/player_idle_body.png');
      ctx.drawImage(state.body, x, y, 96, 96);
      ctx.fillStyle = 'rgba(34,211,238,.95)';
      ctx.font = '700 18px Inter, sans-serif';
      ctx.fillText('Raey', x + 20, y - 8);
    }
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
    drawAvatar(false).catch(() => {});
  }

  function restart() {
    cancelAnimationFrame(state.raf);
    state.startedAt = performance.now();
    state.lastScene = -1;
    resetSceneState();
    tick();
  }

  async function updateSearchScene(elapsed) {
    const searchT = Math.max(0, Math.min(1, elapsed / 1450));
    const query = 'World Lock';
    $('typed-search').textContent = query.slice(0, Math.ceil(searchT * query.length));
    $('world-lock-card').classList.toggle('is-visible', elapsed > 1350);
  }

  async function updateAvatarScene(elapsed) {
    const shouldEquip = elapsed - 4700 > 1100;
    if (shouldEquip !== state.equipped) {
      state.equipped = shouldEquip;
      $('wing-card').classList.toggle('is-equipped', shouldEquip);
      $('equip-status').textContent = shouldEquip ? 'Equipped' : 'Equip';
      $('equipped-pop').classList.toggle('is-visible', shouldEquip);
      await drawAvatar(shouldEquip);
    }
  }

  async function updateWorldScene(elapsed) {
    const playMode = elapsed >= 10800;
    $('edit-mode-pill').classList.toggle('is-active', !playMode);
    $('play-mode-pill').classList.toggle('is-active', playMode);
    $('play-toast').classList.toggle('is-visible', playMode);
    $('world-scene-title').textContent = playMode ? 'Test the parkour' : 'Place blocks';

    if (!playMode) {
      const p = Math.max(0, Math.min(1, (elapsed - 7300) / 3000));
      const cursor = $('place-cursor');
      const wrap = document.querySelector('.world-canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      cursor.style.opacity = '1';
      cursor.style.left = `${rect.width * (0.25 + 0.55 * p)}px`;
      cursor.style.top = `${rect.height * (0.48 - 0.16 * Math.sin(p * Math.PI * 2))}px`;
      await drawWorld(p, false);
    } else {
      $('place-cursor').style.opacity = '0';
      await drawWorld(Math.max(0, Math.min(1, (elapsed - 10800) / 3900)), true);
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

    if (entry.scene === 0) updateSearchScene(elapsed).catch(handleAssetError);
    if (entry.scene === 2) updateAvatarScene(elapsed).catch(handleAssetError);
    if (entry.scene === 3) updateWorldScene(elapsed).catch(handleAssetError);
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
          ['angel wings', 'wing', 'wings'],
          (item) => normalizedName(item.slot) === 'back' && !normalizedName(item.name).includes('da vinci')
        ) ||
        state.wearables.find((item) => normalizedName(item.slot) === 'back') ||
        null;
      state.dirt = findExact(state.items, 'Dirt') || findIncludes(state.items, ['dirt']);
      state.grass = findExact(state.items, 'Grass') || findIncludes(state.items, ['grass']) || state.dirt;

      if (!state.worldLock || !state.wing || !state.dirt) {
        throw new Error('One or more required real project assets could not be resolved from the current database.');
      }

      setAssetLabels();
      state.weather = await loadImage('weather/AUTUMN.png');
      await Promise.all([
        drawItem($('world-lock-thumb'), state.worldLock, 6),
        drawItem($('world-lock-large'), state.worldLock, 0),
        drawItem($('wing-thumb'), state.wing, 6),
        drawPalette(),
        drawAvatar(false)
      ]);

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
