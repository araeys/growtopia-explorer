// Growtopia Explorer Web Application JS - Clean 4-Tab Version
let allItems = [];
let filteredItems = [];
let allSheets = [];
let filteredSheets = [];
let allAudio = [];
let filteredAudio = [];
let wearableManifest = { meta: {}, items: [] };
let wearablesBySlot = window.GTWearableCatalog.groupWearablesBySlot([]);
let wearableAnimMap = {};
let avatarAnimTimer = null;
let avatarPositionState = window.AvatarPositioning.load(window.localStorage);
let wearableSequenceState = window.GTWearableSequence.loadState(
  window.localStorage
);

let activeTab = "items";
let activeCategory = "ALL";
let activeAudioCategory = "ALL";
let currentPage = 1;
const itemsPerPage = 80;
let searchQuery = "";
let sheetSearchQuery = "";
let audioSearchQuery = "";
let currentSort = "id-desc";


// Image & Audio Caches
const textureImageCache = {};
const textureImagePromises = {};
const avatarTextureFailures = new Set();
const avatarSequenceFailures = new Set();
let activeAudioHandle = null;
let activePlayBtnHandle = null;

// Item Animation State
let activeModalItem = null;
let currentFrameIndex = 0;
let totalFrames = 4;
let isAnimPlaying = false;
let animTimer = null;

// Raw Tilesheet Zoom & Sequence State
let currentSheetZoom = 1.0;
let activeModalSheet = null;
let activeSheetMode = "full";
let seqFrameIndex = 0;
let seqTotalFrames = 16;
let seqFrameSize = 64;
let isSeqAnimPlaying = false;
let seqAnimTimer = null;

// GT Set Planner Avatar Engine State
const plannerState = {
  skinTone: "White",
  skinColorHex: "#f0f0f0",
  expression: 0,
  isNakedBody: false,
  setName: "",
  equipped: {
    Back: null,
    Artifact: null,
    Feet: null,
    Pants: null,
    Shirt: null,
    Chest: null,
    Face: null,
    Hair: null,
    Hat: null,
    Hand: null
  }
};

const avatarInventoryState = {
  query: "",
  slot: "All",
  visibleLimit: window.AvatarInventory.DEFAULT_CHUNK_SIZE,
  activeTarget: null,
  inspectorTab: "item",
  workspaceTab: "wearables",
  setMenuOpen: false
};
let avatarInventoryObserver = null;

const AVATAR_BASE_TEXTURE_PATHS = {
  body: "character_base_assets/gtsetplanner/player_idle_body.png",
  head: "tilesheets/player_head.png",
  expression: "character_base_assets/gtsetplanner/player_eyes.png",
  frontLeftHand:
    "character_base_assets/gtsetplanner/player_front_left_hand.png",
  bodyNaked: "Base Set GT/Body Naked.png",
  bodyDefault: "Base Set GT/Body.png",
  bolaMata: "Base Set GT/Bola Mata.png",
  headBolong: "Base Set GT/Head Bolong.png",
  headUtuh: "Base Set GT/Head utuh.png",
  kakiKanan: "Base Set GT/Kaki Kanan.png",
  kakiKiri: "Base Set GT/Kaki Kiri.png",
  mulut: "Base Set GT/Mulut.png",
  pupil: "Base Set GT/Pupil.png",
  tanganKanan: "Base Set GT/Tangan Kanan.png",
  tanganKiri: "Base Set GT/Tangan Kiri.png",
  tutupMata: "Base Set GT/Tutup Mata.png"
};
const AVATAR_LOGICAL_SIZE = 96;
const AVATAR_SCALE = 4;
const SEQUENCE_EXPORT_SCALE = 2;
const PLAY_ICON = "▶";
const PAUSE_ICON = "❚❚";
const AVATAR_ANIMATION_POLL_MS = window.GTWearableSequence.MIN_INTERVAL_MS;
const PLAYER_ORIGIN = Object.freeze({ x: 32, y: 32 });
let avatarBaseLoadPromise = null;

const SKIN_TONES = [
  { name: "White", color: "#f0f0f0" },
  { name: "Tone 8", color: "#ffe9c8" },
  { name: "Tone 7", color: "#ffceb4" },
  { name: "Tone 6", color: "#ffc3aa" },
  { name: "Tone 5", color: "#e1ac96" },
  { name: "Tone 4", color: "#c39582" },
  { name: "Tone 3", color: "#b48a78" },
  { name: "Tone 2", color: "#967264" },
  { name: "Tone 1", color: "#785c50" },
  { name: "Light Green", color: "#b1dda3" },
  { name: "Aqua", color: "#41c2c5" },
  { name: "Red", color: "#d74b2b" },
  { name: "Green", color: "#418a2a" },
  { name: "Purple", color: "#a951d5" },
  { name: "Blue", color: "#397dce" },
  { name: "Light Blue", color: "#afc6ed" },
  { name: "Orange", color: "#ff920b" }
];

const EXPRESSIONS = [
  { id: 0, name: "Normal" },
  { id: 1, name: "Happy" },
  { id: 2, name: "Angry" },
  { id: 3, name: "Surprised" },
  { id: 4, name: "Wink" },
  { id: 5, name: "Sleeping" },
  { id: 6, name: "Derp" }
];

// DOM Elements - Navigation Tabs
const tabItemsBtn = document.getElementById("tab-items-btn");
const tabSheetsBtn = document.getElementById("tab-sheets-btn");
const tabAvatarBtn = document.getElementById("tab-avatar-btn");
const tabAudioBtn = document.getElementById("tab-audio-btn");
const tabWorldBtn = document.getElementById("tab-world-btn");
const tabImportBtn = document.getElementById("tab-import-btn");

const viewItems = document.getElementById("view-items");
const viewSheets = document.getElementById("view-sheets");
const viewAvatar = document.getElementById("view-avatar");
const viewAudio = document.getElementById("view-audio");
const viewWorld = document.getElementById("view-world");
const viewImport = document.getElementById("view-import");

// DOM Elements - Items Explorer
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");
const categoryPillsContainer = document.getElementById("category-pills");
const sortSelect = document.getElementById("sort-select");
const itemsGrid = document.getElementById("items-grid");
const emptyState = document.getElementById("empty-state");

const activeCountBadge = document.getElementById("active-count-badge");
const paginationInfo = document.getElementById("pagination-info");
const pageNumSpan = document.getElementById("page-num");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const batchZipBtn = document.getElementById("batch-zip-btn");

// DOM Elements - Mentahan Sheets View
const sheetSearchInput = document.getElementById("sheet-search-input");
const sheetClearSearchBtn = document.getElementById("sheet-clear-search");
const sheetsGrid = document.getElementById("sheets-grid");
const sheetEmptyState = document.getElementById("sheet-empty-state");
const sheetInfoText = document.getElementById("sheet-info-text");
const totalSheetsNavCount = document.getElementById("total-sheets-nav-count");

// DOM Elements - Audio View
const audioSearchInput = document.getElementById("audio-search-input");
const audioClearSearchBtn = document.getElementById("audio-clear-search");
const audioCategoryPills = document.getElementById("audio-category-pills");
const audioGrid = document.getElementById("audio-grid");
const audioEmptyState = document.getElementById("audio-empty-state");
const audioInfoText = document.getElementById("audio-info-text");

// DOM Elements - Avatar Planner
const avatarCanvas = document.getElementById("avatar-canvas");
const avatarDownloadPngBtn = document.getElementById("avatar-download-png");
const avatarRandomizeBtn = document.getElementById("avatar-randomize");
const avatarResetBtn = document.getElementById("avatar-reset");
const avatarCatalogStatus = document.getElementById("avatar-catalog-status");
const avatarResetAllPositionsBtn = document.getElementById(
  "avatar-reset-all-positions"
);
const avatarActiveTarget = document.getElementById("avatar-active-target");
const avatarActiveSequenceControls = document.getElementById(
  "avatar-active-sequence-controls"
);
const avatarInventoryQuery = document.getElementById("avatar-inventory-query");
const avatarInventorySlot = document.getElementById("avatar-inventory-slot");
const avatarInventoryClear = document.getElementById("avatar-inventory-clear");
const avatarInventoryGrid = document.getElementById("avatar-inventory-grid");
const avatarInventoryCount = document.getElementById("avatar-inventory-count");
const avatarInventorySentinel = document.getElementById(
  "avatar-inventory-sentinel"
);
const avatarDownloadLayersBtn = document.getElementById(
  "avatar-download-layers"
);
const avatarDownloadSelectedSequenceBtn = document.getElementById(
  "avatar-download-selected-sequence"
);
const avatarDownloadAllSequencesBtn = document.getElementById(
  "avatar-download-all-sequences"
);
const avatarExportStatus = document.getElementById("avatar-export-status");
const avatarExportSetBtn = document.getElementById("avatar-export-set");
const avatarImportSetBtn = document.getElementById("avatar-import-set");
const avatarImportFileInput = document.getElementById("avatar-import-file");
const avatarExportScaleSelect = document.getElementById("avatar-export-scale");
const avatarInspectorTabs = Array.from(
  document.querySelectorAll("[data-inspector-tab]")
);
const avatarInspectorPanels = Array.from(
  document.querySelectorAll("[data-inspector-panel]")
);
const avatarWorkspaceTabs = Array.from(
  document.querySelectorAll("[data-workspace-tab]")
);
const avatarInventoryPane = document.getElementById("avatar-inventory-pane");
const avatarInspectorPane = document.getElementById("avatar-inspector-pane");
const avatarSetMenuToggle = document.getElementById("avatar-set-menu-toggle");
const avatarSetMenu = document.getElementById("avatar-set-menu");

// Modal Elements - Item Inspector
const modalOverlay = document.getElementById("modal-overlay");
const modalCloseBtn = document.getElementById("modal-close");
const modalCatBadge = document.getElementById("modal-cat-badge");
const modalTitle = document.getElementById("modal-title");
const modalIdTag = document.getElementById("modal-id-tag");
const modalCanvas = document.getElementById("modal-canvas");
const modalTexture = document.getElementById("modal-texture");
const modalCoords = document.getElementById("modal-coords");
const modalAction = document.getElementById("modal-action");
const modalAnimStatus = document.getElementById("modal-anim-status");
const modalFrameIndicator = document.getElementById("modal-frame-indicator");

// Animation Controls Elements
const animControlsContainer = document.querySelector(".anim-controls");
const frameSliderContainer = document.querySelector(".frame-slider-container");
const animPlayBtn = document.getElementById("anim-play-btn");
const frameCountSelect = document.getElementById("frame-count-select");
const frameSlider = document.getElementById("frame-slider");

// Action Buttons - Item
const modalDownloadBtn = document.getElementById("modal-download-btn");
const modalGifBtn = document.getElementById("modal-gif-btn");
const modalExtractFramesBtn = document.getElementById("modal-extract-frames-btn");
const modalCopyBtn = document.getElementById("modal-copy-btn");

// Modal Elements - Raw Tilesheet Full Preview & Sequence GIF Player
const sheetModalOverlay = document.getElementById("sheet-modal-overlay");
const sheetModalCloseBtn = document.getElementById("sheet-modal-close");
const sheetModalFilename = document.getElementById("sheet-modal-filename");
const sheetModalMeta = document.getElementById("sheet-modal-meta");
const sheetAnimBadge = document.getElementById("sheet-anim-badge");

const modeFullSheetBtn = document.getElementById("mode-full-sheet");
const modeSequenceAnimBtn = document.getElementById("mode-sequence-anim");
const viewportFullSheet = document.getElementById("viewport-full-sheet");
const viewportSequenceAnim = document.getElementById("viewport-sequence-anim");

const sheetModalImg = document.getElementById("sheet-modal-img");
const sheetZoomWrapper = document.getElementById("sheet-zoom-wrapper");
const sheetZoomIn = document.getElementById("sheet-zoom-in");
const sheetZoomOut = document.getElementById("sheet-zoom-out");
const sheetZoomReset = document.getElementById("sheet-zoom-reset");
const sheetZoomLevel = document.getElementById("sheet-zoom-level");
const zoomControlsBar = document.getElementById("zoom-controls-bar");

const sequenceCanvas = document.getElementById("sequence-canvas");
const sequenceFrameLabel = document.getElementById("sequence-frame-label");
const seqPlayBtn = document.getElementById("seq-play-btn");
const seqFrameSizeSelect = document.getElementById("seq-frame-size");
const seqFrameCountSelect = document.getElementById("seq-frame-count");

const sheetModalDownloadBtn = document.getElementById("sheet-modal-download-btn");
const sheetModalGifBtn = document.getElementById("sheet-modal-gif-btn");
const sheetModalExtractBtn = document.getElementById("sheet-modal-extract-btn");

// Initialize Application
async function initApp() {
  try {
    const resItems = await fetch("items_db.json");
    allItems = await resItems.json();
    filteredItems = [...allItems];
  } catch (err) {
    console.error("Gagal memuat items_db.json:", err);
  }

  try {
    const resSheets = await fetch("tilesheets_info.json");
    allSheets = await resSheets.json();
    filteredSheets = [...allSheets];
    if (totalSheetsNavCount) totalSheetsNavCount.textContent = allSheets.length.toLocaleString();
  } catch (err) {
    console.error("Gagal memuat tilesheets_info.json:", err);
  }

  try {
    const resAudio = await fetch("audio_db.json");
    allAudio = await resAudio.json();
    filteredAudio = [...allAudio];
  } catch (err) {
    console.error("Gagal memuat audio_db.json:", err);
  }

  try {
    await loadWearableManifest();
  } catch (err) {
    console.error("Gagal memuat wearables:", err);
  }

  try {
    setupEventListeners();
  } catch (err) {
    console.error("Error setting up event listeners:", err);
  }

  try {
    applyFilters();
  } catch (err) {
    console.error("Error applying item filters:", err);
  }

  try {
    renderSheetsGrid();
  } catch (err) {
    console.error("Error rendering sheets grid:", err);
  }

  try {
    renderAudioGrid();
  } catch (err) {
    console.error("Error rendering audio grid:", err);
  }

  try {
    initAvatarPlanner();
  } catch (err) {
    console.error("Error initializing avatar planner:", err);
  }
}

