/**
 * Growtopia Live World Render Viewer & GT World Planner Importer
 * Fetches high-res official renders from https://s3.amazonaws.com/world.growtopiagame.com/{world}.png
 */
(function(window) {
  'use strict';

  const POPULAR_WORLDS = ['START', 'BUYGHC', 'SET', 'TRADE', 'GROWTOPIA', 'PARKOUR', 'HOSPITAL', 'SURGERY'];

  class GTWorldRenderViewer {
    constructor() {
      this.currentWorld = 'START';
      this.imageUrl = '';
      this.zoom = 1.0;
      this.loading = false;
      this.error = null;
      this.renderDate = null;
      this.imageSize = { width: 0, height: 0, bytes: 0 };
    }

    async loadWorld(worldName) {
      const cleanName = (worldName || '').trim().toLowerCase();
      if (!cleanName) return;

      this.currentWorld = cleanName.toUpperCase();
      this.imageUrl = `https://s3.amazonaws.com/world.growtopiagame.com/${cleanName}.png`;
      this.loading = true;
      this.error = null;
      this.zoom = 1.0;

      this.render();

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this.loading = false;
        this.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
        this.renderDate = new Date();
        this.render();
      };

      img.onerror = () => {
        this.loading = false;
        this.error = `World "${this.currentWorld}" has no render snapshot yet! Try entering the world in-game and typing "/renderworld".`;
        this.render();
      };

      img.src = this.imageUrl;
    }

    render(containerId = 'renderworld-container') {
      if (typeof document === 'undefined') return;
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = `
        <div class="renderworld-dashboard">
          <!-- Top Search and Suggestions Header -->
          <div class="renderworld-search-box">
            <div class="renderworld-title-row">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:26px;">🌍</span>
                <div>
                  <h2 class="renderworld-title">Live World Render Viewer (/renderworld)</h2>
                  <p class="renderworld-sub">Official high-resolution render snapshots directly from Amazon S3 / Growtopia CDN.</p>
                </div>
              </div>
            </div>

            <div class="renderworld-input-group">
              <span class="renderworld-input-icon">🔍</span>
              <input type="text" id="renderworld-search-input" class="renderworld-search-input" placeholder="Type world name (e.g. START, BUYGHC, SET, YOURWORLD)..." value="${this.currentWorld}">
              <button id="renderworld-search-btn" class="btn btn-primary">Load Render</button>
            </div>

            <!-- Popular Quick Pills -->
            <div class="renderworld-pills">
              <span class="pills-label">Quick Worlds:</span>
              ${POPULAR_WORLDS.map(w => `
                <button class="renderworld-pill ${w === this.currentWorld ? 'active' : ''}" data-world="${w}">${w}</button>
              `).join('')}
            </div>
          </div>

          <!-- Main Interactive Render Stage -->
          <div class="renderworld-stage-card">
            <div class="renderworld-stage-header">
              <div class="stage-info">
                <span class="stage-world-name">🌍 WORLD: <strong style="color:#00e5ff;">${this.currentWorld}</strong></span>
                ${this.imageSize.width > 0 ? `
                  <span class="stage-meta-tag">📐 ${this.imageSize.width} × ${this.imageSize.height} px</span>
                  <span class="stage-meta-tag">⚡ Live S3 CDN</span>
                ` : ''}
              </div>

              <!-- Zoom & Action Controls -->
              <div class="stage-controls">
                <button id="rw-zoom-out-btn" class="stage-btn" title="Zoom Out (−)">−</button>
                <span class="rw-zoom-label" id="rw-zoom-label">${Math.round(this.zoom * 100)}%</span>
                <button id="rw-zoom-in-btn" class="stage-btn" title="Zoom In (+)">+</button>
                <button id="rw-zoom-reset-btn" class="stage-btn" title="Reset Zoom">↺</button>
                <a id="rw-download-btn" href="${this.imageUrl}" download="${this.currentWorld}_render.png" target="_blank" class="btn btn-sm btn-purple" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                  💾 Download PNG
                </a>
                <button id="rw-import-planner-btn" class="btn btn-sm btn-green" style="display:inline-flex;align-items:center;gap:4px;">
                  📥 Import to World Planner
                </button>
              </div>
            </div>

            <!-- Canvas / Image Viewer Viewport -->
            <div class="renderworld-viewport" id="rw-viewport">
              ${this.loading ? `
                <div class="renderworld-loading-spinner">
                  <div class="spinner-ring"></div>
                  <p>Fetching official render for <strong>${this.currentWorld}</strong> from Amazon S3 CDN...</p>
                </div>
              ` : (this.error ? `
                <div class="renderworld-error-state">
                  <div style="font-size:42px;margin-bottom:8px;">⚠️</div>
                  <h4 style="color:#f87171;margin:0 0 6px 0;">No Snapshot Found</h4>
                  <p style="color:#94a3b8;font-size:13px;max-width:500px;margin:0 auto 14px auto;">${this.error}</p>
                  <div style="font-size:11px;color:#64748b;">Tip: Anyone can render any world in Growtopia by going to that world and typing <code>/renderworld</code>!</div>
                </div>
              ` : `
                <div class="renderworld-image-wrap" id="rw-image-wrap" style="transform: scale(${this.zoom}); transform-origin: center center;">
                  <img id="rw-main-img" src="${this.imageUrl}" alt="${this.currentWorld} Render" class="rw-main-img" style="image-rendering:pixelated;">
                </div>
              `)}
            </div>
          </div>
        </div>
      `;

      this.bindEvents(container);
    }

    bindEvents(container) {
      const input = container.querySelector('#renderworld-search-input');
      const searchBtn = container.querySelector('#renderworld-search-btn');

      const triggerSearch = () => {
        if (input && input.value.trim()) {
          this.loadWorld(input.value.trim());
        }
      };

      if (searchBtn) searchBtn.addEventListener('click', triggerSearch);
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') triggerSearch();
        });
      }

      container.querySelectorAll('.renderworld-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const w = pill.getAttribute('data-world');
          this.loadWorld(w);
        });
      });

      const zoomInBtn = container.querySelector('#rw-zoom-in-btn');
      const zoomOutBtn = container.querySelector('#rw-zoom-out-btn');
      const zoomResetBtn = container.querySelector('#rw-zoom-reset-btn');
      const imgWrap = container.querySelector('#rw-image-wrap');
      const zoomLabel = container.querySelector('#rw-zoom-label');

      const updateZoomUI = () => {
        if (imgWrap) imgWrap.style.transform = `scale(${this.zoom})`;
        if (zoomLabel) zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
      };

      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
          this.zoom = Math.min(4.0, this.zoom + 0.25);
          updateZoomUI();
        });
      }

      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
          this.zoom = Math.max(0.25, this.zoom - 0.25);
          updateZoomUI();
        });
      }

      if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
          this.zoom = 1.0;
          updateZoomUI();
        });
      }

      // Import to World Planner Button handler
      const importBtn = container.querySelector('#rw-import-planner-btn');
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          this.importToWorldPlanner();
        });
      }
    }

    importToWorldPlanner() {
      // 1. If inside index.html, switch to World Planner Tab or open world.html
      const worldName = this.currentWorld;
      const renderUrl = this.imageUrl;

      // Save render reference in localStorage so World Planner can automatically load it
      try {
        localStorage.setItem('gt_planner_import_render', JSON.stringify({
          worldName: worldName,
          imageUrl: renderUrl,
          timestamp: Date.now()
        }));
      } catch (_) {}

      // Switch to world tab or redirect to world.html
      if (window.switchTab) {
        window.switchTab('world');
        const statusMsg = `📥 Loaded "${worldName}" render into World Planner reference engine!`;
        if (window.GTWorldPlanner && window.GTWorldPlanner.onStatusMessage) {
          window.GTWorldPlanner.onStatusMessage(statusMsg);
        }
      } else {
        window.open(`world.html?import_world=${encodeURIComponent(worldName)}`, '_blank');
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.GTWorldRenderViewer = new GTWorldRenderViewer();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTWorldRenderViewer, POPULAR_WORLDS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
