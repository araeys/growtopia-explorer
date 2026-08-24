(function worldPlannerModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GTWorldPlanner = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createWorldPlanner() {
    const TILE_SIZE = 32;
    const MAX_HISTORY = 40;
    const AUTOSAVE_KEY = "gt-world-planner-autosave-v1";

    function createEngine(options = {}) {
      const {
        canvas,
        minimapCanvas,
        itemsDb = [],
        catalog = window.GTWorldCatalog,
        lzString = window.LZString,
        onWorldChange: externalOnWorldChange = () => {},
        onToolChange = () => {},
        onHotbarChange = () => {},
        onStatusMessage = () => {}
      } = options;

      function onWorldChange(w) {
        externalOnWorldChange(w);
        scheduleAutosave();
      }

      const itemsById = new Map();
      const defaultHotbarIds = [2, 14, 8, 20, 6, 4, 248, 114, 6176, 6514];
      const hotbar = new Array(10).fill(null);

      let activeHotbarIndex = 0;
      let activeTool = "pencil"; // pencil, eraser, picker, bucket, select, flip, preview
      let isFlipped = false;
      let showGrid = true;
      let showMinimap = true;

      let world = catalog.createStandardWorld(100, 60);

      // Viewport State
      const viewport = {
        x: 0,
        y: 0,
        zoom: 0.5, // 0.5 default gives great initial overview
        minZoom: 0.15,
        maxZoom: 2.5
      };

      // Selection State
      const selection = {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
      };

      // Clipboard State
      const clipboard = {
        active: false,
        width: 0,
        height: 0,
        fg: null,
        bg: null,
        flags: null
      };

      // Block Placement Pop & Particle Effects
      const activeBlockEffects = [];
      const activeParticles = [];
      let flagLogoImg = null;
      if (typeof Image !== "undefined") {
        flagLogoImg = new Image();
        flagLogoImg.src = "flag_logo.png";
      }

      // Playable Avatar State (Parkour Physics Simulation & Moderator Mode)
      const player = {
        active: false,
        moderatorMode: false,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        width: 20,
        height: 28,
        isGrounded: false,
        jumpCount: 0,
        jumpConsumed: false,
        facing: 1,
        isAlive: true,
        animFrame: 0,
        animTimer: 0,
        state: "idle",
        respawnX: 100,
        respawnY: 100,
        skinStyle: (typeof localStorage !== "undefined" && localStorage.getItem("gt_world_player_skin")) || "cartoon",
        keys: { left: false, right: false, up: false, down: false, jump: false }
      };

      // Music Sheet Sequencer State
      const sequencer = {
        isPlaying: false,
        bpm: 100,
        playheadX: 0,
        loop: true,
        timer: null
      };

      const audioBufferCache = new Map();
      let audioContext = null;

      // Interaction State
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let isDrawing = false;
      let lastDrawTile = null;
      let isSelecting = false;
      let hoveredTile = { x: -1, y: -1 };

      // Undo / Redo Stacks
      const undoStack = [];
      const redoStack = [];

      // Texture image cache
      const textureCache = new Map();
      const weatherImageCache = new Map();
      const loadingTextures = new Set();
      const loadingWeathers = new Set();
      let renderPending = false;

      function requestRender() {
        if (renderPending) return;
        renderPending = true;
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => {
            renderPending = false;
            render();
          });
        } else {
          renderPending = false;
          render();
        }
      }

      function reloadItems(newItemsDb = []) {
        if (Array.isArray(newItemsDb)) {
          newItemsDb.forEach(item => {
            if (item && item.id !== undefined) {
              itemsById.set(Number(item.id), item);
            }
          });
        }
        for (let i = 0; i < hotbar.length; i++) {
          if (defaultHotbarIds[i] && (!hotbar[i] || !hotbar[i].texture)) {
            const found = itemsById.get(defaultHotbarIds[i]);
            if (found) hotbar[i] = found;
          } else if (hotbar[i]) {
            const found = itemsById.get(Number(hotbar[i].id));
            if (found) hotbar[i] = found;
          }
        }
        onHotbarChange(hotbar, activeHotbarIndex);
        requestRender();
      }

      reloadItems(itemsDb);

      function getItem(id) {
        return itemsById.get(Number(id)) || null;
      }

      function loadTexture(texturePath) {
        if (!texturePath) return Promise.resolve(null);
        const fullPath = `tilesheets/${texturePath}`;
        if (textureCache.has(fullPath)) {
          return Promise.resolve(textureCache.get(fullPath));
        }
        if (loadingTextures.has(fullPath)) {
          return Promise.resolve(null);
        }
        loadingTextures.add(fullPath);

        if (typeof Image === "undefined") {
          const dummy = { width: 1024, height: 1024, complete: true, naturalWidth: 1024, naturalHeight: 1024 };
          textureCache.set(fullPath, dummy);
          loadingTextures.delete(fullPath);
          return Promise.resolve(dummy);
        }
        return new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const onDone = () => {
            textureCache.set(fullPath, img);
            loadingTextures.delete(fullPath);
            requestRender();
            resolve(img);
          };
          img.onload = onDone;
          img.onerror = () => {
            loadingTextures.delete(fullPath);
            resolve(null);
          };
          img.src = fullPath;
          if (img.complete && img.naturalWidth > 0) {
            onDone();
          }
        });
      }

      function loadWeatherImage(weatherFilename) {
        if (!weatherFilename) return Promise.resolve(null);
        const fullPath = `weather/${weatherFilename}`;
        if (weatherImageCache.has(fullPath)) {
          return Promise.resolve(weatherImageCache.get(fullPath));
        }
        if (loadingWeathers.has(fullPath)) {
          return Promise.resolve(null);
        }
        loadingWeathers.add(fullPath);

        if (typeof Image === "undefined") {
          const dummy = { width: 3200, height: 1920, complete: true, naturalWidth: 3200, naturalHeight: 1920 };
          weatherImageCache.set(fullPath, dummy);
          loadingWeathers.delete(fullPath);
          return Promise.resolve(dummy);
        }
        return new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const onDone = () => {
            weatherImageCache.set(fullPath, img);
            loadingWeathers.delete(fullPath);
            requestRender();
            resolve(img);
          };
          img.onload = onDone;
          img.onerror = () => {
            loadingWeathers.delete(fullPath);
            resolve(null);
          };
          img.src = fullPath;
          if (img.complete && img.naturalWidth > 0) {
            onDone();
          }
        });
      }

      function pushUndoSnapshot(name = "Edit") {
        if (undoStack.length >= MAX_HISTORY) {
          undoStack.shift();
        }
        undoStack.push({
          name,
          fg: new Uint16Array(world.fg),
          bg: new Uint16Array(world.bg),
          flags: new Uint8Array(world.flags)
        });
        redoStack.length = 0;
      }

      function undo() {
        if (!undoStack.length) return false;
        redoStack.push({
          fg: new Uint16Array(world.fg),
          bg: new Uint16Array(world.bg),
          flags: new Uint8Array(world.flags)
        });
        const prev = undoStack.pop();
        world.fg.set(prev.fg);
        world.bg.set(prev.bg);
        world.flags.set(prev.flags);
        render();
        onWorldChange(world);
        return true;
      }

      function redo() {
        if (!redoStack.length) return false;
        undoStack.push({
          fg: new Uint16Array(world.fg),
          bg: new Uint16Array(world.bg),
          flags: new Uint8Array(world.flags)
        });
        const next = redoStack.pop();
        world.fg.set(next.fg);
        world.bg.set(next.bg);
        world.flags.set(next.flags);
        render();
        onWorldChange(world);
        return true;
      }

      function getTileIndex(x, y) {
        if (x < 0 || x >= world.width || y < 0 || y >= world.height) return -1;
        return y * world.width + x;
      }

      function spawnBlockPlaceEffect(tx, ty, item) {
        if (!item || !player.active || typeof performance === "undefined") return;
        const now = performance.now();
        if (activeBlockEffects.length > 5) activeBlockEffects.shift();
        activeBlockEffects.push({
          tx,
          ty,
          item,
          startTime: now,
          duration: 180
        });

        const worldX = tx * TILE_SIZE;
        const worldY = ty * TILE_SIZE;
        const count = 4;
        const colors = ["#00e5ff", "#c084fc", "#fde047", "#ffffff", "#38bdf8"];
        for (let i = 0; i < count; i++) {
          if (activeParticles.length >= 16) activeParticles.shift();
          const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
          const speed = 1.0 + Math.random() * 2.0;
          activeParticles.push({
            x: worldX + TILE_SIZE / 2,
            y: worldY + TILE_SIZE / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.0,
            size: 2.0 + Math.random() * 2.0,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1.0,
            life: 0,
            maxLife: 280 + Math.random() * 150,
            isStar: Math.random() > 0.4
          });
        }
      }

      function setTile(x, y, item, { isBg = null, flip = isFlipped } = {}) {
        const idx = getTileIndex(x, y);
        if (idx === -1) return false;

        const determineBg = isBg !== null ? isBg : catalog.isBackgroundItem(item);
        if (determineBg) {
          world.bg[idx] = item ? Number(item.id) : 0;
        } else {
          world.fg[idx] = item ? Number(item.id) : 0;
          if (flip) {
            world.flags[idx] |= 1; // Bit 0: Flip horizontal
          } else {
            world.flags[idx] &= ~1;
          }
        }
        if (item && player.active) {
          spawnBlockPlaceEffect(x, y, item);
          playSfx("pop", 0.95 + Math.random() * 0.15, 0.4);
        }
        return true;
      }

      function eraseTile(x, y) {
        const idx = getTileIndex(x, y);
        if (idx === -1) return false;
        // Erase FG first if present, then BG
        if (world.fg[idx] !== 0) {
          world.fg[idx] = 0;
          world.flags[idx] = 0;
        } else if (world.bg[idx] !== 0) {
          world.bg[idx] = 0;
        }
        return true;
      }

      function floodFill(startX, startY, newItem) {
        const startIdx = getTileIndex(startX, startY);
        if (startIdx === -1) return;

        const isBg = catalog.isBackgroundItem(newItem);
        const targetLayer = isBg ? world.bg : world.fg;
        const targetVal = targetLayer[startIdx];
        const newVal = newItem ? Number(newItem.id) : 0;

        if (targetVal === newVal) return;

        pushUndoSnapshot("Bucket Fill");
        const queue = [[startX, startY]];
        const visited = new Uint8Array(world.width * world.height);

        while (queue.length > 0) {
          const [cx, cy] = queue.pop();
          const idx = cy * world.width + cx;
          if (visited[idx]) continue;
          visited[idx] = 1;

          if (targetLayer[idx] === targetVal) {
            targetLayer[idx] = newVal;
            if (!isBg && isFlipped) {
              world.flags[idx] |= 1;
            } else if (!isBg) {
              world.flags[idx] &= ~1;
            }

            if (cx > 0 && !visited[idx - 1]) queue.push([cx - 1, cy]);
            if (cx < world.width - 1 && !visited[idx + 1]) queue.push([cx + 1, cy]);
            if (cy > 0 && !visited[idx - world.width]) queue.push([cx, cy - 1]);
            if (cy < world.height - 1 && !visited[idx + world.width]) queue.push([cx, cy + 1]);
          }
        }
        render();
        onWorldChange(world);
      }

      function flipTile(x, y) {
        const idx = getTileIndex(x, y);
        if (idx === -1) return false;
        world.flags[idx] ^= 1;
        render();
        onWorldChange(world);
        return true;
      }

      function pickTile(x, y) {
        const idx = getTileIndex(x, y);
        if (idx === -1) return null;
        const fgId = world.fg[idx];
        const bgId = world.bg[idx];
        const pickedId = fgId !== 0 ? fgId : bgId;
        if (pickedId === 0) return null;
        const item = getItem(pickedId);
        if (item) {
          hotbar[activeHotbarIndex] = item;
          onHotbarChange(hotbar, activeHotbarIndex);
          onStatusMessage(`Picked: #${item.id} ${item.name}`);
        }
        return item;
      }

      // Convert Screen Pixel to World Tile (x, y)
      function screenToWorldTile(screenX, screenY) {
        const rect = canvas.getBoundingClientRect();
        const clientX = screenX - rect.left;
        const clientY = screenY - rect.top;

        const worldPixelX = (clientX - viewport.x) / viewport.zoom;
        const worldPixelY = (clientY - viewport.y) / viewport.zoom;

        const tileX = Math.floor(worldPixelX / TILE_SIZE);
        const tileY = Math.floor(worldPixelY / TILE_SIZE);

        return { tileX, tileY, worldPixelX, worldPixelY };
      }

      // Center viewport on world
      function centerViewport() {
        if (!canvas) return;
        const cw = canvas.clientWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : 800) || 800;
        const ch = canvas.clientHeight || (canvas.parentElement ? canvas.parentElement.clientHeight : 600) || 600;
        const worldPixelW = world.width * TILE_SIZE;
        const worldPixelH = world.height * TILE_SIZE;
        const computedZoom = Math.min(cw / worldPixelW, ch / worldPixelH) * 0.95;
        viewport.zoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, computedZoom > 0 ? computedZoom : 0.5));
        viewport.x = (cw - worldPixelW * viewport.zoom) / 2;
        viewport.y = (ch - worldPixelH * viewport.zoom) / 2;
        render();
      }

      // Render World to Canvas
      function render() {
        if (!canvas) return;
        const ctx = canvas.getContext ? canvas.getContext("2d") : null;
        if (!ctx) return;
        const cw = canvas.width;
        const ch = canvas.height;
        const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;

        ctx.clearRect(0, 0, cw, ch);

        ctx.save();
        ctx.scale(dpr, dpr);

        const viewW = cw / dpr;
        const viewH = ch / dpr;

        // 1. Dark outer void backdrop across entire canvas (outside of world boundary)
        ctx.fillStyle = "#050811";
        ctx.fillRect(0, 0, viewW, viewH);

        const worldW = world.width * TILE_SIZE;
        const worldH = world.height * TILE_SIZE;

        // Screen-space coordinates of the World Rectangle
        const wsX = viewport.x;
        const wsY = viewport.y;
        const wsW = worldW * viewport.zoom;
        const wsH = worldH * viewport.zoom;

        // 2. Weather Sky Backdrop (Rendered with fixed scale/position, Clipped STRICTLY inside World Rectangle)
        if (world.weather !== "TRANSPARENT") {
          const weatherObj = catalog.getWeatherById(world.weather);
          if (weatherObj) {
            ctx.save();
            ctx.beginPath();
            if (typeof ctx.rect === "function") ctx.rect(wsX, wsY, wsW, wsH);
            if (typeof ctx.clip === "function") ctx.clip();

            const weatherImg = weatherObj.file ? weatherImageCache.get(`weather/${weatherObj.file}`) : null;
            if (weatherImg && weatherImg.complete && weatherImg.naturalWidth > 0) {
              const imgW = weatherImg.naturalWidth;
              const imgH = weatherImg.naturalHeight;
              const coverScale = Math.max(viewW / imgW, viewH / imgH);
              const drawW = imgW * coverScale;
              const drawH = imgH * coverScale;
              const drawX = (viewW - drawW) / 2;
              const drawY = (viewH - drawH) / 2;
              ctx.drawImage(weatherImg, drawX, drawY, drawW, drawH);
            } else {
              const grad = ctx.createLinearGradient(wsX, wsY, wsX, wsY + wsH);
              grad.addColorStop(0, "#1a2c42");
              grad.addColorStop(0.5, "#0b1522");
              grad.addColorStop(1, "#04080e");
              ctx.fillStyle = grad;
              ctx.fillRect(wsX, wsY, wsW, wsH);
              if (weatherObj.file) loadWeatherImage(weatherObj.file);
            }
            ctx.restore();
          }
        }

        // 2. Apply Viewport Matrix (pan + zoom) for World Tiles & Grid
        ctx.save();
        ctx.translate(viewport.x, viewport.y);
        ctx.scale(viewport.zoom, viewport.zoom);

        // Mask tiles strictly inside World Rectangle (0, 0, worldW, worldH)
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.rect === "function") ctx.rect(0, 0, worldW, worldH);
        if (typeof ctx.clip === "function") ctx.clip();

        // Viewport Culling Bounds (in tiles)
        const visibleMinX = Math.max(0, Math.floor(-viewport.x / (viewport.zoom * TILE_SIZE)) - 1);
        const visibleMaxX = Math.min(world.width - 1, Math.ceil((cw / dpr - viewport.x) / (viewport.zoom * TILE_SIZE)) + 1);
        const visibleMinY = Math.max(0, Math.floor(-viewport.y / (viewport.zoom * TILE_SIZE)) - 1);
        const visibleMaxY = Math.min(world.height - 1, Math.ceil((ch / dpr - viewport.y) / (viewport.zoom * TILE_SIZE)) + 1);

        ctx.imageSmoothingEnabled = false;

        // 2. Background Layer
        for (let y = visibleMinY; y <= visibleMaxY; y++) {
          for (let x = visibleMinX; x <= visibleMaxX; x++) {
            const idx = y * world.width + x;
            const bgId = world.bg[idx];
            if (bgId > 0) {
              const item = getItem(bgId);
              if (item && item.texture) {
                drawTileSprite(ctx, item, x * TILE_SIZE, y * TILE_SIZE, false, true, x, y, world.bg);
              }
            }
          }
        }

        // 3. Foreground Layer
        for (let y = visibleMinY; y <= visibleMaxY; y++) {
          for (let x = visibleMinX; x <= visibleMaxX; x++) {
            const idx = y * world.width + x;
            const fgId = world.fg[idx];
            if (fgId > 0) {
              const item = getItem(fgId);
              if (item && item.texture) {
                const flipX = (world.flags[idx] & 1) === 1;
                drawTileSprite(ctx, item, x * TILE_SIZE, y * TILE_SIZE, flipX, false, x, y, world.fg);
              }
            }
          }
        }

        // 4. Grid Lines
        if (showGrid && activeTool !== "preview" && viewport.zoom >= 0.25) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1 / viewport.zoom;
          ctx.beginPath();
          for (let x = visibleMinX; x <= visibleMaxX + 1; x++) {
            ctx.moveTo(x * TILE_SIZE, visibleMinY * TILE_SIZE);
            ctx.lineTo(x * TILE_SIZE, (visibleMaxY + 1) * TILE_SIZE);
          }
          for (let y = visibleMinY; y <= visibleMaxY + 1; y++) {
            ctx.moveTo(visibleMinX * TILE_SIZE, y * TILE_SIZE);
            ctx.lineTo((visibleMaxX + 1) * TILE_SIZE, y * TILE_SIZE);
          }
          ctx.stroke();
        }

        // 5. Selection Box
        if (selection.active) {
          const minX = Math.min(selection.startX, selection.endX);
          const maxX = Math.max(selection.startX, selection.endX);
          const minY = Math.min(selection.startY, selection.endY);
          const maxY = Math.max(selection.startY, selection.endY);

          ctx.fillStyle = "rgba(0, 229, 255, 0.22)";
          ctx.fillRect(
            minX * TILE_SIZE,
            minY * TILE_SIZE,
            (maxX - minX + 1) * TILE_SIZE,
            (maxY - minY + 1) * TILE_SIZE
          );
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = 2 / viewport.zoom;
          ctx.strokeRect(
            minX * TILE_SIZE,
            minY * TILE_SIZE,
            (maxX - minX + 1) * TILE_SIZE,
            (maxY - minY + 1) * TILE_SIZE
          );
        }

        // 6. Ghost Paste Preview
        if (activeTool === "paste" && clipboard.active && hoveredTile.x >= 0 && hoveredTile.y >= 0) {
          const pw = clipboard.width;
          const ph = clipboard.height;
          ctx.save();
          ctx.globalAlpha = 0.65;
          for (let py = 0; py < ph; py++) {
            for (let px = 0; px < pw; px++) {
              const pidx = py * pw + px;
              const bgId = clipboard.bg ? clipboard.bg[pidx] : 0;
              const fgId = clipboard.fg ? clipboard.fg[pidx] : 0;
              const destX = (hoveredTile.x + px) * TILE_SIZE;
              const destY = (hoveredTile.y + py) * TILE_SIZE;
              if (destX < worldW && destY < worldH) {
                if (bgId > 0) {
                  const bItem = getItem(bgId);
                  if (bItem) drawTileSprite(ctx, bItem, destX, destY, false, true);
                }
                if (fgId > 0) {
                  const fItem = getItem(fgId);
                  const flipX = clipboard.flags ? (clipboard.flags[pidx] & 1) === 1 : false;
                  if (fItem) drawTileSprite(ctx, fItem, destX, destY, flipX, false);
                }
              }
            }
          }
          ctx.restore();
          ctx.strokeStyle = "#c084fc";
          ctx.lineWidth = 2 / viewport.zoom;
          ctx.strokeRect(hoveredTile.x * TILE_SIZE, hoveredTile.y * TILE_SIZE, pw * TILE_SIZE, ph * TILE_SIZE);
        }

        // 7. Music Sequencer Playhead Line
        if (sequencer.isPlaying) {
          const phX = sequencer.playheadX * TILE_SIZE;
          ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
          ctx.fillRect(phX, 0, TILE_SIZE, worldH);
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = 2 / viewport.zoom;
          ctx.strokeRect(phX, 0, TILE_SIZE, worldH);
          ctx.fillStyle = "#00e5ff";
          ctx.beginPath();
          ctx.arc(phX + TILE_SIZE / 2, 16, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // 7b. Block Placement Animations & Burst Particles
        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        for (let i = activeBlockEffects.length - 1; i >= 0; i--) {
          const ef = activeBlockEffects[i];
          const elapsed = nowMs - ef.startTime;
          if (elapsed >= ef.duration) {
            activeBlockEffects.splice(i, 1);
            continue;
          }
          const progress = elapsed / ef.duration;
          const popScale = 1.0 + Math.sin(progress * Math.PI) * 0.28;
          ctx.save();
          ctx.translate(ef.tx * TILE_SIZE + TILE_SIZE / 2, ef.ty * TILE_SIZE + TILE_SIZE / 2);
          ctx.scale(popScale, popScale);
          ctx.strokeStyle = "rgba(0, 229, 255, " + (1.0 - progress) + ")";
          ctx.lineWidth = 2 / viewport.zoom;
          ctx.strokeRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          ctx.restore();
        }

        for (let i = activeParticles.length - 1; i >= 0; i--) {
          const p = activeParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08; // particle gravity
          p.vx *= 0.95;
          p.life += 16;
          p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
          if (p.alpha <= 0 || p.life >= p.maxLife) {
            activeParticles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          if (p.isStar) {
            ctx.fillRect(p.x - p.size / 2, p.y - 0.5, p.size, 1);
            ctx.fillRect(p.x - 0.5, p.y - p.size / 2, 1, p.size);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 8. Player Avatar (Play Mode)
        if (player.active) {
          drawPlayerAvatar(ctx);
        }

        // 9. Hover Indicator (in Build/Erase mode)
        if (activeTool !== "preview" && activeTool !== "paste" && hoveredTile.x >= 0 && hoveredTile.x < world.width && hoveredTile.y >= 0 && hoveredTile.y < world.height) {
          ctx.strokeStyle = activeTool === "eraser" ? "#f87171" : "#67e8f9";
          ctx.lineWidth = 2 / viewport.zoom;
          ctx.strokeRect(
            hoveredTile.x * TILE_SIZE,
            hoveredTile.y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
          );

          if (activeTool === "pencil" && hotbar[activeHotbarIndex]) {
            ctx.globalAlpha = 0.5;
            drawTileSprite(
              ctx,
              hotbar[activeHotbarIndex],
              hoveredTile.x * TILE_SIZE,
              hoveredTile.y * TILE_SIZE,
              isFlipped,
              catalog.isBackgroundItem(hotbar[activeHotbarIndex])
            );
            ctx.globalAlpha = 1.0;
          }
        }

        // 10. World Border Line around (0, 0, worldW, worldH)
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(0, 0, worldW, worldH);

        ctx.restore(); // Restore clip mask
        ctx.restore(); // Restore viewport matrix
        ctx.restore(); // Restore dpr scale
      }

      function getTileConnectionOffset(item, x, y, layer) {
        if (!item || !layer || x < 0 || y < 0) return { offsetX: 0, offsetY: 0 };
        
        const nameLower = (item.name || "").toLowerCase();
        const id = Number(item.id);
        
        // 1. Horizontal Connectable Items (Couch, Table, Platform, Bench, Bar, Desk, Shelf, Bed, Sofa, Bannister, Pew, Counter)
        const isHorizontalConnectable = (
          item.spread_type === 3 ||
          item.frames >= 3 ||
          nameLower.includes("couch") ||
          nameLower.includes("table") ||
          nameLower.includes("platform") ||
          nameLower.includes("bench") ||
          nameLower.includes("sofa") ||
          nameLower.includes("desk") ||
          nameLower.includes("shelf") ||
          nameLower.includes("counter") ||
          nameLower.includes("bannister") ||
          nameLower.includes("bar ") ||
          nameLower.endsWith(" bar") ||
          nameLower.includes("pew")
        );

        if (isHorizontalConnectable) {
          const hasLeft = x > 0 && layer[y * world.width + (x - 1)] === id;
          const hasRight = x < world.width - 1 && layer[y * world.width + (x + 1)] === id;

          if (!hasLeft && !hasRight) {
            return { offsetX: 3, offsetY: 0 }; // Standalone single item (1 block)
          } else if (!hasLeft && hasRight) {
            return { offsetX: 0, offsetY: 0 }; // Left end
          } else if (hasLeft && hasRight) {
            return { offsetX: 1, offsetY: 0 }; // Middle segment
          } else if (hasLeft && !hasRight) {
            return { offsetX: 2, offsetY: 0 }; // Right end
          }
        }

        // 2. 4-Way Connectable Items (Fences, Pipes, Plumbing, Wires, Ropes, Lattices)
        const is4WayConnectable = (
          nameLower.includes("fence") ||
          nameLower.includes("pipe") ||
          nameLower.includes("plumbing") ||
          nameLower.includes("wire") ||
          nameLower.includes("lattice") ||
          nameLower.includes("rope") ||
          nameLower.includes("vine") ||
          nameLower.includes("beam")
        );

        // 3. Terrain Blocks with Grass / Border (Dirt and natural blocks with spread_type === 2)
        if (id === 2 || (item.spread_type === 2 && !nameLower.includes("bedrock") && !nameLower.includes("background"))) {
          const hasAbove = y > 0 && layer[(y - 1) * world.width + x] > 0;
          const hasLeft = x > 0 && layer[y * world.width + (x - 1)] === id;
          const hasRight = x < world.width - 1 && layer[y * world.width + (x + 1)] === id;

          if (!hasAbove) {
            // Surface with air above -> has grass top!
            if (!hasLeft && hasRight) {
              return { offsetX: 5, offsetY: 0 }; // Top-left grass corner
            } else if (hasLeft && !hasRight) {
              return { offsetX: 6, offsetY: 0 }; // Top-right grass corner
            } else {
              return { offsetX: 1, offsetY: 0 }; // Continuous top grass
            }
          } else {
            // Under ground / solid above
            if (!hasLeft && hasRight) {
              return { offsetX: 3, offsetY: 0 }; // Left edge
            } else if (hasLeft && !hasRight) {
              return { offsetX: 4, offsetY: 0 }; // Right edge
            } else {
              return { offsetX: 0, offsetY: 0 }; // Solid inner dirt
            }
          }
        }

        return { offsetX: 0, offsetY: 0 };
      }

      function drawTileSprite(ctx, item, destX, destY, flipX = false, isBg = false, x = -1, y = -1, layer = null, scale = 1) {
        const fullPath = `tilesheets/${item.texture}`;
        const img = textureCache.get(fullPath);
        if (!img || !img.complete || img.naturalWidth === 0) {
          loadTexture(item.texture);
          return;
        }

        let offsetX = 0;
        let offsetY = 0;
        if (x >= 0 && y >= 0 && layer) {
          const conn = getTileConnectionOffset(item, x, y, layer);
          offsetX = conn.offsetX;
          offsetY = conn.offsetY;
        }

        const sx = (item.tx + offsetX) * TILE_SIZE;
        const sy = (item.ty + offsetY) * TILE_SIZE;
        const drawSize = TILE_SIZE * scale;

        ctx.save();
        if (isBg) {
          ctx.globalAlpha = 0.85;
        }
        if (flipX) {
          ctx.translate(destX + drawSize, destY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, drawSize, drawSize);
        } else {
          ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE, destX, destY, drawSize, drawSize);
        }
        ctx.restore();
      }

      function renderMinimap() {
        if (!minimapCanvas) return;
        const mCtx = minimapCanvas.getContext("2d");
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;

        mCtx.fillStyle = "#090f1b";
        mCtx.fillRect(0, 0, mw, mh);

        const tileW = mw / world.width;
        const tileH = mh / world.height;

        for (let y = 0; y < world.height; y++) {
          for (let x = 0; x < world.width; x++) {
            const idx = y * world.width + x;
            const fgId = world.fg[idx];
            const bgId = world.bg[idx];

            if (fgId > 0) {
              if (fgId === 8) mCtx.fillStyle = "#334155"; // Bedrock
              else if (fgId === 2) mCtx.fillStyle = "#7c4a27"; // Dirt
              else if (fgId === 4) mCtx.fillStyle = "#ef4444"; // Lava
              else if (fgId === 6) mCtx.fillStyle = "#f59e0b"; // Main Door
              else if (fgId === 20) mCtx.fillStyle = "#a16207"; // Wood
              else mCtx.fillStyle = "#38bdf8"; // Other blocks
              mCtx.fillRect(x * tileW, y * tileH, Math.max(1, tileW), Math.max(1, tileH));
            } else if (bgId > 0) {
              if (bgId === 14) mCtx.fillStyle = "#1e293b"; // Cave Background
              else mCtx.fillStyle = "#0f172a";
              mCtx.fillRect(x * tileW, y * tileH, Math.max(1, tileW), Math.max(1, tileH));
            }
          }
        }

        // Viewport rectangle indicator on minimap
        if (canvas) {
          const visibleX = (-viewport.x / (viewport.zoom * TILE_SIZE)) * tileW;
          const visibleY = (-viewport.y / (viewport.zoom * TILE_SIZE)) * tileH;
          const visibleW = (canvas.clientWidth / (viewport.zoom * TILE_SIZE)) * tileW;
          const visibleH = (canvas.clientHeight / (viewport.zoom * TILE_SIZE)) * tileH;

          mCtx.strokeStyle = "#38bdf8";
          mCtx.lineWidth = 1.5;
          mCtx.strokeRect(visibleX, visibleY, visibleW, visibleH);
        }
      }

      // Render selection / full world to PNG with optional upscale (1x, 2x, 3x, 4x)
      function exportToPNG({ onlySelection = false, scale = 1 } = {}) {
        scale = Math.max(1, Math.min(10, parseInt(scale, 10) || 1));
        let minX = 0;
        let maxX = world.width - 1;
        let minY = 0;
        let maxY = world.height - 1;

        if (onlySelection && selection.active) {
          minX = Math.max(0, Math.min(selection.startX, selection.endX));
          maxX = Math.min(world.width - 1, Math.max(selection.startX, selection.endX));
          minY = Math.max(0, Math.min(selection.startY, selection.endY));
          maxY = Math.min(world.height - 1, Math.max(selection.startY, selection.endY));
        }

        const tileSize = TILE_SIZE * scale;
        const renderW = (maxX - minX + 1) * tileSize;
        const renderH = (maxY - minY + 1) * tileSize;

        const offCanvas = typeof document !== "undefined" && document.createElement ? document.createElement("canvas") : null;
        if (!offCanvas) return null;
        offCanvas.width = renderW;
        offCanvas.height = renderH;
        const offCtx = offCanvas.getContext ? offCanvas.getContext("2d") : null;
        if (offCtx) offCtx.imageSmoothingEnabled = false;

        // Draw Weather Background clipped (if not TRANSPARENT)
        if (offCtx && world.weather !== "TRANSPARENT") {
          const weatherObj = catalog.getWeatherById(world.weather);
          const weatherImg = weatherObj?.file ? weatherImageCache.get(`weather/${weatherObj.file}`) : null;
          if (weatherImg && weatherImg.complete && weatherImg.naturalWidth > 0) {
            const fullWorldW = world.width * TILE_SIZE;
            const fullWorldH = world.height * TILE_SIZE;
            offCtx.drawImage(
              weatherImg,
              (minX * TILE_SIZE / fullWorldW) * weatherImg.naturalWidth,
              (minY * TILE_SIZE / fullWorldH) * weatherImg.naturalHeight,
              ((maxX - minX + 1) * TILE_SIZE / fullWorldW) * weatherImg.naturalWidth,
              ((maxY - minY + 1) * TILE_SIZE / fullWorldH) * weatherImg.naturalHeight,
              0,
              0,
              renderW,
              renderH
            );
          } else {
            offCtx.fillStyle = "#0b1522";
            offCtx.fillRect(0, 0, renderW, renderH);
          }
        } else if (offCtx) {
          offCtx.fillStyle = "#0b1522";
          offCtx.fillRect(0, 0, renderW, renderH);
        }

        // Draw Backgrounds
        if (offCtx) {
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const idx = y * world.width + x;
              const bgId = world.bg[idx];
              if (bgId > 0) {
                const item = getItem(bgId);
                if (item && item.texture) {
                  drawTileSprite(offCtx, item, (x - minX) * tileSize, (y - minY) * tileSize, false, true, x, y, world.bg, scale);
                }
              }
            }
          }

          // Draw Foregrounds
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const idx = y * world.width + x;
              const fgId = world.fg[idx];
              if (fgId > 0) {
                const item = getItem(fgId);
                if (item && item.texture) {
                  const flipX = (world.flags[idx] & 1) === 1;
                  drawTileSprite(offCtx, item, (x - minX) * tileSize, (y - minY) * tileSize, flipX, false, x, y, world.fg, scale);
                }
              }
            }
          }
        }

        const suffix = onlySelection ? "selection" : "full";
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const filename = `${world.name || "World"}-${suffix}-${scale}x-${dateStr}.png`;

        if (typeof offCanvas.toBlob === "function") {
          return new Promise(resolve => {
            offCanvas.toBlob(blob => {
              if (blob && typeof URL !== "undefined" && URL.createObjectURL && typeof document !== "undefined") {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                if (a && a.style) a.style.display = "none";
                a.download = filename;
                a.href = url;
                if (document.body) document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  if (document.body && a.parentNode === document.body) document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }, 2000);
                onStatusMessage(`Exported ${filename} (${renderW} × ${renderH} px)!`);
                resolve(url);
              } else {
                // Fallback to dataURL
                try {
                  const dataUrl = offCanvas.toDataURL("image/png");
                  if (typeof document !== "undefined") {
                    const a = document.createElement("a");
                    if (a && a.style) a.style.display = "none";
                    a.download = filename;
                    a.href = dataUrl;
                    if (document.body) document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      if (document.body && a.parentNode === document.body) document.body.removeChild(a);
                    }, 2000);
                  }
                  resolve(dataUrl);
                } catch(err) {
                  console.error("Export fallback failed:", err);
                  resolve(null);
                }
              }
            }, "image/png");
          });
        } else {
          // Sync fallback
          let dataUrl = "";
          try {
            dataUrl = offCanvas.toDataURL("image/png");
            if (typeof document !== "undefined") {
              const a = document.createElement("a");
              if (a && a.style) a.style.display = "none";
              a.download = filename;
              a.href = dataUrl;
              if (document.body) document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                if (document.body && a.parentNode === document.body) document.body.removeChild(a);
              }, 2000);
            }
          } catch (e) {
            console.error("Canvas export failed:", e);
          }
          return dataUrl;
        }
      }

      // .DAT format Export (compatible with gt-planner.tommyhub.com)
      function exportToDAT() {
        if (!lzString) {
          throw new Error("LZString library is required to export .dat format.");
        }
        const total = world.width * world.height;
        const tileChunks = [];

        for (let i = 0; i < total; i++) {
          const fg = world.fg[i];
          const bg = world.bg[i];
          const flags = world.flags[i];

          // 16-byte binary chunk in string representation (char codes)
          const b0 = fg & 0xff;
          const b1 = (fg >> 8) & 0xff;
          const b2 = bg & 0xff;
          const b3 = (bg >> 8) & 0xff;
          const b4 = flags & 0xff;
          const b5 = (flags >> 8) & 0xff;

          const chunk = String.fromCharCode(b0, b1, b2, b3, b4, b5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          tileChunks.push(chunk);
        }

        const weatherObj = catalog.getWeatherById(world.weather);
        const weatherCode = weatherObj.code || 80;

        const metaObj = {
          name: world.name || "World",
          guild: { level: 1, mascot: 0 },
          tileextra: {},
          weatherMeta: { r: 0, g: 0, b: 0 },
          bpm: 100,
          recent: hotbar.filter(Boolean).map(item => Number(item.id)).slice(0, 8)
        };

        const rawGpMap2 = `GPMAP2|${world.width},${world.height},${weatherCode}|${tileChunks.join("")}|${JSON.stringify(metaObj)}`;
        const compressedBase64 = lzString.compressToBase64(rawGpMap2);

        const blob = new Blob([compressedBase64], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.download = `${world.name || "World"}-${dateStr}.dat`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // .DAT format Import
      function importFromDAT(rawText) {
        if (!lzString) {
          throw new Error("LZString library is required to import .dat format.");
        }
        let decompressed = lzString.decompressFromBase64(rawText.trim());
        if (!decompressed) {
          decompressed = lzString.decompress(rawText.trim());
        }
        if (!decompressed || !decompressed.startsWith("GPMAP2|")) {
          throw new Error("Invalid GPMAP2 World data format.");
        }

        const sections = decompressed.split("|");
        const dims = (sections[1] || "100,60,80").split(",");
        const width = parseInt(dims[0], 10) || 100;
        const height = parseInt(dims[1], 10) || 60;
        const weatherCode = parseInt(dims[2], 10) || 80;

        const tilesStr = sections[2] || "";
        let meta = {};
        try {
          if (sections[3]) meta = JSON.parse(sections[3]);
        } catch {}

        pushUndoSnapshot("Import World");

        const total = width * height;
        const fg = new Uint16Array(total);
        const bg = new Uint16Array(total);
        const flags = new Uint8Array(total);

        for (let i = 0; i < total; i++) {
          const offset = i * 16;
          if (offset + 6 <= tilesStr.length) {
            const b0 = tilesStr.charCodeAt(offset);
            const b1 = tilesStr.charCodeAt(offset + 1);
            const b2 = tilesStr.charCodeAt(offset + 2);
            const b3 = tilesStr.charCodeAt(offset + 3);
            const b4 = tilesStr.charCodeAt(offset + 4);
            const b5 = tilesStr.charCodeAt(offset + 5);

            fg[i] = b0 | (b1 << 8);
            bg[i] = b2 | (b3 << 8);
            flags[i] = b4 | (b5 << 8);
          }
        }

        const weatherObj = catalog.getWeatherById(String(weatherCode));

        world = {
          width,
          height,
          name: meta.name || "World",
          weather: weatherObj.id,
          weatherCode: weatherCode,
          fg,
          bg,
          flags
        };

        // Populate recent hotbar if provided
        if (Array.isArray(meta.recent)) {
          meta.recent.forEach((id, idx) => {
            if (idx < hotbar.length) {
              hotbar[idx] = getItem(id) || hotbar[idx];
            }
          });
          onHotbarChange(hotbar, activeHotbarIndex);
        }

        centerViewport();
        render();
        onWorldChange(world);
        onStatusMessage(`Loaded world "${world.name}" (${width}x${height}) successfully!`);
      }

      // JSON format export
      function exportToJSON() {
        const payload = {
          format: "GT_WORLD_PLANNER",
          version: 1,
          name: world.name,
          width: world.width,
          height: world.height,
          weather: world.weather,
          weatherCode: world.weatherCode,
          fg: Array.from(world.fg),
          bg: Array.from(world.bg),
          flags: Array.from(world.flags),
          hotbar: hotbar.filter(Boolean).map(i => i.id)
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `${world.name || "World"}.gtworld`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // JSON format import
      function importFromJSON(jsonStr) {
        const data = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        pushUndoSnapshot("Import JSON World");

        const width = data.width || 100;
        const height = data.height || 60;
        const total = width * height;

        const fg = new Uint16Array(data.fg || total);
        const bg = new Uint16Array(data.bg || total);
        const flags = new Uint8Array(data.flags || total);

        world = {
          width,
          height,
          name: data.name || "World",
          weather: data.weather || "SUNNY",
          weatherCode: data.weatherCode || 1,
          fg,
          bg,
          flags
        };

        if (Array.isArray(data.hotbar)) {
          data.hotbar.forEach((id, idx) => {
            if (idx < hotbar.length) {
              hotbar[idx] = getItem(id) || hotbar[idx];
            }
          });
          onHotbarChange(hotbar, activeHotbarIndex);
        }

        centerViewport();
        render();
        onWorldChange(world);
      }

      // Resize Canvas buffer to match CSS element size
      function resizeCanvas() {
        if (typeof window === "undefined" || !canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
        const w = rect.width || canvas.clientWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : 800) || 800;
        const h = rect.height || canvas.clientHeight || (canvas.parentElement ? canvas.parentElement.clientHeight : 600) || 600;
        if (w > 0 && h > 0) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          render();
        }
      }

      function setupEventHandlers() {
        if (!canvas) return;

        if (typeof window !== "undefined") {
          window.addEventListener("resize", resizeCanvas);
          resizeCanvas();
        }

        // Mouse Down
        canvas.addEventListener("mousedown", event => {
          const { tileX, tileY } = screenToWorldTile(event.clientX, event.clientY);

          // Middle click or Spacebar held -> Pan viewport
          if (event.button === 1 || event.spaceKey || event.shiftKey && event.button === 0 && activeTool === "preview") {
            isPanning = true;
            panStartX = event.clientX - viewport.x;
            panStartY = event.clientY - viewport.y;
            canvas.style.cursor = "grabbing";
            return;
          }

          // Right click -> Erase or cancel
          if (event.button === 2) {
            event.preventDefault();
            pushUndoSnapshot("Erase Tile");
            eraseTile(tileX, tileY);
            render();
            onWorldChange(world);
            return;
          }

          // Left Click Tool Handling
          if (event.button === 0) {
            if (activeTool === "select") {
              isSelecting = true;
              selection.active = true;
              selection.startX = tileX;
              selection.startY = tileY;
              selection.endX = tileX;
              selection.endY = tileY;
              render();
              return;
            }

            if (activeTool === "picker") {
              pickTile(tileX, tileY);
              return;
            }

            if (activeTool === "bucket") {
              const activeItem = hotbar[activeHotbarIndex];
              floodFill(tileX, tileY, activeItem);
              return;
            }

            if (activeTool === "flip") {
              pushUndoSnapshot("Flip Tile");
              flipTile(tileX, tileY);
              return;
            }

            if (activeTool === "paste" && clipboard.active) {
              pasteClipboardAt(tileX, tileY);
              return;
            }

            if (activeTool === "eraser") {
              isDrawing = true;
              pushUndoSnapshot("Erase");
              eraseTile(tileX, tileY);
              lastDrawTile = { x: tileX, y: tileY };
              render();
              onWorldChange(world);
              return;
            }

            if (activeTool === "pencil") {
              isDrawing = true;
              pushUndoSnapshot("Place Tile");
              const activeItem = hotbar[activeHotbarIndex];
              setTile(tileX, tileY, activeItem);
              lastDrawTile = { x: tileX, y: tileY };
              render();
              onWorldChange(world);
              return;
            }
          }
        });

        // Prevent Context Menu on canvas
        canvas.addEventListener("contextmenu", event => event.preventDefault());

        // ── Touch Gestures for Mobile (1-finger Draw/Pan, 2-finger Pinch-to-Zoom) ──
        let touchStartDist = 0;
        let touchStartZoom = 1;
        let touchMidX = 0;
        let touchMidY = 0;
        let isTouchDrawing = false;
        let isTouchPanning = false;
        let touchPanStartX = 0;
        let touchPanStartY = 0;

        function getTouchDistance(t1, t2) {
          const dx = t1.clientX - t2.clientX;
          const dy = t1.clientY - t2.clientY;
          return Math.sqrt(dx * dx + dy * dy);
        }

        canvas.addEventListener("touchstart", event => {
          if (event.touches.length === 1) {
            const t = event.touches[0];
            const { tileX, tileY } = screenToWorldTile(t.clientX, t.clientY);

            if (player.active) {
              if (activeTool === "preview" || event.shiftKey) {
                isTouchPanning = true;
                touchPanStartX = t.clientX - viewport.x;
                touchPanStartY = t.clientY - viewport.y;
                return;
              }

              if (tileX >= 0 && tileX < world.width && tileY >= 0 && tileY < world.height) {
                if (activeTool === "picker") {
                  pickTile(tileX, tileY);
                } else if (activeTool === "bucket") {
                  floodFill(tileX, tileY, hotbar[activeHotbarIndex]);
                } else if (activeTool === "flip") {
                  pushUndoSnapshot("Flip Tile");
                  flipTile(tileX, tileY);
                } else if (activeTool === "select") {
                  isSelecting = true;
                  selection.active = true;
                  selection.startX = tileX; selection.startY = tileY;
                  selection.endX = tileX; selection.endY = tileY;
                  render();
                } else if (activeTool === "eraser") {
                  isTouchDrawing = true;
                  pushUndoSnapshot("Erase Tile");
                  eraseTile(tileX, tileY);
                  playSfx("tile_removed", 1.0 + Math.random() * 0.2, 0.55);
                  lastDrawTile = { x: tileX, y: tileY };
                  render();
                  onWorldChange(world);
                } else {
                  // Default to pencil (Place Tile)
                  isTouchDrawing = true;
                  pushUndoSnapshot("Place Tile");
                  setTile(tileX, tileY, hotbar[activeHotbarIndex]);
                  lastDrawTile = { x: tileX, y: tileY };
                  render();
                  onWorldChange(world);
                }
              }
              return;
            }

            if (activeTool === "preview" || event.shiftKey) {
              isTouchPanning = true;
              touchPanStartX = t.clientX - viewport.x;
              touchPanStartY = t.clientY - viewport.y;
              return;
            }

            if (tileX >= 0 && tileX < world.width && tileY >= 0 && tileY < world.height) {
              if (activeTool === "pencil") {
                isTouchDrawing = true;
                pushUndoSnapshot("Place Tile");
                setTile(tileX, tileY, hotbar[activeHotbarIndex]);
                lastDrawTile = { x: tileX, y: tileY };
                render();
                onWorldChange(world);
              } else if (activeTool === "eraser") {
                isTouchDrawing = true;
                pushUndoSnapshot("Erase");
                eraseTile(tileX, tileY);
                lastDrawTile = { x: tileX, y: tileY };
                render();
                onWorldChange(world);
              } else if (activeTool === "picker") {
                pickTile(tileX, tileY);
              } else if (activeTool === "bucket") {
                floodFill(tileX, tileY, hotbar[activeHotbarIndex]);
              } else if (activeTool === "flip") {
                pushUndoSnapshot("Flip Tile");
                flipTile(tileX, tileY);
              } else if (activeTool === "select") {
                isSelecting = true;
                selection.active = true;
                selection.startX = tileX; selection.startY = tileY;
                selection.endX = tileX; selection.endY = tileY;
                render();
              }
            }
          } else if (event.touches.length === 2) {
            // Start Pinch-to-Zoom
            isTouchDrawing = false;
            isTouchPanning = false;
            const t1 = event.touches[0];
            const t2 = event.touches[1];
            touchStartDist = getTouchDistance(t1, t2);
            touchStartZoom = viewport.zoom;
            const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            touchMidX = ((t1.clientX + t2.clientX) / 2) - rect.left;
            touchMidY = ((t1.clientY + t2.clientY) / 2) - rect.top;
          }
        }, { passive: false });

        canvas.addEventListener("touchmove", event => {
          if (event.touches.length === 1) {
            const t = event.touches[0];
            if (isTouchPanning) {
              event.preventDefault();
              viewport.x = t.clientX - touchPanStartX;
              viewport.y = t.clientY - touchPanStartY;
              requestRender();
              return;
            }

            if (isTouchDrawing) {
              event.preventDefault();
              const { tileX, tileY } = screenToWorldTile(t.clientX, t.clientY);
              if (tileX >= 0 && tileX < world.width && tileY >= 0 && tileY < world.height) {
                if (lastDrawTile?.x !== tileX || lastDrawTile?.y !== tileY) {
                  if (activeTool === "pencil") {
                    setTile(tileX, tileY, hotbar[activeHotbarIndex]);
                  } else if (activeTool === "eraser") {
                    eraseTile(tileX, tileY);
                  }
                  lastDrawTile = { x: tileX, y: tileY };
                  requestRender();
                }
              }
            } else if (isSelecting) {
              event.preventDefault();
              const { tileX, tileY } = screenToWorldTile(t.clientX, t.clientY);
              selection.endX = Math.max(0, Math.min(world.width - 1, tileX));
              selection.endY = Math.max(0, Math.min(world.height - 1, tileY));
              requestRender();
            }
          } else if (event.touches.length === 2) {
            // Pinch-to-Zoom & 2-finger pan
            event.preventDefault();
            const t1 = event.touches[0];
            const t2 = event.touches[1];
            const dist = getTouchDistance(t1, t2);
            if (touchStartDist > 0) {
              const scaleRatio = dist / touchStartDist;
              const nextZoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, touchStartZoom * scaleRatio));
              
              viewport.x = touchMidX - (touchMidX - viewport.x) * (nextZoom / viewport.zoom);
              viewport.y = touchMidY - (touchMidY - viewport.y) * (nextZoom / viewport.zoom);
              viewport.zoom = nextZoom;
              requestRender();
            }
          }
        }, { passive: false });

        canvas.addEventListener("touchend", () => {
          if (isTouchDrawing) {
            isTouchDrawing = false;
            lastDrawTile = null;
            onWorldChange(world);
          }
          isTouchPanning = false;
          if (isSelecting) isSelecting = false;
          touchStartDist = 0;
        });

        canvas.addEventListener("touchcancel", () => {
          isTouchDrawing = false;
          isTouchPanning = false;
          isSelecting = false;
          lastDrawTile = null;
          touchStartDist = 0;
        });

        // Smooth Mouse Wheel Zoom Interpolation
        let smoothZoomTarget = viewport.zoom;
        let smoothAnchorX = 0;
        let smoothAnchorY = 0;
        let isZoomAnimating = false;

        function stepSmoothZoom() {
          const diff = smoothZoomTarget - viewport.zoom;
          if (Math.abs(diff) < 0.002) {
            const finalZoom = smoothZoomTarget;
            viewport.x = smoothAnchorX - (smoothAnchorX - viewport.x) * (finalZoom / viewport.zoom);
            viewport.y = smoothAnchorY - (smoothAnchorY - viewport.y) * (finalZoom / viewport.zoom);
            viewport.zoom = finalZoom;
            isZoomAnimating = false;
            render();
            return;
          }

          const currentZoom = viewport.zoom;
          const nextZoom = currentZoom + diff * 0.25;
          viewport.x = smoothAnchorX - (smoothAnchorX - viewport.x) * (nextZoom / currentZoom);
          viewport.y = smoothAnchorY - (smoothAnchorY - viewport.y) * (nextZoom / currentZoom);
          viewport.zoom = nextZoom;

          render();
          if (typeof requestAnimationFrame !== "undefined") {
            requestAnimationFrame(stepSmoothZoom);
          }
        }

        canvas.addEventListener("wheel", event => {
          event.preventDefault();
          const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
          smoothAnchorX = event.clientX - rect.left;
          smoothAnchorY = event.clientY - rect.top;

          const zoomFactor = event.deltaY < 0 ? 1.16 : 0.84;
          smoothZoomTarget = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, smoothZoomTarget * zoomFactor));

          if (!isZoomAnimating) {
            isZoomAnimating = true;
            if (typeof requestAnimationFrame !== "undefined") {
              requestAnimationFrame(stepSmoothZoom);
            }
          }
        }, { passive: false });

        if (typeof window !== "undefined") {
          // Mouse Move
          window.addEventListener("mousemove", event => {
            if (isPanning) {
              viewport.x = event.clientX - panStartX;
              viewport.y = event.clientY - panStartY;
              requestRender();
              return;
            }

            const { tileX, tileY } = screenToWorldTile(event.clientX, event.clientY);
            if (tileX !== hoveredTile.x || tileY !== hoveredTile.y) {
              hoveredTile.x = tileX;
              hoveredTile.y = tileY;

              if (isSelecting) {
                selection.endX = Math.max(0, Math.min(world.width - 1, tileX));
                selection.endY = Math.max(0, Math.min(world.height - 1, tileY));
                requestRender();
              } else if (isDrawing && (lastDrawTile?.x !== tileX || lastDrawTile?.y !== tileY)) {
                if (activeTool === "pencil") {
                  setTile(tileX, tileY, hotbar[activeHotbarIndex]);
                } else if (activeTool === "eraser") {
                  eraseTile(tileX, tileY);
                }
                lastDrawTile = { x: tileX, y: tileY };
                requestRender();
              } else {
                requestRender();
              }
            }
          });

          // Mouse Up
          window.addEventListener("mouseup", () => {
            if (isPanning) {
              isPanning = false;
              canvas.style.cursor = "default";
            }
            if (isDrawing) {
              isDrawing = false;
              lastDrawTile = null;
              onWorldChange(world);
            }
            if (isSelecting) {
              isSelecting = false;
            }
          });

          // Keyboard Shortcuts (1-9 for Hotbar, B=Pencil, E=Eraser, I=Picker, G=Bucket, S=Select, F=Flip, Z=Undo, Y=Redo)
          window.addEventListener("keydown", event => {
            if (["INPUT", "TEXTAREA", "SELECT"].includes(document?.activeElement?.tagName)) return;

            // Player movement controls (Play Mode)
            if (player.active) {
              const k = event.key.toLowerCase();
              if (k === "a" || event.key === "ArrowLeft") {
                player.keys.left = true;
                event.preventDefault();
              } else if (k === "d" || event.key === "ArrowRight") {
                player.keys.right = true;
                event.preventDefault();
              } else if (k === "w" || event.key === "ArrowUp" || event.key === " ") {
                player.keys.up = true;
                player.keys.jump = true;
                event.preventDefault();
              } else if (k === "s" || event.key === "ArrowDown") {
                player.keys.down = true;
                event.preventDefault();
              } else if (k === "r") {
                respawnPlayer("Respawned at spawn door!");
                event.preventDefault();
              } else if (event.key === "Escape" || k === "p") {
                togglePlayMode(false);
                event.preventDefault();
              }
              return;
            }

            // Clipboard Shortcuts (Editor Mode)
            if (event.ctrlKey && event.key.toLowerCase() === "c") {
              event.preventDefault();
              copySelection();
              return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === "x") {
              event.preventDefault();
              cutSelection();
              return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === "v") {
              event.preventDefault();
              startPasteMode();
              return;
            }
            if ((event.key === "Delete" || event.key === "Backspace") && selection.active) {
              event.preventDefault();
              clearSelectionTiles();
              return;
            }

            // Number keys 1-9 for Hotbar
            if (event.key >= "1" && event.key <= "9") {
              const idx = parseInt(event.key, 10) - 1;
              if (idx < hotbar.length) {
                activeHotbarIndex = idx;
                onHotbarChange(hotbar, activeHotbarIndex);
                render();
              }
            } else if (event.key === "0") {
              activeHotbarIndex = 9;
              onHotbarChange(hotbar, activeHotbarIndex);
              render();
            }

            // Tool Keys
            if (event.key.toLowerCase() === "b") {
              setTool("pencil");
            } else if (event.key.toLowerCase() === "e") {
              setTool("eraser");
            } else if (event.key.toLowerCase() === "i") {
              setTool("picker");
            } else if (event.key.toLowerCase() === "g") {
              setTool("bucket");
            } else if (event.key.toLowerCase() === "f") {
              isFlipped = !isFlipped;
              onStatusMessage(`Flipped items: ${isFlipped ? "ON (Flipped)" : "OFF (Normal)"}`);
              render();
            } else if (event.key.toLowerCase() === "p" && !event.ctrlKey) {
              togglePlayMode();
            } else if (event.key.toLowerCase() === "m" && !event.ctrlKey) {
              toggleMusic();
            }

            // Undo / Redo
            if (event.ctrlKey && event.key.toLowerCase() === "z") {
              event.preventDefault();
              undo();
            } else if ((event.ctrlKey && event.key.toLowerCase() === "y") || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")) {
              event.preventDefault();
              redo();
            }
          });

          window.addEventListener("keyup", event => {
            if (player.active) {
              const k = event.key.toLowerCase();
              if (k === "a" || event.key === "ArrowLeft") player.keys.left = false;
              if (k === "d" || event.key === "ArrowRight") player.keys.right = false;
              if (k === "w" || event.key === "ArrowUp" || event.key === " ") {
                player.keys.up = false;
                player.keys.jump = false;
                player.jumpConsumed = false;
              }
              if (k === "s" || event.key === "ArrowDown") player.keys.down = false;
            }
          });
        }
      }

      function setTool(toolName) {
        activeTool = toolName;
        if (toolName !== "select") {
          selection.active = false;
        }
        onToolChange(activeTool);
        render();
      }

      function setWeather(weatherId) {
        const wObj = catalog.getWeatherById(weatherId);
        if (wObj) {
          pushUndoSnapshot("Change Weather");
          world.weather = wObj.id;
          world.weatherCode = wObj.code;
          loadWeatherImage(wObj.file).then(() => render());
          onWorldChange(world);
          onStatusMessage(`Weather set to: ${wObj.name}`);
        }
      }

      function clearSelectionTiles() {
        if (!selection.active) return;
        pushUndoSnapshot("Clear Selection");
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            eraseTile(x, y);
          }
        }
        render();
        onWorldChange(world);
      }

      function fillSelectionTiles(item) {
        if (!selection.active) return;
        pushUndoSnapshot("Fill Selection");
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            setTile(x, y, item);
          }
        }
        render();
        onWorldChange(world);
      }

      // ── Clipboard System (Copy, Cut, Paste, Mirror) ──
      function copySelection() {
        if (!selection.active) {
          onStatusMessage("No area selected to copy!");
          return false;
        }
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const total = w * h;

        clipboard.width = w;
        clipboard.height = h;
        clipboard.fg = new Uint16Array(total);
        clipboard.bg = new Uint16Array(total);
        clipboard.flags = new Uint8Array(total);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const worldIdx = (minY + y) * world.width + (minX + x);
            const clipIdx = y * w + x;
            clipboard.fg[clipIdx] = world.fg[worldIdx];
            clipboard.bg[clipIdx] = world.bg[worldIdx];
            clipboard.flags[clipIdx] = world.flags[worldIdx];
          }
        }

        clipboard.active = true;
        onStatusMessage(`📋 Copied ${w} × ${h} selection to clipboard!`);
        return true;
      }

      function cutSelection() {
        if (!selection.active) {
          onStatusMessage("No area selected to cut!");
          return false;
        }
        copySelection();
        pushUndoSnapshot("Cut Selection");
        clearSelectionTiles();
        onStatusMessage("✂️ Cut selection to clipboard!");
        return true;
      }

      function startPasteMode() {
        if (!clipboard.active || !clipboard.fg) {
          onStatusMessage("Clipboard is empty! Select an area and Copy first.");
          return false;
        }
        activeTool = "paste";
        selection.active = false;
        onToolChange("paste");
        render();
        onStatusMessage(`📑 Click on world map to paste (${clipboard.width} × ${clipboard.height})`);
        return true;
      }

      function pasteClipboardAt(targetX, targetY) {
        if (!clipboard.active || !clipboard.fg) return false;
        pushUndoSnapshot("Paste Selection");
        const w = clipboard.width;
        const h = clipboard.height;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const wx = targetX + x;
            const wy = targetY + y;
            if (wx >= 0 && wx < world.width && wy >= 0 && wy < world.height) {
              const worldIdx = wy * world.width + wx;
              const clipIdx = y * w + x;
              world.fg[worldIdx] = clipboard.fg[clipIdx];
              world.bg[worldIdx] = clipboard.bg[clipIdx];
              world.flags[worldIdx] = clipboard.flags[clipIdx];
            }
          }
        }

        render();
        onWorldChange(world);
        onStatusMessage(`Pasted ${w} × ${h} tiles at (${targetX}, ${targetY})!`);
        return true;
      }

      function flipClipboardHorizontal() {
        if (!clipboard.active || !clipboard.fg) return;
        const w = clipboard.width;
        const h = clipboard.height;
        const newFg = new Uint16Array(w * h);
        const newBg = new Uint16Array(w * h);
        const newFlags = new Uint8Array(w * h);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const oldIdx = y * w + x;
            const newIdx = y * w + (w - 1 - x);
            newFg[newIdx] = clipboard.fg[oldIdx];
            newBg[newIdx] = clipboard.bg[oldIdx];
            newFlags[newIdx] = clipboard.flags[oldIdx] ^ 1;
          }
        }

        clipboard.fg = newFg;
        clipboard.bg = newBg;
        clipboard.flags = newFlags;
        render();
        onStatusMessage("🪞 Mirrored clipboard horizontally!");
      }

      function flipClipboardVertical() {
        if (!clipboard.active || !clipboard.fg) return;
        const w = clipboard.width;
        const h = clipboard.height;
        const newFg = new Uint16Array(w * h);
        const newBg = new Uint16Array(w * h);
        const newFlags = new Uint8Array(w * h);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const oldIdx = y * w + x;
            const newIdx = (h - 1 - y) * w + x;
            newFg[newIdx] = clipboard.fg[oldIdx];
            newBg[newIdx] = clipboard.bg[oldIdx];
            newFlags[newIdx] = clipboard.flags[oldIdx];
          }
        }

        clipboard.fg = newFg;
        clipboard.bg = newBg;
        clipboard.flags = newFlags;
        render();
        onStatusMessage("🔃 Mirrored clipboard vertically!");
      }

      function flipSelectionHorizontal() {
        if (!selection.active) return false;
        copySelection();
        flipClipboardHorizontal();
        const minX = Math.min(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        pasteClipboardAt(minX, minY);
        return true;
      }

      function flipSelectionVertical() {
        if (!selection.active) return false;
        copySelection();
        flipClipboardVertical();
        const minX = Math.min(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        pasteClipboardAt(minX, minY);
        return true;
      }

      // ── Playable Avatar & Game Mode Tester (Live Physics) ──
      function isSolidBlock(item) {
        if (!item) return false;
        const name = (item.name || "").toLowerCase();
        const action = Number(item.action);
        // Non-solids: Air (0), Backgrounds (18), Platforms (21), Doors (1, 2), Signs (3), Main Door (6), Checkpoints (27), Music notes (28), Weather (81, 89)
        if ([0, 1, 2, 3, 6, 18, 21, 27, 28, 81, 89, 134].includes(action)) return false;
        if (name.includes("door") || name.includes("platform") || name.includes("sign") || name.includes("water") || name.includes("fire")) return false;
        return true;
      }

      function isPlatformBlock(item) {
        if (!item) return false;
        const name = (item.name || "").toLowerCase();
        return item.action === 21 || name.includes("platform") || name.includes("cloud") || name.includes("bridge") || name.includes("bannister") || name.includes("ledge");
      }

      function isHazardItem(item) {
        if (!item) return false;
        const name = (item.name || "").toLowerCase();
        return item.action === 16 || name.includes("lava") || name.includes("spike") || name.includes("hazard") || name.includes("death");
      }

      function findSpawnPosition() {
        for (let y = 0; y < world.height; y++) {
          for (let x = 0; x < world.width; x++) {
            const idx = y * world.width + x;
            if (world.fg[idx] === 6) { // Main Door
              return { x: x * TILE_SIZE + 6, y: y * TILE_SIZE + 4 };
            }
          }
        }
        return { x: Math.floor(world.width / 2) * TILE_SIZE + 6, y: 32 };
      }

      function respawnPlayer(msg) {
        player.x = player.respawnX;
        player.y = player.respawnY;
        player.vx = 0;
        player.vy = 0;
        player.isGrounded = false;
        player.jumpCount = 0;
        player.jumpConsumed = false;
        player.state = "idle";
        if (player.active) playSfx("punch", 1.0, 0.5);
        if (msg) onStatusMessage(msg);
      }

      function togglePlayMode(forceState) {
        player.active = typeof forceState === "boolean" ? forceState : !player.active;
        if (player.active) {
          const spawn = findSpawnPosition();
          player.respawnX = spawn.x;
          player.respawnY = spawn.y;
          player.x = spawn.x;
          player.y = spawn.y;
          player.vx = 0;
          player.vy = 0;
          player.isGrounded = false;
          player.jumpCount = 0;
          player.jumpConsumed = false;
          player.keys = { left: false, right: false, up: false, down: false, jump: false };
          activeTool = "preview";
          selection.active = false;
          onToolChange("preview");
          onStatusMessage("🎮 Game Mode Active! WASD/Arrows to run & jump (Double Jump enabled!), R to respawn, ESC to exit.");
        } else {
          activeTool = "pencil";
          onToolChange("pencil");
          onStatusMessage("🛠️ Returned to Builder Mode.");
        }
        render();
        return player.active;
      }

      function toggleModeratorMode(enable = null) {
        if (enable !== null) player.moderatorMode = Boolean(enable);
        else player.moderatorMode = !player.moderatorMode;

        if (player.moderatorMode) {
          player.vx = 0;
          player.vy = 0;
          if (player.active) playSfx("magic", 1.0, 0.6);
          onStatusMessage("🛡️ Moderator Mode Active! [NOCLIP & FREE FLY] WASD/Arrows to fly in all directions & pass through blocks! Press M to toggle.");
        } else {
          if (player.active) playSfx("switch", 1.1, 0.5);
          onStatusMessage("🛡️ Moderator Mode Disabled. Solid block collisions restored.");
        }

        if (typeof document !== "undefined" && typeof document.getElementById === "function") {
          const modBtn = document.getElementById("playmode-mod-btn");
          if (modBtn) {
            modBtn.textContent = player.moderatorMode ? "🛡️ Mod Mode: ON" : "🛡️ Mod Mode: OFF";
            modBtn.classList.toggle("active", player.moderatorMode);
            if (player.moderatorMode) {
              modBtn.style.borderColor = "#a855f7";
              modBtn.style.color = "#c084fc";
              modBtn.style.boxShadow = "0 0 10px rgba(168,85,247,0.5)";
            } else {
              modBtn.style.borderColor = "";
              modBtn.style.color = "";
              modBtn.style.boxShadow = "";
            }
          }
        }
        render();
        return player.moderatorMode;
      }

      function updatePlayerPhysics(dt) {
        if (!player.active) return;
        player.animTimer += dt;

        // Moderator Mode: Free 8-Way Flight & Noclip
        if (player.moderatorMode) {
          const modSpeed = 4.6;
          if (player.keys.left) {
            player.vx = -modSpeed;
            player.facing = -1;
            player.state = "walk";
          } else if (player.keys.right) {
            player.vx = modSpeed;
            player.facing = 1;
            player.state = "walk";
          } else {
            player.vx *= 0.82;
            if (Math.abs(player.vx) < 0.08) player.vx = 0;
            player.state = "idle";
          }

          if (player.keys.up || player.keys.jump) {
            player.vy = -modSpeed;
          } else if (player.keys.down) {
            player.vy = modSpeed;
          } else {
            player.vy *= 0.82;
            if (Math.abs(player.vy) < 0.08) player.vy = 0;
          }

          player.x += player.vx;
          player.y += player.vy;
          player.isGrounded = false;
          // Bypass solid and hazard collisions in Mod mode
        } else {
          // Normal Game Mode Physics

          // Horizontal Movement (Gentle, controlled walk speed: max 2.7)
          if (player.keys.left) {
            player.vx -= 0.60;
            player.facing = -1;
            if (player.isGrounded) player.state = "walk";
          } else if (player.keys.right) {
            player.vx += 0.60;
            player.facing = 1;
            if (player.isGrounded) player.state = "walk";
          } else {
            player.vx *= 0.80;
            if (Math.abs(player.vx) < 0.08) player.vx = 0;
            if (player.isGrounded) player.state = "idle";
          }

          // Max walk speed: 2.7 (-30% from 3.84)
          player.vx = Math.max(-2.7, Math.min(2.7, player.vx));

          // Jump & Double Jump (-40% jump speed & height: -6.1 and -5.6)
          const wantsJump = player.keys.jump || player.keys.up;
          if (wantsJump && !player.jumpConsumed) {
            if (player.isGrounded || player.jumpCount === 0) {
              player.vy = -6.1;
              player.isGrounded = false;
              player.jumpCount = 1;
              player.jumpConsumed = true;
              player.state = "jump";
              playJumpSound(false);
            } else if (player.jumpCount === 1) {
              player.vy = -5.6;
              player.jumpCount = 2;
              player.jumpConsumed = true;
              player.state = "jump";
              playJumpSound(true);
            }
          }

          // Floaty, Slow Gravity (-30% slower fall: 0.15, terminal velocity: 4.2)
          player.vy += 0.15;
          if (player.vy > 4.2) player.vy = 4.2;

          // Apply X movement and check collision
          player.x += player.vx;
          resolvePlayerCollisionX();

          // Apply Y movement and check collision
          player.y += player.vy;
          player.isGrounded = false;
          resolvePlayerCollisionY();
        }

        // World Bounds Check
        const worldPixelW = world.width * TILE_SIZE;
        const worldPixelH = world.height * TILE_SIZE;
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.width > worldPixelW) { player.x = worldPixelW - player.width; player.vx = 0; }
        if (player.y > worldPixelH + 120) {
          respawnPlayer("Fell into the void!");
        }

        // Camera Follow in Play Mode
        if (canvas) {
          const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
          const viewW = canvas.width / dpr;
          const viewH = canvas.height / dpr;
          const targetX = viewW / 2 - (player.x + player.width / 2) * viewport.zoom;
          const targetY = viewH / 2 - (player.y + player.height / 2) * viewport.zoom;
          viewport.x += (targetX - viewport.x) * 0.14;
          viewport.y += (targetY - viewport.y) * 0.14;
        }
      }

      function resolvePlayerCollisionX() {
        const minTileX = Math.floor(player.x / TILE_SIZE);
        const maxTileX = Math.floor((player.x + player.width) / TILE_SIZE);
        const minTileY = Math.floor(player.y / TILE_SIZE);
        const maxTileY = Math.floor((player.y + player.height - 1) / TILE_SIZE);

        for (let ty = minTileY; ty <= maxTileY; ty++) {
          for (let tx = minTileX; tx <= maxTileX; tx++) {
            if (tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) continue;
            const idx = ty * world.width + tx;
            const fgId = world.fg[idx];
            if (!fgId) continue;
            const item = getItem(fgId);
            if (!item) continue;

            if (isHazardItem(item)) {
              respawnPlayer(`Ouch! Hit ${item.name}!`);
              return;
            }

            if (isSolidBlock(item)) {
              if (player.vx > 0) {
                player.x = tx * TILE_SIZE - player.width - 0.01;
                player.vx = 0;
              } else if (player.vx < 0) {
                player.x = (tx + 1) * TILE_SIZE + 0.01;
                player.vx = 0;
              }
            }
          }
        }
      }

      function resolvePlayerCollisionY() {
        const minTileX = Math.floor((player.x + 2) / TILE_SIZE);
        const maxTileX = Math.floor((player.x + player.width - 2) / TILE_SIZE);
        const minTileY = Math.floor(player.y / TILE_SIZE);
        const maxTileY = Math.floor((player.y + player.height) / TILE_SIZE);

        for (let ty = minTileY; ty <= maxTileY; ty++) {
          for (let tx = minTileX; tx <= maxTileX; tx++) {
            if (tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) continue;
            const idx = ty * world.width + tx;
            const fgId = world.fg[idx];
            if (!fgId) continue;
            const item = getItem(fgId);
            if (!item) continue;

            if (isHazardItem(item)) {
              respawnPlayer(`Ouch! Hit ${item.name}!`);
              return;
            }

            const isSolid = isSolidBlock(item);
            const isPlatform = isPlatformBlock(item);

            if (isSolid) {
              if (player.vy > 0) {
                player.y = ty * TILE_SIZE - player.height;
                player.vy = 0;
                player.isGrounded = true;
                player.jumpCount = 0;
                player.jumpConsumed = false;
              } else if (player.vy < 0) {
                player.y = (ty + 1) * TILE_SIZE;
                player.vy = 0;
              }
            } else if (isPlatform && !player.keys.down) {
              const platTop = ty * TILE_SIZE;
              if (player.vy >= 0 && (player.y + player.height) <= platTop + 10 && (player.y + player.height) >= platTop - 6) {
                player.y = platTop - player.height;
                player.vy = 0;
                player.isGrounded = true;
                player.jumpCount = 0;
                player.jumpConsumed = false;
              }
            }
          }
        }
      }

      // ── Authentic Growtopia Avatar Sprite Engine ──
      const avatarSpriteParts = [
        "Base Set GT/Tangan Kanan.png",
        "Base Set GT/Kaki Kanan.png",
        "Base Set GT/Kaki Kiri.png",
        "Base Set GT/Body.png",
        "Base Set GT/Head utuh.png",
        "Base Set GT/Bola Mata.png",
        "Base Set GT/Pupil.png",
        "Base Set GT/Mulut.png",
        "Base Set GT/Tangan Kiri.png"
      ];

      const avatarTextureCache = new Map();
      let isAvatarTexturesLoading = false;

      function ensureAvatarSprites() {
        if (typeof Image === "undefined") return;
        if (avatarTextureCache.size >= avatarSpriteParts.length || isAvatarTexturesLoading) return;
        isAvatarTexturesLoading = true;
        avatarSpriteParts.forEach(path => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            avatarTextureCache.set(path, img);
            requestRender();
          };
          img.src = path;
          if (img.complete && img.naturalWidth > 0) {
            avatarTextureCache.set(path, img);
          }
        });
      }

      const spriteImageCache = new Map();
      function getSpriteImage(src) {
        if (spriteImageCache.has(src)) return spriteImageCache.get(src);
        if (typeof Image === "undefined") return null;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          spriteImageCache.set(src, img);
          requestRender();
        };
        img.src = src;
        if (img.complete && img.naturalWidth > 0) {
          spriteImageCache.set(src, img);
        }
        return img;
      }

      function drawPlayerAvatar(ctx) {
        ctx.save();
        const px = player.x;
        const py = player.y;
        const pw = player.width;
        const ph = player.height;

        // Shadow beneath player (Ground contact shadow)
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph + 1, pw * 0.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Moderator Mode Glowing Aura & Orbiting Sparkles
        if (player.moderatorMode) {
          ctx.save();
          const pulse = 0.6 + 0.3 * Math.sin(player.animTimer * 6);
          ctx.shadowColor = "#c084fc";
          ctx.shadowBlur = 14 * pulse;
          ctx.strokeStyle = "rgba(168, 85, 247, " + pulse + ")";
          ctx.lineWidth = 2.5 / viewport.zoom;
          ctx.beginPath();
          ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.85, ph * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();

          const sparkleCount = 4;
          for (let s = 0; s < sparkleCount; s++) {
            const sAngle = player.animTimer * 3 + (s * Math.PI * 2) / sparkleCount;
            const sx = px + pw / 2 + Math.cos(sAngle) * (pw * 0.9);
            const sy = py + ph / 2 + Math.sin(sAngle) * (ph * 0.65);
            ctx.fillStyle = s % 2 === 0 ? "#fde047" : "#00e5ff";
            ctx.beginPath();
            ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.translate(Math.round(px + pw / 2), Math.round(py + ph / 2));
        if (player.facing < 0) ctx.scale(-1, 1);
        if (player.moderatorMode) ctx.globalAlpha = 0.94;

        const isWalking = player.state === "walk";
        const isJumping = player.state === "jump" || !player.isGrounded;

        // Feet stay grounded; ONLY upper torso + head bob with breathing!
        const breatheBob = player.isGrounded ? Math.sin(player.animTimer * 4) * 0.75 : (isJumping ? -1.5 : 0);
        const stepBob = isWalking ? Math.abs(Math.sin(player.animTimer * 14)) * 0.8 : 0;
        const walkCycle = isWalking ? Math.sin(player.animTimer * 14) : 0;

        const skin = player.skinStyle || "classic";

        if (skin === "classic" || skin === "builder" || skin === "guardian") {
          // ── Fully Articulated Growtopia Base Set Character Engine ──
          ctx.imageSmoothingEnabled = false;

          const imgArmR = getSpriteImage("character_base_assets/gt_parts/arm_r.png");
          const imgArmL = getSpriteImage("character_base_assets/gt_parts/arm_l.png");
          const imgLegR = getSpriteImage("character_base_assets/gt_parts/leg_r.png");
          const imgLegL = getSpriteImage("character_base_assets/gt_parts/leg_l.png");
          const imgBody = getSpriteImage("character_base_assets/gt_parts/body.png");

          let headSrc = "character_base_assets/gt_parts/head.png";
          if (skin === "builder") headSrc = "character_base_assets/gt_parts/head_builder.png";
          const imgHead = getSpriteImage(headSrc);

          // 1. Guardian Wings (Behind Body)
          if (skin === "guardian") {
            const imgWings = getSpriteImage("character_base_assets/gt_parts/wings.png");
            if (imgWings && imgWings.complete && imgWings.naturalWidth > 0) {
              const wingFlap = Math.sin(player.animTimer * 10) * 0.2;
              ctx.save();
              ctx.translate(0, breatheBob - stepBob);
              ctx.rotate(wingFlap);
              ctx.drawImage(imgWings, -16, -16, 32, 32);
              ctx.restore();
            }
          }

          // 2. Back Arm (Tangan Kanan - Rotates around shoulder pivot at 8, 4)
          const backArmAngle = isJumping || player.moderatorMode ? -0.7 : (isWalking ? -Math.cos(player.animTimer * 14) * 0.5 : 0);
          ctx.save();
          ctx.translate(8, 4 + breatheBob - stepBob);
          ctx.rotate(backArmAngle);
          if (imgArmR && imgArmR.complete && imgArmR.naturalWidth > 0) {
            ctx.drawImage(imgArmR, -24, -20, 32, 32);
          }
          ctx.restore();

          // 3. Back Leg (Kaki Kanan - Hip joint at 8, 8, Feet stay on ground)
          const legRAngle = isWalking ? walkCycle * 0.4 : 0;
          ctx.save();
          ctx.translate(8, 8);
          ctx.rotate(legRAngle);
          if (imgLegR && imgLegR.complete && imgLegR.naturalWidth > 0) {
            ctx.drawImage(imgLegR, -24, -24, 32, 32);
          }
          ctx.restore();

          // 4. Front Leg (Kaki Kiri - Hip joint at -4, 8, Feet stay on ground)
          const legLAngle = isWalking ? -walkCycle * 0.4 : (isJumping ? -0.2 : 0);
          ctx.save();
          ctx.translate(-4, 8);
          ctx.rotate(legLAngle);
          if (imgLegL && imgLegL.complete && imgLegL.naturalWidth > 0) {
            ctx.drawImage(imgLegL, -12, -24, 32, 32);
          }
          ctx.restore();

          // 5. Torso / Body (Bobbing with breathing & step bounce)
          ctx.save();
          ctx.translate(0, breatheBob - stepBob);
          if (imgBody && imgBody.complete && imgBody.naturalWidth > 0) {
            ctx.drawImage(imgBody, -16, -16, 32, 32);
          }

          // 6. Head with Face & Clean Hair / Hard Hat (On top of body)
          if (imgHead && imgHead.complete && imgHead.naturalWidth > 0) {
            ctx.drawImage(imgHead, -16, -16, 32, 32);
          }
          ctx.restore();

          // 7. Front Arm (Tangan Kiri - Shoulder pivot at -7, 4, DRAWN ON TOP of shirt!)
          const frontArmAngle = isJumping || player.moderatorMode ? -0.6 : (isWalking ? Math.cos(player.animTimer * 14) * 0.5 : 0);
          ctx.save();
          ctx.translate(-7, 4 + breatheBob - stepBob);
          ctx.rotate(frontArmAngle);
          if (imgArmL && imgArmL.complete && imgArmL.naturalWidth > 0) {
            ctx.drawImage(imgArmL, -9, -20, 32, 32);
          }
          ctx.restore();
        } else {
          // ── Cartoon Chibi (Stylized HD Growtopian) ──
          const skinColor = "#f6b484";
          const darkSkin = "#d88b56";
          const legOffset = (isWalking ? Math.sin(player.animTimer * 14) : 0) * 3.5;

          // 1. Back Leg
          ctx.fillStyle = "#1e3a8a";
          ctx.fillRect(-6, 3 - legOffset, 5, 9 + legOffset);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-7, 12, 6, 2.5);
          ctx.fillStyle = "#1d4ed8";
          ctx.fillRect(-7, 13, 6, 1);

          // 2. Front Leg
          ctx.fillStyle = "#2563eb";
          ctx.fillRect(1, 3 + legOffset, 5, 9 - legOffset);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(1, 12, 6, 2.5);
          ctx.fillStyle = "#2563eb";
          ctx.fillRect(1, 13, 6, 1);

          // 3. Torso
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-8, -6 + breatheBob, 16, 10);
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(-6, -6 + breatheBob, 12, 2);
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(-8, 2 + breatheBob, 16, 2);
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(-2, 2 + breatheBob, 4, 2);

          // 4. Head & Shaded Hair
          ctx.fillStyle = skinColor;
          ctx.beginPath();
          ctx.arc(0, -12 + breatheBob, 8.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#452817";
          ctx.beginPath();
          ctx.arc(0, -14 + breatheBob, 8, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-8, -14 + breatheBob, 5, 3.5);
          ctx.fillStyle = "#784c2f";
          ctx.fillRect(-4, -17.5 + breatheBob, 5, 2);

          // 5. Expressive GT Eye & Smile
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(1, -15 + breatheBob, 5, 4.5);
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(3, -14 + breatheBob, 3, 2.5);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(4, -15 + breatheBob, 1.5, 1.5);
          ctx.fillStyle = "#452817";
          ctx.fillRect(1, -16.5 + breatheBob, 5, 1.2);
          ctx.fillStyle = "#833a1e";
          ctx.fillRect(2, -8.5 + breatheBob, 4, 1.2);
          ctx.fillStyle = "rgba(244, 114, 182, 0.4)";
          ctx.fillRect(-2, -9.5 + breatheBob, 3, 1.5);

          // 6. Arm
          const armAngle = isJumping || player.moderatorMode ? -0.8 : (isWalking ? Math.cos(player.animTimer * 14) * 0.6 : 0);
          ctx.save();
          ctx.translate(-2, -3 + breatheBob);
          ctx.rotate(armAngle);
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-2, 0, 5, 3.5);
          ctx.fillStyle = skinColor;
          ctx.fillRect(-2, 3.5, 4.5, 6);
          ctx.fillStyle = darkSkin;
          ctx.fillRect(1, 7.5, 2, 2);
          ctx.restore();
        }

        ctx.restore(); // Restore sprite transform

        // Growtopia Nametag ("Raey" with Flag Logo)
        drawPlayerNametag(ctx, px + pw / 2, py - 18);

        ctx.restore();
      }

      function drawPlayerNametag(ctx, centerX, topY) {
        ctx.save();
        const isMod = player.moderatorMode;
        const nameText = isMod ? "[MOD] Raey" : "Raey";
        ctx.font = "bold 10px 'Outfit', 'Inter', sans-serif";
        const textMetrics = ctx.measureText ? ctx.measureText(nameText) : { width: 30 };
        const textW = textMetrics.width || 30;

        const flagSize = 13;
        const paddingH = 6;
        const boxW = flagSize + 5 + textW + paddingH * 2;
        const boxH = 18;
        const boxX = centerX - boxW / 2;
        const boxY = topY - boxH;

        // Pill background
        ctx.fillStyle = "rgba(9, 13, 26, 0.88)";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(boxX, boxY, boxW, boxH, 5);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();

        // Border
        ctx.strokeStyle = isMod ? "#a855f7" : "rgba(56, 189, 248, 0.5)";
        ctx.lineWidth = 1.2 / viewport.zoom;
        if (isMod) {
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 6;
        }
        ctx.stroke();

        // Flag Logo (from photo 1)
        const flagX = boxX + paddingH;
        const flagY = boxY + (boxH - flagSize) / 2;
        if (flagLogoImg && flagLogoImg.complete && flagLogoImg.naturalWidth > 0) {
          ctx.drawImage(flagLogoImg, flagX, flagY, flagSize, flagSize);
        } else {
          ctx.strokeStyle = "#c084fc";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(flagX + flagSize / 2, flagY + flagSize / 2, flagSize / 2 - 1, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#fde047";
          ctx.fillRect(flagX + flagSize / 2 - 1, flagY + flagSize / 2 - 1, 2, 2);
        }

        // Nametag Text
        ctx.fillStyle = isMod ? "#c084fc" : "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        if (typeof ctx.fillText === "function") ctx.fillText(nameText, flagX + flagSize + 4, boxY + boxH - 5);

        ctx.restore();
      }

      // ── Audio Engine: SFX, BGM & Music Sheet Sequencer ──
      let bgmAudio = null;
      let isBgmActive = false;

      function getAudioContext() {
        if (!audioContext && typeof window !== "undefined") {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) audioContext = new AudioCtx();
        }
        if (audioContext && audioContext.state === "suspended") {
          audioContext.resume().catch(() => {});
        }
        return audioContext;
      }

      function playSfx(name, playbackRate = 1.0, volume = 0.6) {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        const key = `sfx_${name}`;
        const playBuffer = (buffer) => {
          try {
            const src = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = volume;
            src.buffer = buffer;
            src.playbackRate.value = playbackRate;
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start(0);
          } catch(e) {}
        };

        if (audioBufferCache.has(key)) {
          playBuffer(audioBufferCache.get(key));
          return;
        }

        const ext = (name.endsWith('.ogg') || name.endsWith('.wav')) ? '' : '.wav';
        fetch(`audio/${name}${ext}`)
          .then(r => r.arrayBuffer())
          .then(ab => ctx.decodeAudioData(ab))
          .then(buf => {
            audioBufferCache.set(key, buf);
            playBuffer(buf);
          })
          .catch(() => {});
      }

      function playJumpSound(isDoubleJump = false) {
        const ctx = getAudioContext();
        if (!ctx) return;

        // 1. Play authentic Growtopia jump sound sample
        playSfx("jump", isDoubleJump ? 1.28 : 1.0, 0.65);

        // 2. Play immediate synth chirp fallback for zero-latency response
        try {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const startF = isDoubleJump ? 380 : 250;
          const endF = isDoubleJump ? 600 : 440;
          osc.frequency.setValueAtTime(startF, now);
          osc.frequency.exponentialRampToValueAtTime(endF, now + 0.08);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
        } catch(e) {}
      }

      function startBgm() {
        if (typeof Audio !== "undefined") {
          if (!bgmAudio) {
            bgmAudio = new Audio("audio/theme.ogg");
            bgmAudio.loop = true;
            bgmAudio.volume = 0.4;
          }
          bgmAudio.play().catch(err => console.warn("BGM play error:", err));
          isBgmActive = true;
        }
      }

      function stopBgm() {
        if (bgmAudio) {
          bgmAudio.pause();
          bgmAudio.currentTime = 0;
          isBgmActive = false;
        }
      }

      async function loadNoteAudio(inst, pitch) {
        const key = `${inst}_${pitch}`;
        if (audioBufferCache.has(key)) return audioBufferCache.get(key);

        const ctx = getAudioContext();
        if (!ctx) return null;

        try {
          const res = await fetch(`audio/note_${inst}_${pitch}.wav`);
          if (!res.ok) {
            if (inst !== "piano") return loadNoteAudio("piano", pitch);
            return null;
          }
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          audioBufferCache.set(key, audioBuffer);
          return audioBuffer;
        } catch (e) {
          return null;
        }
      }

      function playNoteSound(inst, pitch) {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        // 1. Synthesize immediate note tone (zero latency)
        try {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          const baseFreq = inst === "bass" ? 65.41 : (inst === "flute" ? 261.63 : 130.81);
          const p = typeof pitch === "number" ? pitch : 12;
          const freq = baseFreq * Math.pow(2, p / 12);
          
          osc.type = inst === "drum" ? "square" : (inst === "bass" ? "sawtooth" : (inst === "flute" ? "sine" : "triangle"));
          osc.frequency.setValueAtTime(freq, now);
          
          const dur = inst === "drum" ? 0.08 : 0.32;
          gain.gain.setValueAtTime(inst === "drum" ? 0.35 : 0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + dur + 0.02);
        } catch(e) {}

        // 2. Play sample WAV buffer from audio folder
        const key = `${inst}_${pitch}`;
        const buffer = audioBufferCache.get(key);
        if (buffer) {
          try {
            const src = ctx.createBufferSource();
            const g = ctx.createGain();
            g.gain.value = 0.55;
            src.buffer = buffer;
            src.connect(g);
            g.connect(ctx.destination);
            src.start(0);
          } catch(e) {}
        } else {
          loadNoteAudio(inst, pitch).then(buf => {
            if (buf && ctx) {
              try {
                const src = ctx.createBufferSource();
                const g = ctx.createGain();
                g.gain.value = 0.55;
                src.buffer = buf;
                src.connect(g);
                g.connect(ctx.destination);
                src.start(0);
              } catch(e) {}
            }
          });
        }
      }

      function getNoteInstrument(item) {
        if (!item) return null;
        const name = (item.name || "").toLowerCase();
        const action = Number(item.action);
        if (action !== 28 && !name.includes("note") && !name.includes("piano") && !name.includes("music") && !name.includes("drum") && !name.includes("bass")) return null;

        if (name.includes("bass")) return "bass";
        if (name.includes("drum")) return "drum";
        if (name.includes("spooky")) return "spooky";
        if (name.includes("flute")) return "flute";
        if (name.includes("sax")) return "sax";
        if (name.includes("violin")) return "violin";
        if (name.includes("electric")) return "electric";
        if (name.includes("festive")) return "festive";
        if (name.includes("lyre")) return "lyre";
        if (name.includes("mexican")) return "mexican";
        if (name.includes("spanish")) return "spanish";
        return "piano";
      }

      function stepSequencer() {
        if (!sequencer.isPlaying) return;
        const col = sequencer.playheadX;

        for (let y = 0; y < world.height; y++) {
          const idx = y * world.width + col;
          const fgId = world.fg[idx];
          if (fgId > 0) {
            const item = getItem(fgId);
            const inst = getNoteInstrument(item);
            if (inst) {
              const pitch = Math.max(0, Math.min(25, 25 - (y % 26)));
              playNoteSound(inst, pitch);
            }
          }
        }

        sequencer.playheadX = (sequencer.playheadX + 1) % world.width;
        if (sequencer.playheadX === 0 && !sequencer.loop) {
          sequencer.isPlaying = false;
          if (sequencer.timer) {
            clearInterval(sequencer.timer);
            sequencer.timer = null;
          }
          onStatusMessage("Music finished playing.");
        }
        render();
      }

      function toggleMusic(forceState) {
        sequencer.isPlaying = typeof forceState === "boolean" ? forceState : !sequencer.isPlaying;
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});

        if (sequencer.isPlaying) {
          if (sequencer.timer) clearInterval(sequencer.timer);
          const intervalMs = Math.round(60000 / (sequencer.bpm * 2));
          sequencer.timer = setInterval(stepSequencer, intervalMs);
          onStatusMessage(`🎵 Music Sequencer Playing at ${sequencer.bpm} BPM...`);
        } else {
          if (sequencer.timer) {
            clearInterval(sequencer.timer);
            sequencer.timer = null;
          }
          onStatusMessage("⏹ Music Stopped.");
        }
        render();
        return sequencer.isPlaying;
      }

      function setMusicBpm(bpm) {
        sequencer.bpm = Math.max(60, Math.min(240, parseInt(bpm, 10) || 100));
        if (sequencer.isPlaying) {
          if (sequencer.timer) clearInterval(sequencer.timer);
          const intervalMs = Math.round(60000 / (sequencer.bpm * 2));
          sequencer.timer = setInterval(stepSequencer, intervalMs);
        }
        onStatusMessage(`BPM set to ${sequencer.bpm}`);
      }

      // Continuous Game & Physics Loop
      let lastGameTimestamp = 0;
      function gameLoop(timestamp) {
        if (!lastGameTimestamp) lastGameTimestamp = timestamp;
        const dt = Math.min((timestamp - lastGameTimestamp) / 1000, 0.1);
        lastGameTimestamp = timestamp;

        if (player.active) {
          updatePlayerPhysics(dt);
          render();
        }

        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(gameLoop);
        }
      }

      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(gameLoop);
      }

      function serializeWorldState() {
        return {
          format: "GT_WORLD_PLANNER",
          version: 1,
          savedAt: Date.now(),
          name: world.name || "World",
          width: world.width,
          height: world.height,
          weather: world.weather,
          weatherCode: world.weatherCode,
          fg: Array.from(world.fg),
          bg: Array.from(world.bg),
          flags: Array.from(world.flags),
          hotbar: hotbar.filter(Boolean).map(i => Number(i.id))
        };
      }

      function getStorage() {
        if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
        if (typeof localStorage !== "undefined") return localStorage;
        if (typeof global !== "undefined" && global.localStorage) return global.localStorage;
        return null;
      }

      let autosaveTimeout = null;
      function scheduleAutosave() {
        const storage = getStorage();
        if (!storage) return;
        if (autosaveTimeout) clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
          try {
            const data = serializeWorldState();
            storage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
          } catch (e) {
            console.warn("Autosave failed:", e);
          }
        }, 300);
      }

      function saveToLocalStorage() {
        const storage = getStorage();
        if (!storage) return false;
        try {
          const data = serializeWorldState();
          storage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
          return true;
        } catch (e) {
          console.warn("Manual save to localStorage failed:", e);
          return false;
        }
      }

      function loadFromLocalStorage() {
        const storage = getStorage();
        if (!storage) return false;
        try {
          const raw = storage.getItem(AUTOSAVE_KEY);
          if (!raw) return false;
          const payload = JSON.parse(raw);
          if (!payload || !payload.width || !payload.height || !Array.isArray(payload.fg)) return false;

          const total = payload.width * payload.height;
          world = {
            width: payload.width,
            height: payload.height,
            name: payload.name || "World",
            weather: payload.weather || "SUNNY",
            weatherCode: payload.weatherCode || 1,
            fg: new Uint16Array(payload.fg.slice(0, total)),
            bg: new Uint16Array(payload.bg ? payload.bg.slice(0, total) : total),
            flags: new Uint8Array(payload.flags ? payload.flags.slice(0, total) : total)
          };

          if (Array.isArray(payload.hotbar)) {
            payload.hotbar.forEach((id, idx) => {
              if (idx < hotbar.length && id) {
                hotbar[idx] = getItem(id) || hotbar[idx];
              }
            });
            onHotbarChange(hotbar, activeHotbarIndex);
          }

          centerViewport();
          render();
          externalOnWorldChange(world);
          return true;
        } catch (e) {
          console.warn("Load autosave failed:", e);
          return false;
        }
      }

      function createCustomWorld(width, height, preset = "standard", name = "World") {
        width = Math.max(10, Math.min(200, parseInt(width, 10) || 100));
        height = Math.max(10, Math.min(200, parseInt(height, 10) || 60));
        pushUndoSnapshot(`New Custom World (${width}x${height})`);

        if (preset === "blank") {
          world = catalog.createBlankWorld(width, height);
        } else if (preset === "flat") {
          world = catalog.createFlatWorld(width, height);
        } else {
          world = catalog.createStandardWorld(width, height);
        }
        world.name = name || "World";

        centerViewport();
        render();
        onWorldChange(world);
        onStatusMessage(`Created ${preset} world (${width} × ${height})!`);
      }

      function loadPreset(presetName) {
        pushUndoSnapshot(`New ${presetName}`);
        if (presetName === "blank") {
          world = catalog.createBlankWorld(world.width, world.height);
        } else if (presetName === "flat") {
          world = catalog.createFlatWorld(world.width, world.height);
        } else {
          world = catalog.createStandardWorld(world.width, world.height);
        }
        centerViewport();
        render();
        onWorldChange(world);
      }

      return {
        init: () => {
          setupEventHandlers();
          centerViewport();
        },
        render,
        setTool,
        getTool: () => activeTool,
        setWeather,
        getWeather: () => world.weather,
        setHotbarItem: (index, item) => {
          if (index >= 0 && index < hotbar.length) {
            hotbar[index] = item;
            onHotbarChange(hotbar, activeHotbarIndex);
          }
        },
        setActiveHotbarIndex: index => {
          if (index >= 0 && index < hotbar.length) {
            activeHotbarIndex = index;
            onHotbarChange(hotbar, activeHotbarIndex);
            render();
          }
        },
        getHotbar: () => [...hotbar],
        getActiveHotbarIndex: () => activeHotbarIndex,
        toggleFlip: () => {
          isFlipped = !isFlipped;
          render();
          return isFlipped;
        },
        isFlipped: () => isFlipped,
        toggleGrid: () => {
          showGrid = !showGrid;
          render();
          return showGrid;
        },
        toggleMinimap: () => {
          showMinimap = !showMinimap;
          render();
          return showMinimap;
        },
        zoomIn: () => {
          const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
          const mouseX = (rect.width || 800) / 2;
          const mouseY = (rect.height || 600) / 2;
          const newZoom = Math.min(viewport.maxZoom, viewport.zoom * 1.25);
          viewport.x = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
          viewport.y = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);
          viewport.zoom = newZoom;
          render();
        },
        zoomOut: () => {
          const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
          const mouseX = (rect.width || 800) / 2;
          const mouseY = (rect.height || 600) / 2;
          const newZoom = Math.max(viewport.minZoom, viewport.zoom * 0.8);
          viewport.x = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
          viewport.y = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);
          viewport.zoom = newZoom;
          render();
        },
        resetZoom: centerViewport,
        centerViewport,
        resize: resizeCanvas,
        reloadItems,
        undo,
        redo,
        clearSelectionTiles,
        fillSelectionTiles,
        getSelection: () => ({ ...selection }),
        setSelection: (selObj) => {
          if (selObj) {
            Object.assign(selection, selObj);
            render();
          }
        },
        copySelection,
        cutSelection,
        startPasteMode,
        pasteClipboardAt,
        flipClipboardHorizontal,
        flipClipboardVertical,
        flipSelectionHorizontal,
        flipSelectionVertical,
        getClipboard: () => ({ ...clipboard }),
        togglePlayMode,
        isPlayMode: () => player.active,
        toggleModeratorMode,
        isModeratorMode: () => player.moderatorMode,
        setPlayerSkin: (skinName) => {
          player.skinStyle = skinName;
          if (typeof localStorage !== "undefined") {
            try { localStorage.setItem("gt_world_player_skin", skinName); } catch(e) {}
          }
          render();
        },
        getPlayerSkin: () => player.skinStyle || "cartoon",
        setPlayerKey: (key, isPressed) => {
          if (player.keys[key] !== undefined) {
            player.keys[key] = Boolean(isPressed);
            if (key === "jump" && isPressed) {
              if (!player.jumpConsumed) {
                if (player.isGrounded || player.jumpCount === 0) {
                  player.vy = -6.1;
                  player.isGrounded = false;
                  player.jumpCount = 1;
                  player.jumpConsumed = true;
                  player.state = "jump";
                  playJumpSound(false);
                } else if (player.jumpCount === 1) {
                  player.vy = -5.6;
                  player.jumpCount = 2;
                  player.jumpConsumed = true;
                  player.state = "jump";
                  playJumpSound(true);
                }
              }
            } else if (key === "jump" && !isPressed) {
              player.jumpConsumed = false;
            }
          }
        },
        spawnBlockPlaceEffect,
        respawnPlayer,
        toggleMusic,
        setMusicBpm,
        getMusicState: () => ({ ...sequencer }),
        loadPreset,
        createCustomWorld,
        saveToLocalStorage,
        loadFromLocalStorage,
        exportToDAT,
        importFromDAT,
        exportToJSON,
        importFromJSON,
        exportToPNG,
        getWorldState: () => world
      };
    }

    return Object.freeze({
      createEngine
    });
  }
);