async function loadWearableManifest() {
  try {
    const response = await fetch("wearables_manifest.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    wearableManifest = await response.json();
    wearablesBySlot = window.GTWearableCatalog.groupWearablesBySlot(
      wearableManifest.items
    );

    try {
      const animRes = await fetch(
        "wearables_anim_map.json?v=wearable-sequence-v2"
      );
      if (animRes.ok) {
        wearableAnimMap = await animRes.json();
      }
    } catch {}

    if (avatarCatalogStatus) {
      avatarCatalogStatus.classList.remove("error");
      const animCount = Object.keys(wearableAnimMap).length;
      avatarCatalogStatus.textContent =
        `${wearableManifest.items.length.toLocaleString()} wearable terorganisir (${animCount} animasi sequence)`;
    }
  } catch (error) {
    wearableManifest = { meta: {}, items: [] };
    wearablesBySlot = window.GTWearableCatalog.groupWearablesBySlot([]);
    if (avatarCatalogStatus) {
      avatarCatalogStatus.classList.add("error");
      avatarCatalogStatus.textContent =
        "Katalog wearable gagal dimuat; karakter dasar tetap tersedia.";
    }
    console.error("Gagal memuat wearable manifest:", error);
  }
}

function getWearableFrameCount(item) {
  const descriptor = getWearableDescriptor(item);
  return descriptor
    ? window.GTWearableSequence.getFrameCount(descriptor)
    : 1;
}

function getWearableDescriptor(item) {
  if (!item || item.id === undefined || item.id === null) return null;
  const value = wearableAnimMap[String(item.id)];
  if (!value) return null;
  try {
    return window.GTWearableSequence.normalizeDescriptor(value);
  } catch (error) {
    if (!avatarSequenceFailures.has(Number(item.id))) {
      avatarSequenceFailures.add(Number(item.id));
      console.warn(`Wearable #${item.id} has an invalid sequence descriptor:`, error);
    }
    return null;
  }
}

function getWearablePlayback(item) {
  return window.GTWearableSequence.getPlayback(
    wearableSequenceState,
    item.id,
    getWearableFrameCount(item)
  );
}

function autoStartWearableAnimation(item) {
  if (!item) return;
  const frameCount = getWearableFrameCount(item);
  if (frameCount <= 1) return;
  const hasPersistedState = Boolean(
    wearableSequenceState?.items?.[String(item.id)]
  );
  if (hasPersistedState) return;
  wearableSequenceState = window.GTWearableSequence.setPlayback(
    wearableSequenceState,
    item.id,
    {
      mode: "playing",
      frame: 0,
      intervalMs: window.GTWearableSequence.DEFAULT_INTERVAL_MS,
      startedAtMs: getAvatarAnimationNowMs()
    },
    frameCount
  );
  window.GTWearableSequence.saveState(
    window.localStorage,
    wearableSequenceState
  );
}

let getAvatarAnimationNowMs = () => Math.round(performance.now());

function startAvatarAnimationLoop() {
  if (avatarAnimTimer) return;
  avatarAnimTimer = setInterval(() => {
    const hasEquippedAnim = Object.values(plannerState.equipped).some(item =>
      item &&
      getWearableFrameCount(item) > 1 &&
      getWearablePlayback(item).mode === "playing"
    );
    if (hasEquippedAnim) {
      renderAvatarCanvas();
      updateActiveSequencePlaybackDisplay();
    }
  }, AVATAR_ANIMATION_POLL_MS);
}

// Event Listeners
function setupEventListeners() {
  // Main Tabs Navigation
  tabItemsBtn?.addEventListener("click", () => switchTab("items"));
  tabSheetsBtn?.addEventListener("click", () => switchTab("sheets"));
  tabAvatarBtn?.addEventListener("click", () => switchTab("avatar"));
  tabAudioBtn?.addEventListener("click", () => switchTab("audio"));
  tabWorldBtn?.addEventListener("click", () => switchTab("world"));
  tabImportBtn?.addEventListener("click", () => switchTab("import"));

  // Batch ZIP Button
  batchZipBtn?.addEventListener("click", () => {
    alert("Batch ZIP Exporter: Mengunduh database tilesheets mentahan...");
    window.location.href = "tilesheets_info.json";
  });

  // Search Input (Items)
  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    if (clearSearchBtn) clearSearchBtn.style.display = searchQuery ? "block" : "none";
    currentPage = 1;
    applyFilters();
  });

  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    searchQuery = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    currentPage = 1;
    applyFilters();
  });

  // Search Input (Sheets)
  sheetSearchInput?.addEventListener("input", (e) => {
    sheetSearchQuery = e.target.value.trim().toLowerCase();
    if (sheetClearSearchBtn) sheetClearSearchBtn.style.display = sheetSearchQuery ? "block" : "none";
    filterSheets();
  });

  sheetClearSearchBtn?.addEventListener("click", () => {
    if (sheetSearchInput) sheetSearchInput.value = "";
    searchQuery = "";
    if (sheetClearSearchBtn) sheetClearSearchBtn.style.display = "none";
    filterSheets();
  });

  // Search Input (Audio)
  audioSearchInput?.addEventListener("input", (e) => {
    audioSearchQuery = e.target.value.trim().toLowerCase();
    if (audioClearSearchBtn) audioClearSearchBtn.style.display = audioSearchQuery ? "block" : "none";
    filterAudio();
  });

  audioClearSearchBtn?.addEventListener("click", () => {
    if (audioSearchInput) audioSearchInput.value = "";
    audioSearchQuery = "";
    if (audioClearSearchBtn) audioClearSearchBtn.style.display = "none";
    filterAudio();
  });

  // Category Pills (Items)
  categoryPillsContainer?.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    
    document.querySelectorAll("#category-pills .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    
    activeCategory = pill.getAttribute("data-cat");
    currentPage = 1;
    applyFilters();
  });

  // Category Pills (Audio)
  audioCategoryPills?.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;

    document.querySelectorAll("#audio-category-pills .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");

    activeAudioCategory = pill.getAttribute("data-audiocat");
    filterAudio();
  });

  // Sort Selector
  sortSelect?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFilters();
  });

  // Pagination
  prevPageBtn?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  nextPageBtn?.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderGrid();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Modal Close - Item Inspector
  modalCloseBtn?.addEventListener("click", closeModal);
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Modal Close - Sheet Full Preview
  sheetModalCloseBtn.addEventListener("click", closeSheetModal);
  sheetModalOverlay.addEventListener("click", (e) => {
    if (e.target === sheetModalOverlay) closeSheetModal();
  });

  // Sheet Mode Selector Tabs
  modeFullSheetBtn?.addEventListener("click", () => setSheetModalMode("full"));
  modeSequenceAnimBtn?.addEventListener("click", () => setSheetModalMode("sequence"));

  // Sheet Zoom Controls
  sheetZoomIn?.addEventListener("click", () => changeSheetZoom(0.25));
  sheetZoomOut?.addEventListener("click", () => changeSheetZoom(-0.25));
  sheetZoomReset?.addEventListener("click", () => setSheetZoom(1.0));

  // Raw Sequence Controls
  seqPlayBtn?.addEventListener("click", toggleSeqAnimationPlay);
  
  seqFrameSizeSelect?.addEventListener("change", (e) => {
    seqFrameSize = parseInt(e.target.value, 10);
    if (sequenceCanvas) {
      sequenceCanvas.width = seqFrameSize;
      sequenceCanvas.height = seqFrameSize;
    }
    updateSequenceFrameView();
  });

  seqFrameCountSelect?.addEventListener("change", (e) => {
    seqTotalFrames = parseInt(e.target.value, 10);
    if (seqFrameIndex >= seqTotalFrames) seqFrameIndex = 0;
    updateSequenceFrameView();
  });

  // Action Buttons - Raw Sheet Modal
  sheetModalGifBtn?.addEventListener("click", () => {
    if (!activeModalSheet) return;
    convertRawSheetToGIF(activeModalSheet);
  });

  sheetModalExtractBtn?.addEventListener("click", () => {
    if (!activeModalSheet) return;
    extractRawSheetFrames(activeModalSheet);
  });

  // Item Animation Play/Pause Button
  animPlayBtn?.addEventListener("click", toggleAnimationPlay);

  // Frame Count Selector (Item)
  frameCountSelect?.addEventListener("change", (e) => {
    totalFrames = parseInt(e.target.value, 10);
    if (frameSlider) frameSlider.max = totalFrames - 1;
    if (currentFrameIndex >= totalFrames) {
      currentFrameIndex = 0;
      if (frameSlider) frameSlider.value = 0;
    }
    updateModalFrameView();
  });

  // Frame Slider (Item)
  frameSlider?.addEventListener("input", (e) => {
    if (isAnimPlaying) pauseAnimation();
    currentFrameIndex = parseInt(e.target.value, 10);
    updateModalFrameView();
  });

  // Item Action Buttons
  modalDownloadBtn?.addEventListener("click", () => {
    if (!activeModalItem) return;
    downloadItemSprite(activeModalItem, currentFrameIndex);
  });

  modalGifBtn?.addEventListener("click", () => {
    if (!activeModalItem) return;
    convertToAnimatedGIF(activeModalItem, totalFrames);
  });

  modalExtractFramesBtn?.addEventListener("click", () => {
    if (!activeModalItem) return;
    extractAllFrames(activeModalItem, totalFrames);
  });

  modalCopyBtn?.addEventListener("click", () => {
    if (!activeModalItem) return;
    const text = JSON.stringify(activeModalItem, null, 2);
    navigator.clipboard.writeText(text);
    if (modalCopyBtn) {
      modalCopyBtn.innerHTML = `<span>✅</span> Tersalin!`;
      setTimeout(() => {
        modalCopyBtn.innerHTML = `<span>📋</span> Salin Metadata`;
      }, 2000);
    }
  });
}

// Switch Main Tab
function switchTab(tabName) {
  [tabItemsBtn, tabSheetsBtn, tabAvatarBtn, tabAudioBtn, tabWorldBtn, tabImportBtn].forEach(t => t && t.classList.remove("active"));
  [viewItems, viewSheets, viewAvatar, viewAudio, viewWorld, viewImport].forEach(v => v && v.classList.add("hidden"));

  if (tabName === "items") {
    tabItemsBtn?.classList.add("active");
    viewItems?.classList.remove("hidden");
  } else if (tabName === "sheets") {
    tabSheetsBtn?.classList.add("active");
    viewSheets?.classList.remove("hidden");
  } else if (tabName === "avatar") {
    tabAvatarBtn?.classList.add("active");
    viewAvatar?.classList.remove("hidden");
    renderAvatarCanvas();
  } else if (tabName === "audio") {
    tabAudioBtn?.classList.add("active");
    viewAudio?.classList.remove("hidden");
  } else if (tabName === "world") {
    tabWorldBtn?.classList.add("active");
    viewWorld?.classList.remove("hidden");
    // Double rAF: first frame triggers layout, second frame reads accurate getBoundingClientRect
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initWorldPlannerUI();
      });
    });
  } else if (tabName === "import") {
    tabImportBtn?.classList.add("active");
    viewImport?.classList.remove("hidden");
    initImportStudio();
  }
}
function initWorldPlannerUI() {
  const worldCanvas = document.getElementById("world-canvas");
  const worldMinimapCanvas = document.getElementById("world-minimap-canvas");

  if (!worldPlannerInitialized && worldCanvas && window.GTWorldPlanner) {
    const worldNameDisplay = document.getElementById("world-name-display");
    const worldSelectionBar = document.getElementById("world-selection-bar");

    worldPlannerEngine = window.GTWorldPlanner.createEngine({
      canvas: worldCanvas,
      minimapCanvas: worldMinimapCanvas,
      itemsDb: allItems,
      catalog: window.GTWorldCatalog,
      lzString: window.LZString,
      onWorldChange: (w) => {
        if (worldNameDisplay) worldNameDisplay.textContent = w.name || "World";
        const sel = worldPlannerEngine.getSelection();
        if (worldSelectionBar) {
          worldSelectionBar.classList.toggle("hidden", !sel.active);
        }
      },
      onToolChange: (toolName) => {
        document.querySelectorAll(".world-tool-btn[data-tool]").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-tool") === toolName);
        });
        const sel = worldPlannerEngine.getSelection();
        if (worldSelectionBar) {
          worldSelectionBar.classList.toggle("hidden", !sel.active);
        }
      },
      onHotbarChange: (hotbar, activeIdx) => {
        renderWorldHotbar(hotbar, activeIdx);
      },
      onStatusMessage: (msg) => {
        if (avatarExportStatus) {
          avatarExportStatus.textContent = msg;
        }
      }
    });

    worldPlannerEngine.init();
    worldPlannerInitialized = true;

    // Zoom Buttons
    document.getElementById("world-zoom-in-btn")?.addEventListener("click", () => worldPlannerEngine.zoomIn());
    document.getElementById("world-zoom-out-btn")?.addEventListener("click", () => worldPlannerEngine.zoomOut());
    document.getElementById("world-zoom-reset-btn")?.addEventListener("click", () => worldPlannerEngine.resetZoom());

    // Tool Buttons
    document.querySelectorAll(".world-tool-btn[data-tool]").forEach(btn => {
      btn.addEventListener("click", () => {
        worldPlannerEngine.setTool(btn.getAttribute("data-tool"));
      });
    });

    // Flip Button
    const flipBtn = document.getElementById("world-flip-btn");
    if (flipBtn) {
      flipBtn.addEventListener("click", () => {
        const isFlipped = worldPlannerEngine.toggleFlip();
        flipBtn.classList.toggle("active", isFlipped);
      });
    }

    // Grid & Minimap Toggle Buttons
    document.getElementById("world-grid-toggle-btn")?.addEventListener("click", function() {
      const isGrid = worldPlannerEngine.toggleGrid();
      this.classList.toggle("active", isGrid);
    });
    document.getElementById("world-minimap-toggle-btn")?.addEventListener("click", function() {
      const isMinimap = worldPlannerEngine.toggleMinimap();
      this.classList.toggle("active", isMinimap);
      document.getElementById("world-minimap-box")?.classList.toggle("hidden", !isMinimap);
    });

    // Undo / Redo Buttons
    document.getElementById("world-undo-btn")?.addEventListener("click", () => worldPlannerEngine.undo());
    document.getElementById("world-redo-btn")?.addEventListener("click", () => worldPlannerEngine.redo());

    // Weather Button & Modal
    const weatherBtn = document.getElementById("world-weather-btn");
    const weatherModal = document.getElementById("world-weather-modal");
    const weatherModalClose = document.getElementById("world-weather-modal-close");
    const weatherSearch = document.getElementById("world-weather-search");

    if (weatherBtn && weatherModal) {
      weatherBtn.addEventListener("click", () => {
        renderWeatherGrid();
        weatherModal.classList.remove("hidden");
      });
    }
    if (weatherModalClose && weatherModal) {
      weatherModalClose.addEventListener("click", () => weatherModal.classList.add("hidden"));
      weatherModal.addEventListener("click", (e) => {
        if (e.target === weatherModal) weatherModal.classList.add("hidden");
      });
    }
    if (weatherSearch) {
      weatherSearch.addEventListener("input", (e) => {
        renderWeatherGrid(e.target.value);
      });
    }

    // Select Block Button & Modal
    const addBlockBtn = document.getElementById("world-add-block-btn");
    const blockModal = document.getElementById("world-block-modal");
    const blockModalClose = document.getElementById("world-block-modal-close");
    const blockSearch = document.getElementById("world-block-search");

    if (addBlockBtn && blockModal) {
      addBlockBtn.addEventListener("click", () => {
        openSelectBlockModal();
      });
    }
    if (blockModalClose && blockModal) {
      blockModalClose.addEventListener("click", () => blockModal.classList.add("hidden"));
      blockModal.addEventListener("click", (e) => {
        if (e.target === blockModal) blockModal.classList.add("hidden");
      });
    }
    if (blockSearch) {
      blockSearch.addEventListener("input", () => {
        filterAndRenderBlockModalGrid();
      });
    }

    // Settings / World Management Dropdown
    const settingsBtn = document.getElementById("world-settings-btn");
    const menuDropdown = document.getElementById("world-menu-dropdown");
    if (settingsBtn && menuDropdown) {
      settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle("hidden");
      });
      window.addEventListener("click", (e) => {
        if (!menuDropdown.contains(e.target) && e.target !== settingsBtn) {
          menuDropdown.classList.add("hidden");
        }
      });
    }

    // Menu Dropdown Actions
    document.getElementById("world-menu-new-std")?.addEventListener("click", () => {
      worldPlannerEngine.loadPreset("standard");
      menuDropdown?.classList.add("hidden");
    });
    document.getElementById("world-menu-new-flat")?.addEventListener("click", () => {
      worldPlannerEngine.loadPreset("flat");
      menuDropdown?.classList.add("hidden");
    });
    document.getElementById("world-menu-new-blank")?.addEventListener("click", () => {
      worldPlannerEngine.loadPreset("blank");
      menuDropdown?.classList.add("hidden");
    });
    document.getElementById("world-menu-save-dat")?.addEventListener("click", () => {
      worldPlannerEngine.exportToDAT();
      menuDropdown?.classList.add("hidden");
    });
    document.getElementById("world-menu-save-json")?.addEventListener("click", () => {
      worldPlannerEngine.exportToJSON();
      menuDropdown?.classList.add("hidden");
    });
    document.getElementById("world-menu-render-png")?.addEventListener("click", () => {
      worldPlannerEngine.exportToPNG({ onlySelection: false });
      menuDropdown?.classList.add("hidden");
    });

    // Open World File Input
    const fileInput = document.getElementById("world-file-input");
    document.getElementById("world-menu-open-file")?.addEventListener("click", () => {
      fileInput?.click();
      menuDropdown?.classList.add("hidden");
    });
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result;
          try {
            if (file.name.endsWith(".dat")) {
              worldPlannerEngine.importFromDAT(content);
            } else {
              worldPlannerEngine.importFromJSON(content);
            }
          } catch (err) {
            alert(`Gagal membuka world file: ${err.message}`);
          }
        };
        reader.readAsText(file);
        fileInput.value = "";
      });
    }

    // Selection Action Bar
    document.getElementById("world-render-selection-btn")?.addEventListener("click", () => {
      worldPlannerEngine.exportToPNG({ onlySelection: true });
    });
    document.getElementById("world-fill-selection-btn")?.addEventListener("click", () => {
      const hotbar = worldPlannerEngine.getHotbar();
      const activeIdx = worldPlannerEngine.getActiveHotbarIndex();
      worldPlannerEngine.fillSelectionTiles(hotbar[activeIdx]);
    });
    document.getElementById("world-clear-selection-btn")?.addEventListener("click", () => {
      worldPlannerEngine.clearSelectionTiles();
    });
    document.getElementById("world-cancel-selection-btn")?.addEventListener("click", () => {
      worldPlannerEngine.setTool("pencil");
    });

    renderWorldHotbar(worldPlannerEngine.getHotbar(), worldPlannerEngine.getActiveHotbarIndex());
    // Double rAF: guarantee CSS layout is fully computed before reading canvas dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (worldPlannerEngine) {
          worldPlannerEngine.resize();
          worldPlannerEngine.centerViewport();
        }
      });
    });
  } else if (worldPlannerEngine) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        worldPlannerEngine.resize();
        worldPlannerEngine.centerViewport();
        worldPlannerEngine.render();
      });
    });
  }
}

function renderWorldHotbar(hotbar, activeIdx) {
  const container = document.getElementById("world-hotbar-slots");
  if (!container) return;
  container.innerHTML = "";

  hotbar.forEach((item, idx) => {
    const slotEl = document.createElement("div");
    slotEl.className = `hotbar-slot ${idx === activeIdx ? "active" : ""}`;
    slotEl.setAttribute("data-slot", idx);
    slotEl.title = item ? `#${item.id} ${item.name} (Key: ${idx + 1 <= 9 ? idx + 1 : 0})` : `Slot ${idx + 1} (Empty)`;

    const numBadge = document.createElement("span");
    numBadge.className = "hotbar-slot-num";
    numBadge.textContent = idx + 1 <= 9 ? idx + 1 : 0;
    slotEl.appendChild(numBadge);

    if (item && item.texture) {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      canvas.className = "hotbar-sprite-thumb";
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      const img = new Image();
      img.src = `tilesheets/${item.texture}`;
      img.onload = () => {
        ctx.drawImage(img, item.tx * 32, item.ty * 32, 32, 32, 0, 0, 32, 32);
      };
      slotEl.appendChild(canvas);
    }

    slotEl.addEventListener("click", () => {
      worldPlannerEngine.setActiveHotbarIndex(idx);
    });

    slotEl.addEventListener("dblclick", () => {
      worldPlannerEngine.setActiveHotbarIndex(idx);
      openSelectBlockModal();
    });

    container.appendChild(slotEl);
  });
}

