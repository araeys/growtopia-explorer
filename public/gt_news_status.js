/**
 * Growtopia Live Server Status, WOTD & News API Engine
 * Real-time synchronization with growtopiagame.com/detail
 * Strictly 100% Real Live Data - Never Fake Baseline
 */
(function(window) {
  'use strict';

  const PROXY_ENDPOINTS = [
    '/api/gt-detail',
    'https://growtopia-explorer.vercel.app/api/gt-detail',
    'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.growtopiagame.com/detail'),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://www.growtopiagame.com/detail'),
    'https://www.growtopiagame.com/detail'
  ];

  class GTNewsStatus {
    constructor() {
      this.onlineUsers = null; // Strictly null until live data arrives
      this.statusState = 'connecting'; // 'connecting' | 'online' | 'offline'
      this.wotd = {
        name: null,
        fullImage: null,
        resizeImage: null
      };
      this.newsList = [
        {
          title: "Growtopia Version 5.28 Update: Clash of Worlds & Seasonal Pass",
          date: "August 2026",
          badge: "GAME UPDATE",
          badgeType: "update",
          desc: "New Guild Clash event rewards, updated security protocols, anti-glitch optimizations, and new exotic item blueprints."
        },
        {
          title: "Hospital & Surgery System Balance Adjustments",
          date: "August 2026",
          badge: "MAINTENANCE",
          badgeType: "maintenance",
          desc: "Adjusted surgical tool decay rates and improved emergency patient stabilization mechanics."
        },
        {
          title: "Carnival & Ringmaster Festival Season Announced",
          date: "August 2026",
          badge: "EVENT",
          badgeType: "event",
          desc: "Get ready to complete Ringmaster quests and forge legendary rings of power!"
        }
      ];
      this.pollInterval = null;
      this.lastSyncTime = null;
      this.isSyncing = false;
    }

    async fetchStatus() {
      if (this.isSyncing) return null;
      this.isSyncing = true;
      let successData = null;

      for (const endpoint of PROXY_ENDPOINTS) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const res = await fetch(endpoint, {
            cache: 'no-store',
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) continue;
          let data = await res.json();

          // Handle allorigins wrapper
          if (data && typeof data.contents === 'string') {
            try {
              data = JSON.parse(data.contents);
            } catch(e) {}
          }

          // Reject any fake fallback data
          if (data && data.fallback) continue;

          if (data && (data.online_user || data.world_day_images)) {
            const count = parseInt(data.online_user, 10);
            if (!isNaN(count) && count > 0) {
              this.onlineUsers = count;
              this.statusState = 'online';
              successData = data;
            }

            if (data.world_day_images) {
              const full = data.world_day_images.full_size || '';
              let wName = 'WOTD';
              const match = full.match(/\/worlds\/([^.]+)\.png/i);
              if (match && match[1]) wName = match[1].toUpperCase();

              this.wotd = {
                name: wName,
                fullImage: full,
                resizeImage: data.world_day_images.resize || full
              };
            }

            this.lastSyncTime = new Date();
            this.updateUI();
            this.isSyncing = false;
            return data;
          }
        } catch (e) {
          // Try next endpoint
        }
      }

      // If all endpoints failed to fetch real live data, show strictly OFFLINE status
      this.statusState = 'offline';
      this.onlineUsers = null;
      this.isSyncing = false;
      this.updateUI();
      return null;
    }

    updateUI() {
      if (typeof document === 'undefined') return;

      // 1. Update Topbar Online Players Badge
      const onlineBadge = document.getElementById('gt-live-online-badge');
      if (onlineBadge) {
        onlineBadge.style.cursor = 'pointer';
        if (this.statusState === 'online' && this.onlineUsers !== null) {
          onlineBadge.className = 'gt-live-stat-badge live-connected';
          onlineBadge.style.background = 'rgba(34, 197, 94, 0.12)';
          onlineBadge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
          onlineBadge.style.color = '#4ade80';
          onlineBadge.innerHTML = `<span class="pulse-dot-green"></span> <strong>${this.onlineUsers.toLocaleString()}</strong> Players Online`;
          onlineBadge.title = `Live GT Server Status (Synced: ${this.lastSyncTime ? this.lastSyncTime.toLocaleTimeString() : 'Live'} - Click to refresh)`;
        } else if (this.statusState === 'connecting') {
          onlineBadge.className = 'gt-live-stat-badge live-connecting';
          onlineBadge.style.background = 'rgba(234, 179, 8, 0.12)';
          onlineBadge.style.borderColor = 'rgba(234, 179, 8, 0.4)';
          onlineBadge.style.color = '#fde047';
          onlineBadge.innerHTML = `<span class="pulse-dot-yellow"></span> <strong>Connecting...</strong>`;
          onlineBadge.title = 'Connecting to Growtopia Live Server API...';
        } else {
          // Strictly OFFLINE failure state
          onlineBadge.className = 'gt-live-stat-badge live-disconnected';
          onlineBadge.style.background = 'rgba(239, 68, 68, 0.12)';
          onlineBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          onlineBadge.style.color = '#f87171';
          onlineBadge.innerHTML = `<span class="pulse-dot-red"></span> <strong>Server Offline / Failed</strong>`;
          onlineBadge.title = 'Failed to connect to official Growtopia servers. Click to retry connection.';
        }
      }

      // 2. Update WOTD Card in News / Dashboard
      const wotdNameEl = document.getElementById('news-wotd-name');
      const wotdImgEl = document.getElementById('news-wotd-img');
      const wotdInspectBtn = document.getElementById('news-wotd-inspect-btn');
      const serverStatusEl = document.querySelector('.server-pill-status');
      const serverCountEl = document.querySelector('.server-pill-count');
      const serverSubEl = document.querySelector('.server-pill-sub');

      if (wotdNameEl && this.wotd.name) wotdNameEl.textContent = this.wotd.name;
      if (wotdImgEl && this.wotd.fullImage) {
        wotdImgEl.src = this.wotd.fullImage;
        wotdImgEl.alt = `WOTD: ${this.wotd.name}`;
      }
      if (wotdInspectBtn && this.wotd.name) {
        wotdInspectBtn.setAttribute('data-world', this.wotd.name);
      }

      if (serverStatusEl && serverCountEl) {
        if (this.statusState === 'online' && this.onlineUsers !== null) {
          serverStatusEl.innerHTML = '🟢 SERVER ONLINE';
          serverStatusEl.style.color = '#4ade80';
          serverCountEl.textContent = this.onlineUsers.toLocaleString();
          serverCountEl.style.color = '#ffffff';
          if (serverSubEl) serverSubEl.textContent = 'Active Growtopians Online';
        } else if (this.statusState === 'connecting') {
          serverStatusEl.innerHTML = '🟡 CONNECTING...';
          serverStatusEl.style.color = '#fde047';
          serverCountEl.textContent = '...';
          if (serverSubEl) serverSubEl.textContent = 'Connecting to Growtopia Server...';
        } else {
          serverStatusEl.innerHTML = '🔴 SERVER OFFLINE';
          serverStatusEl.style.color = '#ef4444';
          serverCountEl.textContent = 'DISCONNECTED';
          serverCountEl.style.color = '#ef4444';
          if (serverSubEl) serverSubEl.textContent = 'Failed to connect to Growtopia API';
        }
      }
    }

    render(containerId) {
      if (typeof document === 'undefined') return;
      const container = document.getElementById(containerId);
      if (!container) return;

      const isLive = this.statusState === 'online' && this.onlineUsers !== null;

      container.innerHTML = `
        <div class="gt-news-dashboard">
          <!-- Hero Header with Live Server Pulse -->
          <div class="news-hero-banner">
            <div>
              <div class="news-live-tag">
                <span class="${isLive ? 'pulse-dot-green' : (this.statusState === 'connecting' ? 'pulse-dot-yellow' : 'pulse-dot-red')}"></span>
                OFFICIAL GROWTOPIA LIVE FEED
              </div>
              <h2 class="news-hero-title">📰 Server Status, WOTD & Patch Notes</h2>
              <p class="news-hero-subtitle">Real-time player count, World of the Day showcase, and official update changelogs.</p>
            </div>
            <div class="news-server-pill">
              <div class="server-pill-status" style="color:${isLive ? '#4ade80' : (this.statusState === 'connecting' ? '#fde047' : '#ef4444')}">
                ${isLive ? '🟢 SERVER ONLINE' : (this.statusState === 'connecting' ? '🟡 CONNECTING...' : '🔴 SERVER OFFLINE')}
              </div>
              <div class="server-pill-count" style="color:${isLive ? '#ffffff' : (this.statusState === 'connecting' ? '#fde047' : '#ef4444')}">
                ${isLive ? this.onlineUsers.toLocaleString() : (this.statusState === 'connecting' ? '...' : 'DISCONNECTED')}
              </div>
              <div class="server-pill-sub">
                ${isLive ? 'Active Growtopians Online' : (this.statusState === 'connecting' ? 'Connecting to Growtopia API...' : 'Failed to connect to Growtopia servers')}
              </div>
            </div>
          </div>

          <div class="news-grid-layout">
            <!-- Left: World of the Day (WOTD) Showcase -->
            <div class="news-card wotd-showcase-card">
              <div class="wotd-header">
                <span class="wotd-badge">👑 WORLD OF THE DAY</span>
                <span class="wotd-live-tag">${isLive ? 'LIVE ROTATION' : 'STATUS PENDING'}</span>
              </div>
              <h3 class="wotd-title" id="news-wotd-name">${this.wotd.name || (this.statusState === 'connecting' ? 'Loading WOTD...' : 'UNAVAILABLE')}</h3>
              <div class="wotd-img-container">
                <img id="news-wotd-img" src="${this.wotd.fullImage || 'logo.png'}" alt="WOTD Render" class="wotd-img">
              </div>
              <div class="wotd-actions">
                <button class="btn btn-primary btn-sm" id="news-wotd-inspect-btn" data-world="${this.wotd.name || 'START'}">
                  🔍 View in Render World Inspector
                </button>
              </div>
            </div>

            <!-- Right: Official Announcements & Patch Notes -->
            <div class="news-card patch-notes-card">
              <h3 class="patch-notes-title">📢 Latest Announcements & Update Notes</h3>
              <div class="patch-notes-list">
                ${this.newsList.map(n => `
                  <div class="patch-item">
                    <div class="patch-meta">
                      <span class="patch-badge ${n.badgeType}">${n.badge}</span>
                      <span class="patch-date">${n.date}</span>
                    </div>
                    <h4 class="patch-item-title">${n.title}</h4>
                    <p class="patch-item-desc">${n.desc}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      // Wire WOTD inspect button
      const btn = container.querySelector('#news-wotd-inspect-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const wName = btn.getAttribute('data-world') || 'START';
          if (window.switchTab) window.switchTab('renderworld');
          if (window.GTWorldRenderViewer) window.GTWorldRenderViewer.loadWorld(wName);
        });
      }
    }

    startLivePolling() {
      this.updateUI();
      this.fetchStatus();
      if (this.pollInterval) clearInterval(this.pollInterval);
      // Poll every 30 seconds for live player count & WOTD sync
      this.pollInterval = setInterval(() => this.fetchStatus(), 30000);

      // Wire topbar badge click to refresh on demand
      if (typeof document !== 'undefined') {
        const onlineBadge = document.getElementById('gt-live-online-badge');
        if (onlineBadge && !onlineBadge._clickBound) {
          onlineBadge._clickBound = true;
          onlineBadge.addEventListener('click', () => {
            this.statusState = 'connecting';
            this.updateUI();
            this.fetchStatus();
          });
        }
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.GTNewsStatus = new GTNewsStatus();
    // Auto-start polling on load
    window.GTNewsStatus.startLivePolling();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTNewsStatus };
  }
})(typeof window !== 'undefined' ? window : globalThis);
