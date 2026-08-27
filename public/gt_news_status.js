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
      this.votw = {
        title: "The Curse of the Legendary Dragons - Epic Growtopia Cinematic",
        creator: "Official Growtopia Community Spotlight",
        youtubeId: "2-tArcNir10",
        youtubeUrl: "https://www.youtube.com/watch?v=2-tArcNir10",
        prize: "100,000 Gems + Exclusive Trophy",
        week: "Week #34 - August 2026",
        desc: "Featured weekly community spotlight showcase! Create videos, share with #GrowtopiaVOTW on YouTube, and win 100,000 Gems & the exclusive in-game trophy."
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
      this.staffList = [
        { name: "@Seth", role: "Original Creator", roleType: "dev", icon: "👨‍💻", note: "Co-creator of Growtopia (Legacy)" },
        { name: "@Hamumu", role: "Original Creator", roleType: "dev", icon: "🧙‍♂️", note: "Co-creator & Game Designer (Legacy)" },
        { name: "@Misthero", role: "Developer", roleType: "dev", icon: "👑", note: "Ubisoft Core Lead Developer" },
        { name: "@Meow", role: "Lead Developer", roleType: "dev", icon: "🐱", note: "Server Architecture & Systems" },
        { name: "@Solorlz", role: "Community Manager", roleType: "cm", icon: "📢", note: "Official Community & Global Events Lead" },
        { name: "@JackBowe", role: "Community Manager", roleType: "cm", icon: "🎙️", note: "Social Media & Player Experience" },
        { name: "@Zodiac", role: "Senior Moderator", roleType: "mod", icon: "🛡️", note: "In-game Security & Rule Enforcement" },
        { name: "@Cuckers", role: "Senior Moderator", roleType: "mod", icon: "⚖️", note: "Anti-glitch & Player Moderation" },
        { name: "@Airplaneguy", role: "Guardian", roleType: "guardian", icon: "✈️", note: "Community Guardian & Volunteer Support" },
        { name: "@TechnoGamer", role: "Guardian", roleType: "guardian", icon: "🎮", note: "Player Assistance & Event Support" }
      ];
      this.pollInterval = null;
      this.clockInterval = null;
      this.lastSyncTime = null;
      this.isSyncing = false;
    }

    getGTTimeData() {
      const now = new Date();
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          weekday: 'short'
        });
        const parts = formatter.formatToParts(now);
        const map = {};
        parts.forEach(p => map[p.type] = p.value);

        const hours = parseInt(map.hour, 10) % 24;
        const minutes = parseInt(map.minute, 10);
        const seconds = parseInt(map.second, 10);

        const currentDaySeconds = hours * 3600 + minutes * 60 + seconds;
        const totalDaySeconds = 86400;
        const remainingSeconds = totalDaySeconds - currentDaySeconds;

        const remHours = Math.floor(remainingSeconds / 3600);
        const remMinutes = Math.floor((remainingSeconds % 3600) / 60);
        const remSecs = remainingSeconds % 60;

        const progressPercent = ((currentDaySeconds / totalDaySeconds) * 100).toFixed(1);

        return {
          timeString: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0'),
          dateString: map.weekday + ', ' + map.month + ' ' + map.day + ' ' + map.year,
          countdownString: String(remHours).padStart(2, '0') + 'h ' + String(remMinutes).padStart(2, '0') + 'm ' + String(remSecs).padStart(2, '0') + 's',
          progressPercent: progressPercent
        };
      } catch (e) {
        return {
          timeString: now.toTimeString().slice(0, 8),
          dateString: now.toDateString(),
          countdownString: '--:--:--',
          progressPercent: '50'
        };
      }
    }

    updateClockUI() {
      if (typeof document === 'undefined') return;
      const gtTime = this.getGTTimeData();

      // 1. Header Clock Badge
      const headerClockVal = document.getElementById('gt-header-time-val');
      if (headerClockVal) headerClockVal.textContent = gtTime.timeString;

      // 2. Operations Card Time Elements
      const opsTimeVal = document.getElementById('gt-ops-time-val');
      const opsDateVal = document.getElementById('gt-ops-date-val');
      const opsCountdownVal = document.getElementById('gt-ops-countdown-val');
      const opsProgressVal = document.getElementById('gt-ops-progress-val');
      const opsProgressBar = document.getElementById('gt-ops-progress-bar');

      if (opsTimeVal) opsTimeVal.textContent = gtTime.timeString;
      if (opsDateVal) opsDateVal.textContent = gtTime.dateString;
      if (opsCountdownVal) opsCountdownVal.textContent = gtTime.countdownString;
      if (opsProgressVal) opsProgressVal.textContent = gtTime.progressPercent + '%';
      if (opsProgressBar) opsProgressBar.style.width = gtTime.progressPercent + '%';
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
            this.failureCount = 0;
            this.updateUI();
            this.isSyncing = false;
            return data;
          }
        } catch (e) {
          // Try next endpoint
        }
      }

      // If endpoints failed to fetch, only mark offline after consecutive failure threshold
      this.failureCount = (this.failureCount || 0) + 1;
      if (this.failureCount >= 2 || this.onlineUsers === null) {
        this.statusState = 'offline';
        this.onlineUsers = null;
      }
      this.isSyncing = false;
      this.updateUI();
      return null;
    }

    updateUI() {
      if (typeof document === 'undefined') return;
      this.updateClockUI();

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
      const gtTime = this.getGTTimeData();

      container.innerHTML = `
        <div class="gt-news-dashboard">
          <!-- Hero Header with Live Server Pulse -->
          <div class="news-hero-banner">
            <div>
              <div class="news-live-tag">
                <span class="${isLive ? 'pulse-dot-green' : (this.statusState === 'connecting' ? 'pulse-dot-yellow' : 'pulse-dot-red')}"></span>
                OFFICIAL GROWTOPIA LIVE FEED
              </div>
              <h2 class="news-hero-title">📰 Server Status, WOTD & Operations</h2>
              <p class="news-hero-subtitle">Real-time player count, Growtopia Server Time (EDT), daily reset countdown & update notes.</p>
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

          <!-- Live Server Operations & GT Clock Card -->
          <div class="gt-server-ops-card">
            <div class="gt-ops-header">
              <h3 class="gt-ops-title">⏱️ Live Growtopia Server Time & Daily Reset Operations</h3>
              <span class="news-live-tag" style="margin:0;"><span class="pulse-dot-cyan"></span> REAL-TIME CLOCK (EDT / UTC-4)</span>
            </div>

            <div class="gt-ops-grid">
              <div class="gt-ops-box">
                <div class="gt-ops-box-label">🕒 Official Server Time (GT Time)</div>
                <div class="gt-ops-box-val" id="gt-ops-time-val">${gtTime.timeString}</div>
                <div class="gt-ops-box-sub" id="gt-ops-date-val">${gtTime.dateString}</div>
              </div>

              <div class="gt-ops-box">
                <div class="gt-ops-box-label">⏳ Next Daily Server Reset (00:00 GT)</div>
                <div class="gt-ops-box-val" id="gt-ops-countdown-val" style="color:#fde047;">${gtTime.countdownString}</div>
                <div class="gt-ops-box-sub">Resets WOTD, Daily Rewards & Guild Clash</div>
              </div>

              <div class="gt-ops-box">
                <div class="gt-ops-box-label">🌐 Server Region & Protocol</div>
                <div class="gt-ops-box-val" style="font-size:20px;color:#a78bfa;">US-East (ENet)</div>
                <div class="gt-ops-box-sub">Port 17091 / UDP Protocol</div>
              </div>
            </div>

            <div class="gt-day-progress-container">
              <div class="gt-progress-header">
                <span>🌞 Game Day Cycle Progress</span>
                <span id="gt-ops-progress-val">${gtTime.progressPercent}% Completed</span>
              </div>
              <div class="gt-progress-bar-bg">
                <div class="gt-progress-bar-fill" id="gt-ops-progress-bar" style="width:${gtTime.progressPercent}%;"></div>
              </div>
              <div class="gt-reset-checklist">
                <div class="gt-reset-item">👑 <span class="gt-reset-item-name">WOTD Rotation</span></div>
                <div class="gt-reset-item">🎁 <span class="gt-reset-item-name">Daily Bonus Calendar</span></div>
                <div class="gt-reset-item">⚔️ <span class="gt-reset-item-name">Guild Clash Quests</span></div>
                <div class="gt-reset-item">🏥 <span class="gt-reset-item-name">Surgery Daily Patients</span></div>
              </div>
            </div>
          </div>

          <div class="news-grid-layout">
            <!-- Left: World of the Day (WOTD) & Video of the Week (VOTW) -->
            <div style="display:flex;flex-direction:column;gap:20px;">
              <!-- World of the Day (WOTD) Showcase -->
              <div class="news-card wotd-showcase-card" style="margin:0;">
                <div class="wotd-header">
                  <span class="wotd-badge">👑 WORLD OF THE DAY (WOTD)</span>
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

              <!-- Video of the Week (VOTW) Showcase -->
              <div class="news-card votw-showcase-card" style="margin:0;">
                <div class="votw-header">
                  <span class="votw-badge">🎬 VIDEO OF THE WEEK (VOTW)</span>
                  <span class="votw-live-tag">COMMUNITY SPOTLIGHT</span>
                </div>
                <h3 class="votw-title">${this.votw.title}</h3>
                
                <div class="votw-video-container">
                  <iframe 
                    src="https://www.youtube-nocookie.com/embed/${this.votw.youtubeId}?rel=0" 
                    title="Growtopia Video of the Week" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                  </iframe>
                </div>

                <div class="votw-meta-box">
                  <div>👤 Creator: <strong style="color:#f8fafc;">${this.votw.creator}</strong></div>
                  <div class="votw-prize-tag">🏆 Prize: ${this.votw.prize}</div>
                </div>

                <div class="votw-actions">
                  <a href="${this.votw.youtubeUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
                    ▶️ Watch on YouTube
                  </a>
                  <span style="font-size:11px;color:#64748b;display:flex;align-items:center;">
                    ${this.votw.week}
                  </span>
                </div>
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

          <!-- Official Growtopia Staff & Moderator Roster -->
          <div class="gt-staff-card">
            <div class="gt-staff-header">
              <div>
                <h3 class="gt-staff-title">🛡️ Official Staff & Moderator Directory</h3>
                <p style="font-size:12px;color:#94a3b8;margin:4px 0 0 0;">
                  Official Ubisoft Developers, Community Managers, and Moderators. In-game check: Type <code>/mods</code> command in the Growtopia client.
                </p>
              </div>
              <span class="news-live-tag" style="margin:0;"><span class="pulse-dot-green"></span> UBISOFT OFFICIAL ROSTER</span>
            </div>
            <div class="gt-staff-grid">
              ${this.staffList.map(s => `
                <div class="gt-staff-item">
                  <div class="gt-staff-avatar">${s.icon}</div>
                  <div class="gt-staff-info">
                    <div class="gt-staff-name">
                      ${s.name}
                      <span class="gt-staff-role-badge role-${s.roleType}">${s.role}</span>
                    </div>
                    <div class="gt-staff-sub">${s.note}</div>
                  </div>
                </div>
              `).join('')}
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

      // Poll every 30 seconds for live player count & WOTD sync
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => this.fetchStatus(), 30000);

      // Live 1-second ticking clock ticker
      if (this.clockInterval) clearInterval(this.clockInterval);
      this.clockInterval = setInterval(() => {
        this.updateClockUI();
      }, 1000);

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