function openSelectBlockModal() {
  const modal = document.getElementById("world-block-modal");
  const tabsContainer = document.getElementById("world-block-category-tabs");
  if (!modal || !tabsContainer || !window.GTWorldCatalog) return;

  // Render Category Tabs
  tabsContainer.innerHTML = "";
  window.GTWorldCatalog.CATEGORIES.forEach(cat => {
    const pill = document.createElement("button");
    pill.className = `block-cat-pill ${cat.key === blockModalCategory ? "active" : ""}`;
    pill.textContent = `${cat.icon} ${cat.label}`;
    pill.addEventListener("click", () => {
      blockModalCategory = cat.key;
      document.querySelectorAll(".block-cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      filterAndRenderBlockModalGrid();
    });
    tabsContainer.appendChild(pill);
  });

  filterAndRenderBlockModalGrid();
  modal.classList.remove("hidden");
}

function filterAndRenderBlockModalGrid() {
  const grid = document.getElementById("world-block-grid");
  const searchInput = document.getElementById("world-block-search");
  if (!grid || !window.GTWorldCatalog) return;

  const query = searchInput ? searchInput.value : "";
  const items = window.GTWorldCatalog.filterPlaceableItems(allItems, {
    query,
    category: blockModalCategory
  });

  grid.innerHTML = "";

  const displayLimit = Math.min(items.length, 250);
  items.slice(0, displayLimit).forEach(item => {
    const card = document.createElement("div");
    card.className = "world-block-card";
    card.title = `#${item.id} ${item.name} (${item.category})`;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.src = `tilesheets/${item.texture}`;
    img.onload = () => {
      ctx.drawImage(img, item.tx * 32, item.ty * 32, 32, 32, 0, 0, 32, 32);
    };
    card.appendChild(canvas);

    card.addEventListener("click", () => {
      if (worldPlannerEngine) {
        const activeIdx = worldPlannerEngine.getActiveHotbarIndex();
        worldPlannerEngine.setHotbarItem(activeIdx, item);
      }
      document.getElementById("world-block-modal")?.classList.add("hidden");
    });

    grid.appendChild(card);
  });
}

function renderWeatherGrid(query = "") {
  const grid = document.getElementById("world-weather-grid");
  if (!grid || !window.GTWorldCatalog) return;

  grid.innerHTML = "";
  const q = query.trim().toLowerCase();
  const currentWeather = worldPlannerEngine ? worldPlannerEngine.getWeather() : "EMERALD_CITY";

  window.GTWorldCatalog.WEATHERS.forEach(w => {
    if (q && !w.name.toLowerCase().includes(q) && !w.id.toLowerCase().includes(q)) return;

    const card = document.createElement("div");
    card.className = `world-weather-card ${w.id === currentWeather ? "active" : ""}`;
    card.innerHTML = `
      <div class="weather-thumb-box">
        <img src="weather/${w.file}" class="weather-thumb-img" alt="${w.name}" loading="lazy">
      </div>
      <div class="weather-card-label">${w.name}</div>
    `;

    card.addEventListener("click", () => {
      if (worldPlannerEngine) {
        worldPlannerEngine.setWeather(w.id);
      }
      document.getElementById("world-weather-modal")?.classList.add("hidden");
    });

    grid.appendChild(card);
  });
}

// Filter and Sort Items
function applyFilters() {
  filteredItems = allItems.filter(item => {
    let catMatch = false;
    if (activeCategory === "ALL") {
      catMatch = true;
    } else if (activeCategory === "ANIMATED") {
      catMatch = item.has_anim === true;
    } else if (activeCategory === "STATIC") {
      catMatch = item.has_anim !== true;
    } else {
      catMatch = item.category === activeCategory;
    }
    
    let searchMatch = true;
    if (searchQuery) {
      const nameMatch = item.name.toLowerCase().includes(searchQuery);
      const idMatch = item.id.toString() === searchQuery.replace('#', '');
      searchMatch = nameMatch || idMatch;
    }
    
    return catMatch && searchMatch;
  });

  if (currentSort === "id-desc") {
    filteredItems.sort((a, b) => b.id - a.id);
  } else if (currentSort === "id-asc") {
    filteredItems.sort((a, b) => a.id - b.id);
  } else if (currentSort === "name-asc") {
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === "name-desc") {
    filteredItems.sort((a, b) => b.name.localeCompare(a.name));
  }

  activeCountBadge.textContent = filteredItems.length.toLocaleString();
  renderGrid();
}

// Render Grid Cards (Items)
function renderGrid() {
  itemsGrid.innerHTML = "";
  
  if (filteredItems.length === 0) {
    emptyState.classList.remove("hidden");
    paginationInfo.textContent = "0 Items";
    pageNumSpan.textContent = "0 / 0";
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  emptyState.classList.add("hidden");

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
  const pageItems = filteredItems.slice(startIndex, endIndex);

  paginationInfo.textContent = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${filteredItems.length.toLocaleString()}`;
  pageNumSpan.textContent = `${currentPage} / ${totalPages}`;
  prevPageBtn.disabled = (currentPage === 1);
  nextPageBtn.disabled = (currentPage === totalPages);

  pageItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.setAttribute("data-id", item.id);

    const animBadgeHtml = item.has_anim ? `<span class="anim-indicator-badge" title="Animated Item">🎞️ Anim</span>` : '';

    card.innerHTML = `
      <span class="card-id-tag">#${item.id}</span>
      ${animBadgeHtml}
      <div class="card-sprite-frame">
        <canvas class="card-sprite-canvas" width="32" height="32" id="canvas-card-${item.id}"></canvas>
      </div>
      <div class="card-title">${escapeHtml(item.name)}</div>
      <span class="card-cat-badge">${escapeHtml(item.category)}</span>
    `;

    card.addEventListener("click", () => openModal(item));
    itemsGrid.appendChild(card);

    renderSpriteToCanvas(`canvas-card-${item.id}`, item, 0);
  });
}

// Render Audio Grid (Tab 4)
function filterAudio() {
  filteredAudio = allAudio.filter(a => {
    const catMatch = (activeAudioCategory === "ALL" || a.category === activeAudioCategory);
    let searchMatch = true;
    if (audioSearchQuery) {
      searchMatch = a.filename.toLowerCase().includes(audioSearchQuery);
    }
    return catMatch && searchMatch;
  });
  renderAudioGrid();
}

function renderAudioGrid() {
  audioGrid.innerHTML = "";

  if (filteredAudio.length === 0) {
    audioEmptyState.classList.remove("hidden");
    audioInfoText.textContent = "0 Audio File";
    return;
  }

  audioEmptyState.classList.add("hidden");
  audioInfoText.textContent = `Menampilkan ${filteredAudio.length} dari ${allAudio.length} Efek Suara (.WAV / .OGG)`;

  filteredAudio.forEach((audio, idx) => {
    const card = document.createElement("div");
    card.className = "audio-card";

    card.innerHTML = `
      <div class="audio-card-header">
        <button class="audio-play-btn" id="audio-play-${idx}" title="Play Audio">▶</button>
        <div class="audio-info">
          <div class="audio-title">${escapeHtml(audio.original_name)}</div>
          <div class="audio-cat-badge">${escapeHtml(audio.category)} (${audio.type})</div>
        </div>
      </div>
      <a class="btn btn-secondary" style="min-width:auto; padding:0.4rem 0.8rem; font-size:0.8rem;" href="${audio.path}" download="${audio.original_name}">
        <span>💾</span> Download Sound
      </a>
    `;

    const playBtn = card.querySelector(`#audio-play-${idx}`);
    playBtn.addEventListener("click", () => playSoundFile(audio.path, playBtn));

    audioGrid.appendChild(card);
  });
}

function playSoundFile(audioPath, btn) {
  if (activeAudioHandle) {
    activeAudioHandle.pause();
    if (activePlayBtnHandle) activePlayBtnHandle.textContent = "▶";
  }

  const audio = new Audio(audioPath);
  activeAudioHandle = audio;
  activePlayBtnHandle = btn;
  btn.textContent = "⏸";

  audio.play().catch(e => console.error("Audio playback error:", e));
  audio.onended = () => {
    btn.textContent = "▶";
    activeAudioHandle = null;
  };
}

// GT Set Planner Avatar Engine (Tab 3)
function initAvatarPlanner() {
  const skinGrid = document.getElementById("skin-tones-grid");
  if (skinGrid) {
    skinGrid.innerHTML = "";
    SKIN_TONES.forEach(tone => {
      const box = document.createElement("div");
      box.className = `skin-color-box ${tone.name === plannerState.skinTone ? "selected" : ""}`;
      box.style.backgroundColor = tone.color;
      box.title = tone.name;
      box.addEventListener("click", () => {
        document.querySelectorAll(".skin-color-box").forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
        plannerState.skinTone = tone.name;
        plannerState.skinColorHex = tone.color;
        renderAvatarCanvas();
        refreshExpressionPreviews();
      });
      skinGrid.appendChild(box);
    });
  }

  // Render Expressions Select
  const exprGrid = document.getElementById("expressions-grid");
  if (exprGrid) {
    exprGrid.innerHTML = "";
    EXPRESSIONS.forEach(exp => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `expr-btn ${exp.id === plannerState.expression ? "active" : ""}`;
      btn.dataset.expressionId = exp.id.toString();
      btn.setAttribute("aria-label", `Use ${exp.name} expression`);

      const preview = document.createElement("img");
      preview.className = "expr-preview";
      preview.width = 32;
      preview.height = 32;
      preview.src = createExpressionPreviewPng(exp.id);
      preview.alt = `${exp.name} expression preview`;

      const label = document.createElement("span");
      label.className = "expr-label";
      label.textContent = exp.name;

      btn.append(preview, label);
      btn.addEventListener("click", () => {
        document.querySelectorAll(".expr-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        plannerState.expression = exp.id;
        renderAvatarCanvas();
        refreshExpressionPreviews();
      });
      exprGrid.appendChild(btn);
    });
  }

  const nakedBodyBtn = document.getElementById("naked-body-toggle");
  if (nakedBodyBtn) {
    nakedBodyBtn.addEventListener("click", () => {
      plannerState.isNakedBody = !plannerState.isNakedBody;
      if (plannerState.isNakedBody) {
        nakedBodyBtn.classList.add("active");
      } else {
        nakedBodyBtn.classList.remove("active");
      }
      renderAvatarCanvas();
    });
  }

  avatarRandomizeBtn.addEventListener("click", randomizeAvatarOutfit);
  avatarResetBtn.addEventListener("click", resetAvatarOutfit);
  avatarDownloadPngBtn.addEventListener("click", downloadAvatarPNG);
  avatarDownloadLayersBtn.addEventListener(
    "click",
    downloadAvatarLayersZip
  );
  avatarDownloadSelectedSequenceBtn.addEventListener(
    "click",
    downloadSelectedWearableSequenceZip
  );
  avatarDownloadAllSequencesBtn.addEventListener(
    "click",
    downloadAllEquippedWearableSequencesZip
  );
  avatarExportSetBtn.addEventListener("click", exportSetJSON);
  const avatarExportSetCardBtn = document.getElementById("avatar-export-set-card-btn");
  if (avatarExportSetCardBtn) avatarExportSetCardBtn.addEventListener("click", exportSetJSON);
  avatarImportSetBtn.addEventListener("click", () => avatarImportFileInput.click());
  avatarImportFileInput.addEventListener("change", importSetJSON);

  // Set Name input
  const setNameInput = document.getElementById("set-name-input");
  if (setNameInput) {
    setNameInput.addEventListener("input", () => {
      plannerState.setName = setNameInput.value;
    });
  }

  // Save Set to cache
  const saveSetBtn = document.getElementById("avatar-save-set");
  if (saveSetBtn) saveSetBtn.addEventListener("click", saveSetToCache);

  // Toggle Saved Sets panel
  const savedSetsToggle = document.getElementById("avatar-saved-sets-toggle");
  const savedSetsPanel = document.getElementById("saved-sets-panel");
  if (savedSetsToggle && savedSetsPanel) {
    savedSetsToggle.addEventListener("click", () => {
      const isHidden = savedSetsPanel.hasAttribute("hidden");
      if (isHidden) {
        savedSetsPanel.removeAttribute("hidden");
        renderSavedSetsPanel();
        savedSetsToggle.setAttribute("aria-expanded", "true");
        setAvatarSetMenuOpen(false);
      } else {
        savedSetsPanel.setAttribute("hidden", "");
        savedSetsToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Init saved sets panel count
  renderSavedSetsPanel();
  avatarInventoryQuery.addEventListener("input", event => {
    avatarInventoryState.query = event.target.value;
    avatarInventoryState.visibleLimit =
      window.AvatarInventory.DEFAULT_CHUNK_SIZE;
    renderAvatarInventory();
  });
  avatarInventorySlot.addEventListener("change", event => {
    avatarInventoryState.slot = event.target.value;
    avatarInventoryState.visibleLimit =
      window.AvatarInventory.DEFAULT_CHUNK_SIZE;
    renderAvatarInventory();
  });
  avatarInventoryClear.addEventListener("click", () => {
    avatarInventoryState.query = "";
    avatarInventoryState.slot = "All";
    avatarInventoryState.visibleLimit =
      window.AvatarInventory.DEFAULT_CHUNK_SIZE;
    avatarInventoryQuery.value = "";
    avatarInventorySlot.value = "All";
    renderAvatarInventory();
    avatarInventoryQuery.focus();
  });
  avatarInventorySentinel.addEventListener(
    "click",
    loadMoreAvatarInventory
  );

  avatarInspectorTabs.forEach((button, index) => {
    button.addEventListener("click", () => {
      setAvatarInspectorTab(button.dataset.inspectorTab);
    });
    button.addEventListener("keydown", event => {
      const lastIndex = avatarInspectorTabs.length - 1;
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
      else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = lastIndex;
      else return;
      event.preventDefault();
      setAvatarInspectorTab(
        avatarInspectorTabs[nextIndex].dataset.inspectorTab,
        { focus: true }
      );
    });
  });
  avatarWorkspaceTabs.forEach(button => {
    button.addEventListener("click", () => {
      setAvatarWorkspaceTab(button.dataset.workspaceTab);
    });
  });
  avatarSetMenuToggle.addEventListener("click", () => {
    const savedSetsPanel = document.getElementById("saved-sets-panel");
    if (savedSetsPanel) savedSetsPanel.hidden = true;
    const savedSetsToggle = document.getElementById("avatar-saved-sets-toggle");
    if (savedSetsToggle) savedSetsToggle.setAttribute("aria-expanded", "false");
    setAvatarSetMenuOpen(!avatarInventoryState.setMenuOpen);
  });
  avatarSetMenu.querySelectorAll(".avatar-menu-action").forEach(button => {
    button.addEventListener("click", () => setAvatarSetMenuOpen(false));
  });
  document.addEventListener("pointerdown", event => {
    if (
      avatarInventoryState.setMenuOpen &&
      !avatarSetMenu.contains(event.target) &&
      !avatarSetMenuToggle.contains(event.target)
    ) {
      setAvatarSetMenuOpen(false);
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && avatarInventoryState.setMenuOpen) {
      setAvatarSetMenuOpen(false, { restoreFocus: true });
    }
  });
  window.addEventListener("resize", () => {
    setAvatarWorkspaceTab(avatarInventoryState.workspaceTab);
  });
  setAvatarInspectorTab(avatarInventoryState.inspectorTab);
  setAvatarWorkspaceTab(avatarInventoryState.workspaceTab);
    avatarResetAllPositionsBtn.addEventListener("click", () => {
    avatarPositionState = window.AvatarPositioning.resetAll(
      avatarPositionState
    );
    window.AvatarPositioning.save(window.localStorage, avatarPositionState);
    refreshActivePositionControls();
    renderAvatarCanvas();
  });

  populateAvatarInventorySlots();
  setupAvatarZoomControls();
  setupCanvasDrag();
  startAvatarAnimationLoop();

  renderAvatarInventory();
  renderAvatarCanvas();
}

function populateAvatarInventorySlots() {
  const options = document.createDocumentFragment();
  window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
    const option = document.createElement("option");
    option.value = slot.key;
    option.textContent = `${slot.icon} ${slot.label}`;
    options.appendChild(option);
  });
  avatarInventorySlot.appendChild(options);
}

function renderAvatarInventory() {
  if (!avatarInventoryGrid) return;
  const matches = window.AvatarInventory.filterItems(
    wearableManifest.items,
    {
      query: avatarInventoryState.query,
      slot: avatarInventoryState.slot
    }
  );
  const visibleItems = matches.slice(0, avatarInventoryState.visibleLimit);
  const fragment = document.createDocumentFragment();
  avatarInventoryGrid.innerHTML = "";

  visibleItems.forEach(item => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "avatar-item-card";
    card.title = `#${item.id} ${item.name}`;
    card.setAttribute("aria-pressed", String(
      window.AvatarInventory.isEquipped(plannerState.equipped, item)
    ));

    const frameCount = getWearableFrameCount(item);

    const preview = document.createElement("span");
    preview.className = "avatar-item-preview";
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    preview.appendChild(canvas);

    if (frameCount > 1) {
      const animBadge = document.createElement("span");
      animBadge.className = "item-anim-badge";
      animBadge.title = `Sequence Animation (${frameCount} frames)`;
      animBadge.textContent = `🎞️ ${frameCount}f`;
      preview.appendChild(animBadge);
    }

    const name = document.createElement("span");
    name.className = "avatar-item-name";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "avatar-item-meta";
    meta.textContent = `#${item.id} · ${item.slot}`;

    card.append(preview, name, meta);
    card.addEventListener("click", () => equipAvatarInventoryItem(item));
    fragment.appendChild(card);
    drawAvatarInventoryPreview(canvas, item);
  });

  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "avatar-inventory-empty";
    empty.textContent = "No wearable matches this search.";
    fragment.appendChild(empty);
  }

  avatarInventoryGrid.appendChild(fragment);
  avatarInventoryCount.textContent =
    `Showing ${visibleItems.length.toLocaleString()} of ` +
    `${matches.length.toLocaleString()} matching items`;
  avatarInventorySentinel.hidden =
    matches.length === 0 || visibleItems.length >= matches.length;
}

