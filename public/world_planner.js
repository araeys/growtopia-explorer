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
 catalog = (typeof GTWorldCatalog !== "undefined" ? GTWorldCatalog : (typeof window !== "undefined" ? window.GTWorldCatalog : null)),
 autotile = (typeof GTAutotile !== "undefined" ? GTAutotile : (typeof window !== "undefined" ? window.GTAutotile : null)),
 lzString = (typeof LZString !== "undefined" ? LZString : (typeof window !== "undefined" ? window.LZString : null)),
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
 maxZoom: 8.0
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

 // Shape Dragging State (Line, Box, Filled Box, Circle, Filled Circle)
 let isShapeDragging = false;
 let shapeStartTile = null;
 let shapeCurrentTile = null;

 // Block Placement Pop & Particle Effects
 const activeBlockEffects = [];
 const activeParticles = [];
 const gameParticles = [];
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
 skinStyle: (typeof localStorage !== "undefined" && localStorage.getItem("gt_world_player_skin")) || "classic",
 punchTimer: 0,
 punchTargetX: 0,
 punchTargetY: 0,
 stepParticleTimer: 0,
 landingSquashTimer: 0,
 modTransformTimer: 0,
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

 // Settings State
 let cameraShakeEnabled = true;
 try {
 const savedShake = localStorage.getItem("gt_camera_shake_enabled");
 if (savedShake !== null) cameraShakeEnabled = (savedShake === "true");
 } catch(e) {}

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
 paint: world.paint ? new Uint16Array(world.paint) : new Uint16Array(world.fg.length),
 flags: new Uint8Array(world.flags)
 });
 redoStack.length = 0;
 }

 function undo() {
 if (!undoStack.length) return false;
 redoStack.push({
 fg: new Uint16Array(world.fg),
 bg: new Uint16Array(world.bg),
 paint: world.paint ? new Uint16Array(world.paint) : new Uint16Array(world.fg.length),
 flags: new Uint8Array(world.flags)
 });
 const prev = undoStack.pop();
 world.fg.set(prev.fg);
 world.bg.set(prev.bg);
 if (!world.paint) world.paint = new Uint16Array(world.fg.length);
 if (prev.paint) world.paint.set(prev.paint);
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
 paint: world.paint ? new Uint16Array(world.paint) : new Uint16Array(world.fg.length),
 flags: new Uint8Array(world.flags)
 });
 const next = redoStack.pop();
 world.fg.set(next.fg);
 world.bg.set(next.bg);
 if (!world.paint) world.paint = new Uint16Array(world.fg.length);
 if (next.paint) world.paint.set(next.paint);
 world.flags.set(next.flags);
 render();
 onWorldChange(world);
 return true;
 }

 function getTileIndex(x, y) {
 if (x < 0 || x >= world.width || y < 0 || y >= world.height) return -1;
 return y * world.width + x;
 }

 // Dynamic World Particle System (Footstep dust, block hits, death burst, respawn rings)
 function spawnFootstepDust(x, y, facing, isSkid = false) {
 const count = isSkid ? 5 : 3;
 for (let i = 0; i < count; i++) {
 const baseRadius = isSkid ? (2.8 + Math.random() * 2.2) : (2.0 + Math.random() * 2.0);
 const lifeTime = isSkid ? (0.35 + Math.random() * 0.12) : (0.28 + Math.random() * 0.10);
 const speedMul = isSkid ? 2.2 : 1.2;
 gameParticles.push({
 type: "dust",
 x: x + (Math.random() - 0.5) * (isSkid ? 8 : 5),
 y: y - 1 + (Math.random() - 0.5) * 2,
 vx: -facing * (0.8 + Math.random() * 1.5 * speedMul),
 vy: -(0.5 + Math.random() * 1.0 * (isSkid ? 1.5 : 1.0)),
 radius: baseRadius,
 color: Math.random() > 0.4 ? "#ffffff" : "#f1f5f9",
 borderColor: "rgba(148, 163, 184, 0.40)",
 life: lifeTime,
 maxLife: lifeTime
 });
 }
 }

 function spawnLandingDust(x, y) {
 for (let i = 0; i < 8; i++) {
 const side = (i % 2 === 0) ? 1 : -1;
 const lifeTime = 0.36 + Math.random() * 0.14;
 const baseRadius = 2.6 + Math.random() * 2.6;
 gameParticles.push({
 type: "dust",
 x: x + side * (Math.random() * 7),
 y: y - 1,
 vx: side * (1.2 + Math.random() * 2.2),
 vy: -(0.6 + Math.random() * 1.2),
 radius: baseRadius,
 color: Math.random() > 0.35 ? "#ffffff" : "#f8fafc",
 borderColor: "rgba(148, 163, 184, 0.45)",
 life: lifeTime,
 maxLife: lifeTime
 });
 }
 }

 function spawnDeathParticles(x, y) {
 // 1. Popping & Floating Heart Particles (Smooth Fountain Burst)
 for (let i = 0; i < 16; i++) {
 const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.5;
 const speed = 2.0 + Math.random() * 4.2;
 const lifeTime = 0.75 + Math.random() * 0.35;
 const randImg = deathHeartImages[Math.floor(Math.random() * deathHeartImages.length)];
 gameParticles.push({
 type: "heart",
 src: randImg,
 x: x + (Math.random() - 0.5) * 6,
 y: y + (Math.random() - 0.5) * 6,
 vx: Math.cos(angle) * speed,
 vy: Math.sin(angle) * speed - 1.2,
 rot: (Math.random() - 0.5) * 0.6,
 rotSpeed: (Math.random() - 0.5) * 3.5,
 scale: 0.75 + Math.random() * 0.40,
 life: lifeTime,
 maxLife: lifeTime
 });
 }

 // 2. Rising Ghost Soul Wisps (6 particles)
 for (let i = 0; i < 6; i++) {
 const lifeTime = 0.75 + Math.random() * 0.25;
 gameParticles.push({
 type: "soul",
 x: x + (Math.random() - 0.5) * 12,
 y: y - 4,
 vx: (Math.random() - 0.5) * 0.8,
 vy: -(1.2 + Math.random() * 1.5),
 radius: 3.5 + Math.random() * 2.5,
 color: "#e0f2fe",
 borderColor: "rgba(56, 189, 248, 0.4)",
 life: lifeTime,
 maxLife: lifeTime
 });
 }

 // 3. Expanding Fiery Shockwave Ring
 gameParticles.push({
 type: "ring",
 x: x,
 y: y,
 vx: 0,
 vy: 0,
 radius: 6,
 maxRadius: 36,
 color: "#f87171",
 borderColor: "#ef4444",
 life: 0.45,
 maxLife: 0.45
 });
 }

 function spawnModTransformParticles(x, y) {
 // 1. Lightweight Electrical Sparks (12 particles, zero GPU stall)
 for (let i = 0; i < 12; i++) {
 const angle = Math.random() * Math.PI * 2;
 const speed = 2.0 + Math.random() * 4.5;
 const lifeTime = 0.45 + Math.random() * 0.15;
 gameParticles.push({
 type: "dust",
 x: x,
 y: y,
 vx: Math.cos(angle) * speed,
 vy: Math.sin(angle) * speed - 1.0,
 radius: 2.2 + Math.random() * 2.0,
 color: Math.random() > 0.5 ? "#c084fc" : (Math.random() > 0.5 ? "#38bdf8" : "#ffffff"),
 borderColor: "rgba(192, 132, 252, 0.4)",
 life: lifeTime,
 maxLife: lifeTime
 });
 }

 // 2. Single Expanding Power Ring
 gameParticles.push({
 type: "ring",
 x: x,
 y: y,
 vx: 0,
 vy: 0,
 radius: 6,
 maxRadius: 40,
 color: "#c084fc",
 borderColor: "#a855f7",
 life: 0.42,
 maxLife: 0.42
 });
 }

 function spawnTileBreakParticle(tx, ty) {
 const worldX = (tx + 0.5) * TILE_SIZE;
 const worldY = (ty + 0.5) * TILE_SIZE;

 // Anti-lag throttling: Limit max concurrent break sequence particles to 24
 let breakCount = 0;
 for (let i = 0; i < gameParticles.length; i++) {
 if (gameParticles[i].type === "break_seq") breakCount++;
 }
 if (breakCount >= 24) {
 for (let i = 0; i < gameParticles.length; i++) {
 if (gameParticles[i].type === "break_seq") {
 gameParticles.splice(i, 1);
 break;
 }
 }
 }

 const lifeTime = 0.42; // 0.42s total duration for 10 frames (~42ms per frame)
 gameParticles.push({
 type: "break_seq",
 x: worldX,
 y: worldY,
 vx: 0,
 vy: 0,
 life: lifeTime,
 maxLife: lifeTime
 });
 requestRender();
 }

 function updateAndDrawParticles(ctx, dt) {
 for (let i = gameParticles.length - 1; i >= 0; i--) {
 const p = gameParticles[i];
 p.life -= dt;
 if (p.life <= 0) {
 gameParticles.splice(i, 1);
 continue;
 }

 if (p.type === "break_seq") {
 const frameProgress = 1.0 - (p.life / p.maxLife);
 const frameIdx = Math.min(9, Math.max(0, Math.floor(frameProgress * 10)));
 const frameSrc = breakParticleFrames[frameIdx];
 const img = getSpriteImage(frameSrc);
 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 ctx.drawImage(img, p.x - 21, p.y - 21, 42, 42);
 ctx.restore();
 }
 continue;
 }

 if (p.type === "heart") {
 p.x += p.vx;
 p.y += p.vy;
 // Smooth buoyant physics (burst outward, decelerate, and gently float upwards)
 p.vx *= 0.93;
 p.vy = p.vy * 0.92 - 0.06;
 p.rot = (p.rot || 0) + (p.rotSpeed || 0) * dt;

 const progress = 1.0 - (p.life / p.maxLife);
 // Smooth pop in and fade out
 const baseAlpha = progress < 0.15 ? (progress / 0.15) : Math.max(0, 1.0 - Math.pow((progress - 0.15) / 0.85, 1.6));
 // Silky smooth sinusoidal strobe flicker (Never drops frames!)
 const flicker = 0.60 + 0.40 * Math.sin((p.maxLife - p.life) * 26);
 const alpha = Math.max(0, Math.min(1, baseAlpha * flicker));

 const img = getSpriteImage(p.src);
 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 ctx.globalAlpha = alpha;
 ctx.translate(p.x, p.y);
 ctx.rotate(p.rot);
 // Pop scale curve
 const popScale = p.scale * (progress < 0.2 ? (0.4 + (progress / 0.2) * 0.7) : (1.1 - (progress - 0.2) * 0.3));
 ctx.scale(popScale, popScale);
 ctx.drawImage(img, -10, -10, 20, 20);
 ctx.restore();
 }
 continue;
 }

 if (p.type === "purple_sparkle") {
 p.x += p.vx;
 p.y += p.vy;
 const progress = 1.0 - (p.life / p.maxLife);
 const frameIdx = Math.min(5, Math.max(0, Math.floor(progress * 6)));
 const frameSrc = purpleSparkleFrames[frameIdx];
 const img = getSpriteImage(frameSrc);

 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 const alpha = progress < 0.2 ? (progress / 0.2) : Math.max(0, 1.0 - (progress - 0.2) / 0.8);
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
 ctx.shadowColor = "#c084fc";
 ctx.shadowBlur = 8 * p.scale;
 ctx.translate(p.x, p.y);
 ctx.scale(p.scale, p.scale);
 ctx.drawImage(img, -10, -10, 20, 20);
 ctx.restore();
 }
 continue;
 }

 if (p.type === "dance_note") {
 p.x += p.vx + Math.sin((p.maxLife - p.life) * 8) * 0.45;
 p.y += p.vy;
 p.vx *= 0.96;
 p.vy *= 0.98;
 p.rot = (p.rot || 0) + (p.rotSpeed || 0) * dt;

 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = progress < 0.15 ? (progress / 0.15) : Math.max(0, 1.0 - (progress - 0.15) / 0.85);
 const img = getSpriteImage(p.src);

 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = true;
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.95));
 ctx.translate(p.x, p.y);
 ctx.rotate(p.rot);
 const popScale = p.scale * (0.8 + Math.sin(progress * Math.PI) * 0.45);
 ctx.scale(popScale, popScale);
 ctx.shadowColor = "#fde047";
 ctx.shadowBlur = 8;
 ctx.drawImage(img, -10, -10, 20, 20);
 ctx.restore();
 }
 continue;
 }

 if (p.type === "anger_fume") {
 p.x += p.vx;
 p.y += p.vy;
 p.vy -= 0.06;
 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = Math.sin(progress * Math.PI) * 0.70;
 ctx.save();
 ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
 ctx.shadowColor = "#dc2626";
 ctx.shadowBlur = 5;
 ctx.beginPath();
 ctx.arc(p.x, p.y, (p.radius || 2.5) * (0.8 + progress * 0.6), 0, Math.PI * 2);
 ctx.fill();
 ctx.restore();
 continue;
 }

 if (p.type === "cheer_star") {
 p.x += p.vx;
 p.y += p.vy;
 p.vy += 0.05; // light gravity on confetti
 p.rot = (p.rot || 0) + (p.rotSpeed || 0) * dt;
 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = Math.sin(progress * Math.PI);
 ctx.save();
 ctx.fillStyle = p.color || "#facc15";
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
 ctx.shadowColor = p.color || "#facc15";
 ctx.shadowBlur = 4;
 ctx.translate(p.x, p.y);
 ctx.rotate(p.rot);
 const sz = (p.size || 3.0) * (0.8 + progress * 0.4);
 ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
 ctx.restore();
 continue;
 }

 if (p.type === "floating_text") {
 p.x += p.vx;
 p.y += p.vy;
 p.vy *= 0.96;
 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = progress < 0.15 ? (progress / 0.15) : Math.max(0, 1.0 - Math.pow((progress - 0.15) / 0.85, 1.5));
 ctx.save();
 ctx.font = "bold 13px 'Segoe UI', sans-serif";
 ctx.textAlign = "center";
 ctx.textBaseline = "middle";
 ctx.fillStyle = p.color || "#fde047";
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
 ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
 ctx.shadowBlur = 4;
 if (typeof ctx.fillText === "function") {
 ctx.fillText(p.text || "", p.x, p.y);
 }
 ctx.restore();
 continue;
 }

 if (p.type === "wind_breeze") {
 p.x += p.vx;
 p.y += p.vy;
 p.vx *= 0.94;
 p.vy *= 0.96;
 p.rot = (p.rot || 0) + (p.rotSpeed || 0) * dt;

 const progress = 1.0 - (p.life / p.maxLife);
 const frameIdx = Math.min(2, Math.floor(progress * 3));
 const frameSrc = windMoveFrames[frameIdx];
 const img = getSpriteImage(frameSrc);

 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = true;
 const alpha = Math.sin(progress * Math.PI) * 0.16;
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
 ctx.translate(p.x, p.y);
 ctx.rotate(p.rot);
 const curScale = p.scale * (0.80 + progress * 0.40);
 ctx.scale(curScale, curScale);
 ctx.drawImage(img, -14, -14, 28, 28);
 ctx.restore();
 }
 continue;
 }

 if (p.type === "wind_streak") {
 p.x += p.vx;
 p.y += p.vy;
 p.vx *= 0.97;
 p.vy *= 0.97;
 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = Math.sin(progress * Math.PI) * (p.baseAlpha || 0.22);
 if (alpha > 0.005) {
 ctx.save();
 const dir = p.dir || 1;
 const tailLen = p.length * (0.6 + 0.4 * Math.sin(progress * Math.PI));
 const headX = p.x;
 const tailX = p.x - tailLen * dir;
 const headY = p.y;
 const tailY = p.y + (p.vy * 3);

 const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
 grad.addColorStop(0, "rgba(240, 249, 255, 0)");
 grad.addColorStop(0.5, p.color || "rgba(224, 242, 254, 0.55)");
 grad.addColorStop(1, "rgba(255, 255, 255, 0.75)");

 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
 ctx.strokeStyle = grad;
 ctx.lineWidth = p.lineWidth || 1.1;
 ctx.lineCap = "round";
 ctx.beginPath();
 const midX = (tailX + headX) / 2;
 const midY = (tailY + headY) / 2 + Math.sin((p.waveOffset || 0) + progress * Math.PI * 1.5) * 1.0;
 ctx.moveTo(tailX, tailY);
 ctx.quadraticCurveTo(midX, midY, headX, headY);
 ctx.stroke();
 ctx.restore();
 }
 continue;
 }

 p.x += p.vx;
 p.y += p.vy;

 if (p.type === "dust") {
 p.vx *= 0.88; // horizontal air drag
 p.vy = p.vy * 0.90 - 0.05; // buoyant gentle lift
 } else if (p.type === "soul") {
 p.vx = Math.sin(p.life * 10) * 0.6; // gentle sine wave float
 p.vy *= 0.96;
 } else if (p.type === "ring") {
 p.radius += (p.maxRadius - p.radius) * 0.15;
 } else {
 p.vx *= 0.94;
 p.vy += 0.18; // gravity on debris
 }

 const progress = 1.0 - (p.life / p.maxLife);
 const alpha = Math.max(0, 1.0 - Math.pow(progress, 1.4));

 ctx.save();
 ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

 if (p.type === "ring") {
 ctx.strokeStyle = p.color;
 ctx.lineWidth = Math.max(1, 3.5 * (1.0 - progress));
 ctx.beginPath();
 ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
 ctx.stroke();
 } else {
 // Puffy pop & dissipate scale curve
 let scale = 1.0;
 if (progress < 0.22) {
 scale = 0.4 + (progress / 0.22) * 0.85;
 } else {
 scale = 1.25 - ((progress - 0.22) / 0.78) * 0.5;
 }
 const currentRadius = Math.max(0.6, p.radius * scale);

 if (p.borderColor && currentRadius > 1.8) {
 ctx.fillStyle = p.borderColor;
 ctx.beginPath();
 ctx.arc(p.x, p.y + 0.5, currentRadius + 0.5, 0, Math.PI * 2);
 ctx.fill();
 }

 ctx.fillStyle = p.color || "#ffffff";
 ctx.beginPath();
 ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
 ctx.fill();
 }
 ctx.restore();
 }
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

 // Special Paint Bucket handling: Paints tile overlay with semi-transparent color tint
 if (item && catalog.isPaintItem(item)) {
 if (!world.paint) world.paint = new Uint16Array(world.width * world.height);
 const col = catalog.getPaintColor(item);
 if (col === null) {
 // Varnish clears paint on this tile
 world.paint[idx] = 0;
 } else {
 world.paint[idx] = Number(item.id);
 }
 if (player.active) {
 triggerPlayerPlace(x, y);
 }
 spawnTileBreakParticle(x, y);
 playSfx("pop", 1.15 + Math.random() * 0.20, 0.50);
 return true;
 }

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
 if (item) {
 if (player.active) {
 triggerPlayerPlace(x, y);
 spawnBlockPlaceEffect(x, y, item);
 }
 spawnTileBreakParticle(x, y);
 playSfx("pop", 0.95 + Math.random() * 0.15, 0.50);
 }
 return true;
 }

 function eraseTile(x, y) {
 const idx = getTileIndex(x, y);
 if (idx === -1) return false;
 const hadTile = world.fg[idx] !== 0 || world.bg[idx] !== 0 || (world.paint && world.paint[idx] !== 0);
 if (!hadTile) return false;

 if (player.active) {
 triggerPlayerPunch(x, y);
 }
 spawnTileBreakParticle(x, y);
 if (world.paint && world.paint[idx] !== 0) {
 world.paint[idx] = 0;
 }
 if (world.fg[idx] !== 0) {
 world.fg[idx] = 0;
 world.flags[idx] = 0;
 } else if (world.bg[idx] !== 0) {
 world.bg[idx] = 0;
 }
 playSfx("rock_destroy", 0.95 + Math.random() * 0.15, 0.75);
 return true;
 }

 function spawnFloatingText(tileX, tileY, text, color = "#fde047") {
 const px = tileX * TILE_SIZE + TILE_SIZE / 2;
 const py = tileY * TILE_SIZE;
 gameParticles.push({
 type: "floating_text",
 x: px,
 y: py,
 vx: 0,
 vy: -0.9,
 text,
 color,
 life: 1.1,
 maxLife: 1.1
 });
 }

 function spawnPunchImpactEffect(tileX, tileY) {
 const px = tileX * TILE_SIZE + TILE_SIZE / 2;
 const py = tileY * TILE_SIZE + TILE_SIZE / 2;

 // Expanding shockwave punch ring
 gameParticles.push({
 type: "ring",
 x: px,
 y: py,
 vx: 0,
 vy: 0,
 radius: 4,
 maxRadius: 22,
 color: "#f87171",
 borderColor: "#ef4444",
 life: 0.25,
 maxLife: 0.25
 });

 // Punch impact sparks
 for (let i = 0; i < 4; i++) {
 const angle = Math.random() * Math.PI * 2;
 const spd = 1.5 + Math.random() * 2.5;
 gameParticles.push({
 type: "dust",
 x: px + (Math.random() - 0.5) * 6,
 y: py + (Math.random() - 0.5) * 6,
 vx: Math.cos(angle) * spd,
 vy: Math.sin(angle) * spd,
 radius: 2 + Math.random() * 1.5,
 color: "#fb7185",
 borderColor: "#e11d48",
 life: 0.22,
 maxLife: 0.22
 });
 }
 }

 function punchInteract(tileX, tileY, preciseWorldX, preciseWorldY) {
 const idx = getTileIndex(tileX, tileY);
 if (idx === -1) return false;

 const fgId = world.fg[idx];
 const bgId = world.bg[idx];
 const fgItem = fgId > 0 ? getItem(fgId) : null;
 const fgName = (fgItem?.name || "").toLowerCase();

 // 1. Interactive Dice / Roulette / Roshambo (Action 36 / Dice blocks)
 if (fgItem && (fgItem.action === 36 || fgName.includes("dice") || fgName.includes("roulette") || fgName.includes("roshambo"))) {
 if (player.active) triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 else playPunchSound(tileX, tileY);
 spawnPunchImpactEffect(tileX, tileY);
 const isRoulette = fgName.includes("roulette");
 const rollVal = isRoulette ? Math.floor(Math.random() * 37) : (Math.floor(Math.random() * 6) + 1);
 playSfx("magic", 1.2, 0.7);
 spawnFloatingText(tileX, tileY, isRoulette ? ` [ ${rollVal} ]` : ` [ ${rollVal} ]`, "#fde047");
 onStatusMessage(` ${fgItem.name} rolled: ${rollVal}!`);
 return true;
 }

 // 2. Weather Machines (Action 41 / 81 / 89 / 134)
 if (fgItem && [41, 81, 89, 134].includes(fgItem.action)) {
 if (player.active) triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 else playPunchSound(tileX, tileY);
 spawnPunchImpactEffect(tileX, tileY);
 const matchedWeather = catalog.getWeathers().find(w => fgName.includes(w.id.toLowerCase()) || fgName.includes(w.name.toLowerCase()));
 if (matchedWeather) {
 setWeather(matchedWeather.id);
 playSfx("magic", 1.1, 0.8);
 spawnFloatingText(tileX, tileY, ` ${matchedWeather.name}`, "#38bdf8");
 onStatusMessage(` Activated Weather Machine: ${matchedWeather.name}!`);
 return true;
 }
 }

 // 3. Music Note Blocks / Piano / Drums (Action 12 / 28 / 71 / 99)
 if (fgItem && (fgItem.action === 12 || fgItem.action === 28 || fgItem.action === 71 || fgName.includes("note") || fgName.includes("piano"))) {
 if (player.active) triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 else playPunchSound(tileX, tileY);
 spawnPunchImpactEffect(tileX, tileY);
 const inst = getNoteInstrument(fgItem);
 if (inst) {
 const pitch = Math.max(0, Math.min(25, 25 - (tileY % 26)));
 playNoteSound(inst, pitch);
 spawnFloatingText(tileX, tileY, ` ${inst.toUpperCase()}`, "#c084fc");
 return true;
 }
 }

 // 4. Doors, Portals & Entrances (Authentic Growtopia Door Knock)
 if (fgItem && (fgId === 6 || isDoorItem(fgItem))) {
 if (player.active) triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 else playPunchSound(tileX, tileY);
 spawnPunchImpactEffect(tileX, tileY);
 playSfx("door_open", 1.0, 0.7);
 spawnFloatingText(tileX, tileY, ` Knock Knock!`, "#a7f3d0");
 onStatusMessage(` Interacted with ${fgItem.name}!`);
 return true;
 }

 // 5. Donation Box, Vending, ATM, Lock (Action 3, 6, 7, 47, 62, 80, 97, 130)
 if (fgItem && [3, 6, 7, 47, 62, 80, 97, 130].includes(fgItem.action)) {
 if (player.active) triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 else playPunchSound(tileX, tileY);
 spawnPunchImpactEffect(tileX, tileY);
 playSfx("gem_pickup", 1.0, 0.8);
 spawnFloatingText(tileX, tileY, ` ${fgItem.name}`, "#fbbf24");
 onStatusMessage(` Interacted with ${fgItem.name}!`);
 return true;
 }

 // 6. Default: Punch breaks block
 if (player.active) {
 triggerPlayerPunch(tileX, tileY, preciseWorldX, preciseWorldY);
 } else {
 playPunchSound(tileX, tileY);
 }
 spawnPunchImpactEffect(tileX, tileY);
 pushUndoSnapshot("Punch Erase");
 const erased = eraseTile(tileX, tileY);
 if (erased) {
 render();
 onWorldChange(world);
 }
 return erased;
 }

 function floodFill(startX, startY, newItem) {
 const startIdx = getTileIndex(startX, startY);
 if (startIdx === -1) return;

 // Paint Bucket Flood Fill
 if (newItem && catalog.isPaintItem(newItem)) {
 if (!world.paint) world.paint = new Uint16Array(world.width * world.height);
 const targetVal = world.paint[startIdx];
 const col = catalog.getPaintColor(newItem);
 const newVal = (col === null) ? 0 : Number(newItem.id);
 if (targetVal === newVal) return;

 pushUndoSnapshot("Bucket Paint Fill");
 const queue = [[startX, startY]];
 const visited = new Uint8Array(world.width * world.height);

 while (queue.length > 0) {
 const [cx, cy] = queue.pop();
 const idx = cy * world.width + cx;
 if (visited[idx]) continue;
 visited[idx] = 1;

 if (world.paint[idx] === targetVal) {
 world.paint[idx] = newVal;
 if (cx > 0 && !visited[idx - 1]) queue.push([cx - 1, cy]);
 if (cx < world.width - 1 && !visited[idx + 1]) queue.push([cx + 1, cy]);
 if (cy > 0 && !visited[idx - world.width]) queue.push([cx, cy - 1]);
 if (cy < world.height - 1 && !visited[idx + world.width]) queue.push([cx, cy + 1]);
 }
 }
 render();
 onWorldChange(world);
 return;
 }

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

 // ── SHAPE GENERATION ALGORITHMS (Line, Box, Filled Box, Circle, Filled Circle) ──
 function getLineTiles(x0, y0, x1, y1) {
 const tiles = [];
 const dx = Math.abs(x1 - x0);
 const dy = Math.abs(y1 - y0);
 const sx = x0 < x1 ? 1 : -1;
 const sy = y0 < y1 ? 1 : -1;
 let err = dx - dy;

 let currX = x0;
 let currY = y0;

 while (true) {
 tiles.push({ x: currX, y: currY });
 if (currX === x1 && currY === y1) break;
 const e2 = 2 * err;
 if (e2 > -dy) {
 err -= dy;
 currX += sx;
 }
 if (e2 < dx) {
 err += dx;
 currY += sy;
 }
 }
 return tiles;
 }

 function getBoxTiles(x0, y0, x1, y1) {
 const minX = Math.min(x0, x1);
 const maxX = Math.max(x0, x1);
 const minY = Math.min(y0, y1);
 const maxY = Math.max(y0, y1);
 const tiles = [];
 const seen = new Set();

 function add(x, y) {
 const key = `${x},${y}`;
 if (!seen.has(key)) {
 seen.add(key);
 tiles.push({ x, y });
 }
 }

 for (let x = minX; x <= maxX; x++) {
 add(x, minY);
 add(x, maxY);
 }
 for (let y = minY; y <= maxY; y++) {
 add(minX, y);
 add(maxX, y);
 }
 return tiles;
 }

 function getFilledBoxTiles(x0, y0, x1, y1) {
 const minX = Math.min(x0, x1);
 const maxX = Math.max(x0, x1);
 const minY = Math.min(y0, y1);
 const maxY = Math.max(y0, y1);
 const tiles = [];

 for (let y = minY; y <= maxY; y++) {
 for (let x = minX; x <= maxX; x++) {
 tiles.push({ x, y });
 }
 }
 return tiles;
 }

 function getCircleTiles(x0, y0, x1, y1, filled = false) {
 const minX = Math.min(x0, x1);
 const maxX = Math.max(x0, x1);
 const minY = Math.min(y0, y1);
 const maxY = Math.max(y0, y1);

 const cx = (minX + maxX) / 2;
 const cy = (minY + maxY) / 2;
 const rx = Math.max(0.5, (maxX - minX + 1) / 2);
 const ry = Math.max(0.5, (maxY - minY + 1) / 2);

 const tiles = [];
 const seen = new Set();

 function add(x, y) {
 const key = `${x},${y}`;
 if (!seen.has(key)) {
 seen.add(key);
 tiles.push({ x, y });
 }
 }

 for (let y = minY; y <= maxY; y++) {
 for (let x = minX; x <= maxX; x++) {
 const normX = (x + 0.5 - cx) / rx;
 const normY = (y + 0.5 - cy) / ry;
 const distSq = normX * normX + normY * normY;

 if (filled) {
 if (distSq <= 1.05) {
 add(x, y);
 }
 } else {
 // Hollow circle / ellipse perimeter
 if (distSq <= 1.15) {
 let isEdge = false;
 for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
 const nx = (x + dx + 0.5 - cx) / rx;
 const ny = (y + dy + 0.5 - cy) / ry;
 if (nx * nx + ny * ny > 1.0) {
 isEdge = true;
 break;
 }
 }
 if (isEdge || distSq >= 0.55) {
 add(x, y);
 }
 }
 }
 }
 }
 return tiles;
 }

 function getShapeTiles(tool, x0, y0, x1, y1) {
 if (tool === "line") return getLineTiles(x0, y0, x1, y1);
 if (tool === "box") return getBoxTiles(x0, y0, x1, y1);
 if (tool === "filled_box") return getFilledBoxTiles(x0, y0, x1, y1);
 if (tool === "circle") return getCircleTiles(x0, y0, x1, y1, false);
 if (tool === "filled_circle") return getCircleTiles(x0, y0, x1, y1, true);
 return [];
 }

 function commitShape(tool, startTile, endTile) {
 if (!startTile || !endTile) return;
 const tiles = getShapeTiles(tool, startTile.x, startTile.y, endTile.x, endTile.y);
 if (tiles.length === 0) return;

 const activeItem = hotbar[activeHotbarIndex];
 const toolLabel = tool === "line" ? "Draw Line" :
 tool === "box" ? "Draw Box" :
 tool === "filled_box" ? "Draw Filled Box" :
 tool === "circle" ? "Draw Circle" :
 tool === "filled_circle" ? "Draw Filled Circle" : "Draw Shape";

 pushUndoSnapshot(toolLabel);

 let placedCount = 0;
 for (const pt of tiles) {
 if (pt.x >= 0 && pt.x < world.width && pt.y >= 0 && pt.y < world.height) {
 setTile(pt.x, pt.y, activeItem);
 placedCount++;
 }
 }

 if (placedCount > 0) {
 if (player.active) {
 triggerPlayerPlace(endTile.x, endTile.y);
 }
 playSfx("pop", 1.0, 0.7);
 render();
 onWorldChange(world);
 onStatusMessage(` Placed ${placedCount} blocks with ${toolLabel}`);
 }
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
 let transformShakeX = 0;
 let transformShakeY = 0;
 let impactShakeX = 0;
 let impactShakeY = 0;
 let runShakeX = 0;
 let runShakeY = 0;
 let fallShakeX = 0;
 let fallShakeY = 0;

 if (cameraShakeEnabled) {
 if (player.modTransformTimer > 0) {
 const shakeFactor = player.modTransformTimer / 0.65;
 const maxShake = 3.5 * shakeFactor;
 transformShakeX = (Math.random() - 0.5) * maxShake * 2;
 transformShakeY = (Math.random() - 0.5) * maxShake * 2;
 }

 if (player.impactShakeTimer > 0) {
 const impactProg = player.impactShakeTimer / 0.35;
 const impactMag = 7.5 * Math.pow(impactProg, 1.2);
 impactShakeX = (Math.random() - 0.5) * impactMag * 2;
 impactShakeY = (Math.random() - 0.5) * impactMag * 2;
 }

 // Smooth rhythmic running camera shake (natural heavy step cadence)
 if (player.active && player.isGrounded && Math.abs(player.vx) > 0.5 && player.state === "walk") {
 const walkBlend = player.walkBlend !== undefined ? player.walkBlend : 1.0;
 const runIntensity = Math.min(1.0, Math.abs(player.vx) / 3.0);
 runShakeX = Math.sin(player.walkPhase * 0.5) * 0.75 * runIntensity * walkBlend;
 runShakeY = Math.sin(player.walkPhase) * 1.35 * runIntensity * walkBlend;
 }

 // Dynamic falling air turbulence camera shake (starts at >= 0.5s, ramps smoothly from small to large)
 if (player.active && (player.continuousFallTimer || 0) >= 0.5 && !player.moderatorMode && !player.isDead) {
 const fallTime = player.continuousFallTimer - 0.5;
 const fallProgress = Math.min(1.0, fallTime / 2.0);
 const fallMag = (fallProgress * 0.4 + Math.pow(fallProgress, 1.8) * 3.4) * Math.min(1.0, Math.max(0.1, (player.vy - 1.0) / 4.0));
 fallShakeX = Math.sin(player.animTimer * 16) * fallMag;
 fallShakeY = Math.cos(player.animTimer * 18) * (fallMag * 0.75);
 }
 }

 ctx.save();
 ctx.translate(
 viewport.x + transformShakeX + impactShakeX + runShakeX + fallShakeX,
 viewport.y + transformShakeY + impactShakeY + runShakeY + fallShakeY
 );
 ctx.scale(viewport.zoom, viewport.zoom);

 // Mask tiles strictly inside World Rectangle (0, 0, worldW, worldH)
 ctx.save();
 ctx.beginPath();
 if (typeof ctx.rect === "function") ctx.rect(0, 0, worldW, worldH);
 if (typeof ctx.clip === "function") ctx.clip();

 // 2b. Imported Live World Render Blueprint Overlay (from /renderworld)
 if (world.renderOverlayImage && world.renderOverlayImage.complete && world.renderOverlayImage.naturalWidth > 0) {
 ctx.save();
 ctx.globalAlpha = 0.95;
 ctx.imageSmoothingEnabled = true;
 ctx.drawImage(world.renderOverlayImage, 0, 0, worldW, worldH);
 ctx.restore();
 }

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

 // 3.5 Paint Tint Overlay Layer
 if (world.paint) {
 for (let y = visibleMinY; y <= visibleMaxY; y++) {
 for (let x = visibleMinX; x <= visibleMaxX; x++) {
 const idx = y * world.width + x;
 const paintId = world.paint[idx];
 if (paintId > 0) {
 const pItem = getItem(paintId);
 if (pItem) {
 const col = catalog.getPaintColor(pItem);
 if (col) {
 ctx.save();
 ctx.globalAlpha = 0.45;
 ctx.fillStyle = col;
 ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
 ctx.restore();
 }
 }
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

 // 5b. Live Shape Drag Preview (Line, Box, Filled Box, Circle, Filled Circle)
 if (isShapeDragging && shapeStartTile && shapeCurrentTile && ["line", "box", "filled_box", "circle", "filled_circle"].includes(activeTool)) {
 const shapeTiles = getShapeTiles(activeTool, shapeStartTile.x, shapeStartTile.y, shapeCurrentTile.x, shapeCurrentTile.y);
 const activeItem = hotbar[activeHotbarIndex];
 const isBg = activeItem ? catalog.isBackgroundItem(activeItem) : false;

 ctx.save();
 ctx.globalAlpha = 0.65;
 for (const pt of shapeTiles) {
 if (pt.x >= 0 && pt.x < world.width && pt.y >= 0 && pt.y < world.height) {
 if (activeItem) {
 drawTileSprite(ctx, activeItem, pt.x * TILE_SIZE, pt.y * TILE_SIZE, isFlipped, isBg, pt.x, pt.y);
 } else {
 ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
 ctx.fillRect(pt.x * TILE_SIZE, pt.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
 }
 ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
 ctx.lineWidth = 1.5 / viewport.zoom;
 ctx.strokeRect(pt.x * TILE_SIZE, pt.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
 }
 }
 ctx.restore();

 // Dimension Badge overlay at shapeCurrentTile
 const shapeW = Math.abs(shapeCurrentTile.x - shapeStartTile.x) + 1;
 const shapeH = Math.abs(shapeCurrentTile.y - shapeStartTile.y) + 1;
 const badgeText = `${shapeW} × ${shapeH} (${shapeTiles.length})`;

 ctx.save();
 ctx.font = `bold ${Math.max(10, Math.min(14, 12 / viewport.zoom))}px sans-serif`;
 const badgeMetrics = ctx.measureText(badgeText);
 const badgePadX = 6 / viewport.zoom;
 const badgePadY = 3 / viewport.zoom;
 const badgeW = badgeMetrics.width + badgePadX * 2;
 const badgeH = 18 / viewport.zoom;
 const badgeX = (shapeCurrentTile.x + 1) * TILE_SIZE + 4 / viewport.zoom;
 const badgeY = (shapeCurrentTile.y) * TILE_SIZE - 4 / viewport.zoom;

 ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
 ctx.strokeStyle = "#38bdf8";
 ctx.lineWidth = 1 / viewport.zoom;
 if (typeof ctx.roundRect === "function") {
 ctx.beginPath();
 ctx.roundRect(badgeX, badgeY - badgeH, badgeW, badgeH, 4 / viewport.zoom);
 ctx.fill();
 ctx.stroke();
 } else {
 ctx.fillRect(badgeX, badgeY - badgeH, badgeW, badgeH);
 ctx.strokeRect(badgeX, badgeY - badgeH, badgeW, badgeH);
 }

 ctx.fillStyle = "#38bdf8";
 ctx.textBaseline = "bottom";
 ctx.fillText(badgeText, badgeX + badgePadX, badgeY - badgePadY);
 ctx.restore();
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

 // 8. Player Avatar & Dynamic Particles (Play Mode)
 if (player.active || gameParticles.length > 0) {
 updateAndDrawParticles(ctx, 0.016);
 if (player.active) drawPlayerAvatar(ctx);
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
 const previewItem = hotbar[activeHotbarIndex];
 const isBg = catalog.isBackgroundItem(previewItem);
 ctx.globalAlpha = 0.5;
 drawTileSprite(
 ctx,
 previewItem,
 hoveredTile.x * TILE_SIZE,
 hoveredTile.y * TILE_SIZE,
 isFlipped,
 isBg,
 hoveredTile.x,
 hoveredTile.y,
 isBg ? world.bg : world.fg
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

 // 11. Subtle Screen-Space Digital Scanline / Micro-Glitch on Transformation
 if (player.modTransformTimer > 0) {
 ctx.save();
 const transProg = 1.0 - (player.modTransformTimer / 0.65);
 const viewW = cw / dpr;
 const viewH = ch / dpr;
 // 2-3 brief micro-glitch slice scanlines
 if (Math.random() < 0.65) {
 const sliceY = Math.random() * viewH;
 const sliceH = 2 + Math.random() * 5;
 ctx.fillStyle = Math.random() < 0.5 ? "rgba(56, 189, 248, 0.12)" : "rgba(168, 85, 247, 0.12)";
 ctx.fillRect(0, sliceY, viewW, sliceH);
 }
 // Soft cyan-violet chromatic flash on borders
 ctx.fillStyle = `rgba(168, 85, 247, ${0.04 * Math.sin(transProg * Math.PI)})`;
 ctx.fillRect(0, 0, viewW, viewH);
 ctx.restore();
 }



 ctx.restore(); // Restore dpr scale
 }

 function getTileConnectionOffset(item, x, y, layer) {
 if (!item || !layer || x < 0 || y < 0) return { offsetX: 0, offsetY: 0 };

 // ── 0. Authentic Growtopia Door & Entrance Open/Close Sprite Animation ──
 if (isDoorItem(item)) {
 // White Door (Main Door, ID 6) is a single static frame in Growtopia (no 2nd open sprite)
 if (Number(item.id) === 6 || (item.name || "").toLowerCase() === "main door") {
 return { offsetX: 0, offsetY: 0 };
 }

 let isOpen = false;
 if (player.active) {
 // In Game Mode: Door swings open when player approaches or stands at the entrance!
 const pxCenter = player.x + player.width / 2;
 const pyCenter = player.y + player.height / 2;
 const tileCenterX = x * TILE_SIZE + TILE_SIZE / 2;
 const tileCenterY = y * TILE_SIZE + TILE_SIZE / 2;
 const dx = Math.abs(pxCenter - tileCenterX);
 const dy = Math.abs(pyCenter - tileCenterY);
 if (dx <= 22 && dy <= 28) {
 isOpen = true;
 }
 } else {
 // In Builder Mode: Door swings open when hovered with cursor
 if (typeof hoverTileX !== "undefined" && typeof hoverTileY !== "undefined") {
 if (hoverTileX === x && hoverTileY === y) {
 isOpen = true;
 }
 }
 }
 if (isOpen) {
 return { offsetX: 1, offsetY: 0 }; // 2nd sprite in tilesheet: Open Door!
 }
 return { offsetX: 0, offsetY: 0 }; // 1st sprite in tilesheet: Closed Door!
 }

 const autotileEngine = autotile || (typeof GTAutotile !== "undefined" ? GTAutotile : (typeof window !== "undefined" ? window.GTAutotile : null));
 const id = Number(item.id);
 const st = Number(item.spread_type) || 0;

 // Use official Growtopia 8-neighbor bitmask solver if spread_type is 2, 5, 3, 14, 7, or 4
 if (autotileEngine && [2, 5, 3, 14, 7, 4].includes(st)) {
 const matchAnySolid = (st === 4);
 const mask = autotileEngine.computeNeighborMask(layer, world.width, world.height, x, y, id, matchAnySolid);
 return autotileEngine.getTileOffset(item, mask);
 }

 // Horizontal connectable fallback (tables, couches, desks, platforms)
 const nameLower = (item.name || "").toLowerCase();
 const isHorizontalConnectable = (
 st === 3 ||
 st === 14 ||
 nameLower.includes("couch") ||
 nameLower.includes("table") ||
 nameLower.includes("platform") ||
 nameLower.includes("bench") ||
 nameLower.includes("sofa") ||
 nameLower.includes("desk") ||
 nameLower.includes("counter")
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

 // Draw Paint Overlay
 if (world.paint) {
 for (let y = minY; y <= maxY; y++) {
 for (let x = minX; x <= maxX; x++) {
 const idx = y * world.width + x;
 const paintId = world.paint[idx];
 if (paintId > 0) {
 const pItem = getItem(paintId);
 if (pItem) {
 const col = catalog.getPaintColor(pItem);
 if (col) {
 offCtx.save();
 offCtx.globalAlpha = 0.45;
 offCtx.fillStyle = col;
 offCtx.fillRect((x - minX) * tileSize, (y - minY) * tileSize, tileSize, tileSize);
 offCtx.restore();
 }
 }
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
 paint: new Uint16Array(total),
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
 paint: world.paint ? Array.from(world.paint) : [],
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
 const paint = new Uint16Array(data.paint && data.paint.length ? data.paint : total);
 const flags = new Uint8Array(data.flags || total);

 world = {
 width,
 height,
 name: data.name || "World",
 weather: data.weather || "SUNNY",
 weatherCode: data.weatherCode || 1,
 fg,
 bg,
 paint,
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
 const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
 const sx = event.clientX - rect.left;
 const sy = event.clientY - rect.top;
 const preciseWorldX = (sx - viewport.x) / viewport.zoom;
 const preciseWorldY = (sy - viewport.y) / viewport.zoom;

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
 if (["line", "box", "filled_box", "circle", "filled_circle"].includes(activeTool)) {
 isShapeDragging = true;
 shapeStartTile = { x: tileX, y: tileY };
 shapeCurrentTile = { x: tileX, y: tileY };
 requestRender();
 return;
 }

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

 if (activeTool === "eraser" || activeTool === "punch") {
 isDrawing = true;
 punchInteract(tileX, tileY, preciseWorldX, preciseWorldY);
 lastDrawTile = { x: tileX, y: tileY };
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
 const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
 const sx = t.clientX - rect.left;
 const sy = t.clientY - rect.top;
 const preciseWorldX = (sx - viewport.x) / viewport.zoom;
 const preciseWorldY = (sy - viewport.y) / viewport.zoom;

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
 } else if (activeTool === "eraser" || activeTool === "punch") {
 isTouchDrawing = true;
 punchInteract(tileX, tileY, preciseWorldX, preciseWorldY);
 lastDrawTile = { x: tileX, y: tileY };
 } else {
 // Default to pencil (Place Tile)
 isTouchDrawing = true;
 pushUndoSnapshot("Place Tile");
 triggerPlayerPlace(tileX, tileY);
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
 if (["line", "box", "filled_box", "circle", "filled_circle"].includes(activeTool)) {
 isShapeDragging = true;
 shapeStartTile = { x: tileX, y: tileY };
 shapeCurrentTile = { x: tileX, y: tileY };
 requestRender();
 } else if (activeTool === "pencil") {
 isTouchDrawing = true;
 pushUndoSnapshot("Place Tile");
 setTile(tileX, tileY, hotbar[activeHotbarIndex]);
 lastDrawTile = { x: tileX, y: tileY };
 render();
 onWorldChange(world);
 } else if (activeTool === "eraser" || activeTool === "punch") {
 isTouchDrawing = true;
 punchInteract(tileX, tileY, preciseWorldX, preciseWorldY);
 lastDrawTile = { x: tileX, y: tileY };
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

 if (isShapeDragging) {
 event.preventDefault();
 const { tileX, tileY } = screenToWorldTile(t.clientX, t.clientY);
 shapeCurrentTile = { x: tileX, y: tileY };
 requestRender();
 } else if (isTouchDrawing) {
 event.preventDefault();
 const { tileX, tileY } = screenToWorldTile(t.clientX, t.clientY);
 if (tileX >= 0 && tileX < world.width && tileY >= 0 && tileY < world.height) {
 if (lastDrawTile?.x !== tileX || lastDrawTile?.y !== tileY) {
 if (activeTool === "pencil") {
 setTile(tileX, tileY, hotbar[activeHotbarIndex]);
 } else if (activeTool === "eraser" || activeTool === "punch") {
 punchInteract(tileX, tileY);
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
 if (isShapeDragging) {
 isShapeDragging = false;
 if (shapeStartTile && shapeCurrentTile) {
 commitShape(activeTool, shapeStartTile, shapeCurrentTile);
 }
 shapeStartTile = null;
 shapeCurrentTile = null;
 requestRender();
 }
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
 isShapeDragging = false;
 shapeStartTile = null;
 shapeCurrentTile = null;
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
 let zoomAnchorWorldX = 0;
 let zoomAnchorWorldY = 0;
 let zoomScreenX = 0;
 let zoomScreenY = 0;

 function stepSmoothZoom() {
 const diff = smoothZoomTarget - viewport.zoom;
 if (Math.abs(diff) < 0.0008) {
 viewport.zoom = smoothZoomTarget;
 if (player.active) {
 const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
 const cw = canvas.clientWidth || (canvas.width / dpr);
 const ch = canvas.clientHeight || (canvas.height / dpr);
 viewport.x = cw / 2 - (player.x + TILE_SIZE / 2) * viewport.zoom;
 viewport.y = ch / 2 - (player.y + TILE_SIZE / 2) * viewport.zoom;
 }
 isZoomAnimating = false;
 requestRender();
 return;
 }

 viewport.zoom += diff * 0.28;
 if (!player.active) {
 viewport.x = zoomScreenX - zoomAnchorWorldX * viewport.zoom;
 viewport.y = zoomScreenY - zoomAnchorWorldY * viewport.zoom;
 } else {
 const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
 const cw = canvas.clientWidth || (canvas.width / dpr);
 const ch = canvas.clientHeight || (canvas.height / dpr);
 viewport.x = cw / 2 - (player.x + TILE_SIZE / 2) * viewport.zoom;
 viewport.y = ch / 2 - (player.y + TILE_SIZE / 2) * viewport.zoom;
 }
 requestRender();
 requestAnimationFrame(stepSmoothZoom);
 }

 canvas.addEventListener("wheel", event => {
 event.preventDefault();
 const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 600 };
 const sx = event.clientX - rect.left;
 const sy = event.clientY - rect.top;
 zoomAnchorWorldX = (sx - viewport.x) / viewport.zoom;
 zoomAnchorWorldY = (sy - viewport.y) / viewport.zoom;
 zoomScreenX = sx;
 zoomScreenY = sy;

 const minZ = player.active ? 0.35 : 0.15;
 const maxZ = player.active ? 4.5 : 8.0;
 const zoomFactor = event.deltaY < 0 ? 1.18 : 0.84;
 smoothZoomTarget = Math.max(minZ, Math.min(maxZ, smoothZoomTarget * zoomFactor));

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
 // Track cursor world position for live pupil gaze tracking (Desktop only)
 const rect = canvas.getBoundingClientRect();
 const sx = event.clientX - rect.left;
 const sy = event.clientY - rect.top;
 player.cursorWorldX = (sx - viewport.x) / viewport.zoom;
 player.cursorWorldY = (sy - viewport.y) / viewport.zoom;
 player.isDesktopCursor = true;
 if (tileX !== hoveredTile.x || tileY !== hoveredTile.y) {
 hoveredTile.x = tileX;
 hoveredTile.y = tileY;

 if (isShapeDragging) {
 shapeCurrentTile = { x: tileX, y: tileY };
 requestRender();
 } else if (isSelecting) {
 selection.endX = Math.max(0, Math.min(world.width - 1, tileX));
 selection.endY = Math.max(0, Math.min(world.height - 1, tileY));
 requestRender();
 } else if (isDrawing && (lastDrawTile?.x !== tileX || lastDrawTile?.y !== tileY)) {
 if (activeTool === "pencil") {
 setTile(tileX, tileY, hotbar[activeHotbarIndex]);
 } else if (activeTool === "eraser" || activeTool === "punch") {
 punchInteract(tileX, tileY);
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
 if (isShapeDragging) {
 isShapeDragging = false;
 if (shapeStartTile && shapeCurrentTile) {
 commitShape(activeTool, shapeStartTile, shapeCurrentTile);
 }
 shapeStartTile = null;
 shapeCurrentTile = null;
 requestRender();
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

 // Keyboard Shortcuts (1-9 for Hotbar, B=Box, Shift+B=Filled Box, L=Line, C=Circle, E=Eraser, I=Picker, G=Bucket, S=Select, F=Flip, Z=Undo, Y=Redo)
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
 const kLow = event.key.toLowerCase();
 if (kLow === "l" && !event.ctrlKey) {
 setTool("line");
 } else if (kLow === "b" && !event.ctrlKey) {
 if (event.shiftKey) {
 setTool("filled_box");
 } else {
 setTool("box");
 }
 } else if (kLow === "c" && !event.ctrlKey) {
 if (event.shiftKey) {
 setTool("filled_circle");
 } else {
 setTool("circle");
 }
 } else if (kLow === "n" && !event.ctrlKey) {
 setTool("pencil");
 } else if (kLow === "e" && !event.ctrlKey) {
 setTool("eraser");
 } else if (kLow === "i" && !event.ctrlKey) {
 setTool("picker");
 } else if (kLow === "g" && !event.ctrlKey) {
 setTool("bucket");
 } else if (kLow === "f" && !event.ctrlKey) {
 isFlipped = !isFlipped;
 onStatusMessage(`Flipped items: ${isFlipped ? "ON (Flipped)" : "OFF (Normal)"}`);
 render();
 } else if (kLow === "p" && !event.ctrlKey) {
 togglePlayMode();
 } else if (kLow === "m" && !event.ctrlKey) {
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
 onStatusMessage(`Copied ${w} × ${h} selection to clipboard!`);
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
 onStatusMessage("Cut selection to clipboard!");
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
 onStatusMessage(`Click on world map to paste (${clipboard.width} × ${clipboard.height})`);
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
 onStatusMessage("Mirrored clipboard horizontally!");
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
 onStatusMessage("Mirrored clipboard vertically!");
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
 function isDoorItem(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 const action = Number(item.action);
 if ([1, 2, 26, 43, 84, 104, 105, 106, 142].includes(action)) return true;
 if (
 name.includes("door") || name.includes("portal") || name.includes("entrance") ||
 name.includes("gate") || name.includes("passage") || name.includes("gateway") ||
 name.includes("chute") || name.includes("manhole") || name.includes("teleporter") ||
 name.includes("warp")
 ) return true;
 return false;
 }

 function isBouncyBlock(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 const action = Number(item.action);
 const id = Number(item.id);
 return (
 id === 194 || // Mushroom
 id === 526 || // Pinball Bumper
 id === 624 || // Pinball Sproinger
 id === 1448 || // Trampoline
 action === 24 || // Bouncy Action
 name.includes("mushroom") ||
 name.includes("pinball") ||
 name.includes("trampoline") ||
 name.includes("bouncy") ||
 name.includes("spring") ||
 name.includes("sproinger") ||
 name.includes("bumper") ||
 name.includes("slime block") ||
 name.includes("jelly") ||
 name.includes("rubber")
 );
 }

 function isPlatformBlock(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 const action = Number(item.action);
 // Vines, Ladders, Platforms, Clouds, Bannisters, Bridges, Ropes, Chains, Climbing walls
 return (
 action === 21 || action === 14 || action === 145 ||
 name.includes("platform") || name.includes("cloud") || name.includes("bridge") ||
 name.includes("bannister") || name.includes("ledge") || name.includes("vine") ||
 name.includes("ladder") || name.includes("rope") || name.includes("chain") ||
 name.includes("lattice") || name.includes("climbing") || name.includes("scaffolding")
 );
 }

 function isPassThroughPlant(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 const id = Number(item.id);
 // Specifically delicate floor plants & flowers (NOT solid blocks, NOT vines, NOT mushrooms)
 if (
 id === 16 || // Grass
 id === 22 || // Daisy
 id === 188 || // Poppy
 id === 190 || // Rose
 id === 528 || // Lucky Clover
 id === 846 || // Seaweed
 id === 880 || // Wheat
 id === 1104 || // Foliage
 name.includes("grass") ||
 name.includes("daisy") ||
 name.includes("rose") ||
 name.includes("poppy") ||
 name.includes("clover") ||
 name.includes("seaweed") ||
 name.includes("wheat") ||
 name.includes("tulip") ||
 name.includes("dahlia") ||
 name.includes("orchid") ||
 name.includes("sunflower")
 ) {
 // Exclude solid block variants, wallpapers, vines, trees, and mushrooms
 if (
 name.includes("wallpaper") || name.includes("wall") || name.includes("block") ||
 name.includes("seed") || name.includes("hedge") || name.includes("vine") ||
 name.includes("tree") || name.includes("wood") || name.includes("mushroom")
 ) return false;
 return true;
 }
 return false;
 }

 function isSolidBlock(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 const action = Number(item.action);
 // Bouncy blocks like Mushroom (ID 194) and Pinball are SOLID!
 if (isBouncyBlock(item)) return true;
 // Non-solids: Doors, Platforms/Vines (handled by platform physics), delicate Plants/Grass, Signs, Checkpoints
 if (isDoorItem(item)) return false;
 if (isPlatformBlock(item)) return false;
 if (isPassThroughPlant(item)) return false;
 if ([0, 1, 2, 3, 6, 18, 21, 27, 28, 81, 89, 134].includes(action)) return false;
 if (
 name.includes("sign") || name.includes("water") || name.includes("fire") ||
 name.includes("checkpoint") || name.includes("flag") || name.includes("banner")
 ) return false;
 return true;
 }

 function isHazardItem(item) {
 if (!item) return false;
 const name = (item.name || "").toLowerCase();
 return item.action === 16 || name.includes("lava") || name.includes("spike") || name.includes("hazard") || name.includes("death");
 }

 function getAllDoorTiles() {
 const doors = [];
 for (let y = 0; y < world.height; y++) {
 for (let x = 0; x < world.width; x++) {
 const idx = y * world.width + x;
 const fgId = world.fg[idx];
 if (fgId > 0) {
 const item = getItem(fgId);
 if (item && (fgId === 6 || isDoorItem(item))) {
 doors.push({ x, y, id: fgId, item });
 }
 }
 }
 }
 return doors;
 }

 function warpThroughDoor(currentTileX, currentTileY) {
 if (player.doorWarpCooldown > 0) return false;
 const allDoors = getAllDoorTiles();
 if (allDoors.length === 0) return false;

 const curIdx = allDoors.findIndex(d => d.x === currentTileX && d.y === currentTileY);
 let targetDoor = null;

 if (allDoors.length === 1) {
 targetDoor = allDoors[0];
 spawnFloatingText(targetDoor.x, targetDoor.y, ` ${targetDoor.item.name}`, "#67e8f9");
 playSfx("door_open", 1.0, 0.85);
 player.doorWarpCooldown = 0.5;
 return true;
 }

 if (curIdx !== -1) {
 // Warp to the NEXT door in cycle
 const nextIdx = (curIdx + 1) % allDoors.length;
 targetDoor = allDoors[nextIdx];
 } else {
 targetDoor = allDoors[0];
 }

 if (targetDoor) {
 player.x = targetDoor.x * TILE_SIZE + 6;
 player.y = targetDoor.y * TILE_SIZE + 4;
 player.vx = 0;
 player.vy = 0;
 player.jumpCount = 0;
 player.jumpConsumed = true;
 player.doorWarpCooldown = 0.55;
 player.respawnRingRadius = 1;
 playSfx("door_open", 1.0, 0.85);
 playSfx("teleport", 1.0, 0.6);
 spawnFloatingText(targetDoor.x, targetDoor.y, ` ${targetDoor.item.name}`, "#67e8f9");
 onStatusMessage(` Entered door -> Exited at ${targetDoor.item.name} (${targetDoor.x}, ${targetDoor.y})`);
 requestRender();
 return true;
 }
 return false;
 }

 function findSpawnPosition() {
 let fallbackDoor = null;

 // 1. Scan for White Door (ID 6) or any Door / Entrance Block
 for (let y = 0; y < world.height; y++) {
 for (let x = 0; x < world.width; x++) {
 const idx = y * world.width + x;
 const fgId = world.fg[idx];
 if (fgId > 0) {
 if (fgId === 6) { // Official White Door / Main Spawn Door
 return { x: x * TILE_SIZE + 6, y: y * TILE_SIZE + 4 };
 }
 const item = getItem(fgId);
 if (item && isDoorItem(item)) {
 if (!fallbackDoor) {
 fallbackDoor = { x: x * TILE_SIZE + 6, y: y * TILE_SIZE + 4 };
 }
 }
 }
 }
 }

 if (fallbackDoor) return fallbackDoor;

 // 2. If NO door exists in the world: Find safe solid ground near the horizontal center of the world
 const centerX = Math.floor(world.width / 2);
 // Scan downwards at center column, and neighboring columns outward (+-1, +-2, ...)
 for (let offset = 0; offset <= Math.floor(world.width / 2); offset++) {
 const checkCols = offset === 0 ? [centerX] : [centerX - offset, centerX + offset];
 for (const tx of checkCols) {
 if (tx < 0 || tx >= world.width) continue;
 for (let ty = 0; ty < world.height; ty++) {
 const idx = ty * world.width + tx;
 const fgId = world.fg[idx];
 if (fgId > 0) {
 const item = getItem(fgId);
 if (item && (isSolidBlock(item) || isPlatformBlock(item)) && !isHazardItem(item)) {
 // Found safe solid ground! Stand on top of this block
 return { x: tx * TILE_SIZE + 6, y: Math.max(0, (ty - 1) * TILE_SIZE + 4) };
 }
 }
 }
 }
 }

 // 3. Completely empty blank world: Spawn in the exact center of the world
 return {
 x: Math.floor(world.width / 2) * TILE_SIZE + 6,
 y: Math.floor(world.height / 2) * TILE_SIZE + 4
 };
 }

 function killPlayer(reason = "Ouch! Hit a lethal hazard!") {
 if (player.isDead || player.moderatorMode || player.respawnInvincible > 0) return;
 player.isDead = true;
 player.deathTimer = 0.85; // 0.85s full cinematic death arc
 player.vx = player.facing > 0 ? -2.8 : 2.8; // Launch knockback recoil
 player.vy = -7.6; // Powerful upward death pop launch
 
 // Hazard Impact Hit Flash & Screen Shake
 player.impactShakeTimer = 0.35;
 player.hitFlashTimer = 0.25;
 
 spawnDeathParticles(player.x + player.width / 2, player.y + player.height / 2);
 playSfx("boo_death", 1.0, 0.95);
 playSfx("hit", 1.15, 0.75);
 playSfx("splat", 1.0, 0.70);
 onStatusMessage(reason);
 }

 function respawnPlayer(msg = "") {
 let spawn;
 if (player.lastCheckpoint) {
 spawn = {
 x: player.lastCheckpoint.x * TILE_SIZE + 6,
 y: player.lastCheckpoint.y * TILE_SIZE + 4
 };
 if (!msg) msg = ` Respawned at ${player.lastCheckpoint.name || "Checkpoint"}!`;
 } else {
 spawn = findSpawnPosition();
 }
 player.x = spawn.x;
 player.y = spawn.y;
 player.vx = 0;
 player.vy = 0;
 player.isDead = false;
 player.deathTimer = 0;
 player.isGrounded = false;
 player.jumpCount = 0;
 player.jumpConsumed = false;
 player.respawnInvincible = 1.8; // 1.8s invincibility shield
 player.respawnRingRadius = 4;
 player.state = "idle";
 playSfx("teleport", 1.0, 0.85);
 playSfx("door_shut", 1.0, 0.70);
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

 // Play Authentic Growtopia World Entrance Sound Effect & Zoom in to Player
 playSfx("door_shut", 1.0, 0.85);
 playSfx("piano_nice", 1.0, 0.70);
 preloadFootstepSounds();
 viewport.zoom = 2.2;
 smoothZoomTarget = 2.2;
 if (canvas) {
 const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
 const viewW = canvas.width / dpr;
 const viewH = canvas.height / dpr;
 viewport.x = (viewW / 2) - (spawn.x + player.width / 2) * viewport.zoom;
 viewport.y = (viewH / 2) - (spawn.y + player.height / 2) * viewport.zoom;
 }

 onStatusMessage("Game Mode Active! WASD/Arrows to run & jump (Double Jump enabled!), R to respawn, ESC to exit.");
 } else {
 activeTool = "pencil";
 onToolChange("pencil");
 // Play Game Mode Exit Sound Effect
 playSfx("door_shut", 1.0, 0.8);
 onStatusMessage("Returned to Builder Mode.");
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
 player.modTransformTimer = 0.65; // 0.65s transformation sequence with rapid electrical flicker
 spawnModTransformParticles(player.x + player.width / 2, player.y + player.height / 2);
 if (player.active) {
 playSfx("magic", 1.25, 0.85);
 playSfx("boo_ghost_be_gone", 1.05, 0.80);
 playSfx("already_used", 1.30, 0.70);
 }
 onStatusMessage("Moderator Mode Active! [NOCLIP & FREE FLY] WASD/Arrows to fly in all directions & pass through blocks! Press M to toggle.");
 } else {
 player.modTransformTimer = 0;
 if (player.active) playSfx("switch", 1.1, 0.5);
 onStatusMessage("Moderator Mode Disabled. Solid block collisions restored.");
 }

 if (typeof document !== "undefined" && typeof document.getElementById === "function") {
 const modBtn = document.getElementById("playmode-mod-btn");
 if (modBtn) {
 modBtn.textContent = player.moderatorMode ? "Mod Mode: ON" : "Mod Mode: OFF";
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

 function triggerPlayerPlace(targetTileX, targetTileY) {
 if (!player.active) return;
 player.placeTimer = 0.28;
 if (typeof targetTileX === "number") {
 const playerTileX = Math.floor((player.x + player.width / 2) / TILE_SIZE);
 if (targetTileX > playerTileX) player.facing = 1;
 else if (targetTileX < playerTileX) player.facing = -1;
 }
 }

 function triggerPlayerPunch(targetTileX, targetTileY, preciseWorldX, preciseWorldY) {
 if (!player.active) return;
 player.punchTimer = 0.24;
 player.punchMaxTimer = 0.24;

 if (typeof preciseWorldX === "number" && typeof preciseWorldY === "number") {
 player.punchTargetWorldX = preciseWorldX;
 player.punchTargetWorldY = preciseWorldY;
 } else if (typeof targetTileX === "number" && typeof targetTileY === "number") {
 player.punchTargetWorldX = targetTileX * TILE_SIZE + TILE_SIZE / 2;
 player.punchTargetWorldY = targetTileY * TILE_SIZE + TILE_SIZE / 2;
 } else {
 player.punchTargetWorldX = (player.x + player.width / 2) + player.facing * 32;
 player.punchTargetWorldY = player.y + 12;
 }

 const centerPlayerX = player.x + player.width / 2;
 if (player.punchTargetWorldX > centerPlayerX + 4) player.facing = 1;
 else if (player.punchTargetWorldX < centerPlayerX - 4) player.facing = -1;

 // Play punch sound effect
 playPunchSound(targetTileX, targetTileY);
 }

 function updatePlayerPhysics(dt) {
 if (!player.active) return;



 // Death state handling
 if (player.isDead) {
 player.deathTimer -= dt;
 const timeScale = dt * 60;
 player.x += player.vx * timeScale;
 player.y += player.vy * timeScale;
 player.vy += 0.48 * timeScale; // Gravity during death arc
 player.vx *= Math.pow(0.96, timeScale);

 if (player.deathTimer <= 0) {
 player.isDead = false;
 respawnPlayer("Respawned at spawn door!");
 }
 return;
 }

 player.animTimer += dt;

 // Timers
 if (player.impactShakeTimer > 0) player.impactShakeTimer = Math.max(0, player.impactShakeTimer - dt);
 if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
 if (player.modTransformTimer > 0) player.modTransformTimer = Math.max(0, player.modTransformTimer - dt);
 if (player.punchTimer > 0) player.punchTimer = Math.max(0, player.punchTimer - dt);
 if (player.placeTimer > 0) player.placeTimer = Math.max(0, player.placeTimer - dt);
 if (player.jumpThrustTimer > 0) player.jumpThrustTimer = Math.max(0, player.jumpThrustTimer - dt);
 if (player.jumpSpinTimer > 0) player.jumpSpinTimer = Math.max(0, player.jumpSpinTimer - dt);
 if (player.chatTimer > 0) player.chatTimer = Math.max(0, player.chatTimer - dt);
 if (player.landingSquashTimer > 0) player.landingSquashTimer = Math.max(0, player.landingSquashTimer - dt);
 if (player.respawnInvincible > 0) player.respawnInvincible = Math.max(0, player.respawnInvincible - dt);
 if (player.respawnRingRadius > 0) player.respawnRingRadius += dt * 80;

 // Continuous AFK Animation Loop (Runs continuously when idle until player moves)
 const isUserMoving = player.keys.left || player.keys.right || player.keys.up || player.keys.down || player.keys.jump || Math.abs(player.vx) > 0.3;
 if (isUserMoving || player.moderatorMode || !player.isGrounded) {
 player.afkTimer = 0;
 player.afkAction = null;
 player.afkParticleTimer = 0;
 } else {
 player.afkTimer += dt;
 if (player.afkTimer >= 6.5) {
 player.afkTimer = 0; // Next randomized animation cycle every 6.5 seconds
 const afkList = ["dance", "sleep", "think", "cheer", "angry", "wave", "laugh"];
 const available = afkList.filter(a => a !== player.afkAction);
 player.afkAction = available[Math.floor(Math.random() * available.length)];
 if (player.afkAction === "cheer") playSfx("happy", 1.0, 0.45);
 else if (player.afkAction === "angry") playSfx("grunt", 1.0, 0.45);
 else if (player.afkAction === "dance") playSfx("magic", 1.0, 0.35);
 }

 // Active AFK Particle FX Spawners
 if (player.afkAction) {
 player.afkParticleTimer = (player.afkParticleTimer || 0) + dt;

 // 1. Dancing Floating Musical Notes (from user assets note_1, note_2, note_4)
 if (player.afkAction === "dance" && player.afkParticleTimer >= 0.22) {
 player.afkParticleTimer = 0;
 const noteList = [
 "character_base_assets/dance_notes/note_1.png",
 "character_base_assets/dance_notes/note_2.png",
 "character_base_assets/dance_notes/note_4.png"
 ];
 const noteSrc = noteList[Math.floor(Math.random() * noteList.length)];
 const nX = player.x + player.width / 2 + (Math.random() - 0.5) * 26;
 const nY = player.y + player.height / 2 - 6 + (Math.random() - 0.5) * 12;
 gameParticles.push({
 type: "dance_note",
 src: noteSrc,
 x: nX,
 y: nY,
 vx: (Math.random() - 0.5) * 0.5,
 vy: -(0.70 + Math.random() * 0.55),
 scale: 0.20 + Math.random() * 0.08,
 rot: (Math.random() - 0.5) * 0.4,
 rotSpeed: (Math.random() - 0.5) * 1.5,
 life: 0.75 + Math.random() * 0.25,
 maxLife: 0.75 + Math.random() * 0.25
 });
 requestRender();
 }

 // 2. Angry Comic Red Steam Fumes
 else if (player.afkAction === "angry" && player.afkParticleTimer >= 0.16) {
 player.afkParticleTimer = 0;
 const earSide = Math.random() < 0.5 ? -6 : 6;
 gameParticles.push({
 type: "anger_fume",
 x: player.x + player.width / 2 + earSide + (Math.random() - 0.5) * 3,
 y: player.y + 4 + (Math.random() - 0.5) * 4,
 vx: earSide * 0.08 + (Math.random() - 0.5) * 0.2,
 vy: -(0.6 + Math.random() * 0.5),
 radius: 2.2 + Math.random() * 1.8,
 life: 0.45 + Math.random() * 0.15,
 maxLife: 0.45 + Math.random() * 0.15
 });
 requestRender();
 }

 // 3. Cheerful Celebration Star Confetti
 else if (player.afkAction === "cheer" && player.afkParticleTimer >= 0.18) {
 player.afkParticleTimer = 0;
 const cheerColors = ["#facc15", "#38bdf8", "#ec4899", "#a855f7", "#4ade80", "#fb923c"];
 gameParticles.push({
 type: "cheer_star",
 x: player.x + player.width / 2 + (Math.random() - 0.5) * 24,
 y: player.y - 4 + (Math.random() - 0.5) * 10,
 vx: (Math.random() - 0.5) * 1.2,
 vy: -(1.2 + Math.random() * 1.0),
 size: 2.5 + Math.random() * 2.0,
 color: cheerColors[Math.floor(Math.random() * cheerColors.length)],
 rot: Math.random() * Math.PI * 2,
 rotSpeed: (Math.random() - 0.5) * 6.0,
 life: 0.65 + Math.random() * 0.25,
 maxLife: 0.65 + Math.random() * 0.25
 });
 requestRender();
 }
 }
 }

 // Delta-time normalization: base is 60fps (dt = 0.0166s -> timeScale = 1.0)
 const timeScale = Math.max(0.5, Math.min(2.5, (dt || 0.0166) * 60));

 // Moderator Mode: Ultra-Fast Free 8-Way Flight & Noclip
 if (player.moderatorMode) {
 player.sparkleTimer = (player.sparkleTimer || 0) + dt;
 const nextInterval = player.nextSparkleInterval || 2.2;
 if (player.sparkleTimer >= nextInterval) {
 player.sparkleTimer = 0;
 player.nextSparkleInterval = 2.0 + Math.random() * 1.0; // 2 to 3 seconds
 const spawnCount = 2; // spawn 2 sparkles
 for (let s = 0; s < spawnCount; s++) {
 const offsetX = (Math.random() - 0.5) * 36;
 const offsetY = (Math.random() - 0.5) * 38 - 4;
 const lifeTime = 0.55 + Math.random() * 0.20;
 gameParticles.push({
 type: "purple_sparkle",
 x: (player.x + player.width / 2) + offsetX,
 y: (player.y + player.height / 2) + offsetY,
 vx: (Math.random() - 0.5) * 0.4,
 vy: -(0.3 + Math.random() * 0.4),
 scale: 0.80 + Math.random() * 0.40,
 life: lifeTime,
 maxLife: lifeTime
 });
 }
 requestRender();
 }

 const modSpeed = 8.5;
 if (player.keys.left) {
 player.vx = -modSpeed;
 player.facing = -1;
 player.state = "walk";
 } else if (player.keys.right) {
 player.vx = modSpeed;
 player.facing = 1;
 player.state = "walk";
 } else {
 player.vx *= Math.pow(0.70, timeScale);
 if (Math.abs(player.vx) < 0.1) player.vx = 0;
 player.state = "idle";
 }

 if (player.keys.up || player.keys.jump) {
 player.vy = -modSpeed;
 } else if (player.keys.down) {
 player.vy = modSpeed;
 } else {
 player.vy *= Math.pow(0.70, timeScale);
 if (Math.abs(player.vy) < 0.1) player.vy = 0;
 }

 player.x += player.vx * timeScale;
 player.y += player.vy * timeScale;
 player.isGrounded = false;
 } else {
 // Normal Game Mode Physics

 // Horizontal Movement (10% tuned speed for authentic platforming)
 if (player.keys.left) {
 player.vx -= 1.62 * timeScale;
 player.facing = -1;
 if (player.isGrounded) player.state = "walk";
 } else if (player.keys.right) {
 player.vx += 1.62 * timeScale;
 player.facing = 1;
 if (player.isGrounded) player.state = "walk";
 } else {
 player.vx *= Math.pow(0.68, timeScale);
 if (Math.abs(player.vx) < 0.1) player.vx = 0;
 if (player.isGrounded) player.state = "idle";
 }

 // Max walk speed: 5.58 px/frame (10% decrease from 6.2)
 player.vx = Math.max(-5.58, Math.min(5.58, player.vx));

 // Dynamic Footstep & Skid Particles + Sound Effects (Randomized footstep1-7 with 200ms gap, nonstop while moving)
 const isMovingOnGround = player.isGrounded && (player.keys.left || player.keys.right || Math.abs(player.vx) > 0.35);
 const isSkidding = player.isGrounded && Math.abs(player.vx) > 1.8 && ((player.vx > 0 && player.keys.left) || (player.vx < 0 && player.keys.right));

 if (isSkidding) {
 player.stepParticleTimer = (player.stepParticleTimer || 0) + dt;
 if (player.stepParticleTimer >= 0.08) {
 player.stepParticleTimer = 0;
 const footX = player.x + player.width / 2;
 spawnFootstepDust(footX, player.y + player.height, player.facing, true);
 playRandomFootstepSfx(0.90);
 }
 } else if (isMovingOnGround) {
 player.stepParticleTimer = (player.stepParticleTimer || 0) + dt;
 if (player.stepParticleTimer >= 0.20) { // Exact 200ms gap continuous loop
 player.stepParticleTimer = 0;
 const footX = player.facing > 0 ? (player.x + 3) : (player.x + player.width - 3);
 spawnFootstepDust(footX, player.y + player.height, player.facing, false);
 playRandomFootstepSfx(0.85);
 }
 } else {
 // When user stops moving, immediately reset timer to 0.19 so next step starts promptly
 player.stepParticleTimer = 0.19;
 }

 // ── Authentic Growtopia Checkpoint Detection & Save ──
 const cpTileX = Math.floor((player.x + player.width / 2) / TILE_SIZE);
 const cpTileY = Math.floor((player.y + player.height / 2) / TILE_SIZE);
 const cpIdx = (cpTileX >= 0 && cpTileX < world.width && cpTileY >= 0 && cpTileY < world.height) ? (cpTileY * world.width + cpTileX) : -1;
 const cpFgId = cpIdx !== -1 ? world.fg[cpIdx] : 0;
 const cpItem = cpFgId > 0 ? getItem(cpFgId) : null;
 const isCheckpointTile = cpItem && (cpItem.action === 27 || (cpItem.name || "").toLowerCase().includes("checkpoint"));

 if (isCheckpointTile) {
 if (!player.lastCheckpoint || player.lastCheckpoint.x !== cpTileX || player.lastCheckpoint.y !== cpTileY) {
 player.lastCheckpoint = { x: cpTileX, y: cpTileY, name: cpItem.name };
 playSfx("success", 1.0, 0.85);
 spawnFloatingText(cpTileX, cpTileY, " Checkpoint Saved!", "#4ade80");
 onStatusMessage(` Checkpoint activated at (${cpTileX}, ${cpTileY})!`);
 // Golden sparkles on checkpoint activation
 for (let i = 0; i < 8; i++) {
 gameParticles.push({
 type: "gem_sparkle",
 x: cpTileX * TILE_SIZE + 16 + (Math.random() - 0.5) * 16,
 y: cpTileY * TILE_SIZE + 16 + (Math.random() - 0.5) * 16,
 vx: (Math.random() - 0.5) * 2.0,
 vy: -1.5 - Math.random() * 1.5,
 scale: 0.6 + Math.random() * 0.4,
 rot: Math.random() * Math.PI,
 rotSpeed: (Math.random() - 0.5) * 3,
 life: 0.5 + Math.random() * 0.3,
 maxLife: 0.8,
 color: "#4ade80"
 });
 }
 requestRender();
 }
 }

 // ── Authentic Growtopia Door / Entrance Enter Logic ──
 if (player.doorWarpCooldown > 0) {
 player.doorWarpCooldown = Math.max(0, player.doorWarpCooldown - dt);
 }

 const playerCenterTileX = Math.floor((player.x + player.width / 2) / TILE_SIZE);
 const playerCenterTileY = Math.floor((player.y + player.height / 2) / TILE_SIZE);
 const playerOverIdx = (playerCenterTileX >= 0 && playerCenterTileX < world.width && playerCenterTileY >= 0 && playerCenterTileY < world.height) ? (playerCenterTileY * world.width + playerCenterTileX) : -1;
 const standingFgId = playerOverIdx !== -1 ? world.fg[playerOverIdx] : 0;
 const standingFgItem = standingFgId > 0 ? getItem(standingFgId) : null;
 const isAtDoor = standingFgItem && (standingFgId === 6 || isDoorItem(standingFgItem));

 // Pressing UP / W while standing in front of a door enters the door!
 if (isAtDoor && player.keys.up && !player.jumpConsumed && player.doorWarpCooldown === 0) {
 const entered = warpThroughDoor(playerCenterTileX, playerCenterTileY);
 if (entered) {
 // Handled by door entry
 }
 }

 // Jump & Double Jump
 const wantsJump = player.keys.jump || (player.keys.up && !isAtDoor);
 if (wantsJump && !player.jumpConsumed) {
 if (player.isGrounded || player.jumpCount === 0) {
 player.vy = -10.5;
 player.isGrounded = false;
 player.jumpCount = 1;
 player.jumpConsumed = true;
 player.jumpThrustTimer = 0.22; // Power jump kick!
 player.jumpSpinTimer = 0.28; // 360-degree power spin!
 player.state = "jump";
 playJumpSound(false);
 } else if (player.jumpCount === 1) {
 player.vy = -9.2;
 player.jumpCount = 2;
 player.jumpConsumed = true;
 player.jumpThrustTimer = 0.22; // Power jump kick!
 player.jumpSpinTimer = 0.28; // 360-degree power spin!
 player.state = "jump";
 playJumpSound(true);
 }
 }

 // Snappy, Crisp Gravity
 player.vy += 0.58 * timeScale;
 if (player.vy > 11.5) player.vy = 11.5;

 // Apply X movement and check collision
 player.x += player.vx * timeScale;
 resolvePlayerCollisionX();

 // Apply Y movement and check collision
 const wasGrounded = player.isGrounded;
 player.y += player.vy * timeScale;
 player.isGrounded = false;
 resolvePlayerCollisionY();

 // Landing Dust Puff Burst & Squash + hitground.wav Impact SFX
 if (!wasGrounded && player.isGrounded) {
 player.landingSquashTimer = 0.14;
 spawnLandingDust(player.x + player.width / 2, player.y + player.height);
 playSfx("hitground", 0.96 + Math.random() * 0.08, 0.85);
 }
 }

 // Continuous Smooth Animation Blend Weights (Zero jump-cut transition)
 const isWalkingOnGround = (player.state === "walk" && player.isGrounded) || (player.isGrounded && Math.abs(player.vx) > 0.15);
 if (isWalkingOnGround) {
 player.walkBlend = Math.min(1.0, (player.walkBlend || 0) + dt * 10.0);
 const strideSpeed = 15;
 const strideMultiplier = Math.min(1.25, Math.max(0.65, Math.abs(player.vx) / 3.2));
 player.walkPhase = (player.walkPhase || 0) + dt * strideSpeed * strideMultiplier;
 } else {
 player.walkBlend = Math.max(0.0, (player.walkBlend || 0) - dt * 10.0);
 if (player.walkBlend > 0) {
 player.walkPhase = (player.walkPhase || 0) + dt * 15 * (player.walkBlend || 0);
 }
 }

 const isJumpingState = player.state === "jump" || (!player.isGrounded && player.vy < -0.5);
 if (isJumpingState) {
 player.jumpBlend = Math.min(1.0, (player.jumpBlend || 0) + dt * 14.0);
 } else {
 player.jumpBlend = Math.max(0.0, (player.jumpBlend || 0) - dt * 12.0);
 }

 const isFallingState = !player.isGrounded && player.vy > 0.8;
 if (isFallingState) {
 player.fallBlend = Math.min(1.0, (player.fallBlend || 0) + dt * 10.0);
 } else {
 player.fallBlend = Math.max(0.0, (player.fallBlend || 0) - dt * 12.0);
 }

 const isFloatingState = Boolean(player.moderatorMode);
 if (isFloatingState) {
 player.floatBlend = Math.min(1.0, (player.floatBlend || 0) + dt * 8.0);
 } else {
 player.floatBlend = Math.max(0.0, (player.floatBlend || 0) - dt * 10.0);
 }

 // World Bounds Check
 const worldPixelW = world.width * TILE_SIZE;
 const worldPixelH = world.height * TILE_SIZE;
 if (player.x < 0) { player.x = 0; player.vx = 0; }
 if (player.x + player.width > worldPixelW) { player.x = worldPixelW - player.width; player.vx = 0; }
 if (player.y > worldPixelH + 120) {
 respawnPlayer("Fell into the void!");
 }

 // Continuous Movement, Running & Falling Tracking
 const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
 const isPlayerMoving = (playerSpeed > 0.45 || player.keys.left || player.keys.right || player.keys.up || player.keys.down || player.keys.jump) && !player.isDead;
 if (isPlayerMoving) {
 player.continuousMoveTimer = (player.continuousMoveTimer || 0) + dt;
 } else {
 player.continuousMoveTimer = 0;
 }

 // Running timer for serious face expression (active after >= 1.5s running horizontally, stays until stopped)
 const isRunningHoriz = (Math.abs(player.vx) > 0.45 || (player.state === "walk" && (player.keys.left || player.keys.right))) && !player.isDead;
 if (isRunningHoriz && player.isGrounded) {
 player.continuousRunTimer = (player.continuousRunTimer || 0) + dt;
 } else if (isRunningHoriz && !player.isGrounded) {
 // preserve timer mid-air if sprinting
 } else {
 player.continuousRunTimer = 0;
 }

 // Falling timer for falling camera rumble shake (active after falling >= 0.5s)
 const isFallingInAir = !player.isGrounded && player.vy > 1.0 && !player.moderatorMode && !player.isDead;
 if (isFallingInAir) {
 player.continuousFallTimer = (player.continuousFallTimer || 0) + dt;
 } else {
 player.continuousFallTimer = 0;
 }

 // ONLY spawn wind effects when the character has moved continuously for >= 1.0 second
 if (isPlayerMoving && player.continuousMoveTimer >= 1.0) {
 player.windTrailTimer = (player.windTrailTimer || 0) + dt;
 if (player.windTrailTimer >= 0.10) {
 player.windTrailTimer = 0;
 const facing = player.facing || 1;
 const backOffset = facing > 0 ? -4 : (player.width + 4);
 const spawnX = player.x + backOffset + (Math.random() - 0.5) * 4;
 const spawnY = player.y + player.height - 12 + (Math.random() - 0.5) * 8;
 const driftVx = -player.vx * 0.12 + (Math.random() - 0.5) * 0.15;
 const driftVy = -player.vy * 0.08 - (0.12 + Math.random() * 0.15);

 gameParticles.push({
 type: "wind_breeze",
 x: spawnX,
 y: spawnY,
 vx: driftVx,
 vy: driftVy,
 scale: 0.55 + Math.random() * 0.25,
 rot: (Math.random() - 0.5) * 0.4,
 rotSpeed: (Math.random() - 0.5) * 1.2,
 life: 0.45 + Math.random() * 0.12,
 maxLife: 0.45 + Math.random() * 0.12
 });
 }

 // Dynamic Speed Wind Streak Lines (Streamline speed ribbons)
 if (playerSpeed > 0.6) {
 player.speedStreakTimer = (player.speedStreakTimer || 0) + dt;
 const streakInterval = playerSpeed > 2.5 ? 0.060 : 0.090;
 if (player.speedStreakTimer >= streakInterval) {
 player.speedStreakTimer = 0;
 const streakDir = player.vx !== 0 ? (player.vx > 0 ? 1 : -1) : (player.facing || 1);
 const streakCount = playerSpeed > 3.2 ? 2 : 1;
 for (let i = 0; i < streakCount; i++) {
 const sX = player.x + (streakDir > 0 ? -2 : player.width + 2) + (Math.random() - 0.5) * 4;
 const sY = player.y + 4 + Math.random() * (player.height - 8);
 const sLen = 22 + Math.random() * 26 + Math.min(20, playerSpeed * 3.5);
 gameParticles.push({
 type: "wind_streak",
 x: sX,
 y: sY,
 vx: -player.vx * 0.18 + (Math.random() - 0.5) * 0.15,
 vy: -player.vy * 0.04 + (Math.random() - 0.5) * 0.08,
 dir: streakDir,
 length: sLen,
 lineWidth: 1.0 + Math.random() * 0.4,
 waveOffset: Math.random() * Math.PI * 2,
 baseAlpha: 0.22 + Math.random() * 0.08,
 color: Math.random() < 0.4 ? "rgba(186, 230, 253, 0.65)" : "rgba(240, 249, 255, 0.55)",
 life: 0.48 + Math.random() * 0.12,
 maxLife: 0.48 + Math.random() * 0.12
 });
 }
 }
 }
 requestRender();
 }

 // Direct, Rock-Solid Center on Player in Game Mode (Zero vibration)
 if (canvas && player.active) {
 const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
 const viewW = canvas.width / dpr;
 const viewH = canvas.height / dpr;
 viewport.x = (viewW / 2) - (player.x + player.width / 2) * viewport.zoom;
 viewport.y = (viewH / 2) - (player.y + player.height / 2) * viewport.zoom;
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
 killPlayer(`Ouch! Hit ${item.name}!`);
 return;
 }

 if (isSolidBlock(item)) {
 if (isBouncyBlock(item)) {
 // Horizontal Pinball Bumper Bounce!
 if (player.vx > 0) {
 player.x = tx * TILE_SIZE - player.width - 2;
 player.vx = -Math.max(5.0, Math.abs(player.vx) * 1.35);
 } else if (player.vx < 0) {
 player.x = (tx + 1) * TILE_SIZE + 2;
 player.vx = Math.max(5.0, Math.abs(player.vx) * 1.35);
 }
 playSfx("pinball", 1.0, 0.85);
 spawnPunchImpactEffect(tx, ty);
 requestRender();
 } else {
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
 killPlayer(`Ouch! Hit ${item.name}!`);
 return;
 }

 const isSolid = isSolidBlock(item);
 const isPlatform = isPlatformBlock(item);

 if (isSolid) {
 if (player.vy > 0) {
 if (isBouncyBlock(item)) {
 // Super Bouncy Block / Mushroom / Pinball Spring Launch!
 const isSproinger = (item.name || "").toLowerCase().includes("sproinger") || Number(item.id) === 624;
 const bounceStrength = isSproinger ? -15.5 : -13.2;
 player.vy = bounceStrength;
 player.y = ty * TILE_SIZE - player.height - 2;
 player.isGrounded = false;
 player.jumpCount = 1;
 player.jumpConsumed = false;
 player.jumpSpinTimer = 0.38; // 360 acrobatic power spin!
 playSfx("trampoline", 1.0, 0.9);
 playSfx("pinball", 1.0, 0.85);
 spawnLandingDust(player.x + player.width / 2, player.y + player.height);
 spawnFloatingText(tx, ty, "BOING!", "#38bdf8");
 requestRender();
 } else {
 player.y = ty * TILE_SIZE - player.height;
 player.vy = 0;
 player.isGrounded = true;
 player.jumpCount = 0;
 player.jumpConsumed = false;
 }
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

 // ── ElectroMagnet Particle Sequence (12 Frames) ──
 const electroMagnetFrames = [];
 for (let i = 1; i <= 12; i++) {
 const pad = String(i).padStart(3, "0");
 electroMagnetFrames.push(`particles/electromagnet/ElectroMagnet_${pad}.png`);
 }

 // ── Block Break / Place Particle Sequence (10 Frames) ──
 const breakParticleFrames = [];
 for (let i = 1; i <= 10; i++) {
 const pad = String(i).padStart(3, "0");
 breakParticleFrames.push(`particles/breaks/Breaks_${pad}.png`);
 }

 // ── Death Heart Particles ──
 const deathHeartImages = [
 "particles/hearts/Heart_001.png",
 "particles/hearts/Heart_002.png",
 "particles/hearts/HeartGlow_001.png",
 "particles/hearts/HeartGlow_002.png"
 ];

 // ── Crystal Orb 3D Orbit Sequence (16 Frames) ──
 const crystalOrbFrames = [];
 for (let i = 1; i <= 16; i++) {
 const pad = String(i).padStart(3, "0");
 crystalOrbFrames.push(`particles/crystal_orbs/CrystalOrbs_${pad}.png`);
 }

 // ── Mod Portal Astral Sequence (10 Frames in Purple-Blue) ──
 const modPortalFrames = [];
 for (let i = 1; i <= 10; i++) {
 const pad = String(i).padStart(3, "0");
 modPortalFrames.push(`particles/mod_portal/ModPortal_${pad}.png`);
 }

 // ── Mod Sparkle Particle Sequence (6 Frames) ──
 const purpleSparkleFrames = [];
 for (let i = 1; i <= 6; i++) {
 const pad = String(i).padStart(3, "0");
 purpleSparkleFrames.push(`particles/sparkles/PurpleStar_${pad}.png`);
 }

 // ── Wind Movement Breeze Particle Sequence (3 Frames) ──
 const windMoveFrames = [
 "particles/wind/WindMoves_001.png",
 "particles/wind/WindMoves_002.png",
 "particles/wind/WindMoves_003.png"
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
 electroMagnetFrames.forEach(path => {
 getSpriteImage(path);
 });
 breakParticleFrames.forEach(path => {
 getSpriteImage(path);
 });
 deathHeartImages.forEach(path => {
 getSpriteImage(path);
 });
 crystalOrbFrames.forEach(path => {
 getSpriteImage(path);
 });
 modPortalFrames.forEach(path => {
 getSpriteImage(path);
 });
 purpleSparkleFrames.forEach(path => {
 getSpriteImage(path);
 });
 windMoveFrames.forEach(path => {
 getSpriteImage(path);
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

 let avatarMaskCanvas = null;
 let avatarMaskCtx = null;
 function getAvatarMaskCtx() {
 if (!avatarMaskCanvas && typeof document !== "undefined") {
 avatarMaskCanvas = document.createElement("canvas");
 avatarMaskCanvas.width = 64;
 avatarMaskCanvas.height = 64;
 avatarMaskCtx = avatarMaskCanvas.getContext("2d");
 }
 return { canvas: avatarMaskCanvas, ctx: avatarMaskCtx };
 }

 function drawCrystalOrbs(ctx, px, py, pw, ph, layer) {
 if (!player.moderatorMode || player.isDead) return;
 const cx = px + pw / 2;
 const cy = py + ph / 2 + 1;
 const t = player.animTimer;
 const rx = 27; // Horizontal elliptical span
 const ry = 7.5; // Vertical orbit tilt
 const orbitSpeed = 2.4; // 3D orbit speed
 const orbCount = 3; // 3 Symmetrical orbiting crystal orbs

 for (let i = 0; i < orbCount; i++) {
 const ang = t * orbitSpeed + (i * ((Math.PI * 2) / orbCount));
 const oz = Math.sin(ang); // < 0 is behind character, >= 0 is in front

 if (layer === "behind" && oz >= 0) continue;
 if (layer === "front" && oz < 0) continue;

 const ox = cx + Math.cos(ang) * rx;
 const oy = cy + Math.sin(ang) * ry;

 // 16-frame looping crystal orb animation
 const frameFps = 16;
 const frameIdx = Math.floor((t * frameFps + i * 5) % 16);
 const imgSrc = crystalOrbFrames[frameIdx];
 const img = getSpriteImage(imgSrc);

 if (img && img.complete && img.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 // Dynamic 3D depth scaling (sweet spot size)
 const depthScale = 0.78 + (oz + 1.0) * 0.18; // 0.78 to 1.14
 const depthAlpha = 0.75 + (oz + 1.0) * 0.12;
 ctx.globalAlpha = Math.max(0, Math.min(1, depthAlpha));
 ctx.shadowColor = "#38bdf8";
 ctx.shadowBlur = 5 * depthScale;
 ctx.translate(ox, oy);
 ctx.scale(depthScale, depthScale);
 ctx.drawImage(img, -8, -8, 16, 16);
 ctx.restore();
 }
 }
 }

 function drawPlayerAvatar(ctx) {
 ctx.save();
 const px = player.x;
 const py = player.y;
 const pw = player.width;
 const ph = player.height;

 // Shadow beneath player (Adjusted height and natural soft spread)
 if (!player.isDead) {
 ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
 ctx.beginPath();
 ctx.ellipse(px + pw / 2, py + ph + 3, pw * 0.58, 2.5, 0, 0, Math.PI * 2);
 ctx.fill();
 }

 // ── Enhanced Legendary Moderator Celestial Aura & Orbital Energy Rings ──
 if (player.moderatorMode && !player.isDead) {
 ctx.save();
 const centerX = px + pw / 2;
 const centerY = py + ph / 2;
 const t = player.animTimer;

 // 1. Soft Radiant Radial Core Glow
 if (typeof ctx.createRadialGradient === "function") {
 const radialGlow = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, 38);
 radialGlow.addColorStop(0, "rgba(168, 85, 247, 0.45)");
 radialGlow.addColorStop(0.5, "rgba(56, 189, 248, 0.20)");
 radialGlow.addColorStop(1, "rgba(168, 85, 247, 0)");
 ctx.fillStyle = radialGlow;
 ctx.beginPath();
 ctx.arc(centerX, centerY, 38, 0, Math.PI * 2);
 ctx.fill();
 }

 // ── Mod Astral Portal Backdrop (10-Frame Looping Sequence in Purple-Blue) ──
 const portalFps = 12;
 const portalIndex = Math.floor((t * portalFps) % 10);
 const portalSrc = modPortalFrames[portalIndex];
 const portalImg = getSpriteImage(portalSrc);
 if (portalImg && portalImg.complete && portalImg.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 const portalSize = 54;
 ctx.globalAlpha = 0.88;
 ctx.shadowColor = "#692ff6";
 ctx.shadowBlur = 8;
 ctx.drawImage(portalImg, centerX - portalSize / 2, centerY - portalSize / 2 + 1, portalSize, portalSize);
 ctx.restore();
 }

 // ── ElectroMagnet Electrical Power Surge (12-Frame Looping Sequence) ──
 const emFps = 13;
 const emIndex = Math.floor((t * emFps) % 12);
 const emSrc = electroMagnetFrames[emIndex];
 const emImg = getSpriteImage(emSrc);

 if (emImg && emImg.complete && emImg.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 const emSize = 64;
 const emX = centerX - emSize / 2;
 const emY = (py + ph + 4) - emSize;
 
 ctx.shadowColor = "#c084fc";
 ctx.shadowBlur = 10;
 ctx.globalAlpha = 0.95;
 ctx.drawImage(emImg, emX, emY, emSize, emSize);
 ctx.restore();
 }

 // 2. Rotating Diamond Flare Starburst Rays
 ctx.save();
 ctx.translate(centerX, centerY);
 ctx.rotate(t * 0.6);
 const rayCount = 8;
 for (let r = 0; r < rayCount; r++) {
 ctx.save();
 ctx.rotate((r * Math.PI * 2) / rayCount);
 const rayLen = (r % 2 === 0 ? 30 : 22) + Math.sin(t * 4 + r) * 3;
 const rayGrad = ctx.createLinearGradient(0, 0, 0, -rayLen);
 rayGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
 rayGrad.addColorStop(0.4, r % 2 === 0 ? "rgba(0, 229, 255, 0.45)" : "rgba(192, 132, 252, 0.45)");
 rayGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
 ctx.fillStyle = rayGrad;
 ctx.beginPath();
 ctx.moveTo(-2.2, 0);
 ctx.lineTo(0, -rayLen);
 ctx.lineTo(2.2, 0);
 ctx.closePath();
 ctx.fill();
 ctx.restore();
 }
 ctx.restore();

 // 3. Primary Celestial Orbital Ring
 ctx.save();
 ctx.translate(centerX, centerY);
 ctx.rotate(0.32);
 const ringPulse = 0.75 + 0.25 * Math.sin(t * 3.5);
 ctx.shadowColor = "#38bdf8";
 ctx.shadowBlur = 10 * ringPulse;
 ctx.strokeStyle = "rgba(56, 189, 248, " + ringPulse + ")";
 ctx.lineWidth = 1.8;
 ctx.beginPath();
 ctx.ellipse(0, 0, pw * 0.95, ph * 0.72, 0, 0, Math.PI * 2);
 ctx.stroke();

 // Secondary Counter-Rotating Ring
 ctx.rotate(-0.64);
 ctx.shadowColor = "#c084fc";
 ctx.shadowBlur = 8 * ringPulse;
 ctx.strokeStyle = "rgba(192, 132, 252, " + (ringPulse * 0.85) + ")";
 ctx.lineWidth = 1.2;
 ctx.beginPath();
 ctx.ellipse(0, 0, pw * 0.88, ph * 0.68, 0, 0, Math.PI * 2);
 ctx.stroke();
 ctx.restore();

 // 4. Orbiting Celestial Gems
 const orbCount = 4;
 for (let o = 0; o < orbCount; o++) {
 const orbAngle = t * 2.2 + (o * Math.PI * 2) / orbCount;
 const ox = centerX + Math.cos(orbAngle) * (pw * 0.96);
 const oy = centerY + Math.sin(orbAngle) * (ph * 0.70);
 const isGold = o % 2 === 0;

 ctx.save();
 ctx.shadowColor = isGold ? "#fbbf24" : "#00e5ff";
 ctx.shadowBlur = 12;
 ctx.fillStyle = isGold ? "#f59e0b" : "#0284c7";
 ctx.beginPath();
 ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
 ctx.fill();

 ctx.fillStyle = isGold ? "#fef08a" : "#67e8f9";
 ctx.beginPath();
 ctx.arc(ox, oy, 2.0, 0, Math.PI * 2);
 ctx.fill();

 ctx.fillStyle = "#ffffff";
 ctx.beginPath();
 ctx.arc(ox - 0.7, oy - 0.7, 0.9, 0, Math.PI * 2);
 ctx.fill();
 ctx.restore();
 }
 ctx.restore();
 }

 // ── 3D Crystal Orbs Orbit (Behind Character Layer) ──
 drawCrystalOrbs(ctx, px, py, pw, ph, "behind");

 ctx.save();
 ctx.translate(px + pw / 2, py + ph / 2);
 if (player.facing < 0) ctx.scale(-1, 1);

 // ── Landing Squash & Stretch Transform (Satisfying bouncy impact) ──
 if (player.landingSquashTimer > 0) {
 const squashProgress = player.landingSquashTimer / 0.14;
 const squashFactor = Math.sin(squashProgress * Math.PI);
 const squashScaleX = 1.0 + squashFactor * 0.16;
 const squashScaleY = 1.0 - squashFactor * 0.16;
 ctx.translate(0, ph / 2);
 ctx.scale(squashScaleX, squashScaleY);
 ctx.translate(0, -ph / 2);
 }

 // Death Tumble Animation, Damage Flash & Ghost Fade
 if (player.isDead) {
 const deathProgress = 1.0 - Math.max(0, player.deathTimer / 0.85);
 const isDeathImpact = player.deathTimer > 0.70; // 0.15s initial damage hit flash
 if (isDeathImpact) {
 ctx.shadowColor = "#ef4444";
 ctx.shadowBlur = 12;
 }
 ctx.globalAlpha = Math.max(0, 1.0 - Math.pow(deathProgress, 2.2));
 const spinDir = player.vx < 0 ? -1 : 1;
 ctx.rotate(deathProgress * Math.PI * 6 * spinDir);
 const deathScale = Math.max(0.15, 1.0 + Math.sin(deathProgress * Math.PI * 0.5) * 0.2 - deathProgress * 0.6);
 ctx.scale(deathScale, deathScale);
 } else if (player.modTransformTimer > 0) {
 // Mod Transformation Electrical Strobe Flicker Effect (GPU-friendly zero lag)
 const transProg = 1.0 - (player.modTransformTimer / 0.65);
 // Rapid alternating holographic electrical flash
 const isFlickerOn = Math.sin((0.65 - player.modTransformTimer) * 55) > -0.2;
 ctx.globalAlpha = isFlickerOn ? 1.0 : 0.35;
 ctx.shadowColor = "#a855f7";
 ctx.shadowBlur = 14 * (1.0 - transProg);
 const transformScale = 1.0 + Math.sin(transProg * Math.PI) * 0.16;
 ctx.scale(transformScale, transformScale);
 } else if (player.respawnInvincible > 0) {
 ctx.globalAlpha = (player.animTimer % 0.2 < 0.1) ? 0.45 : 1.0;
 } else if (player.moderatorMode) {
 ctx.globalAlpha = 0.96;
 }

 const isWalking = player.state === "walk";
 const isJumping = player.state === "jump" || (!player.isGrounded && player.vy < -0.5);
 const isFalling = !player.isGrounded && player.vy > 0.8;
 const isFloating = player.moderatorMode;
 const t = player.animTimer;
 const fallIntensity = isFalling ? Math.min(1.0, Math.max(0, (player.vy - 0.8) / 8.0)) : 0;

 // Dynamic Falling Aerodynamic Stretch (Velocity Stretch) - Zero stretch in Mod mode, subtle in normal fall
 if (isFalling && !player.isDead && !player.moderatorMode) {
 const fallStretchY = 1.0 + fallIntensity * 0.04;
 const fallStretchX = 1.0 - fallIntensity * 0.02;
 ctx.translate(0, -ph / 2);
 ctx.scale(fallStretchX, fallStretchY);
 ctx.translate(0, ph / 2);
 }

 let isBlinking = (t % 3.8) < 0.14;

 // 360-Degree Single Jump Spin Throw (1x forward spin for back arm, 1x INVERTED spin for front arm!)
 const isJumpSpinning = player.jumpSpinTimer > 0;
 const jumpSpinProgress = isJumpSpinning ? (1.0 - player.jumpSpinTimer / 0.28) : 0;
 const jumpSpinAngleBack = jumpSpinProgress * Math.PI * 2; // 1x 360-degree forward spin
 const jumpSpinAngleFront = -jumpSpinProgress * Math.PI * 2; // 1x 360-degree INVERTED spin

 // Placing & Punch Dynamic Thrust & Snap Kinematics
 const isPunching = player.punchTimer > 0;
 const isPlacing = player.placeTimer > 0;
 const isActionActive = isPunching || isPlacing;
 const actionProg = isPunching ? (1.0 - (player.punchTimer / (player.punchMaxTimer || 0.24))) : (isPlacing ? (1.0 - (player.placeTimer / 0.28)) : 0);

 const actionThrustX = isActionActive ? Math.sin(actionProg * Math.PI) * 7.5 : 0;
 const placeSpinAngle = isPlacing ? (-actionProg * Math.PI * 2) : 0;
 const actionSnapAngle = isActionActive ? (-0.35 - Math.sin(actionProg * Math.PI) * 1.45 + (1.0 - actionProg) * 0.3) : 0;
 const actionTorsoLean = isActionActive ? Math.sin(actionProg * Math.PI) * 0.14 : 0;
 const actionHeadDip = isActionActive ? Math.sin(actionProg * Math.PI) * 0.08 : 0;
 const actionStepX = isActionActive ? Math.sin(actionProg * Math.PI) * 2.5 : 0;

 // Jump Thrust Leg Extension
 const jumpThrustY = player.jumpThrustTimer > 0 ? Math.sin((1.0 - player.jumpThrustTimer / 0.22) * Math.PI) * 4.0 : 0;

 // Blended kinematic weights (Continuous zero jump-cut blending)
 const wBlend = player.walkBlend !== undefined ? player.walkBlend : (isWalking ? 1.0 : 0.0);
 const jBlend = player.jumpBlend !== undefined ? player.jumpBlend : (isJumping ? 1.0 : 0.0);
 const fBlend = player.fallBlend !== undefined ? player.fallBlend : (isFalling ? 1.0 : 0.0);
 const flBlend = player.floatBlend !== undefined ? player.floatBlend : (isFloating ? 1.0 : 0.0);
 const idleBlend = Math.max(0, 1.0 - wBlend - jBlend - fBlend - flBlend);

 // Dynamic Running Forward Lean (Momentum & Weight)
 const runLean = (player.isGrounded && !isFloating) ? (0.09 * Math.min(1.0, Math.abs(player.vx) / 3.0) * wBlend) : 0;

 // Mod Flying Hover Float Wave
 const floatBob = isFloating ? Math.sin(t * 4.5) * 1.6 : 0;
 
 // Fluid Striding Walk Cycle
 const walkPhase = player.walkPhase || (t * 15);
 const walkCycleSin = Math.sin(walkPhase) * wBlend;
 const walkCycleCos = Math.cos(walkPhase) * wBlend;
 const walkStepBob = (player.isGrounded && !isFloating) ? (Math.abs(Math.sin(walkPhase)) * 1.8 * wBlend) : 0;
 const legHoverWave = Math.sin(t * 4.0) * 1.4;

 // ── SKELETAL AFK RANDOMIZED ACTION ANIMATIONS ──
 let afkHeadAngle = 0;
 let afkHeadX = 0;
 let afkHeadY = 0;
 let afkTorsoX = 0;
 let afkTorsoY = 0;
 let afkTorsoAngle = 0;
 let afkBackArmAngle = null;
 let afkFrontArmAngle = null;
 let afkLegROffset = 0;
 let afkLegLOffset = 0;

 if (player.afkAction && player.isGrounded && !isWalking) {
 if (player.afkAction === "sleep") {
 isBlinking = true;
 afkHeadAngle = 0.16 + Math.sin(t * 2.5) * 0.03;
 afkHeadY = 1.5;
 afkTorsoY = Math.sin(t * 2.5) * 1.2;
 afkBackArmAngle = 0.38 + Math.sin(t * 2.5) * 0.04;
 afkFrontArmAngle = 0.48 + Math.sin(t * 2.5) * 0.04;
 afkLegROffset = 0.6;
 afkLegLOffset = 0.6;
 } else if (player.afkAction === "dance") {
 afkTorsoX = Math.sin(t * 7.5) * 4.0;
 afkTorsoAngle = Math.sin(t * 7.5) * 0.22;
 afkHeadAngle = -Math.sin(t * 7.5) * 0.16;
 afkBackArmAngle = -Math.cos(t * 7.5) * 1.45;
 afkFrontArmAngle = Math.sin(t * 7.5) * 1.45;
 afkLegROffset = Math.max(0, Math.sin(t * 7.5)) * 3.5;
 afkLegLOffset = Math.max(0, -Math.sin(t * 7.5)) * 3.5;
 } else if (player.afkAction === "think") {
 afkHeadAngle = -0.14;
 afkHeadY = -0.5;
 afkFrontArmAngle = -1.85;
 afkBackArmAngle = 0.52;
 afkTorsoAngle = -0.04;
 } else if (player.afkAction === "cheer") {
 const hopY = -Math.abs(Math.sin(t * 11)) * 6.5;
 afkTorsoY = hopY;
 afkHeadY = hopY * 0.3;
 afkBackArmAngle = -2.35 + Math.sin(t * 14) * 0.25;
 afkFrontArmAngle = -2.35 - Math.sin(t * 14) * 0.25;
 afkLegROffset = Math.abs(Math.sin(t * 11)) * 2.0;
 afkLegLOffset = Math.abs(Math.sin(t * 11)) * 2.0;
 } else if (player.afkAction === "angry") {
 afkTorsoX = (Math.random() - 0.5) * 2.8;
 afkTorsoY = 1.0;
 afkHeadAngle = (Math.random() - 0.5) * 0.08;
 afkBackArmAngle = -0.75 + Math.sin(t * 30) * 0.18;
 afkFrontArmAngle = -0.75 + Math.cos(t * 30) * 0.18;
 afkLegROffset = Math.abs(Math.sin(t * 14)) * 3.8;
 } else if (player.afkAction === "wave") {
 afkHeadAngle = -0.10 + Math.sin(t * 5) * 0.05;
 afkFrontArmAngle = -2.1 + Math.sin(t * 10) * 0.45;
 afkBackArmAngle = 0.30;
 afkTorsoY = Math.sin(t * 4) * 0.8;
 } else if (player.afkAction === "laugh") {
 const laughBounce = Math.abs(Math.sin(t * 14)) * 2.5;
 afkTorsoY = laughBounce;
 afkTorsoAngle = 0.20 + Math.sin(t * 14) * 0.08;
 afkHeadAngle = 0.15 + Math.sin(t * 14) * 0.10;
 afkBackArmAngle = -0.65;
 afkFrontArmAngle = -1.25;
 }
 }

 const breatheBob = (player.isGrounded ? (Math.sin(t * 4) * 0.75 * idleBlend - walkStepBob + afkTorsoY) : 0) + (isJumping ? -1.8 * jBlend : 0) + (isFalling ? 1.2 * fBlend : 0) + (floatBob * flBlend);
 const legRLift = isWalking ? (Math.max(0, walkCycleSin) * 2.8) : afkLegROffset;
 const legLLift = isWalking ? (Math.max(0, -walkCycleSin) * 2.8) : afkLegLOffset;
 const idleArmWiggle = (player.isGrounded && !isWalking) ? (Math.sin(t * 2.5) * 0.08 * idleBlend) : 0;

 // ── Ultra-Subtle Pupil Gaze Vector & 100% Strict Lock Forward Support ──
 let pupilOffsetX = 0;
 let pupilOffsetY = 0;
 const eyeMode = player.eyeTrackingMode || "cursor";
 if (eyeMode !== "forward" && player.isDesktopCursor) {
 const eyeWorldX = px + pw / 2 + player.facing * 4;
 const eyeWorldY = py + 6;
 const dx = player.cursorWorldX - eyeWorldX;
 const dy = player.cursorWorldY - eyeWorldY;
 const dist = Math.sqrt(dx * dx + dy * dy) || 1;
 pupilOffsetX = player.facing * Math.max(-0.4, Math.min(0.4, (dx / dist) * 0.5));
 pupilOffsetY = Math.max(-0.25, Math.min(0.25, (dy / dist) * 0.3));
 } else {
 pupilOffsetX = 0;
 pupilOffsetY = 0;
 }

 const skin = player.skinStyle || "classic";
 const cOffsets = player.clothesOffsets || { hair: { x: 0, y: -6 }, shirt: { x: 0, y: 0 }, pants: { x: 0, y: 0 } };

 function renderAvatarParts(tCtx) {
 if (skin === "classic" || skin === "growtopia" || skin === "builder") {
 // ── 1. Authentic Growtopia Set Character Engine ──
 tCtx.imageSmoothingEnabled = false;

 const imgArmR = getSpriteImage("character_base_assets/gt_parts/arm_r.png");
 const imgArmL = getSpriteImage("character_base_assets/gt_parts/arm_l.png");
 const imgLegR = getSpriteImage("character_base_assets/gt_parts/leg_r.png");
 const imgLegL = getSpriteImage("character_base_assets/gt_parts/leg_l.png");
 const imgBody = getSpriteImage("character_base_assets/gt_parts/body.png");

 const imgSclera = getSpriteImage("character_base_assets/gt_parts/eyeballs_sclera.png");
 const isSeriousFace = (player.continuousRunTimer >= 1.5) && !player.moderatorMode;
 const isJumpFace = isJumping && !player.moderatorMode;

 let imgHeadMask = null;
 if (isJumpFace) {
 imgHeadMask = isBlinking ?
 getSpriteImage("character_base_assets/gt_parts/head_jump_blink.png") :
 getSpriteImage("character_base_assets/gt_parts/head_jump.png");
 } else if (isSeriousFace) {
 imgHeadMask = isBlinking ?
 getSpriteImage("character_base_assets/gt_parts/head_serious_blink.png") :
 getSpriteImage("character_base_assets/gt_parts/head_serious.png");
 } else {
 imgHeadMask = isBlinking ?
 getSpriteImage("character_base_assets/gt_parts/head_blink.png") :
 getSpriteImage("character_base_assets/gt_parts/head_mask.png");
 }

 const jumpIntensity = isJumping ? Math.min(1.0, Math.abs(player.vy) / 10.0) : 0;

 // 1. Back Arm (Tangan Kanan) - Smooth dynamic blended pose
 let backArmAngle = 0;
 if (isJumpSpinning) {
 backArmAngle = jumpSpinAngleBack;
 } else if (isActionActive) {
 backArmAngle = 0.55 + Math.sin(actionProg * Math.PI) * 0.40;
 } else if (afkBackArmAngle !== null) {
 backArmAngle = afkBackArmAngle;
 } else {
 const idleAng = -idleArmWiggle;
 const walkAng = -walkCycleCos * 0.85;
 const jumpAng = -1.95 - jumpIntensity * 0.35 + Math.sin(t * 10) * 0.08;
 const fallAng = -1.75 - fallIntensity * 0.35 + Math.sin(t * 22) * 0.14;
 const floatAng = -0.75 + Math.sin(t * 5) * 0.1;
 backArmAngle = (idleAng * idleBlend) + (walkAng * wBlend) + (jumpAng * jBlend) + (fallAng * fBlend) + (floatAng * flBlend);
 }

 tCtx.save();
 tCtx.translate(8 + afkTorsoX, 4 + breatheBob);
 tCtx.rotate(backArmAngle);
 if (imgArmR && imgArmR.complete && imgArmR.naturalWidth > 0) {
 tCtx.drawImage(imgArmR, -24, -20, 32, 32);
 }
 tCtx.restore();

 // 2. Back Leg (Kaki Kanan)
 let legRAngle = 0;
 const floatLegRAng = 0.40 + Math.sin(t * 4) * 0.08;
 const fallLegRAng = -0.15 + Math.sin(t * 16) * 0.10;
 const jumpLegRAng = -0.45 - jumpIntensity * 0.20;
 const walkLegRAng = walkCycleSin * 0.65;
 legRAngle = (walkLegRAng * wBlend) + (jumpLegRAng * jBlend) + (fallLegRAng * fBlend) + (floatLegRAng * flBlend);

 const legRY = isFloating ? (10 + floatBob + legHoverWave) : (8 - legRLift + jumpThrustY);
 const pxLeg = (cOffsets.pants ? cOffsets.pants.x : 0) || 0;
 const pyLeg = (cOffsets.pants ? cOffsets.pants.y : 0) || 0;

 tCtx.save();
 tCtx.translate(8 + afkTorsoX + pxLeg, legRY + pyLeg);
 tCtx.rotate(legRAngle);
 if (imgLegR && imgLegR.complete && imgLegR.naturalWidth > 0) {
 tCtx.drawImage(imgLegR, -24, -24, 32, 32);
 }
 tCtx.restore();

 // 3. Front Leg (Kaki Kiri)
 let legLAngle = 0;
 const floatLegLAng = 0.30 - Math.sin(t * 4) * 0.08;
 const fallLegLAng = 0.40 + Math.cos(t * 16) * 0.10;
 const jumpLegLAng = 0.55 + jumpIntensity * 0.20;
 const walkLegLAng = -walkCycleSin * 0.65;
 legLAngle = (walkLegLAng * wBlend) + (jumpLegLAng * jBlend) + (fallLegLAng * fBlend) + (floatLegLAng * flBlend);

 const legLY = isFloating ? (10 + floatBob - legHoverWave) : (8 - legLLift + jumpThrustY);
 tCtx.save();
 tCtx.translate(-4 + afkTorsoX + pxLeg, legLY + pyLeg);
 tCtx.rotate(legLAngle);
 if (imgLegL && imgLegL.complete && imgLegL.naturalWidth > 0) {
 tCtx.drawImage(imgLegL, -12, -24, 32, 32);
 }
 tCtx.restore();

 // 4. Torso & Shirt with Forward Run Lean, Walk Twist & Placing/Punch Lunge
 const sxShirt = (cOffsets.shirt ? cOffsets.shirt.x : 0) || 0;
 const syShirt = (cOffsets.shirt ? cOffsets.shirt.y : 0) || 0;
 const torsoTwist = (Math.sin(walkPhase) * 0.04 * wBlend) + (isJumping ? -0.06 * jumpIntensity * jBlend : 0);

 tCtx.save();
 tCtx.translate(afkTorsoX + sxShirt + actionStepX, breatheBob + syShirt);
 tCtx.rotate(afkTorsoAngle + runLean + torsoTwist + actionTorsoLean);
 if (imgBody && imgBody.complete && imgBody.naturalWidth > 0) {
 tCtx.drawImage(imgBody, -16, -16, 32, 32);
 }

 // 5. Head Layering with Eyeballs & Pupils UNDER Head Mask
 tCtx.save();
 const headBobLag = (Math.sin(walkPhase - 0.5) * 0.85 * wBlend);
 const fallHeadTilt = (0.12 + fallIntensity * 0.10) * fBlend;
 const jumpHeadTilt = (-0.10 * jumpIntensity) * jBlend;
 tCtx.translate(afkHeadX - sxShirt + actionStepX * 0.5, afkHeadY - syShirt + headBobLag);
 tCtx.rotate(afkHeadAngle + fallHeadTilt + jumpHeadTilt + actionHeadDip + (-walkCycleSin * 0.05 * wBlend));

 if (player.moderatorMode) {
 // ── Glowing Pure White Eyeballs (Mod Mode - Clean Authentic Sclera Glow, No Pupils) ──
 const eyePulse = 0.70 + 0.30 * Math.sin(t * 6.0);
 
 // Layer A: Authentic White Sclera Base with soft glowing aura behind head mask
 if (!isBlinking && imgSclera && imgSclera.complete && imgSclera.naturalWidth > 0) {
 tCtx.save();
 tCtx.shadowColor = "#38bdf8";
 tCtx.shadowBlur = 6 + 6 * eyePulse;
 tCtx.drawImage(imgSclera, -16, -16, 32, 32);
 tCtx.restore();
 }

 // Layer B: Head Mask with transparent eye cutouts (Frames the white eyes naturally)
 if (imgHeadMask && imgHeadMask.complete && imgHeadMask.naturalWidth > 0) {
 tCtx.drawImage(imgHeadMask, -16, -16, 32, 32);
 }

 // Layer C: Radiant Eye Aura radiating from the exact eyeball sprite pixels
 if (!isBlinking && imgSclera && imgSclera.complete && imgSclera.naturalWidth > 0) {
 tCtx.save();
 tCtx.globalCompositeOperation = "screen";
 tCtx.globalAlpha = 0.65 * eyePulse;
 tCtx.shadowColor = "#ffffff";
 tCtx.shadowBlur = 8 * eyePulse;
 tCtx.drawImage(imgSclera, -16, -16, 32, 32);
 tCtx.restore();
 }
 } else {
 // Standard Normal Mode: White Sclera + Dark Locked Pupils
 // Layer A: White Eyeballs Sclera Base (Behind head mask)
 if (!isBlinking && imgSclera && imgSclera.complete && imgSclera.naturalWidth > 0) {
 tCtx.drawImage(imgSclera, -16, -16, 32, 32);
 }

 // Layer B: Eye Pupils (UNDER Head Mask, permanently locked forward in eye sockets!)
 if (!isBlinking) {
 tCtx.fillStyle = "#0f172a";
 // Left Eye Pupil (socket x: 13..17, front position at x = 0, y = -11)
 tCtx.fillRect(0, -11, 2.0, 2.0);
 // Right Eye Pupil (socket x: 21..25, front position at x = 8, y = -11)
 tCtx.fillRect(8, -11, 2.0, 2.0);
 }

 // Layer C: Head Mask with transparent eye cutouts (Drawn on top of pupils!)
 if (imgHeadMask && imgHeadMask.complete && imgHeadMask.naturalWidth > 0) {
 tCtx.drawImage(imgHeadMask, -16, -16, 32, 32);
 }
 }

 // Layer D: Hair / Hats Overlay with Physics Inertial Sway & Bend (Subtle & Natural)
 const hairChoice = player.hairStyle || "red";
 if (hairChoice !== "none") {
 const hairImgName = hairChoice === "red" ? "red_hair.png" : (hairChoice === "brown" ? "brown_hair.png" : (hairChoice === "blonde" ? "blonde_hair.png" : "black_hair.png"));
 const imgHair = getSpriteImage("character_base_assets/gt_parts/" + hairImgName);
 if (imgHair && imgHair.complete && imgHair.naturalWidth > 0) {
 const hx = (cOffsets.hair ? cOffsets.hair.x : 0) || 0;
 const hy = (cOffsets.hair ? cOffsets.hair.y : -6) || -6;

 tCtx.save();
 tCtx.translate(hx, hy);

 // Inertial Sway & Physics Bend Angles (Sweet spot responsive dynamics)
 const hairWalkSway = (-Math.sin(walkPhase - 0.7) * 0.072 * wBlend);
 const hairVelLag = (isWalking || !player.isGrounded) ? (-player.vx * 0.016 * (player.facing || 1)) : 0;
 const hairJumpSway = (-player.vy * 0.013 * jBlend);
 const hairFallLift = (-player.vy * 0.015 * fBlend);
 const hairIdleSway = (Math.sin(t * 3.0) * 0.022 * idleBlend);

 const totalHairBend = hairWalkSway + hairVelLag + hairJumpSway + hairFallLift + hairIdleSway;
 tCtx.rotate(totalHairBend);

 // Elastic vertical bounce / wind lift
 const hairScaleY = 1.0 + (isJumping ? 0.05 * jBlend : (isFalling ? -0.04 * fBlend : (Math.sin(walkPhase) * 0.03 * wBlend)));
 const hairScaleX = 1.0 + (isFalling ? 0.035 * fBlend : 0);
 tCtx.scale(hairScaleX, hairScaleY);

 tCtx.drawImage(imgHair, -16, -16, 32, 32);
 tCtx.restore();
 }
 }
 tCtx.restore();
 tCtx.restore();

 // 6. Front Arm (Tangan Kiri - Growtopia Stretched Punch Arm & Official Fist Asset)
 if (isPunching) {
 // ── AUTHENTIC GROWTOPIA STRETCHED PUNCH ARM & GIANT FIST ──
 const shoulderX = -4 + afkTorsoX + actionStepX;
 const shoulderY = 4 + breatheBob;

 // Compute target in character local coordinate space (considering player.facing)
 const worldShoulderX = px + pw / 2 + shoulderX * player.facing;
 const worldShoulderY = py + ph / 2 + shoulderY;

 const targetX = player.punchTargetWorldX !== undefined ? player.punchTargetWorldX : (worldShoulderX + player.facing * 32);
 const targetY = player.punchTargetWorldY !== undefined ? player.punchTargetWorldY : worldShoulderY;

 const dx = (targetX - (px + pw / 2)) * player.facing - shoulderX;
 const dy = targetY - (py + ph / 2) - shoulderY;
 const aimAngle = Math.atan2(dy, dx);
 const totalDist = Math.hypot(dx, dy);

 const punchProgress = 1.0 - Math.max(0, player.punchTimer / (player.punchMaxTimer || 0.24));
 const punchExtend = Math.sin(punchProgress * Math.PI); // 0 -> 1 -> 0
 const armLen = Math.max(8, totalDist * punchExtend);
 const fistScale = 1.0 + punchExtend * 0.25;

 tCtx.save();
 tCtx.translate(shoulderX, shoulderY);
 tCtx.rotate(aimAngle);

 // 1. Stretched Tapered Arm (Conical Sleeve / Skin from shoulder to fist)
 const wBase = 3.5;
 const wTip = 8.5;
 const fistW = 28 * fistScale;
 const fistH = 26 * fistScale;
 const armTipX = Math.max(0, armLen - (fistW * 0.55));

 const skinFill = "#c8b69c";
 const skinDark = "#a3947f";
 const skinLight = "#dac7aa";
 const skinOutline = "#000000";

 if (armTipX > 2) {
 // Fill Conical Arm
 tCtx.beginPath();
 tCtx.moveTo(0, -wBase);
 tCtx.lineTo(armTipX, -wTip);
 tCtx.lineTo(armTipX, wTip);
 tCtx.lineTo(0, wBase);
 tCtx.closePath();
 tCtx.fillStyle = skinFill;
 tCtx.fill();

 // Top Highlight Strip on Arm
 tCtx.beginPath();
 tCtx.moveTo(0, -wBase);
 tCtx.lineTo(armTipX, -wTip);
 tCtx.lineTo(armTipX, -wTip + 2.5);
 tCtx.lineTo(0, -wBase + 1.5);
 tCtx.closePath();
 tCtx.fillStyle = skinLight;
 tCtx.fill();

 // Bottom Shadow Strip on Arm
 tCtx.beginPath();
 tCtx.moveTo(0, wBase - 1.5);
 tCtx.lineTo(armTipX, wTip - 3.0);
 tCtx.lineTo(armTipX, wTip);
 tCtx.lineTo(0, wBase);
 tCtx.closePath();
 tCtx.fillStyle = skinDark;
 tCtx.fill();

 // Arm Outline
 tCtx.lineWidth = 1.2;
 tCtx.strokeStyle = skinOutline;
 tCtx.beginPath();
 tCtx.moveTo(0, -wBase);
 tCtx.lineTo(armTipX, -wTip);
 tCtx.moveTo(armTipX, wTip);
 tCtx.lineTo(0, wBase);
 tCtx.stroke();
 }

 // 2. Official Growtopia Fist Sprite Asset at (armTipX, 0)
 const imgPunchFist = getSpriteImage("character_base_assets/gt_parts/gt_punch_fist.png");
 if (player.moderatorMode) {
 tCtx.shadowColor = "#c084fc";
 tCtx.shadowBlur = 10 * punchExtend;
 }

 if (imgPunchFist && imgPunchFist.complete && imgPunchFist.naturalWidth > 0) {
 tCtx.imageSmoothingEnabled = false;
 tCtx.drawImage(imgPunchFist, armTipX - 2, -fistH / 2, fistW, fistH);
 } else {
 // High Quality Fallback
 tCtx.fillStyle = skinFill;
 tCtx.strokeStyle = skinOutline;
 tCtx.lineWidth = 1.2;
 tCtx.beginPath();
 if (typeof tCtx.roundRect === "function") {
 tCtx.roundRect(armTipX - 2, -fistH / 2, fistW, fistH, 4);
 } else {
 tCtx.rect(armTipX - 2, -fistH / 2, fistW, fistH);
 }
 tCtx.fill();
 tCtx.stroke();
 }

 tCtx.restore(); // restore arm transform
 } else {
 let frontArmAngle = 0;
 if (isJumpSpinning) {
 frontArmAngle = jumpSpinAngleFront;
 } else if (isPlacing) {
 frontArmAngle = placeSpinAngle;
 } else if (isActionActive) {
 frontArmAngle = actionSnapAngle;
 } else if (afkFrontArmAngle !== null) {
 frontArmAngle = afkFrontArmAngle;
 } else {
 const idleFront = idleArmWiggle;
 const walkFront = walkCycleCos * 0.85;
 const jumpFront = -1.75 - jumpIntensity * 0.35 + Math.cos(t * 10) * 0.08;
 const fallFront = -1.85 - fallIntensity * 0.35 + Math.cos(t * 22) * 0.14;
 const floatFront = 0.45 - Math.sin(t * 5) * 0.1;
 frontArmAngle = (idleFront * idleBlend) + (walkFront * wBlend) + (jumpFront * jBlend) + (fallFront * fBlend) + (floatFront * flBlend);
 }

 tCtx.save();
 tCtx.translate(-7 + afkTorsoX + actionThrustX, 4 + breatheBob);
 tCtx.rotate(frontArmAngle);
 if (imgArmL && imgArmL.complete && imgArmL.naturalWidth > 0) {
 tCtx.drawImage(imgArmL, -9, -20, 32, 32);
 }
 tCtx.restore();
 }
 } else {
 // ── 2. Cartoon Chibi Skin ──
 const skinColor = "#f6b484";
 const darkSkin = "#d88b56";
 const legOffset = (isWalking ? Math.sin(t * 14) : 0) * 3.5;

 // 1. Back Leg
 const cLegRAngle = isFloating ? 0.35 : (isFalling ? 0.35 : 0);
 tCtx.save();
 tCtx.translate(afkTorsoX, isFloating ? (floatBob + 2 + legHoverWave) : 0);
 tCtx.rotate(cLegRAngle);
 tCtx.fillStyle = "#1e3a8a";
 tCtx.fillRect(-6, 3 - legOffset, 5, 9 + legOffset);
 tCtx.fillStyle = "#ffffff";
 tCtx.fillRect(-7, 12, 6, 2.5);
 tCtx.fillStyle = "#1d4ed8";
 tCtx.fillRect(-7, 13, 6, 1);
 tCtx.restore();

 // 2. Front Leg
 const cLegLAngle = isFloating ? 0.30 : (isFalling ? 0.25 : (isJumping ? 0.20 : 0));
 tCtx.save();
 tCtx.translate(afkTorsoX, isFloating ? (floatBob + 2 - legHoverWave) : 0);
 tCtx.rotate(cLegLAngle);
 tCtx.fillStyle = "#2563eb";
 tCtx.fillRect(1, 3 + legOffset, 5, 9 - legOffset);
 tCtx.fillStyle = "#ffffff";
 tCtx.fillRect(1, 12, 6, 2.5);
 tCtx.fillStyle = "#2563eb";
 tCtx.fillRect(1, 13, 6, 1);
 tCtx.restore();

 // 3. Torso
 tCtx.save();
 tCtx.translate(afkTorsoX, breatheBob);
 tCtx.rotate(afkTorsoAngle);
 tCtx.fillStyle = "#0284c7";
 tCtx.fillRect(-8, -6, 16, 10);
 tCtx.fillStyle = "#38bdf8";
 tCtx.fillRect(-6, -6, 12, 2);
 tCtx.fillStyle = "#0f172a";
 tCtx.fillRect(-8, 2, 16, 2);
 tCtx.fillStyle = "#e2e8f0";
 tCtx.fillRect(-2, 2, 4, 2);

 // 4. Head & Pupil
 tCtx.save();
 tCtx.translate(afkHeadX, afkHeadY);
 tCtx.rotate(afkHeadAngle);
 tCtx.fillStyle = skinColor;
 tCtx.beginPath();
 tCtx.arc(0, -12, 8.5, 0, Math.PI * 2);
 tCtx.fill();

 tCtx.fillStyle = "#452817";
 tCtx.beginPath();
 tCtx.arc(0, -14, 8, Math.PI, Math.PI * 2);
 tCtx.fill();
 tCtx.fillRect(-8, -14, 5, 3.5);
 tCtx.fillStyle = "#784c2f";
 tCtx.fillRect(-4, -17.5, 5, 2);

 // 5. Dynamic Eye Expression
 if (isBlinking) {
 tCtx.fillStyle = "#452817";
 tCtx.fillRect(0, -13, 2.5, 1.5);
 tCtx.fillRect(3.5, -13, 2.5, 1.5);
 } else if (player.moderatorMode) {
 // Glowing Pure White Eyes (Mod Mode - No Pupils, Pulsing Soft Glow)
 const eyePulse = 0.70 + 0.30 * Math.sin(t * 6.0);
 tCtx.save();
 tCtx.shadowColor = "#38bdf8";
 tCtx.shadowBlur = 4 + 6 * eyePulse;
 tCtx.globalAlpha = 0.85 + 0.15 * eyePulse;
 tCtx.fillStyle = "#ffffff";
 tCtx.fillRect(1, -14, 5, 3.5);
 tCtx.restore();
 } else {
 tCtx.fillStyle = "#ffffff";
 tCtx.fillRect(1, -14, 5, 3.5);
 tCtx.fillStyle = "#0f172a";
 tCtx.fillRect(3 + pupilOffsetX * 0.7, -13.5 + pupilOffsetY * 0.7, 2.5, 2.5);
 tCtx.fillStyle = "#ffffff";
 tCtx.fillRect(4 + pupilOffsetX * 0.7, -14 + pupilOffsetY * 0.7, 1, 1);
 }
 tCtx.fillStyle = "#452817";
 tCtx.fillRect(1, -16.5, 5, 1.2);
 tCtx.fillStyle = "#833a1e";
 tCtx.fillRect(2, -8.5, 4, 1.2);
 tCtx.fillStyle = "rgba(244, 114, 182, 0.4)";
 tCtx.fillRect(-2, -9.5, 3, 1.5);
 tCtx.restore();
 tCtx.restore();

 // 6. Arm
 let cArmAngle = 0;
 if (isJumpSpinning) cArmAngle = jumpSpinAngleFront;
 else if (isPunching) cArmAngle = punchSpinAngle;
 else if (afkFrontArmAngle !== null) cArmAngle = afkFrontArmAngle;
 else if (isFloating) cArmAngle = 0.45 + Math.sin(t * 6) * 0.15;
 else if (isFalling) cArmAngle = -1.0 + Math.sin(t * 8) * 0.1;
 else if (isJumping) cArmAngle = -0.8 + Math.sin(t * 8) * 0.1;
 else if (isWalking) cArmAngle = Math.cos(t * 14) * 0.6;
 else cArmAngle = idleArmWiggle;

 tCtx.save();
 tCtx.translate(-2 + afkTorsoX, -3 + breatheBob);
 tCtx.rotate(cArmAngle);
 tCtx.fillStyle = "#0284c7";
 tCtx.fillRect(-2, 0, 5, 3.5);
 tCtx.fillStyle = skinColor;
 tCtx.fillRect(-2, 3.5, 4.5, 6);
 tCtx.fillStyle = darkSkin;
 tCtx.fillRect(1, 7.5, 2, 2);
 tCtx.restore();
 }
 }

 // Mod Mode Transformation Invert / White Strobe Flash (100% Zero-Lag Hardware Accelerated)
 const isModTransform = player.modTransformTimer > 0;
 const isWhiteStrobe = isModTransform && (Math.sin((0.65 - player.modTransformTimer) * 48) > 0.0);

 if (isWhiteStrobe) {
 const maskObj = getAvatarMaskCtx();
 if (maskObj && maskObj.ctx) {
 maskObj.ctx.clearRect(0, 0, 64, 64);
 maskObj.ctx.save();
 maskObj.ctx.translate(32, 32);
 renderAvatarParts(maskObj.ctx);
 maskObj.ctx.restore();

 // Mask ONLY the character sprite pixels to pure white
 maskObj.ctx.save();
 maskObj.ctx.globalCompositeOperation = "source-in";
 maskObj.ctx.fillStyle = "#ffffff";
 maskObj.ctx.fillRect(0, 0, 64, 64);
 maskObj.ctx.restore();

 ctx.save();
 ctx.shadowColor = "#38bdf8";
 ctx.shadowBlur = 10;
 ctx.drawImage(maskObj.canvas, -32, -32);
 ctx.restore();
 } else {
 renderAvatarParts(ctx);
 }
 } else {
 renderAvatarParts(ctx);
 }

 ctx.restore();

 // ── 3D Crystal Orbs Orbit (Front Character Layer) ──
 drawCrystalOrbs(ctx, px, py, pw, ph, "front");

 // ── Moderator Mode Front ElectroMagnet Electric Arcs (Foreground Overlay) ──
 if (player.moderatorMode && !player.isDead) {
 const emFps = 13;
 const emIndex = Math.floor((player.animTimer * emFps) % 12);
 const emSrc = electroMagnetFrames[emIndex];
 const emImg = getSpriteImage(emSrc);
 if (emImg && emImg.complete && emImg.naturalWidth > 0) {
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 const emSize = 64;
 const centerX = px + pw / 2;
 const emX = centerX - emSize / 2;
 const emY = (py + ph + 4) - emSize;
 ctx.globalAlpha = 0.45;
 ctx.shadowColor = "#38bdf8";
 ctx.shadowBlur = 6;
 ctx.drawImage(emImg, emX, emY, emSize, emSize);
 ctx.restore();
 }
 }
 if (player.respawnRingRadius > 0 && player.respawnRingRadius < 55) {
 ctx.save();
 ctx.strokeStyle = "rgba(0, 229, 255, " + Math.max(0, 1 - player.respawnRingRadius / 55) + ")";
 ctx.lineWidth = 2.5;
 ctx.beginPath();
 ctx.arc(px + pw / 2, py + ph / 2, player.respawnRingRadius, 0, Math.PI * 2);
 ctx.stroke();
 ctx.restore();
 }

 // AFK Sleeping "Zzz..." animated floating text (repositioned lower just above head)
 if (player.afkAction === "sleep" && !player.isDead) {
 ctx.save();
 const zProgress = (t * 1.4) % 1.4;
 ctx.fillStyle = "#67e8f9";
 ctx.font = "bold 11px sans-serif";
 ctx.fillText("Z", px + pw / 2 + Math.sin(t * 3) * 3, py - 10 - zProgress * 12);
 ctx.font = "bold 9px sans-serif";
 ctx.fillText("z", px + pw / 2 + 6 + Math.sin(t * 3 + 1) * 2, py - 6 - zProgress * 12);
 ctx.font = "bold 8px sans-serif";
 ctx.fillText("z", px + pw / 2 + 11 + Math.sin(t * 3 + 2) * 2, py - 2 - zProgress * 12);
 ctx.restore();
 }

 if (!player.isDead) {
 drawPlayerNametag(ctx, px + pw / 2, py - 18);
 }
 ctx.restore();
 }

 function drawPlayerNametag(ctx, centerX, topY) {
 ctx.save();
 const isMod = player.moderatorMode;
 const isTransforming = player.modTransformTimer > 0;
 const transProg = isTransforming ? (1.0 - (player.modTransformTimer / 0.65)) : 1.0;
 
 let nameText = isMod ? "[MOD] Raey" : "Raey";
 let textJitterX = 0;
 let textJitterY = 0;

 // Punchy Cyber Glitch Text Animation on Transformation
 if (isTransforming) {
 textJitterX = (Math.random() - 0.5) * 1.8;
 textJitterY = (Math.random() - 0.5) * 1.2;
 const glitchSet = "!@#$%^&*<>01R43Y_+-=/~";
 const baseName = transProg > 0.4 ? "[MOD] Raey" : "Raey";
 const chars = baseName.split("");
 if (transProg < 0.85 && Math.random() < 0.75) {
 const glitchCount = Math.random() < 0.6 ? 1 : 2;
 for (let g = 0; g < glitchCount; g++) {
 const idx = Math.floor(Math.random() * chars.length);
 if (chars[idx] !== " " && chars[idx] !== "[" && chars[idx] !== "]") {
 chars[idx] = glitchSet[Math.floor(Math.random() * glitchSet.length)];
 }
 }
 }
 nameText = chars.join("");
 }

 ctx.font = "bold 10px 'Outfit', 'Inter', sans-serif";
 const textMetrics = ctx.measureText ? ctx.measureText(nameText) : { width: 30 };
 const textW = textMetrics.width || 30;

 const flagSize = 13;
 const paddingH = 6;
 const boxW = flagSize + 5 + textW + paddingH * 2;
 const boxH = 18;
 const boxX = centerX - boxW / 2 + textJitterX;
 const boxY = topY - boxH + textJitterY;

 // Pill background
 ctx.fillStyle = "rgba(9, 13, 26, 0.88)";
 ctx.beginPath();
 if (typeof ctx.roundRect === "function") {
 ctx.roundRect(boxX, boxY, boxW, boxH, 5);
 } else {
 ctx.rect(boxX, boxY, boxW, boxH);
 }
 ctx.fill();

 // Border with elegant neon pulse on transform
 ctx.strokeStyle = isMod ? "#a855f7" : "rgba(56, 189, 248, 0.5)";
 ctx.lineWidth = 1.2 / viewport.zoom;
 if (isMod || isTransforming) {
 ctx.shadowColor = isTransforming ? "#38bdf8" : "#a855f7";
 ctx.shadowBlur = isTransforming ? (8 + 4 * Math.sin(transProg * Math.PI)) : 6;
 }
 ctx.stroke();

 // Micro-glitch scanline slice across pill
 if (isTransforming && Math.random() < 0.60) {
 ctx.save();
 const sliceY = boxY + Math.random() * (boxH - 3);
 ctx.fillStyle = Math.random() < 0.5 ? "rgba(56, 189, 248, 0.35)" : "rgba(168, 85, 247, 0.35)";
 ctx.fillRect(boxX, sliceY, boxW, 2);
 ctx.restore();
 }

 // Flag Logo
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

 // Nametag Text with Cyber Chromatic Aberration RGB split on transform
 const textPosX = flagX + flagSize + 4;
 const textPosY = boxY + boxH - 5;
 if (typeof ctx.fillText === "function") {
 if (isTransforming) {
 // Cyan Aberration Pass
 ctx.save();
 ctx.fillStyle = "#38bdf8";
 ctx.fillText(nameText, textPosX - 1.2, textPosY);
 ctx.restore();
 // Magenta Aberration Pass
 ctx.save();
 ctx.fillStyle = "#f43f5e";
 ctx.fillText(nameText, textPosX + 1.2, textPosY);
 ctx.restore();
 }

 ctx.fillStyle = isMod ? "#c084fc" : "#ffffff";
 ctx.shadowColor = isTransforming ? "#c084fc" : "rgba(0, 0, 0, 0.8)";
 ctx.shadowBlur = isTransforming ? 6 : 3;
 ctx.shadowOffsetX = 1;
 ctx.shadowOffsetY = 1;
 ctx.fillText(nameText, textPosX, textPosY);
 }

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

 function playSynthFallbackSfx(ctx, name, volume = 0.6) {
 try {
 const now = ctx.currentTime;
 if (name === "door_open" || name === "teleport") {
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = "sine";
 osc.frequency.setValueAtTime(220, now);
 osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);
 gain.gain.setValueAtTime(volume * 0.5, now);
 gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(now);
 osc.stop(now + 0.23);
 } else if (name === "trampoline" || name === "pinball") {
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = "triangle";
 osc.frequency.setValueAtTime(240, now);
 osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
 gain.gain.setValueAtTime(volume * 0.6, now);
 gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(now);
 osc.stop(now + 0.19);
 } else if (name === "success") {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "triangle";
              osc.frequency.value = freq;
              gain.gain.setValueAtTime(volume * 0.35, now + i * 0.05);
              gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.25);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(now + i * 0.05);
              osc.stop(now + i * 0.05 + 0.26);
            });
          }
        } catch(e) {}
      }

      function playSfx(name, playbackRate = 1.0, volume = 0.6) {
        const ext = (name.endsWith(".ogg") || name.endsWith(".wav")) ? "" : ".wav";
        const url = "audio/" + name + ext;

        // 1. Direct HTML5 Audio element for instant playback on any protocol/browser
        try {
          const directAudio = new Audio(url);
          directAudio.volume = Math.max(0, Math.min(1, volume));
          directAudio.playbackRate = playbackRate;
          directAudio.play().catch(() => {});
        } catch(e) {}

        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        const key = "sfx_" + name;
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

        fetch(url)
          .then(r => r.arrayBuffer())
          .then(ab => ctx.decodeAudioData(ab))
          .then(buf => {
            audioBufferCache.set(key, buf);
            playBuffer(buf);
          })
          .catch(() => {
            playSynthFallbackSfx(ctx, name, volume);
          });
      }

      let lastFootstepIdx = -1;
 function playRandomFootstepSfx(volume = 0.85) {
 let idx = Math.floor(Math.random() * 7) + 1; // 1 to 7
 if (idx === lastFootstepIdx) {
 idx = (idx % 7) + 1;
 }
 lastFootstepIdx = idx;
 const rate = 0.97 + Math.random() * 0.06;
 playSfx(`footstep${idx}`, rate, volume);
 }

 function preloadFootstepSounds() {
 // Preload all essential gameplay SFX for zero-delay instant playback
 const coreSounds = ["door_open", "door_shut", "piano_nice", "dialog_open", "teleport", "success", "rock_hit", "metal_hit", "wood_break", "punch_organic", "punch_glass", "punch_miss", "hitground", "ouch"];
 coreSounds.forEach(s => {
 const key = `sfx_${s}`;
 if (!audioBufferCache.has(key)) {
 fetch(`audio/${s}.wav`)
 .then(r => r.arrayBuffer())
 .then(ab => {
 const ctx = getAudioContext();
 return ctx ? ctx.decodeAudioData(ab) : null;
 })
 .then(buf => {
 if (buf) audioBufferCache.set(key, buf);
 })
 .catch(() => {});
 }
 });
 for (let i = 1; i <= 7; i++) {
 const key = `sfx_footstep${i}`;
 if (!audioBufferCache.has(key)) {
 fetch(`audio/footstep${i}.wav`)
 .then(r => r.arrayBuffer())
 .then(ab => {
 const ctx = getAudioContext();
 return ctx ? ctx.decodeAudioData(ab) : null;
 })
 .then(buf => {
 if (buf) audioBufferCache.set(key, buf);
 })
 .catch(() => {});
 }
 }
 }

 function preloadPunchSounds() {
 const soundList = [
 "punch", "punch_miss", "punch_organic", "punch_glass",
 "punch_locked", "hit", "rock_hit", "metal_hit", "wood_break"
 ];
 soundList.forEach(name => {
 const key = `sfx_${name}`;
 if (!audioBufferCache.has(key)) {
 fetch(`audio/${name}.wav`)
 .then(r => r.arrayBuffer())
 .then(ab => {
 const ctx = getAudioContext();
 return ctx ? ctx.decodeAudioData(ab) : null;
 })
 .then(buf => {
 if (buf) audioBufferCache.set(key, buf);
 })
 .catch(() => {});
 }
 });
 }

 function playPunchSound(targetTileX, targetTileY) {
 let soundName = "punch";
 let pitch = 0.95 + Math.random() * 0.1;

 if (typeof targetTileX === "number" && typeof targetTileY === "number") {
 const idx = getTileIndex(targetTileX, targetTileY);
 if (idx !== -1) {
 const fgId = world.fg[idx];
 const bgId = world.bg[idx];
 const item = (fgId > 0) ? getItem(fgId) : ((bgId > 0) ? getItem(bgId) : null);
 if (item) {
 const itemName = (item.name || "").toLowerCase();
 if (itemName.includes("glass") || itemName.includes("window")) {
 soundName = "punch_glass";
 } else if (itemName.includes("rock") || itemName.includes("stone") || itemName.includes("granite") || itemName.includes("grimstone") || itemName.includes("bedrock")) {
 soundName = "rock_hit";
 } else if (itemName.includes("wood") || itemName.includes("tree") || itemName.includes("platform") || itemName.includes("fence")) {
 soundName = "wood_break";
 } else if (itemName.includes("steel") || itemName.includes("metal") || itemName.includes("iron") || itemName.includes("high tech") || itemName.includes("robot")) {
 soundName = "metal_hit";
 } else if (itemName.includes("leaf") || itemName.includes("hedge") || itemName.includes("grass") || itemName.includes("plant") || itemName.includes("flower") || itemName.includes("bush")) {
 soundName = "punch_organic";
 } else {
 soundName = "punch";
 }
 } else {
 soundName = "punch_miss";
 }
 }
 }

 playSfx(soundName, pitch, 0.9);

 // Immediate crisp synth punch whoosh fallback for zero-latency
 const ctx = getAudioContext();
 if (ctx) {
 try {
 const now = ctx.currentTime;
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = "triangle";
 osc.frequency.setValueAtTime(240, now);
 osc.frequency.exponentialRampToValueAtTime(70, now + 0.07);
 gain.gain.setValueAtTime(0.25, now);
 gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(now);
 osc.stop(now + 0.09);
 } catch (e) {}
 }
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
 onStatusMessage(`Music Sequencer Playing at ${sequencer.bpm} BPM...`);
 } else {
 if (sequencer.timer) {
 clearInterval(sequencer.timer);
 sequencer.timer = null;
 }
 onStatusMessage("Music Stopped.");
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

 if (player.active || gameParticles.length > 0) {
 if (player.active) updatePlayerPhysics(dt);
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
 paint: world.paint ? Array.from(world.paint) : [],
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
 paint: new Uint16Array(payload.paint ? payload.paint.slice(0, total) : total),
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
 } else if (preset === "nature") {
 world = catalog.createNatureWorld(width, height);
 } else if (preset === "parkour") {
 world = catalog.createParkourWorld(width, height);
 } else if (preset === "horror") {
 world = catalog.createHorrorWorld(width, height);
 } else if (preset === "scifi") {
 world = catalog.createSciFiWorld(width, height);
 } else {
 world = catalog.createStandardWorld(width, height);
 }
 world.name = name || "World";

 // Auto-load matching weather background texture
 const wObj = catalog.getWeatherById(world.weather);
 if (wObj && wObj.file) {
 loadWeatherImage(wObj.file).then(() => render());
 }

 const spawn = findSpawnPosition();
 player.x = spawn.x;
 player.y = spawn.y;
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
 } else if (presetName === "nature") {
 world = catalog.createNatureWorld(world.width, world.height);
 } else if (presetName === "parkour") {
 world = catalog.createParkourWorld(world.width, world.height);
 } else if (presetName === "horror") {
 world = catalog.createHorrorWorld(world.width, world.height);
 } else if (presetName === "scifi") {
 world = catalog.createSciFiWorld(world.width, world.height);
 } else {
 world = catalog.createStandardWorld(world.width, world.height);
 }

 // Auto-load matching weather background texture
 const wObj = catalog.getWeatherById(world.weather);
 if (wObj && wObj.file) {
 loadWeatherImage(wObj.file).then(() => render());
 }

 const spawn = findSpawnPosition();
 player.x = spawn.x;
 player.y = spawn.y;
 centerViewport();
 render();
 onWorldChange(world);
 onStatusMessage(`Loaded ${world.name || presetName} template with ${world.weather || 'SUNNY'} weather!`);
 }

 return {
 init: () => {
 setupEventHandlers();
 const spawn = findSpawnPosition();
 player.x = spawn.x;
 player.y = spawn.y;
 centerViewport();
 getSpriteImage("character_base_assets/gt_parts/gt_punch_fist.png");
 preloadFootstepSounds();
 preloadPunchSounds();
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
 isPlayModeActive: () => player.active,
 getSpriteImage,
 toggleModeratorMode,
 isModeratorMode: () => player.moderatorMode,
 setPlayerSkin: (skinName) => {
 player.skinStyle = skinName;
 if (typeof localStorage !== "undefined") {
 try { localStorage.setItem("gt_world_player_skin", skinName); } catch(e) {}
 }
 render();
 },
 getPlayerSkin: () => player.skinStyle || "classic",
 setEyeTrackingMode: (m) => {
 player.eyeTrackingMode = m;
 if (typeof localStorage !== "undefined") {
 try { localStorage.setItem("gt_eye_tracking_mode", m); } catch(e) {}
 }
 render();
 },
 getEyeTrackingMode: () => player.eyeTrackingMode || "cursor",
 sendChatMessage: (msg) => {
 if (!msg) return;
 player.chatMessage = msg.slice(0, 60);
 player.chatTimer = 5.5;
 playSfx("magic", 1.0, 0.5);
 render();
 },
 setPlayerKey: (key, isPressed) => {
 if (player.keys[key] !== undefined) {
 player.keys[key] = Boolean(isPressed);
 const isJumpKey = (key === "jump" || key === "up");
 if (isJumpKey && isPressed) {
 if (!player.jumpConsumed) {
 if (player.isGrounded || player.jumpCount === 0) {
 player.vy = -10.5;
 player.isGrounded = false;
 player.jumpCount = 1;
 player.jumpConsumed = true;
 player.jumpThrustTimer = 0.22;
 player.jumpSpinTimer = 0.28;
 player.state = "jump";
 playJumpSound(false);
 } else if (player.jumpCount === 1) {
 player.vy = -9.2;
 player.jumpCount = 2;
 player.jumpConsumed = true;
 player.jumpThrustTimer = 0.22;
 player.jumpSpinTimer = 0.28;
 player.state = "jump";
 playJumpSound(true);
 }
 }
 } else if (isJumpKey && !isPressed) {
 player.jumpConsumed = false;
 }
 }
 },
 spawnBlockPlaceEffect,
 respawnPlayer,
 getPlayer: () => ({ ...player }),
 findSpawnPosition,
 toggleMusic,
 setMusicBpm,
 getMusicState: () => ({ ...sequencer }),
 setCameraShake: (enabled) => {
 cameraShakeEnabled = Boolean(enabled);
 try { localStorage.setItem("gt_camera_shake_enabled", cameraShakeEnabled ? "true" : "false"); } catch(e) {}
 onStatusMessage(cameraShakeEnabled ? "Camera Shake: ON" : "Camera Shake: OFF");
 render();
 },
 getCameraShake: () => cameraShakeEnabled,
 loadPreset,
 createCustomWorld,
 setTile,
 eraseTile,
 punchInteract,
 floodFill,
 getLineTiles,
 getBoxTiles,
 getFilledBoxTiles,
 getCircleTiles,
 getShapeTiles,
 commitShape,
 undo,
 redo,
 saveToLocalStorage,
 loadFromLocalStorage,
 exportToDAT,
 importFromDAT,
 exportToJSON,
 importFromJSON,
 exportToPNG,
 loadRenderOverlay: (imageUrl, worldName) => {
 if (!imageUrl) {
 world.renderOverlayImage = null;
 render();
 return;
 }
 if (worldName) {
 world.name = worldName.toUpperCase();
 if (typeof onWorldChange === 'function') onWorldChange(world);
 }
 const img = new Image();
 img.onload = () => {
 world.renderOverlayImage = img;
 render();
 if (minimapCanvas) renderMinimap();
 playSfx("magic", 1.0, 0.6);
 onStatusMessage(`Loaded "${worldName || 'World'}" as background blueprint!`);
 };
 img.src = imageUrl;
 },
 convertBlueprintToBlocks: (options = {}) => {
 if (!world.renderOverlayImage || !world.renderOverlayImage.complete) {
 onStatusMessage("No active blueprint render image found to convert!");
 return null;
 }
 if (typeof window !== "undefined" && window.GTRenderConverter) {
 pushHistory();
 const result = window.GTRenderConverter.convertRenderToWorldBlocks(world.renderOverlayImage, {
 width: world.width,
 height: world.height,
 ...options
 });

 for (let i = 0; i < world.width * world.height; i++) {
 if (result.fg[i] > 0) world.fg[i] = result.fg[i];
 if (result.bg[i] > 0) world.bg[i] = result.bg[i];
 }

 world.renderOverlayImage = null;
 render();
 if (minimapCanvas) renderMinimap();
 playSfx("magic", 1.0, 0.7);
 onStatusMessage(`Converted ${result.detectedCount.toLocaleString()} blocks into editable tiles!`);
 return result;
 }
 return null;
 },
 importFromRender: async (worldNameOrUrl, options = {}) => {
 if (typeof window !== "undefined" && window.GTRenderConverter) {
 onStatusMessage("Scanning & converting world render into blocks...");
 try {
 pushHistory();
 const result = await window.GTRenderConverter.convertFromUrl(worldNameOrUrl, {
 width: world.width,
 height: world.height,
 ...options
 });

 if (!worldNameOrUrl.startsWith('http') && !worldNameOrUrl.startsWith('/')) {
 world.name = worldNameOrUrl.toUpperCase();
 }

 // Reset current grid to clear previous cache
 world.fg.fill(0);
 world.bg.fill(0);

 // Populate detected real blocks
 for (let i = 0; i < world.width * world.height; i++) {
 world.fg[i] = result.fg[i] || 0;
 world.bg[i] = result.bg[i] || 0;
 }

 world.renderOverlayImage = null;
 saveToLocalStorage();
 render();
 if (minimapCanvas) renderMinimap();
 onWorldChange(world);
 playSfx("magic", 1.0, 0.7);
 onStatusMessage(`Converted ${result.detectedCount.toLocaleString()} blocks into editable world!`);
 return result;
 } catch (err) {
 console.error("importFromRender error:", err);
 onStatusMessage("Failed to convert render into blocks.");
 }
 }
 },
 hasBlueprintOverlay: () => Boolean(world.renderOverlayImage && world.renderOverlayImage.complete),
 getWorldState: () => world
 };
 }

 return Object.freeze({
 createEngine
 });
 }
);