function loadMoreAvatarInventory() {
  const matches = window.AvatarInventory.filterItems(
    wearableManifest.items,
    {
      query: avatarInventoryState.query,
      slot: avatarInventoryState.slot
    }
  );
  const nextLimit = window.AvatarInventory.nextVisibleLimit(
    avatarInventoryState.visibleLimit,
    matches.length
  );
  if (nextLimit === avatarInventoryState.visibleLimit) return;
  avatarInventoryState.visibleLimit = nextLimit;
  renderAvatarInventory();
}

function setupAvatarInventoryObserver() {
  if (!("IntersectionObserver" in window)) return;
  const scrollRoot = document.querySelector(".avatar-inventory-pane");
  avatarInventoryObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      loadMoreAvatarInventory();
    }
  }, {
    root: scrollRoot,
    rootMargin: "240px 0px"
  });
  avatarInventoryObserver.observe(avatarInventorySentinel);
}

function drawAvatarInventoryPreview(canvas, item) {
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const texturePath = `tilesheets/${item.texture}`;
  loadTextureImage(texturePath)
    .then(image => {
      const profile = window.GTWearableCatalog.getRenderProfile(
        item.render_profile
      );
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        item.tx * profile.sourceWidth,
        item.ty * profile.sourceHeight,
        profile.sourceWidth,
        profile.sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
    })
    .catch(() => drawNoSpriteState(context, canvas.width, canvas.height));
}

function getAvatarSlotOrder() {
  return window.GTWearableCatalog.SLOT_CONFIG.map(slot => slot.key);
}

function resolveAvatarActiveTarget() {
  avatarInventoryState.activeTarget =
    window.AvatarInventory.resolveActiveTarget(
      plannerState.equipped,
      getAvatarSlotOrder(),
      avatarInventoryState.activeTarget
    );
  return avatarInventoryState.activeTarget;
}

function equipAvatarInventoryItem(item) {
  const wasEquipped = window.AvatarInventory.isEquipped(
    plannerState.equipped,
    item
  );
  plannerState.equipped = window.AvatarInventory.equipOrToggle(
    plannerState.equipped,
    item
  );
  if (!wasEquipped) {
    autoStartWearableAnimation(item);
  }
  avatarInventoryState.activeTarget = wasEquipped
    ? null
    : { slot: item.slot, itemId: Number(item.id) };
  if (!wasEquipped) {
    setAvatarInspectorTab("item");
    setAvatarWorkspaceTab("inspector");
  }
  resolveAvatarActiveTarget();
  renderAvatarInventory();
  updateEquippedItemsBar();
  refreshActivePositionControls();
  renderAvatarCanvas();

  if (!wasEquipped && item && item.texture) {
    loadTextureImage(`tilesheets/${item.texture}`)
      .then(() => {
        renderAvatarCanvas();
      })
      .catch(() => {});
  }
}

function setAvatarInspectorTab(tab, { focus = false } = {}) {
  const allowedTabs = ["item", "look", "export"];
  const nextTab = allowedTabs.includes(tab) ? tab : "item";
  avatarInventoryState.inspectorTab = nextTab;
  avatarInspectorTabs.forEach(button => {
    const selected = button.dataset.inspectorTab === nextTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  avatarInspectorPanels.forEach(panel => {
    panel.hidden = panel.dataset.inspectorPanel !== nextTab;
  });
}

function setAvatarWorkspaceTab(tab, { focus = false } = {}) {
  const nextTab = tab === "inspector" ? "inspector" : "wearables";
  avatarInventoryState.workspaceTab = nextTab;
  avatarWorkspaceTabs.forEach(button => {
    const selected = button.dataset.workspaceTab === nextTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  const compactLayout = window.matchMedia("(max-width: 1279px)").matches;
  avatarInventoryPane.dataset.workspaceHidden = String(
    compactLayout && nextTab !== "wearables"
  );
  avatarInspectorPane.dataset.workspaceHidden = String(
    compactLayout && nextTab !== "inspector"
  );
}

function setAvatarSetMenuOpen(open, { restoreFocus = false } = {}) {
  avatarInventoryState.setMenuOpen = Boolean(open);
  avatarSetMenu.hidden = !avatarInventoryState.setMenuOpen;
  avatarSetMenuToggle.setAttribute(
    "aria-expanded",
    String(avatarInventoryState.setMenuOpen)
  );
  if (restoreFocus) avatarSetMenuToggle.focus();
}

function refreshActivePositionControls() {
  const target = resolveAvatarActiveTarget();
  avatarActivePositionControls.innerHTML = "";
  refreshActiveSequenceControls();
  if (!target) {
    avatarActiveTarget.textContent = "Select an equipped item to adjust it";
    avatarActivePositionControls.textContent =
      "Equip an item, then select its chip or card.";
    updateCanvasDragCursor();
    refreshAvatarExportAvailability();
    return;
  }

  const item = plannerState.equipped[target.slot];
  const offset = window.AvatarPositioning.getOffset(
    avatarPositionState,
    target.slot,
    item.id
  );
  avatarActiveTarget.textContent =
    `${target.slot}: #${item.id} ${item.name} · X ${offset.x} Y ${offset.y}`;

  const controls = document.createElement("div");
  controls.className = "slot-position-controls";
  controls.innerHTML = `
    <div class="position-pad" aria-label="Move ${target.slot}">
      <button class="position-btn position-up" data-dx="0" data-dy="-1" title="Move up">↑</button>
      <button class="position-btn position-left" data-dx="-1" data-dy="0" title="Move left">←</button>
      <button class="position-btn position-reset" data-position-reset title="Reset item position">Reset</button>
      <button class="position-btn position-right" data-dx="1" data-dy="0" title="Move right">→</button>
      <button class="position-btn position-down" data-dx="0" data-dy="1" title="Move down">↓</button>
    </div>
    <output class="position-readout">X ${offset.x} · Y ${offset.y}</output>
  `;
  controls.querySelectorAll("[data-dx]").forEach(button => {
    button.addEventListener("click", () => {
      const current = window.AvatarPositioning.getOffset(
        avatarPositionState,
        target.slot,
        item.id
      );
      avatarPositionState = window.AvatarPositioning.setOffset(
        avatarPositionState,
        target.slot,
        item.id,
        {
          x: current.x + Number(button.dataset.dx),
          y: current.y + Number(button.dataset.dy)
        }
      );
      window.AvatarPositioning.save(window.localStorage, avatarPositionState);
      refreshActivePositionControls();
      renderAvatarCanvas();
    });
  });
  controls.querySelector("[data-position-reset]").addEventListener(
    "click",
    () => {
      avatarPositionState = window.AvatarPositioning.resetOffset(
        avatarPositionState,
        target.slot,
        item.id
      );
      window.AvatarPositioning.save(window.localStorage, avatarPositionState);
      refreshActivePositionControls();
      renderAvatarCanvas();
    }
  );
  avatarActivePositionControls.appendChild(controls);
  updateCanvasDragCursor();
  refreshAvatarExportAvailability();
}

function refreshActiveSequenceControls() {
  if (!avatarActiveSequenceControls) return;
  avatarActiveSequenceControls.innerHTML = "";
  const sequenceTool = avatarActiveSequenceControls.closest(
    ".avatar-sequence-tool"
  );
  const target = avatarInventoryState.activeTarget;
  const item = target ? plannerState.equipped[target.slot] : null;
  const descriptor = getWearableDescriptor(item);
  if (!item || !descriptor) {
    if (sequenceTool) sequenceTool.hidden = true;
    return;
  }
  if (sequenceTool) sequenceTool.hidden = false;

  const frameCount = window.GTWearableSequence.getFrameCount(descriptor);
  const playback = getWearablePlayback(item);
  const nowMs = getAvatarAnimationNowMs();
  const visibleFrame = window.GTWearableSequence.getVisibleFrameAtTime(
    playback,
    frameCount,
    nowMs
  );
  const controls = document.createElement("div");
  controls.className = "wearable-sequence-controls";
  const commitPlayback = nextPlayback => {
    wearableSequenceState = window.GTWearableSequence.setPlayback(
      wearableSequenceState,
      item.id,
      nextPlayback,
      frameCount
    );
    window.GTWearableSequence.saveState(
      window.localStorage,
      wearableSequenceState
    );
    refreshActiveSequenceControls();
    renderAvatarCanvas();
  };

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "sequence-playback-toggle";
  toggle.textContent = playback.mode === "playing" ? PAUSE_ICON : PLAY_ICON;
  toggle.setAttribute(
    "aria-label",
    playback.mode === "playing" ? "Pause sequence" : "Play sequence"
  );
  toggle.addEventListener("click", () => {
    commitPlayback(
      window.GTWearableSequence.togglePlayback(
        playback,
        visibleFrame,
        frameCount,
        getAvatarAnimationNowMs()
      )
    );
  });

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "sequence-step sequence-previous";
  previous.textContent = "‹";
  previous.setAttribute("aria-label", "Previous frame");
  previous.addEventListener("click", () => {
    commitPlayback(
      window.GTWearableSequence.stepPlayback(
        playback,
        -1,
        visibleFrame,
        frameCount
      )
    );
  });

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "sequence-frame-slider";
  slider.min = "0";
  slider.max = String(frameCount - 1);
  slider.step = "1";
  slider.value = String(visibleFrame);
  slider.setAttribute("aria-label", "Select frame");
  slider.addEventListener("input", () => {
    commitPlayback(
      window.GTWearableSequence.selectFrame(
        playback,
        Number(slider.value),
        frameCount
      )
    );
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "sequence-step sequence-next";
  next.textContent = "›";
  next.setAttribute("aria-label", "Next frame");
  next.addEventListener("click", () => {
    commitPlayback(
      window.GTWearableSequence.stepPlayback(
        playback,
        1,
        visibleFrame,
        frameCount
      )
    );
  });

  const counter = document.createElement("output");
  counter.className = "sequence-frame-counter";
  counter.textContent = `${visibleFrame + 1} / ${frameCount}`;

  const speed = document.createElement("div");
  speed.className = "sequence-speed-control";

  const speedMinus = document.createElement("button");
  speedMinus.type = "button";
  speedMinus.className = "sequence-speed-step";
  speedMinus.textContent = "−";
  speedMinus.setAttribute("aria-label", "Decrease sequence speed interval");

  const speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.className = "sequence-speed-input";
  speedInput.min = String(window.GTWearableSequence.MIN_INTERVAL_MS);
  speedInput.max = String(window.GTWearableSequence.MAX_INTERVAL_MS);
  speedInput.step = String(window.GTWearableSequence.INTERVAL_STEP_MS);
  speedInput.value = String(playback.intervalMs);
  speedInput.setAttribute("aria-label", "Sequence speed in milliseconds");

  const speedUnit = document.createElement("span");
  speedUnit.className = "sequence-speed-unit";
  speedUnit.textContent = "ms";

  const speedPlus = document.createElement("button");
  speedPlus.type = "button";
  speedPlus.className = "sequence-speed-step";
  speedPlus.textContent = "+";
  speedPlus.setAttribute("aria-label", "Increase sequence speed interval");

  const commitInterval = (rawValue, refreshControls = true) => {
    const currentPlayback = getWearablePlayback(item);
    const currentNowMs = getAvatarAnimationNowMs();
    const currentFrame = window.GTWearableSequence.getVisibleFrameAtTime(
      currentPlayback,
      frameCount,
      currentNowMs
    );
    const nextPlayback =
      window.GTWearableSequence.changeIntervalForVisibleFrame(
        currentPlayback,
        rawValue,
        currentFrame,
        frameCount,
        currentNowMs
      );
    wearableSequenceState = window.GTWearableSequence.setPlayback(
      wearableSequenceState,
      item.id,
      nextPlayback,
      frameCount
    );
    window.GTWearableSequence.saveState(
      window.localStorage,
      wearableSequenceState
    );
    if (refreshControls) refreshActiveSequenceControls();
    renderAvatarCanvas();
  };

  speedMinus.addEventListener("click", () => {
    commitInterval(
      Number(speedInput.value) - window.GTWearableSequence.INTERVAL_STEP_MS
    );
  });
  speedPlus.addEventListener("click", () => {
    commitInterval(
      Number(speedInput.value) + window.GTWearableSequence.INTERVAL_STEP_MS
    );
  });
  speedInput.addEventListener("change", () => {
    commitInterval(Number(speedInput.value));
  });
  speedInput.addEventListener("input", () => {
    commitInterval(Number(speedInput.value), false);
  });

  speed.append(speedMinus, speedInput, speedUnit, speedPlus);

  controls.append(toggle, previous, slider, next, counter, speed);
  avatarActiveSequenceControls.appendChild(controls);
}

function updateActiveSequencePlaybackDisplay() {
  const target = avatarInventoryState.activeTarget;
  const item = target ? plannerState.equipped[target.slot] : null;
  const descriptor = getWearableDescriptor(item);
  if (!item || !descriptor || !avatarActiveSequenceControls) return;
  const frameCount = window.GTWearableSequence.getFrameCount(descriptor);
  const playback = getWearablePlayback(item);
  const visibleFrame = window.GTWearableSequence.getVisibleFrameAtTime(
    playback,
    frameCount,
    getAvatarAnimationNowMs()
  );
  const slider = avatarActiveSequenceControls.querySelector(
    ".sequence-frame-slider"
  );
  const counter = avatarActiveSequenceControls.querySelector(
    ".sequence-frame-counter"
  );
  const speedInput = avatarActiveSequenceControls.querySelector(
    ".sequence-speed-input"
  );
  if (slider) slider.value = String(visibleFrame);
  if (counter) counter.textContent = `${visibleFrame + 1} / ${frameCount}`;
  if (speedInput && document.activeElement !== speedInput) {
    speedInput.value = String(playback.intervalMs);
  }
}

function updateEquippedItemsBar() {
  const bar = document.getElementById("equipped-items-bar");
  if (!bar) return;
  bar.innerHTML = "";

  const activeTarget = avatarInventoryState.activeTarget;

  Object.keys(plannerState.equipped).forEach(typeKey => {
    const item = plannerState.equipped[typeKey];
    if (item) {
      const chip = document.createElement("div");
      const isActive = activeTarget &&
        activeTarget.slot === typeKey &&
        activeTarget.itemId === Number(item.id);
      chip.className = "equipped-chip" + (isActive ? " equipped-chip--active" : "");
      chip.title = `${typeKey}: ${item.name} — click to select`;

      /* Sprite preview canvas (24×24 display, drawn from tilesheet) */
      const preview = document.createElement("canvas");
      preview.className = "chip-preview";
      preview.width = 32;
      preview.height = 32;
      drawAvatarInventoryPreview(preview, item);

      const typeSpan = document.createElement("span");
      typeSpan.className = "chip-type";
      typeSpan.textContent = typeKey + ":";

      const nameSpan = document.createElement("span");
      nameSpan.className = "chip-name";
      nameSpan.textContent = item.name;

      const removeBtn = document.createElement("button");
      removeBtn.className = "chip-remove";
      removeBtn.type = "button";
      removeBtn.title = "Remove";
      removeBtn.innerHTML = "&times;";

      chip.appendChild(preview);
      chip.appendChild(typeSpan);
      chip.appendChild(nameSpan);
      chip.appendChild(removeBtn);

      chip.addEventListener("click", () => {
        avatarInventoryState.activeTarget = {
          slot: typeKey,
          itemId: Number(item.id)
        };
        setAvatarInspectorTab("item");
        setAvatarWorkspaceTab("inspector");
        refreshActivePositionControls();
        updateEquippedItemsBar();
      });
      removeBtn.addEventListener("click", event => {
        event.stopPropagation();
        plannerState.equipped[typeKey] = null;
        resolveAvatarActiveTarget();
        renderAvatarInventory();
        refreshActivePositionControls();
        renderAvatarCanvas();
        updateEquippedItemsBar();
      });
      bar.appendChild(chip);
    }
  });
}

function randomizeAvatarOutfit() {
  window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
    const typeKey = slot.key;
    const candidates = (wearablesBySlot[typeKey] || []).filter(
      item => item.randomizable
    );
    if (candidates.length) {
      const item = candidates[Math.floor(Math.random() * candidates.length)];
      plannerState.equipped[typeKey] = item;
      autoStartWearableAnimation(item);
    }
  });
  avatarInventoryState.activeTarget = null;
  resolveAvatarActiveTarget();
  renderAvatarInventory();
  refreshActivePositionControls();
  renderAvatarCanvas();
  updateEquippedItemsBar();
}

function resetAvatarOutfit() {
  window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
    const typeKey = slot.key;
    plannerState.equipped[typeKey] = null;
  });
  plannerState.skinTone = "White";
  plannerState.skinColorHex = "#f0f0f0";
  plannerState.expression = 0;
  
  document.querySelectorAll(".skin-color-box").forEach(b => b.classList.remove("selected"));
  const defSkin = document.querySelector(`.skin-color-box[title="White"]`);
  if (defSkin) defSkin.classList.add("selected");

  document.querySelectorAll(".expr-btn").forEach(b => b.classList.remove("active"));
  const defExpression = document.querySelector('.expr-btn[data-expression-id="0"]');
  if (defExpression) defExpression.classList.add("active");
  refreshExpressionPreviews();

  avatarInventoryState.activeTarget = null;
  renderAvatarInventory();
  refreshActivePositionControls();
  renderAvatarCanvas();
  updateEquippedItemsBar();
}

// PERFECT CANVAS COMPOSITE ENGINE FOR GROWTOPIA CHARACTER
function renderAvatarCanvas() {
  if (!avatarCanvas) return;
  const ctx = avatarCanvas.getContext("2d");
  if (!ensureAvatarBaseTextures()) return;
  renderAvatarCompositeToContext(ctx);
}

function renderAvatarCompositeToContext(ctx) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  drawEquippedLayers(ctx, "behind-base");

  drawBasePlayerSkin(ctx, plannerState.skinColorHex);
  drawEquippedLayers(ctx, "pre-expression");
  drawPlayerFacialExpression(ctx, plannerState.expression, plannerState.skinColorHex);

  drawEquippedLayers(ctx, "wearable");
  drawFrontLeftHand(ctx, plannerState.skinColorHex);
}

function drawEquippedLayers(ctx, phase) {
  window.GTWearableCatalog.getRenderLayers().forEach(slot => {
    if (slot.phase !== phase) return;
    const item = plannerState.equipped[slot.key];
    if (item) {
      const customOffset = window.AvatarPositioning.getOffset(
        avatarPositionState,
        slot.key,
        item.id
      );
      const offset = {
        x: PLAYER_ORIGIN.x + slot.defaultOffset.x + customOffset.x,
        y: PLAYER_ORIGIN.y + slot.defaultOffset.y + customOffset.y
      };
      drawLayerItemTile(ctx, item, offset);
    }
  });
}

function ensureAvatarBaseTextures() {
  const paths = Object.values(AVATAR_BASE_TEXTURE_PATHS);
  const allReady = paths.every(path => {
    const image = textureImageCache[path];
    return image && image.complete && image.naturalWidth > 0;
  });
  if (allReady) return true;

  if (!avatarBaseLoadPromise) {
    avatarBaseLoadPromise = Promise.all(paths.map(loadTextureImage))
      .then(() => {
        avatarBaseLoadPromise = null;
        renderAvatarCanvas();
        refreshExpressionPreviews();
      })
      .catch(error => {
        avatarBaseLoadPromise = null;
        paths.forEach(path => {
          delete textureImageCache[path];
          delete textureImagePromises[path];
        });
        console.error("Gagal memuat base character:", error);
      });
  }
  return false;
}

function hexToRgb(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function tintTile(img, sx, sy, sw, sh, colorHex) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tCtx = tempCanvas.getContext("2d");
  tCtx.imageSmoothingEnabled = false;

  tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const imgData = tCtx.getImageData(0, 0, sw, sh);
  const data = imgData.data;
  const rgb = hexToRgb(colorHex);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      // Multiply blend mode: (base / 255) * target
      data[i]     = Math.min(255, Math.floor((data[i] / 255.0) * rgb.r));
      data[i + 1] = Math.min(255, Math.floor((data[i + 1] / 255.0) * rgb.g));
      data[i + 2] = Math.min(255, Math.floor((data[i + 2] / 255.0) * rgb.b));
    }
  }
  tCtx.putImageData(imgData, 0, 0);
  return tempCanvas;
}

function tintExpressionTile(img, sx, sy, sw, sh, colorHex, expressionId) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempContext = tempCanvas.getContext("2d");
  tempContext.imageSmoothingEnabled = false;
  tempContext.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const imageData = tempContext.getImageData(0, 0, sw, sh);
  window.AvatarTint.tintExpressionImageData(imageData, colorHex, expressionId);
  tempContext.putImageData(imageData, 0, 0);
  return tempCanvas;
}

function createExpressionPreviewPng(expressionId) {
  const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.expression];
  if (!img || !img.complete || img.naturalWidth === 0) {
    const placeholder = document.createElement("canvas");
    placeholder.width = 32;
    placeholder.height = 32;
    return placeholder.toDataURL("image/png");
  }
  const coord = getAvatarExpressionCoord(expressionId);
  const tile = tintExpressionTile(
    img,
    coord.x,
    coord.y,
    32,
    32,
    plannerState.skinColorHex,
    expressionId
  );
  return tile.toDataURL("image/png");
}

function refreshExpressionPreviews() {
  document.querySelectorAll(".expr-btn").forEach(button => {
    const id = Number(button.dataset.expressionId);
    const preview = button.querySelector(".expr-preview");
    if (preview) preview.src = createExpressionPreviewPng(id);
  });
}

function drawBasePlayerSkin(ctx, colorHex) {
  const dx = PLAYER_ORIGIN.x * AVATAR_SCALE;
  const dy = PLAYER_ORIGIN.y * AVATAR_SCALE;
  const size = 32 * AVATAR_SCALE;

  // 1. Tangan Kanan (back hand)
  const tanganKananImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tanganKanan];
  if (tanganKananImg) {
    const tinted = tintTile(tanganKananImg, 0, 0, 32, 32, colorHex);
    ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
  }

  // 2. Kaki Kiri
  const kakiKiriImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.kakiKiri];
  if (kakiKiriImg) {
    const tinted = tintTile(kakiKiriImg, 0, 0, 32, 32, colorHex);
    ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
  }

  // 3. Kaki Kanan
  const kakiKananImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.kakiKanan];
  if (kakiKananImg) {
    const tinted = tintTile(kakiKananImg, 0, 0, 32, 32, colorHex);
    ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
  }

  // 4. Body (Naked Body or Default Body)
  const bodyPath = plannerState.isNakedBody
    ? AVATAR_BASE_TEXTURE_PATHS.bodyNaked
    : AVATAR_BASE_TEXTURE_PATHS.bodyDefault;
  const bodyImage = textureImageCache[bodyPath] || textureImageCache[AVATAR_BASE_TEXTURE_PATHS.body];
  if (bodyImage) {
    const tintedBody = tintTile(bodyImage, 0, 0, 32, 32, colorHex);
    ctx.drawImage(tintedBody, 0, 0, 32, 32, dx, dy, size, size);
  }

  // 5. Head & Eye Layers based on Expression Mode
  if (plannerState.expression === 0) {
    // Normal Expression Mode: Head Bolong + Eye Parts + Mouth
    const bolaMataImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.bolaMata];
    if (bolaMataImg) {
      const tinted = tintTile(bolaMataImg, 0, 0, 32, 32, "#ffffff");
      ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
    }
    const pupilImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.pupil];
    if (pupilImg) {
      ctx.drawImage(pupilImg, 0, 0, 32, 32, dx, dy, size, size);
    }
    const headBolongImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.headBolong];
    if (headBolongImg) {
      const tinted = tintTile(headBolongImg, 0, 0, 32, 32, colorHex);
      ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
    }
    const mulutImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.mulut];
    if (mulutImg) {
      const tinted = tintTile(mulutImg, 0, 0, 32, 32, colorHex);
      ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
    }
    const tutupMataImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tutupMata];
    if (tutupMataImg) {
      const tinted = tintTile(tutupMataImg, 0, 0, 32, 32, colorHex);
      ctx.drawImage(tinted, 0, 0, 32, 32, dx, dy, size, size);
    }
  } else {
    // Non-Normal Expression Mode: Solid Head Utuh
    const headUtuhImg = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.headUtuh] || textureImageCache[AVATAR_BASE_TEXTURE_PATHS.head];
    if (headUtuhImg) {
      const tintedHead = tintTile(headUtuhImg, 0, 0, 32, 32, colorHex);
      ctx.drawImage(tintedHead, 0, 0, 32, 32, dx, dy, size, size);
    }
  }
}

function drawFrontLeftHand(ctx, colorHex) {
  const handImage =
    textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tanganKiri] ||
    textureImageCache[AVATAR_BASE_TEXTURE_PATHS.frontLeftHand];
  if (handImage) {
    const tintedHand = tintTile(handImage, 0, 0, 32, 32, colorHex);
    ctx.drawImage(
      tintedHand,
      0,
      0,
      32,
      32,
      PLAYER_ORIGIN.x * AVATAR_SCALE,
      PLAYER_ORIGIN.y * AVATAR_SCALE,
      32 * AVATAR_SCALE,
      32 * AVATAR_SCALE
    );
  }
}

function drawPlayerFacialExpression(ctx, expId, colorHex) {
  const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.expression];
  const coord = getAvatarExpressionCoord(expId);
  const tintedExpression = tintExpressionTile(
    img, coord.x, coord.y, 32, 32, colorHex, expId
  );
  ctx.drawImage(
    tintedExpression,
    0,
    0,
    32,
    32,
    PLAYER_ORIGIN.x * AVATAR_SCALE,
    PLAYER_ORIGIN.y * AVATAR_SCALE,
    32 * AVATAR_SCALE,
    32 * AVATAR_SCALE
  );
}

function getAvatarExpressionCoord(expId) {
  const eyeMap = [
    { x: 0, y: 0 },    // Normal
    { x: 0, y: 32 },   // Happy / Smile
    { x: 128, y: 32 }, // Angry / Mad
    { x: 96, y: 32 },  // Surprised / OMG
    { x: 128, y: 64 }, // Wink
    { x: 64, y: 64 },  // Sleeping
    { x: 192, y: 64 }  // Derp / Troll
  ];

  return eyeMap[expId] || { x: 0, y: 0 };
}

function drawLayerItemTile(ctx, item, offset = { x: 0, y: 0 }) {
  if (!item || !item.texture) return;
  const texturePath = `tilesheets/${item.texture}`;
  const img = textureImageCache[texturePath];

  if (!img || !img.complete || img.naturalWidth === 0) {
    loadTextureImage(texturePath)
      .then(() => renderAvatarCanvas())
      .catch(() => {});
    return;
  }

  const profile = window.GTWearableCatalog.getRenderProfile(
    item.render_profile
  );
  const descriptor = getWearableDescriptor(item);
  const playback = getWearablePlayback(item);
  const visibleFrame = descriptor
    ? window.GTWearableSequence.getVisibleFrameAtTime(
        playback,
        window.GTWearableSequence.getFrameCount(descriptor),
        getAvatarAnimationNowMs()
      )
    : 0;
  const drawPlan = descriptor
    ? window.GTWearableSequence.resolveDrawPlan(
        descriptor,
        { ...playback, mode: "paused", frame: visibleFrame },
        0
      )
    : [{ dx: 0, dy: 0, role: "static" }];
  const dx = offset.x * 4;
  const dy = offset.y * 4;
  try {
    drawPlan.forEach(frame => {
      const sx = (item.tx + frame.dx) * profile.sourceWidth;
      const sy = (item.ty + frame.dy) * profile.sourceHeight;
      assertWearableSourceRect(
        img,
        sx,
        sy,
        profile.sourceWidth,
        profile.sourceHeight,
        item.id
      );
      ctx.drawImage(
        img,
        sx,
        sy,
        profile.sourceWidth,
        profile.sourceHeight,
        dx,
        dy,
        profile.destinationWidth,
        profile.destinationHeight
      );
    });
  } catch (error) {
    if (!avatarSequenceFailures.has(Number(item.id))) {
      avatarSequenceFailures.add(Number(item.id));
      console.warn(`Wearable #${item.id} sequence skipped safely:`, error);
    }
  }
}

function assertWearableSourceRect(img, sx, sy, sw, sh, itemId) {
  if (
    sx < 0 ||
    sy < 0 ||
    sx + sw > img.naturalWidth ||
    sy + sh > img.naturalHeight
  ) {
    throw new RangeError(`Wearable #${itemId} source frame is outside texture bounds`);
  }
}

// Live Preview Canvas Zoom System
let avatarZoomLevel = 1.0;
const MIN_AVATAR_ZOOM = 0.5;
const MAX_AVATAR_ZOOM = 3.0;
const AVATAR_ZOOM_STEP = 0.15;

function setAvatarZoom(newZoom) {
  avatarZoomLevel = Math.max(
    MIN_AVATAR_ZOOM,
    Math.min(MAX_AVATAR_ZOOM, Math.round(newZoom * 100) / 100)
  );
  if (avatarCanvas) {
    avatarCanvas.style.transform =
      avatarZoomLevel === 1.0 ? "none" : `scale(${avatarZoomLevel})`;
  }
  const zoomResetBtn = document.getElementById("avatar-zoom-reset");
  if (zoomResetBtn) {
    zoomResetBtn.textContent = `${Math.round(avatarZoomLevel * 100)}%`;
  }
  const zoomLabel = document.querySelector(".preview-zoom-label");
  if (zoomLabel) {
    const scaleMultiplier = Math.round(4 * avatarZoomLevel * 10) / 10;
    zoomLabel.textContent = `Pixel-Perfect GT Character (${scaleMultiplier}x Scale)`;
  }
}

function setupAvatarZoomControls() {
  const zoomInBtn = document.getElementById("avatar-zoom-in");
  const zoomOutBtn = document.getElementById("avatar-zoom-out");
  const zoomResetBtn = document.getElementById("avatar-zoom-reset");
  const canvasBox =
    document.getElementById("avatar-canvas-box") ||
    document.querySelector(".avatar-canvas-box");

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      setAvatarZoom(avatarZoomLevel + AVATAR_ZOOM_STEP);
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      setAvatarZoom(avatarZoomLevel - AVATAR_ZOOM_STEP);
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      setAvatarZoom(1.0);
    });
  }

  if (canvasBox) {
    canvasBox.addEventListener(
      "wheel",
      event => {
        event.preventDefault();
        const delta = event.deltaY < 0 ? AVATAR_ZOOM_STEP : -AVATAR_ZOOM_STEP;
        setAvatarZoom(avatarZoomLevel + delta);
      },
      { passive: false }
    );
  }
}

// Canvas Drag-to-Position System
function updateCanvasDragCursor() {
  if (!avatarCanvas) return;
  const target = avatarInventoryState.activeTarget;
  if (target && plannerState.equipped[target.slot]) {
    avatarCanvas.classList.add("drag-ready");
  } else {
    avatarCanvas.classList.remove("drag-ready");
  }
}

function setupCanvasDrag() {
  if (!avatarCanvas) return;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartOffset = { x: 0, y: 0 };
  let dragTarget = null;

  function getPointerPos(event) {
    if (event.touches && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  function getCssToLogicalScale() {
    const cssWidth = (avatarCanvas.clientWidth || 576) * avatarZoomLevel;
    return (cssWidth / avatarCanvas.width) * AVATAR_SCALE;
  }

  function onDragStart(event) {
    const target = avatarInventoryState.activeTarget;
    if (!target || !plannerState.equipped[target.slot]) return;

    event.preventDefault();
    isDragging = true;
    dragTarget = { ...target };

    const pos = getPointerPos(event);
    dragStartX = pos.x;
    dragStartY = pos.y;
    dragStartOffset = window.AvatarPositioning.getOffset(
      avatarPositionState,
      dragTarget.slot,
      plannerState.equipped[dragTarget.slot].id
    );

    avatarCanvas.classList.remove("drag-ready");
    avatarCanvas.classList.add("drag-active");
    const canvasBox = avatarCanvas.closest(".avatar-canvas-box");
    if (canvasBox) canvasBox.classList.add("canvas-dragging");
  }

  function onDragMove(event) {
    if (!isDragging || !dragTarget) return;
    event.preventDefault();

    const pos = getPointerPos(event);
    const scale = getCssToLogicalScale();
    const deltaX = Math.round((pos.x - dragStartX) / scale);
    const deltaY = Math.round((pos.y - dragStartY) / scale);

    const newX = dragStartOffset.x + deltaX;
    const newY = dragStartOffset.y + deltaY;

    const item = plannerState.equipped[dragTarget.slot];
    if (!item) { onDragEnd(); return; }

    avatarPositionState = window.AvatarPositioning.setOffset(
      avatarPositionState,
      dragTarget.slot,
      item.id,
      { x: newX, y: newY }
    );

    const clamped = window.AvatarPositioning.getOffset(
      avatarPositionState,
      dragTarget.slot,
      item.id
    );
    avatarActiveTarget.textContent =
      `${dragTarget.slot}: #${item.id} ${item.name} \u00b7 X ${clamped.x} Y ${clamped.y}`;
    const readout = document.querySelector(
      "#avatar-active-position-controls .position-readout"
    );
    if (readout) readout.textContent = `X ${clamped.x} \u00b7 Y ${clamped.y}`;

    renderAvatarCanvas();
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    dragTarget = null;

    avatarCanvas.classList.remove("drag-active");
    const canvasBox = avatarCanvas.closest(".avatar-canvas-box");
    if (canvasBox) canvasBox.classList.remove("canvas-dragging");

    window.AvatarPositioning.save(window.localStorage, avatarPositionState);
    refreshActivePositionControls();
    updateCanvasDragCursor();
  }

  avatarCanvas.addEventListener("mousedown", onDragStart);
  avatarCanvas.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("mouseup", onDragEnd);
  document.addEventListener("touchend", onDragEnd);
  document.addEventListener("touchcancel", onDragEnd);
}

function getExportScaleFactor() {
  const val = avatarExportScaleSelect ? avatarExportScaleSelect.value : "1";
  return Math.max(1, parseInt(val, 10) || 1);
}

function downloadAvatarPNG() {
  const scaleFactor = getExportScaleFactor();
  let sourceCanvas = avatarCanvas;
  if (scaleFactor > 1) {
    const upscaled = document.createElement("canvas");
    upscaled.width = avatarCanvas.width * scaleFactor;
    upscaled.height = avatarCanvas.height * scaleFactor;
    const ctx = upscaled.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(avatarCanvas, 0, 0, upscaled.width, upscaled.height);
    sourceCanvas = upscaled;
  }
  const link = document.createElement("a");
  const pngScale = scaleFactor > 1 ? ` ${scaleFactor}x` : "";
  link.download = `${getExportName()}${pngScale}.png`;
  link.href = sourceCanvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link);
  }, 1000);
  if (avatarExportStatus) {
    avatarExportStatus.classList.remove("error");
    avatarExportStatus.textContent = `Set PNG exported (${sourceCanvas.width}×${sourceCanvas.height} px, ${scaleFactor}x Scale).`;
  }
}

// ─── Export Name Helper ─────────────────────────────────────────────────────
function getExportName() {
  const raw = (plannerState.setName || "").trim();
  return raw.length > 0 ? raw : "Avatar Set";
}

// ─── Saved Sets Cache (localStorage) ────────────────────────────────────────
const SAVED_SETS_KEY = "gt-saved-sets";
const SAVED_SETS_MAX = 20;

function captureAvatarThumbnail(size = 48) {
  if (!avatarCanvas) return "";
  try {
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = size;
    thumbCanvas.height = size;
    const ctx = thumbCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(avatarCanvas, 0, 0, size, size);
    return thumbCanvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function loadSavedSetsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SETS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSavedSetsToStorage(sets) {
  localStorage.setItem(SAVED_SETS_KEY, JSON.stringify(sets));
}

function saveSetToCache() {
  const name = getExportName();
  const sets = loadSavedSetsFromStorage();
  const equippedSnapshot = {};
  Object.keys(plannerState.equipped).forEach(slot => {
    const item = plannerState.equipped[slot];
    if (item) equippedSnapshot[slot] = { id: Number(item.id), name: String(item.name) };
  });
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    thumbnail: captureAvatarThumbnail(48),
    savedAt: new Date().toISOString(),
    skinTone: plannerState.skinTone,
    skinColorHex: plannerState.skinColorHex,
    expression: plannerState.expression,
    isNakedBody: plannerState.isNakedBody,
    equipped: equippedSnapshot
  };
  sets.unshift(entry);
  if (sets.length > SAVED_SETS_MAX) sets.length = SAVED_SETS_MAX;
  writeSavedSetsToStorage(sets);
  renderSavedSetsPanel();
  avatarExportStatus.classList.remove("error");
  avatarExportStatus.textContent = `"${name}" saved to cache.`;
}

function deleteSavedSet(id) {
  const sets = loadSavedSetsFromStorage().filter(s => s.id !== id);
  writeSavedSetsToStorage(sets);
  renderSavedSetsPanel();
}

function loadSetFromCache(entry) {
  if (entry.skinTone && entry.skinColorHex) {
    plannerState.skinTone = entry.skinTone;
    plannerState.skinColorHex = entry.skinColorHex;
    document.querySelectorAll(".skin-color-box").forEach(b => b.classList.remove("selected"));
    const skinBtn = document.querySelector(`.skin-color-box[title="${plannerState.skinTone}"]`);
    if (skinBtn) skinBtn.classList.add("selected");
  }
  if (typeof entry.expression === "number") {
    plannerState.expression = entry.expression;
    document.querySelectorAll(".expr-btn").forEach(b => b.classList.remove("active"));
    const exprBtn = document.querySelector(`.expr-btn[data-expression-id="${entry.expression}"]`);
    if (exprBtn) exprBtn.classList.add("active");
    refreshExpressionPreviews();
  }
  if (typeof entry.isNakedBody === "boolean") {
    plannerState.isNakedBody = entry.isNakedBody;
    const nakedBodyBtn = document.getElementById("naked-body-toggle");
    if (nakedBodyBtn) nakedBodyBtn.classList.toggle("active", plannerState.isNakedBody);
  }
  plannerState.setName = entry.name || "";
  const setNameInput = document.getElementById("set-name-input");
  if (setNameInput) setNameInput.value = plannerState.setName;

  const allItemsList = wearableManifest.items || [];
  window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
    const saved = entry.equipped?.[slot.key];
    if (!saved || !saved.id) { plannerState.equipped[slot.key] = null; return; }
    const match = allItemsList.find(item => Number(item.id) === Number(saved.id));
    plannerState.equipped[slot.key] = match || null;
    if (match) autoStartWearableAnimation(match);
  });

  avatarInventoryState.activeTarget = null;
  resolveAvatarActiveTarget();
  renderAvatarInventory();
  refreshActivePositionControls();
  renderAvatarCanvas();
  updateEquippedItemsBar();
  avatarExportStatus.classList.remove("error");
  avatarExportStatus.textContent = `"${entry.name}" loaded.`;
}

function renderSavedSetsPanel() {
  const sets = loadSavedSetsFromStorage();
  const list = document.getElementById("saved-sets-list");
  const countEl = document.getElementById("saved-sets-count");
  if (!list) return;
  if (countEl) countEl.textContent = `${sets.length} saved`;
  if (sets.length === 0) {
    list.innerHTML = `<div class="saved-sets-empty">No saved sets yet.<br>Click 💾 Save Set to add one.</div>`;
    return;
  }
  list.innerHTML = "";
  sets.forEach(entry => {
    const el = document.createElement("div");
    el.className = "saved-set-entry";
    const date = new Date(entry.savedAt);
    const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" });
    const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const thumbHtml = entry.thumbnail
      ? `<img src="${entry.thumbnail}" class="saved-set-thumb" alt="${entry.name}" width="40" height="40">`
      : `<div class="saved-set-dot" style="background:${entry.skinColorHex || '#888'}"></div>`;
    el.innerHTML = `
      <div class="saved-set-preview-col">${thumbHtml}</div>
      <div class="saved-set-info">
        <div class="saved-set-name" title="${entry.name}">${entry.name}</div>
        <div class="saved-set-meta">${dateStr} ${timeStr}</div>
      </div>
      <div class="saved-set-actions">
        <button class="saved-set-load-btn" title="Load set">Load</button>
        <button class="saved-set-delete-btn" title="Delete set">\u{1F5D1}</button>
      </div>`;
    el.querySelector(".saved-set-load-btn").addEventListener("click", () => loadSetFromCache(entry));
    el.querySelector(".saved-set-delete-btn").addEventListener("click", () => deleteSavedSet(entry.id));
    list.appendChild(el);
  });
}

function exportSetJSON() {
  const setData = {
    version: 1,
    name: plannerState.setName || "",
    skinTone: plannerState.skinTone,
    skinColorHex: plannerState.skinColorHex,
    expression: plannerState.expression,
    equipped: {}
  };
  Object.keys(plannerState.equipped).forEach(slot => {
    const item = plannerState.equipped[slot];
    if (item) {
      setData.equipped[slot] = { id: Number(item.id), name: String(item.name) };
    }
  });
  const json = JSON.stringify(setData, null, 2) + "\n";
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getExportName()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  avatarExportStatus.textContent = "Set exported as JSON.";
}

function importSetJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  avatarImportFileInput.value = "";

  const reader = new FileReader();
  reader.onerror = () => {
    avatarExportStatus.classList.add("error");
    avatarExportStatus.textContent = "Failed to read file.";
  };
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object" || data.version !== 1) {
        throw new Error("Invalid or unsupported set file format.");
      }

      /* Resolve skin tone */
      if (data.skinTone && data.skinColorHex) {
        plannerState.skinTone = String(data.skinTone);
        plannerState.skinColorHex = String(data.skinColorHex);
        document.querySelectorAll(".skin-color-box").forEach(b => b.classList.remove("selected"));
        const skinBtn = document.querySelector(`.skin-color-box[title="${plannerState.skinTone}"]`);
        if (skinBtn) skinBtn.classList.add("selected");
      }

      /* Restore set name */
      if (typeof data.name === "string") {
        plannerState.setName = data.name;
        const setNameInput = document.getElementById("set-name-input");
        if (setNameInput) setNameInput.value = data.name;
      }

      /* Resolve expression */
      if (typeof data.expression === "number") {
        plannerState.expression = data.expression;
        document.querySelectorAll(".expr-btn").forEach(b => b.classList.remove("active"));
        const exprBtn = document.querySelector(`.expr-btn[data-expression-id="${data.expression}"]`);
        if (exprBtn) exprBtn.classList.add("active");
        refreshExpressionPreviews();
      }

      /* Resolve equipped items */
      const notFound = [];
      const allItems = wearableManifest.items || [];
      window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
        const saved = data.equipped?.[slot.key];
        if (!saved || !saved.id) {
          plannerState.equipped[slot.key] = null;
          return;
        }
        const match = allItems.find(item => Number(item.id) === Number(saved.id));
        if (match) {
          plannerState.equipped[slot.key] = match;
          autoStartWearableAnimation(match);
        } else {
          plannerState.equipped[slot.key] = null;
          notFound.push(`${slot.key}: ${saved.name || saved.id}`);
        }
      });

      avatarInventoryState.activeTarget = null;
      resolveAvatarActiveTarget();
      renderAvatarInventory();
      refreshActivePositionControls();
      renderAvatarCanvas();
      updateEquippedItemsBar();

      avatarExportStatus.classList.remove("error");
      if (notFound.length) {
        avatarExportStatus.textContent =
          `Set imported. ${notFound.length} item(s) not found: ${notFound.join(", ")}`;
      } else {
        avatarExportStatus.textContent = "Set imported successfully!";
      }
    } catch (err) {
      avatarExportStatus.classList.add("error");
      avatarExportStatus.textContent = `Import failed: ${err.message}`;
      console.error("Set import failed:", err);
    }
  };
  reader.readAsText(file);
}

function createAvatarExportCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_LOGICAL_SIZE * AVATAR_SCALE;
  canvas.height = AVATAR_LOGICAL_SIZE * AVATAR_SCALE;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  return canvas;
}

async function renderExportLayerCanvas(descriptor) {
  const canvas = createAvatarExportCanvas();
  const context = canvas.getContext("2d");
  const dx = PLAYER_ORIGIN.x * AVATAR_SCALE;
  const dy = PLAYER_ORIGIN.y * AVATAR_SCALE;
  const destinationSize = 32 * AVATAR_SCALE;

  if (descriptor.kind === "wearable") {
    const item = descriptor.item;
    const texturePath = `tilesheets/${item.texture}`;
    const image = await loadTextureImage(texturePath);
    const profile = window.GTWearableCatalog.getRenderProfile(
      item.render_profile
    );
    context.drawImage(
      image,
      item.tx * profile.sourceWidth,
      item.ty * profile.sourceHeight,
      profile.sourceWidth,
      profile.sourceHeight,
      descriptor.finalLogicalOrigin.x * AVATAR_SCALE,
      descriptor.finalLogicalOrigin.y * AVATAR_SCALE,
      profile.destinationWidth,
      profile.destinationHeight
    );
    return canvas;
  }

  if (descriptor.key === "tangan-kanan") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tanganKanan];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "kaki-kiri") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.kakiKiri];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "kaki-kanan") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.kakiKanan];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "body") {
    const bodyPath = plannerState.isNakedBody
      ? AVATAR_BASE_TEXTURE_PATHS.bodyNaked
      : AVATAR_BASE_TEXTURE_PATHS.bodyDefault;
    const img = textureImageCache[bodyPath] || textureImageCache[AVATAR_BASE_TEXTURE_PATHS.body];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "bola-mata") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.bolaMata];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, "#ffffff");
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "pupil") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.pupil];
    if (img) {
      context.drawImage(img, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "head-bolong") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.headBolong];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "mulut") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.mulut];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "tutup-mata") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tutupMata];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "head-utuh") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.headUtuh] || textureImageCache[AVATAR_BASE_TEXTURE_PATHS.head];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "tangan-kiri") {
    const img = textureImageCache[AVATAR_BASE_TEXTURE_PATHS.tanganKiri] || textureImageCache[AVATAR_BASE_TEXTURE_PATHS.frontLeftHand];
    if (img) {
      const tinted = tintTile(img, 0, 0, 32, 32, plannerState.skinColorHex);
      context.drawImage(tinted, 0, 0, 32, 32, dx, dy, destinationSize, destinationSize);
    }
    return canvas;
  }

  if (descriptor.key === "expression") {
    const expression =
      textureImageCache[AVATAR_BASE_TEXTURE_PATHS.expression];
    const coord = getAvatarExpressionCoord(plannerState.expression);
    const tintedExpression = tintExpressionTile(
      expression,
      coord.x,
      coord.y,
      32,
      32,
      plannerState.skinColorHex,
      plannerState.expression
    );
    context.drawImage(
      tintedExpression,
      0,
      0,
      32,
      32,
      dx,
      dy,
      destinationSize,
      destinationSize
    );
    return canvas;
  }

  throw new Error(`Unsupported export layer: ${descriptor.key}`);
}

function buildCompositeFromLayers(layerCanvases) {
  const reconstruction = createAvatarExportCanvas();
  const reconstructionContext = reconstruction.getContext("2d");
  layerCanvases.forEach(canvas => {
    reconstructionContext.drawImage(canvas, 0, 0);
  });
  return reconstruction;
}

async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      value => value
        ? resolve(value)
        : reject(new Error("PNG encoding failed")),
      "image/png"
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function downloadAvatarLayersZip() {
  avatarDownloadLayersBtn.disabled = true;
  avatarExportStatus.classList.remove("error");
  avatarExportStatus.textContent = "Preparing separate 192×192 layers…";

  /* Freeze animation time so all layers and the composite verification
     render the same frame — prevents RGBA mismatch from frame drift. */
  const frozenMs = getAvatarAnimationNowMs();
  const originalGetNowMs = getAvatarAnimationNowMs;
  getAvatarAnimationNowMs = () => frozenMs;

  try {
    const plan = window.AvatarLayerExporter.buildExportPlan({
      canvas: {
        width: AVATAR_LOGICAL_SIZE * AVATAR_SCALE,
        height: AVATAR_LOGICAL_SIZE * AVATAR_SCALE
      },
      playerOrigin: PLAYER_ORIGIN,
      scale: AVATAR_SCALE,
      skinTone: plannerState.skinTone,
      expressionId: plannerState.expression,
      manifestVersion:
        wearableManifest.meta.items_dat_version ??
        wearableManifest.meta.version ??
        null,
      slotConfig: window.GTWearableCatalog.SLOT_CONFIG,
      equipped: plannerState.equipped,
      getUserOffset: (slot, itemId) =>
        window.AvatarPositioning.getOffset(
          avatarPositionState,
          slot,
          itemId
        )
    });

    const texturePaths = new Set(Object.values(AVATAR_BASE_TEXTURE_PATHS));
    plan.layers.forEach(layer => {
      if (layer.kind === "wearable") {
        texturePaths.add(`tilesheets/${layer.item.texture}`);
      }
    });
    await Promise.all([...texturePaths].map(loadTextureImage));

    const layerCanvases = [];
    for (const descriptor of plan.layers) {
      avatarExportStatus.textContent =
        `Rendering ${descriptor.filename}…`;
      layerCanvases.push(
        await renderExportLayerCanvas(descriptor)
      );
    }

    avatarExportStatus.textContent = "Building composite preview…";
    const compositeCanvas = buildCompositeFromLayers(layerCanvases);
    const root = `${getExportName()} Layers`;
    const entries = [];
    for (let index = 0; index < plan.layers.length; index += 1) {
      entries.push({
        name: `${root}/${plan.layers[index].filename}`,
        bytes: await canvasToPngBytes(layerCanvases[index])
      });
    }
    entries.push({
      name: `${root}/composite-preview.png`,
      bytes: await canvasToPngBytes(compositeCanvas)
    });
    entries.push({
      name: `${root}/layers.json`,
      bytes: new TextEncoder().encode(
        window.AvatarLayerExporter.buildLayersMetadata(plan)
      )
    });

    const zipBytes = window.AvatarLayerExporter.createStoredZip(entries);
    const zipBlob = new Blob([zipBytes], { type: "application/zip" });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.download = `${getExportName()} Layers.zip`;
    link.href = downloadUrl;
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    avatarExportStatus.textContent =
      `Exported ${plan.layers.length} separate layers plus metadata.`;
  } catch (error) {
    avatarExportStatus.classList.add("error");
    avatarExportStatus.textContent = `Export aborted: ${error.message}`;
    console.error("Separate avatar layer export failed:", error);
  } finally {
    getAvatarAnimationNowMs = originalGetNowMs;
    avatarDownloadLayersBtn.disabled = false;
  }
}

function getEquippedWearableSequenceEntries(selectedOnly = false) {
  const target = avatarInventoryState.activeTarget;
  const entries = [];
  window.GTWearableCatalog.SLOT_CONFIG.forEach(slot => {
    if (selectedOnly && (!target || target.slot !== slot.key)) return;
    const item = plannerState.equipped[slot.key];
    const descriptor = getWearableDescriptor(item);
    if (!item || !descriptor) return;
    const userOffset = window.AvatarPositioning.getOffset(
      avatarPositionState,
      slot.key,
      item.id
    );
    entries.push({
      item,
      slot: slot.key,
      descriptor,
      finalLogicalOrigin: {
        x: PLAYER_ORIGIN.x + slot.defaultOffset.x + userOffset.x,
        y: PLAYER_ORIGIN.y + slot.defaultOffset.y + userOffset.y,
      },
    });
  });
  return entries;
}

function refreshAvatarExportAvailability() {
  if (!avatarDownloadSelectedSequenceBtn || !avatarDownloadAllSequencesBtn) {
    return;
  }
  const selectedEntries = getEquippedWearableSequenceEntries(true);
  const allEntries = getEquippedWearableSequenceEntries(false);
  avatarDownloadSelectedSequenceBtn.disabled = selectedEntries.length === 0;
  avatarDownloadAllSequencesBtn.disabled = allEntries.length === 0;
}

async function renderWearableSequenceFrameCanvas(entry, drawPlan) {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_LOGICAL_SIZE * SEQUENCE_EXPORT_SCALE;
  canvas.height = AVATAR_LOGICAL_SIZE * SEQUENCE_EXPORT_SCALE;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const item = entry.item;
  const image = await loadTextureImage(`tilesheets/${item.texture}`);
  const profile = window.GTWearableCatalog.getRenderProfile(
    item.render_profile
  );
  drawPlan.forEach(frame => {
    const sx = (item.tx + frame.dx) * profile.sourceWidth;
    const sy = (item.ty + frame.dy) * profile.sourceHeight;
    assertWearableSourceRect(
      image,
      sx,
      sy,
      profile.sourceWidth,
      profile.sourceHeight,
      item.id
    );
    context.drawImage(
      image,
      sx,
      sy,
      profile.sourceWidth,
      profile.sourceHeight,
      entry.finalLogicalOrigin.x * SEQUENCE_EXPORT_SCALE,
      entry.finalLogicalOrigin.y * SEQUENCE_EXPORT_SCALE,
      profile.sourceWidth * SEQUENCE_EXPORT_SCALE,
      profile.sourceHeight * SEQUENCE_EXPORT_SCALE
    );
  });
  return canvas;
}

async function downloadWearableSequenceZip(entries, label) {
  if (!entries.length) {
    throw new Error(
      label === "selected"
        ? "Select an equipped animated wearable first."
        : "No equipped animated wearables to export."
    );
  }
  const manifest = window.GTWearableSequence.buildSequenceExportManifest({
    canvas: {
      width: AVATAR_LOGICAL_SIZE * SEQUENCE_EXPORT_SCALE,
      height: AVATAR_LOGICAL_SIZE * SEQUENCE_EXPORT_SCALE,
    },
    items: entries,
  });
  const root = "growtopia-wearable-sequences";
  const zipEntries = [{
    name: `${root}/sequence.json`,
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n"),
  }];
  for (const itemManifest of manifest.items) {
    const entry = entries.find(value => Number(value.item.id) === itemManifest.id);
    for (const frame of itemManifest.frames) {
      avatarExportStatus.textContent =
        `Rendering #${itemManifest.id} frame ${frame.index + 1}…`;
      const canvas = await renderWearableSequenceFrameCanvas(
        entry,
        frame.drawPlan
      );
      zipEntries.push({
        name: `${root}/${frame.filename}`,
        bytes: await canvasToPngBytes(canvas),
      });
    }
  }
  const bytes = window.AvatarLayerExporter.createStoredZip(zipEntries);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getExportName()} Sequence ${label}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  avatarExportStatus.textContent =
    `Exported ${manifest.items.length} wearable sequence folder(s).`;
}

async function runWearableSequenceExport(entries, label) {
  avatarDownloadSelectedSequenceBtn.disabled = true;
  avatarDownloadAllSequencesBtn.disabled = true;
  avatarExportStatus.classList.remove("error");
  avatarExportStatus.textContent = "Preparing positioned sequence frames…";
  try {
    await downloadWearableSequenceZip(entries, label);
  } catch (error) {
    avatarExportStatus.classList.add("error");
    avatarExportStatus.textContent = `Sequence export aborted: ${error.message}`;
    console.error("Wearable sequence export failed:", error);
  } finally {
    refreshAvatarExportAvailability();
  }
}

async function downloadSelectedWearableSequenceZip() {
  await runWearableSequenceExport(
    getEquippedWearableSequenceEntries(true),
    "selected"
  );
}

async function downloadAllEquippedWearableSequencesZip() {
  await runWearableSequenceExport(
    getEquippedWearableSequenceEntries(false),
    "all-equipped"
  );
}

function isSequenceAnimationSheet(filename) {
  const f = filename.toLowerCase();
  const sequencePrefixes = [
    "bt_mov", "blogox", "pet_", "p_", "wn_", "w_heart", "shamrock", 
    "st_", "sf_", "sky_twirl", "transmografication", "_mov", "_anim", "_walk"
  ];
  return sequencePrefixes.some(p => f.includes(p));
}

function filterSheets() {
  filteredSheets = allSheets.filter(sheet => {
    if (!sheetSearchQuery) return true;
    return sheet.filename.toLowerCase().includes(sheetSearchQuery);
  });
  renderSheetsGrid();
}

function renderSheetsGrid() {
  sheetsGrid.innerHTML = "";

  if (filteredSheets.length === 0) {
    sheetEmptyState.classList.remove("hidden");
    sheetInfoText.textContent = "0 Tilesheet";
    return;
  }

  sheetEmptyState.classList.add("hidden");
  sheetInfoText.textContent = `Menampilkan ${filteredSheets.length} dari ${allSheets.length} File Tilesheet Mentahan PNG`;

  filteredSheets.forEach(sheet => {
    const card = document.createElement("div");
    card.className = "sheet-card";

    const isSeq = isSequenceAnimationSheet(sheet.filename);
    const seqBadgeHtml = isSeq ? `<span class="anim-indicator-badge" style="background:rgba(168,85,247,0.2); border-color:rgba(168,85,247,0.4); color:var(--purple-glow);">🎞️ Sequence Anim</span>` : '';

    card.innerHTML = `
      ${seqBadgeHtml}
      <div class="sheet-preview-frame" title="Klik untuk Full Preview & GIF Mode">
        <img class="sheet-preview-img" src="tilesheets/${sheet.filename}" alt="${sheet.filename}" loading="lazy">
      </div>
      <div class="sheet-info-group">
        <div class="sheet-filename">${escapeHtml(sheet.filename)}</div>
        <div class="sheet-meta-text">Ukuran: ${sheet.width} x ${sheet.height} px | ${sheet.item_count} Item</div>
      </div>
      <a class="btn btn-primary" href="tilesheets/${sheet.filename}" download="${sheet.filename}">
        <span>💾</span> Download Full Tilesheet PNG
      </a>
    `;

    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest("button")) return;
      openSheetModal(sheet);
    });

    sheetsGrid.appendChild(card);
  });
}

function openSheetModal(sheet) {
  activeModalSheet = sheet;
  seqFrameIndex = 0;
  
  sheetModalFilename.textContent = sheet.filename;
  sheetModalMeta.textContent = `${sheet.width} x ${sheet.height} px | ${sheet.item_count ? sheet.item_count.toLocaleString() : "1"} Item`;
  
  sheetModalImg.src = `tilesheets/${sheet.filename}`;
  sheetModalDownloadBtn.href = `tilesheets/${sheet.filename}`;
  sheetModalDownloadBtn.download = sheet.filename;

  const isSeq = isSequenceAnimationSheet(sheet.filename);
  if (isSeq) {
    sheetAnimBadge.classList.remove("hidden");
  } else {
    sheetAnimBadge.classList.add("hidden");
  }

  setSheetModalMode("full");
  sheetModalOverlay.classList.remove("hidden");
}

function setSheetModalMode(mode) {
  activeSheetMode = mode;
  pauseSeqAnimation();

  if (mode === "full") {
    modeFullSheetBtn.classList.add("active");
    modeSequenceAnimBtn.classList.remove("active");
    viewportFullSheet.classList.remove("hidden");
    viewportSequenceAnim.classList.add("hidden");
    zoomControlsBar.classList.remove("hidden");
    setSheetZoom(1.0);
  } else {
    modeSequenceAnimBtn.classList.add("active");
    modeFullSheetBtn.classList.remove("active");
    viewportSequenceAnim.classList.remove("hidden");
    viewportFullSheet.classList.add("hidden");
    zoomControlsBar.classList.add("hidden");

    if (activeModalSheet) {
      if (activeModalSheet.height <= 64 || activeModalSheet.width <= 256) {
        seqFrameSize = 64;
        seqTotalFrames = 16;
      } else if (activeModalSheet.height <= 128) {
        seqFrameSize = 128;
        seqTotalFrames = 8;
      } else {
        seqFrameSize = 64;
        seqTotalFrames = 16;
      }
      seqFrameSizeSelect.value = seqFrameSize.toString();
      seqFrameCountSelect.value = seqTotalFrames.toString();
      sequenceCanvas.width = seqFrameSize;
      sequenceCanvas.height = seqFrameSize;
    }

    updateSequenceFrameView();
  }
}

function closeSheetModal() {
  pauseSeqAnimation();
  sheetModalOverlay.classList.add("hidden");
  activeModalSheet = null;
}

function changeSheetZoom(delta) {
  setSheetZoom(currentSheetZoom + delta);
}

function setSheetZoom(zoomVal) {
  currentSheetZoom = Math.min(Math.max(0.5, zoomVal), 3.0);
  sheetZoomWrapper.style.transform = `scale(${currentSheetZoom})`;
  sheetZoomLevel.textContent = `${Math.round(currentSheetZoom * 100)}%`;
}

function updateSequenceFrameView() {
  if (!activeModalSheet) return;

  const ctx = sequenceCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const texturePath = `tilesheets/${activeModalSheet.filename}`;
  drawLoadingState(ctx, seqFrameSize, seqFrameSize);
  loadTextureImage(texturePath)
    .then(img => {
      if (activeModalSheet) drawSeqFrame(ctx, img);
    })
    .catch(() => drawNoSpriteState(ctx, seqFrameSize, seqFrameSize));

  sequenceFrameLabel.textContent = `Frame ${seqFrameIndex + 1} dari ${seqTotalFrames}`;
}

function drawSeqFrame(ctx, img) {
  ctx.clearRect(0, 0, seqFrameSize, seqFrameSize);
  
  const cols = Math.floor(img.naturalWidth / seqFrameSize) || 1;
  const sx = (seqFrameIndex % cols) * seqFrameSize;
  const sy = Math.floor(seqFrameIndex / cols) * seqFrameSize;

  if (sx + seqFrameSize <= img.naturalWidth && sy + seqFrameSize <= img.naturalHeight) {
    ctx.drawImage(img, sx, sy, seqFrameSize, seqFrameSize, 0, 0, seqFrameSize, seqFrameSize);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, seqFrameSize, seqFrameSize);
  }
}

function toggleSeqAnimationPlay() {
  if (isSeqAnimPlaying) {
    pauseSeqAnimation();
  } else {
    playSeqAnimation();
  }
}

function playSeqAnimation() {
  if (!activeModalSheet) return;
  isSeqAnimPlaying = true;
  seqPlayBtn.textContent = "⏸ Pause GIF";
  seqPlayBtn.style.background = "#f59e0b";
  seqPlayBtn.style.color = "#000";

  seqAnimTimer = setInterval(() => {
    seqFrameIndex = (seqFrameIndex + 1) % seqTotalFrames;
    updateSequenceFrameView();
  }, 150);
}

function pauseSeqAnimation() {
  isSeqAnimPlaying = false;
  if (seqAnimTimer) clearInterval(seqAnimTimer);
  seqPlayBtn.textContent = "▶ Play GIF";
  seqPlayBtn.style.background = "";
  seqPlayBtn.style.color = "";
}

function convertRawSheetToGIF(sheet) {
  const texturePath = `tilesheets/${sheet.filename}`;
  const img = textureImageCache[texturePath] || new Image();

  sheetModalGifBtn.innerHTML = `<span>⏳</span> Converting GIF...`;

  const doEncode = () => {
    try {
      const encoder = new window.SimpleGIFEncoder(seqFrameSize, seqFrameSize, 150);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = seqFrameSize;
      tempCanvas.height = seqFrameSize;
      const ctx = tempCanvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      const cols = Math.floor(img.naturalWidth / seqFrameSize) || 1;

      for (let f = 0; f < seqTotalFrames; f++) {
        ctx.clearRect(0, 0, seqFrameSize, seqFrameSize);
        const sx = (f % cols) * seqFrameSize;
        const sy = Math.floor(f / cols) * seqFrameSize;
        if (sx + seqFrameSize <= img.naturalWidth && sy + seqFrameSize <= img.naturalHeight) {
          ctx.drawImage(img, sx, sy, seqFrameSize, seqFrameSize, 0, 0, seqFrameSize, seqFrameSize);
        }
        encoder.addFrame(ctx);
      }

      const gifBytes = encoder.build();
      const blob = new Blob([gifBytes], { type: "image/gif" });
      const link = document.createElement("a");
      const cleanName = sheet.filename.replace(".png", "");
      link.download = `gt_sequence_${cleanName}_animated.gif`;
      link.href = URL.createObjectURL(blob);
      link.click();

      sheetModalGifBtn.innerHTML = `<span>✅</span> GIF Downloaded!`;
    } catch (e) {
      console.error("Gagal konversi GIF:", e);
      alert("Gagal konversi GIF.");
    } finally {
      setTimeout(() => {
        sheetModalGifBtn.innerHTML = `<span>🎞️</span> Convert & Download Animated GIF`;
      }, 2000);
    }
  };

  if (!img.complete) {
    img.crossOrigin = "anonymous";
    img.src = texturePath;
    img.onload = doEncode;
  } else {
    doEncode();
  }
}

function extractRawSheetFrames(sheet) {
  const texturePath = `tilesheets/${sheet.filename}`;
  const img = textureImageCache[texturePath] || new Image();

  sheetModalExtractBtn.innerHTML = `<span>⏳</span> Extracting...`;

  const doExtract = () => {
    const cols = Math.floor(img.naturalWidth / seqFrameSize) || 1;

    for (let f = 0; f < seqTotalFrames; f++) {
      setTimeout(() => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = seqFrameSize;
        tempCanvas.height = seqFrameSize;
        const ctx = tempCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const sx = (f % cols) * seqFrameSize;
        const sy = Math.floor(f / cols) * seqFrameSize;
        if (sx + seqFrameSize <= img.naturalWidth && sy + seqFrameSize <= img.naturalHeight) {
          ctx.drawImage(img, sx, sy, seqFrameSize, seqFrameSize, 0, 0, seqFrameSize, seqFrameSize);
        }

        const link = document.createElement("a");
        const cleanName = sheet.filename.replace(".png", "");
        link.download = `gt_sequence_${cleanName}_frame${f + 1}.png`;
        link.href = tempCanvas.toDataURL("image/png");
        link.click();

        if (f === seqTotalFrames - 1) {
          sheetModalExtractBtn.innerHTML = `<span>✅</span> All ${seqTotalFrames} Frames Saved!`;
          setTimeout(() => {
            sheetModalExtractBtn.innerHTML = `<span>🖼️</span> Extract Sequence Frames (PNG)`;
          }, 2000);
        }
      }, f * 200);
    }
  };

  if (!img.complete) {
    img.crossOrigin = "anonymous";
    img.src = texturePath;
    img.onload = doExtract;
  } else {
    doExtract();
  }
}

function renderSpriteToCanvas(canvasId, item, frameOffset = 0) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (!item.texture) {
    drawNoSpriteState(ctx, 32, 32);
    return;
  }

  const texturePath = `tilesheets/${item.texture}`;
  drawLoadingState(ctx, 32, 32);
  loadTextureImage(texturePath)
    .then(img => {
      if (canvas.isConnected) {
        drawCrop(ctx, img, item.tx + frameOffset, item.ty, item.name);
      }
    })
    .catch(() => {
      if (canvas.isConnected) drawNoSpriteState(ctx, 32, 32);
    });
}

function loadTextureImage(texturePath) {
  const cached = textureImageCache[texturePath];
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  if (textureImagePromises[texturePath]) {
    return textureImagePromises[texturePath];
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    textureImageCache[texturePath] = img;

    img.onload = () => {
      if (img.naturalWidth > 0) {
        resolve(img);
      } else {
        delete textureImageCache[texturePath];
        delete textureImagePromises[texturePath];
        reject(new Error(`Texture kosong: ${texturePath}`));
      }
    };
    img.onerror = () => {
      delete textureImageCache[texturePath];
      delete textureImagePromises[texturePath];
      reject(new Error(`Gagal memuat: ${texturePath}`));
    };
    img.src = texturePath;
  });

  textureImagePromises[texturePath] = promise;
  return promise;
}

function drawLoadingState(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fillRect(0, 0, width, height);
}

function drawNoSpriteState(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const cell = Math.max(4, Math.floor(width / 8));
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2 === 0)
        ? "rgba(100,116,139,0.18)"
        : "rgba(15,23,42,0.28)";
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.strokeStyle = "rgba(148,163,184,0.65)";
  ctx.lineWidth = Math.max(1, width / 32);
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.beginPath();
  ctx.moveTo(width * 0.22, height * 0.72);
  ctx.lineTo(width * 0.44, height * 0.46);
  ctx.lineTo(width * 0.58, height * 0.6);
  ctx.lineTo(width * 0.76, height * 0.36);
  ctx.stroke();
}

function drawCrop(ctx, img, tx, ty, itemName = "") {
  ctx.clearRect(0, 0, 32, 32);
  const sx = tx * 32;
  const sy = ty * 32;

  if (sx + 32 <= img.naturalWidth && sy + 32 <= img.naturalHeight) {
    ctx.drawImage(img, sx, sy, 32, 32, 0, 0, 32, 32);
  } else {
    drawNoSpriteState(ctx, 32, 32);
  }
}

function drawPlaceholder(ctx, name = "") {
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 0, 32, 32);
  
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  ctx.fillText(letter, 16, 16);
}

function openModal(item) {
  activeModalItem = item;
  currentFrameIndex = 0;
  
  const seqFrames = getWearableFrameCount(item);
  if (seqFrames > 1) {
    item.has_anim = true;
    item.frames = seqFrames;
  }

  modalCatBadge.textContent = item.category || item.slot;
  modalTitle.textContent = item.name;
  modalIdTag.textContent = `ID Item: #${item.id}`;
  modalTexture.textContent = item.texture || "N/A";
  if (item.texture) {
    modalTexture.style.cursor = "pointer";
    modalTexture.style.textDecoration = "underline";
    modalTexture.style.color = "var(--primary-glow)";
    modalTexture.title = "Klik untuk membuka Full Tilesheet Preview";
    modalTexture.onclick = () => {
      if (activeModalItem && activeModalItem.texture) {
        const sheet = allSheets.find(s => s.filename === activeModalItem.texture) || {
          filename: activeModalItem.texture,
          width: 256,
          height: 256,
          item_count: 1
        };
        closeModal();
        openSheetModal(sheet);
      }
    };
  } else {
    modalTexture.style.cursor = "default";
    modalTexture.style.textDecoration = "none";
    modalTexture.style.color = "";
    modalTexture.onclick = null;
  }
  modalCoords.textContent = `Tile X: ${item.tx}, Tile Y: ${item.ty} (Grid 32x32px)`;
  modalAction.textContent = `Action Type: ${item.action || "Wearable"}`;
  modalAnimStatus.textContent = item.has_anim ? `🎞️ Animated Item (${item.frames || 4} frames)` : `🖼️ Static (Non-Animated)`;

  if (item.has_anim) {
    animControlsContainer.classList.remove("hidden");
    frameSliderContainer.classList.remove("hidden");
    modalGifBtn.classList.remove("hidden");
    modalExtractFramesBtn.classList.remove("hidden");

    totalFrames = item.frames > 1 ? item.frames : parseInt(frameCountSelect.value, 10);
    frameCountSelect.value = totalFrames.toString();
    if (!frameCountSelect.querySelector(`option[value="${totalFrames}"]`)) {
      frameCountSelect.value = "4";
      totalFrames = 4;
    }
    
    frameSlider.max = totalFrames - 1;
    frameSlider.value = 0;
  } else {
    animControlsContainer.classList.add("hidden");
    frameSliderContainer.classList.add("hidden");
    modalGifBtn.classList.add("hidden");
    modalExtractFramesBtn.classList.add("hidden");

    totalFrames = 1;
  }

  updateModalFrameView();
  modalOverlay.classList.remove("hidden");
}

function updateModalFrameView() {
  if (!activeModalItem) return;

  if (activeModalItem.has_anim) {
    modalFrameIndicator.textContent = `Frame ${currentFrameIndex + 1} dari ${totalFrames} (4x Zoom)`;
    if (frameSlider) frameSlider.value = currentFrameIndex;
  } else {
    modalFrameIndicator.textContent = `Static Sprite (4x Zoom)`;
  }

  const ctx = modalCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (!activeModalItem.texture) {
    drawNoSpriteState(ctx, 32, 32);
    return;
  }

  const currentItem = activeModalItem;
  const currentFrame = currentFrameIndex;
  const texturePath = `tilesheets/${currentItem.texture}`;

  const cached = textureImageCache[texturePath];
  if (cached && cached.complete && cached.naturalWidth > 0) {
    drawCrop(ctx, cached, currentItem.tx + currentFrame, currentItem.ty, currentItem.name);
    return;
  }

  drawLoadingState(ctx, 32, 32);
  loadTextureImage(texturePath)
    .then(img => {
      if (activeModalItem && activeModalItem.id === currentItem.id) {
        drawCrop(ctx, img, currentItem.tx + currentFrameIndex, currentItem.ty, currentItem.name);
      }
    })
    .catch(() => {
      if (activeModalItem && activeModalItem.id === currentItem.id) {
        drawNoSpriteState(ctx, 32, 32);
      }
    });
}

function toggleAnimationPlay() {
  if (isAnimPlaying) {
    pauseAnimation();
  } else {
    playAnimation();
  }
}

function playAnimation() {
  if (!activeModalItem || !activeModalItem.has_anim) return;
  isAnimPlaying = true;
  animPlayBtn.textContent = "⏸ Pause";
  animPlayBtn.style.background = "#f59e0b";
  animPlayBtn.style.color = "#000";

  animTimer = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % totalFrames;
    updateModalFrameView();
  }, 150);
}

function pauseAnimation() {
  isAnimPlaying = false;
  if (animTimer) clearInterval(animTimer);
  animPlayBtn.textContent = "▶ Play";
  animPlayBtn.style.background = "";
  animPlayBtn.style.color = "";
}

function closeModal() {
  pauseAnimation();
  modalOverlay.classList.add("hidden");
  activeModalItem = null;
}

function downloadItemSprite(item, frameOffset = 0) {
  if (!item || !item.texture) {
    alert("Item tidak memiliki tekstur sprite.");
    return;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 32;
  tempCanvas.height = 32;
  const ctx = tempCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const texturePath = `tilesheets/${item.texture}`;
  loadTextureImage(texturePath)
    .then(img => {
      drawCrop(ctx, img, item.tx + frameOffset, item.ty, item.name);
      const link = document.createElement("a");
      const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `gt_item_${item.id}_${cleanName}_frame${frameOffset + 1}.png`;
      link.href = tempCanvas.toDataURL("image/png");
      link.click();
    })
    .catch(() => {
      alert("Texture sprite gagal dimuat untuk diunduh.");
    });
}

function convertToAnimatedGIF(item, countFrames) {
  const texturePath = `tilesheets/${item.texture}`;
  const img = textureImageCache[texturePath];

  if (!img || !img.complete) {
    alert("Texture tilesheet belum siap.");
    return;
  }

  modalGifBtn.innerHTML = `<span>⏳</span> Converting GIF...`;

  setTimeout(() => {
    try {
      const encoder = new window.SimpleGIFEncoder(32, 32, 150);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 32;
      tempCanvas.height = 32;
      const ctx = tempCanvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      for (let f = 0; f < countFrames; f++) {
        drawCrop(ctx, img, item.tx + f, item.ty, item.name);
        encoder.addFrame(ctx);
      }

      const gifBytes = encoder.build();
      const blob = new Blob([gifBytes], { type: "image/gif" });
      const link = document.createElement("a");
      const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `gt_item_${item.id}_${cleanName}_animated.gif`;
      link.href = URL.createObjectURL(blob);
      link.click();

      modalGifBtn.innerHTML = `<span>✅</span> GIF Downloaded!`;
    } catch (e) {
      console.error("Gagal mengonversi GIF:", e);
      alert("Gagal mengonversi GIF.");
    } finally {
      setTimeout(() => {
        modalGifBtn.innerHTML = `<span>🎞️</span> Convert to Animated GIF`;
      }, 2000);
    }
  }, 50);
}

function extractAllFrames(item, countFrames) {
  modalExtractFramesBtn.innerHTML = `<span>⏳</span> Extracting...`;

  for (let f = 0; f < countFrames; f++) {
    setTimeout(() => {
      downloadItemSprite(item, f);
      if (f === countFrames - 1) {
        modalExtractFramesBtn.innerHTML = `<span>✅</span> All ${countFrames} Frames Saved!`;
        setTimeout(() => {
          modalExtractFramesBtn.innerHTML = `<span>🖼️</span> Extract Frame 1 - dst (PNG)`;
        }, 2000);
      }
    }, f * 200);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let importedImage = null;
let importedScale = 4;
let importAnimPlaying = false;
let importAnimTimer = null;
let importFrameIndex = 0;

function initImportStudio() {
  const uploadDropzone = document.getElementById("upload-dropzone");
  const importFileInput = document.getElementById("import-file-input");
  const btnBrowseFile = document.getElementById("btn-browse-file");

  const importWorkspace = document.getElementById("import-workspace");
  const importFilenameTag = document.getElementById("import-filename-tag");
  const importDimTag = document.getElementById("import-dim-tag");

  const importScaleSlider = document.getElementById("import-scale-slider");
  const importScaleVal = document.getElementById("import-scale-val");
  const presetScaleBtns = document.querySelectorAll(".btn-scale-chip");

  const importPreviewCanvas = document.getElementById("import-preview-canvas");
  const importAnimCanvas = document.getElementById("import-anim-canvas");
  const importFrameStatus = document.getElementById("import-frame-status");

  const importFrameSizeSelect = document.getElementById("import-frame-size");
  const importFrameCountSelect = document.getElementById("import-frame-count");
  const importDelayMsSelect = document.getElementById("import-delay-ms");
  const importExportScaleInput = document.getElementById("import-export-scale");
  const importOutResolutionTag = document.getElementById("import-out-resolution");

  const importPlayBtn = document.getElementById("import-play-btn");
  const importConvertGifBtn = document.getElementById("import-convert-gif-btn");
  const importConvertPngSeqBtn = document.getElementById("import-convert-png-seq-btn");

  if (!uploadDropzone || uploadDropzone.getAttribute("data-initialized")) return;
  uploadDropzone.setAttribute("data-initialized", "true");

  function updateOutResolution() {
    const frameSize = Math.max(8, parseInt(importFrameSizeSelect.value, 10) || 32);
    const scale = Math.max(1, parseInt(importExportScaleInput.value, 10) || 4);
    const outDim = frameSize * scale;
    if (importOutResolutionTag) importOutResolutionTag.textContent = `Output: ${outDim} x ${outDim} px`;
  }

  if (importFrameSizeSelect) {
    importFrameSizeSelect.addEventListener("input", () => { updateImportAnimView(); updateOutResolution(); });
    importFrameSizeSelect.addEventListener("change", () => { updateImportAnimView(); updateOutResolution(); });
  }
  if (importFrameCountSelect) {
    importFrameCountSelect.addEventListener("input", updateImportAnimView);
    importFrameCountSelect.addEventListener("change", updateImportAnimView);
  }
  if (importExportScaleInput) {
    importExportScaleInput.addEventListener("input", updateOutResolution);
    importExportScaleInput.addEventListener("change", updateOutResolution);
  }

  uploadDropzone.addEventListener("click", () => importFileInput.click());
  uploadDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadDropzone.classList.add("dragover");
  });
  uploadDropzone.addEventListener("dragleave", () => uploadDropzone.classList.remove("dragover"));
  uploadDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImportFile(e.dataTransfer.files[0]);
    }
  });

  if (btnBrowseFile) {
    btnBrowseFile.addEventListener("click", (e) => {
      e.stopPropagation();
      importFileInput.click();
    });
  }

  if (importFileInput) {
    importFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleImportFile(e.target.files[0]);
      }
    });
  }

  function handleImportFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Silakan pilih file gambar (PNG, JPEG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        importedImage = img;
        if (importFilenameTag) importFilenameTag.textContent = file.name;
        if (importDimTag) importDimTag.textContent = `${img.width} x ${img.height} px`;
        if (importWorkspace) importWorkspace.classList.remove("hidden");

        if (img.height <= 32 || img.width <= 128) {
          importFrameSizeSelect.value = "32";
        } else if (img.height <= 64 || img.width <= 256) {
          importFrameSizeSelect.value = "64";
        } else if (img.height <= 128) {
          importFrameSizeSelect.value = "128";
        } else {
          importFrameSizeSelect.value = "256";
        }

        renderImportPreviewCanvas();
        updateImportAnimView();
        updateOutResolution();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  if (importScaleSlider) {
    importScaleSlider.addEventListener("input", (e) => {
      importedScale = parseFloat(e.target.value);
      if (importScaleVal) importScaleVal.textContent = `${importedScale}x Scale`;
      renderImportPreviewCanvas();
    });
  }

  presetScaleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetScaleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      importedScale = parseFloat(btn.getAttribute("data-scale"));
      if (importScaleSlider) importScaleSlider.value = importedScale;
      if (importScaleVal) importScaleVal.textContent = `${importedScale}x Scale`;
      renderImportPreviewCanvas();
    });
  });

  function renderImportPreviewCanvas() {
    if (!importedImage || !importPreviewCanvas) return;
    const ctx = importPreviewCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const scaledWidth = Math.round(importedImage.width * importedScale);
    const scaledHeight = Math.round(importedImage.height * importedScale);

    importPreviewCanvas.width = scaledWidth;
    importPreviewCanvas.height = scaledHeight;

    ctx.clearRect(0, 0, scaledWidth, scaledHeight);
    ctx.drawImage(importedImage, 0, 0, importedImage.width, importedImage.height, 0, 0, scaledWidth, scaledHeight);
  }

  function updateImportAnimView() {
    if (!importedImage || !importAnimCanvas) return;
    const frameSize = Math.max(8, parseInt(importFrameSizeSelect.value, 10) || 32);
    const totalFrames = Math.max(1, parseInt(importFrameCountSelect.value, 10) || 8);

    const ctx = importAnimCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    importAnimCanvas.width = frameSize;
    importAnimCanvas.height = frameSize;

    const cols = Math.floor(importedImage.width / frameSize) || 1;
    const sx = (importFrameIndex % cols) * frameSize;
    const sy = Math.floor(importFrameIndex / cols) * frameSize;

    ctx.clearRect(0, 0, frameSize, frameSize);
    if (sx + frameSize <= importedImage.width && sy + frameSize <= importedImage.height) {
      ctx.drawImage(importedImage, sx, sy, frameSize, frameSize, 0, 0, frameSize, frameSize);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, frameSize, frameSize);
    }

    if (importFrameStatus) importFrameStatus.textContent = `Frame ${importFrameIndex + 1} dari ${totalFrames}`;
  }

  if (importPlayBtn) {
    importPlayBtn.addEventListener("click", () => {
      if (importAnimPlaying) {
        importAnimPlaying = false;
        if (importAnimTimer) clearInterval(importAnimTimer);
        importPlayBtn.textContent = "▶ Play Preview";
        importPlayBtn.className = "btn btn-purple";
      } else {
        if (!importedImage) return;
        importAnimPlaying = true;
        importPlayBtn.textContent = "⏸ Pause Preview";
        importPlayBtn.className = "btn btn-secondary";
        const delay = parseInt(importDelayMsSelect.value, 10) || 150;
        const totalFrames = parseInt(importFrameCountSelect.value, 10) || 16;

        importAnimTimer = setInterval(() => {
          importFrameIndex = (importFrameIndex + 1) % totalFrames;
          updateImportAnimView();
        }, delay);
      }
    });
  }

  if (importConvertGifBtn) {
    importConvertGifBtn.addEventListener("click", () => {
      if (!importedImage) {
        alert("Silakan import file Spritesheet terlebih dahulu.");
        return;
      }

      const frameSize = Math.max(8, parseInt(importFrameSizeSelect.value, 10) || 32);
      const totalFrames = Math.max(1, parseInt(importFrameCountSelect.value, 10) || 8);
      const delayMs = Math.max(10, parseInt(importDelayMsSelect.value, 10) || 150);
      const exportScale = Math.max(1, parseInt(importExportScaleInput.value, 10) || 4);

      const outWidth = frameSize * exportScale;
      const outHeight = frameSize * exportScale;

      importConvertGifBtn.innerHTML = `<span>⏳</span> Converting GIF (${outWidth}x${outHeight}px)...`;

      setTimeout(() => {
        try {
          const encoder = new window.SimpleGIFEncoder(outWidth, outHeight, delayMs);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = outWidth;
          tempCanvas.height = outHeight;
          const ctx = tempCanvas.getContext("2d");
          ctx.imageSmoothingEnabled = false;

          const cols = Math.floor(importedImage.width / frameSize) || 1;

          for (let f = 0; f < totalFrames; f++) {
            ctx.clearRect(0, 0, outWidth, outHeight);
            const sx = (f % cols) * frameSize;
            const sy = Math.floor(f / cols) * frameSize;
            if (sx + frameSize <= importedImage.width && sy + frameSize <= importedImage.height) {
              ctx.drawImage(importedImage, sx, sy, frameSize, frameSize, 0, 0, outWidth, outHeight);
            }
            encoder.addFrame(ctx);
          }

          const gifBytes = encoder.build();
          const blob = new Blob([gifBytes], { type: "image/gif" });
          const link = document.createElement("a");
          const fname = importFilenameTag ? importFilenameTag.textContent.replace(/\.[^/.]+$/, "") : "custom_spritesheet";
          link.download = `imported_${fname}_${outWidth}x${outHeight}_animated.gif`;
          link.href = URL.createObjectURL(blob);
          link.click();

          importConvertGifBtn.innerHTML = `<span>✅</span> GIF Downloaded (${outWidth}x${outHeight})!`;
        } catch (err) {
          console.error("Gagal convert GIF import:", err);
          alert("Terjadi kesalahan saat memproses GIF.");
        } finally {
          setTimeout(() => {
            importConvertGifBtn.innerHTML = `<span>🎞️</span> Convert Animated GIF`;
          }, 2000);
        }
      }, 100);
    });
  }
  if (importConvertPngSeqBtn) {
    importConvertPngSeqBtn.addEventListener('click', () => {
      if (!importedImage) {
        alert('Silakan import file Spritesheet terlebih dahulu.');
        return;
      }

      const frameSize = Math.max(8, parseInt(importFrameSizeSelect.value, 10) || 32);
      const totalFrames = Math.max(1, parseInt(importFrameCountSelect.value, 10) || 8);
      const exportScale = Math.max(1, parseInt(importExportScaleInput.value, 10) || 4);

      const outWidth = frameSize * exportScale;
      const outHeight = frameSize * exportScale;

      importConvertPngSeqBtn.innerHTML = "<span>⏳</span> Extracting Frames...";

      const cols = Math.floor(importedImage.width / frameSize) || 1;
      const fname = importFilenameTag ? importFilenameTag.textContent.replace(/\.[^/.]+$/, "") : "custom_spritesheet";

      for (let f = 0; f < totalFrames; f++) {
        setTimeout(() => {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = outWidth;
          tempCanvas.height = outHeight;
          const ctx = tempCanvas.getContext("2d");
          ctx.imageSmoothingEnabled = false;

          const sx = (f % cols) * frameSize;
          const sy = Math.floor(f / cols) * frameSize;
          if (sx + frameSize <= importedImage.width && sy + frameSize <= importedImage.height) {
            ctx.drawImage(importedImage, sx, sy, frameSize, frameSize, 0, 0, outWidth, outHeight);
          }

          const link = document.createElement("a");
          link.download = `imported_${fname}_${outWidth}x${outHeight}_frame_${f + 1}.png`;
          link.href = tempCanvas.toDataURL("image/png");
          link.click();

          if (f === totalFrames - 1) {
            importConvertPngSeqBtn.innerHTML = "<span>✅</span> All Frames Saved!";
            setTimeout(() => {
              importConvertPngSeqBtn.innerHTML = "<span>🖼️</span> Convert PNG Sequence";
            }, 2000);
          }
        }, f * 150);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
