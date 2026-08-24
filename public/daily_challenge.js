/**
 * Growtopia Daily Challenge & Clash of Worlds Tracker
 * Real-time Growtopia Server Time Sync, Daily Quests, and Event Calendar
 */
(function(window) {
  'use strict';

  const CHALLENGE_POOL = [
    {
      title: "Block Breaker Extravaganza",
      category: "Break Blocks",
      icon: "🧱",
      targetItem: "Laser Grid",
      targetId: 5666,
      targetAmount: 500,
      rewardTokens: 2,
      bonusGems: 1500,
      xp: 2500,
      difficulty: "Medium",
      description: "Break 500 Laser Grid blocks to fuel the galactic grid!"
    },
    {
      title: "Botanical Splicer Quest",
      category: "Splice Trees",
      icon: "🌱",
      targetItem: "Portcullis",
      targetId: 382,
      targetAmount: 150,
      rewardTokens: 3,
      bonusGems: 2000,
      xp: 3500,
      difficulty: "Hard",
      description: "Splice 150 Portcullis trees by combining Iron & Dungeon Door seeds."
    },
    {
      title: "Master Surgeon Duty",
      category: "Hospital Surgery",
      icon: "🩺",
      targetItem: "Successful Surgeries",
      targetId: 1256,
      targetAmount: 5,
      rewardTokens: 4,
      bonusGems: 3000,
      xp: 5000,
      difficulty: "Master",
      description: "Successfully cure and save 5 hospital patients without failure."
    },
    {
      title: "Agricultural Harvest Rush",
      category: "Harvest Trees",
      icon: "🌾",
      targetItem: "Chandelier",
      targetId: 340,
      targetAmount: 200,
      rewardTokens: 2,
      bonusGems: 1800,
      xp: 2800,
      difficulty: "Medium",
      description: "Harvest 200 Chandelier crystal trees across your worlds."
    },
    {
      title: "Crime Fighter Patrol",
      category: "Crime Wave",
      icon: "🦹",
      targetItem: "Super Villains Defeated",
      targetId: 2476,
      targetAmount: 3,
      rewardTokens: 3,
      bonusGems: 2500,
      xp: 4000,
      difficulty: "Hard",
      description: "Defeat 3 Super Villains during the urban Crime Wave invasion."
    },
    {
      title: "Geological Extraction",
      category: "Mine Blocks",
      icon: "⛏️",
      targetItem: "Obsidian Blocks",
      targetId: 130,
      targetAmount: 400,
      rewardTokens: 2,
      bonusGems: 1200,
      xp: 2000,
      difficulty: "Easy",
      description: "Mine 400 Obsidian volcanic blocks from deep underground."
    },
    {
      title: "Cosmic Fishing Derby",
      category: "Fish Caught",
      icon: "🎣",
      targetItem: "Trophy Fish",
      targetId: 1512,
      targetAmount: 10,
      rewardTokens: 2,
      bonusGems: 1600,
      xp: 2200,
      difficulty: "Medium",
      description: "Catch 10 prize-winning trophy fish in freshwater ponds."
    }
  ];

  const CLASH_EVENTS = [
    {
      name: "Guild Clash: Season of Flames",
      status: "ACTIVE",
      type: "Guild PvP",
      endsInDays: 4,
      multiplier: "2.5× Guild XP",
      topReward: "Flaming Dragon Horns & 100,000 Gems"
    },
    {
      name: "Carnival of Wonder",
      status: "UPCOMING",
      type: "Festival",
      endsInDays: 9,
      multiplier: "Ringmaster Quest Boost",
      topReward: "Golden Ring of Smithing"
    },
    {
      name: "Comet Night Skyfall",
      status: "SCHEDULED",
      type: "World Event",
      endsInDays: 16,
      multiplier: "Stardust Drop Boost",
      topReward: "Star Power Wings"
    }
  ];

  class GTDailyChallenge {
    constructor() {
      this.timerInterval = null;
      this.savedProgress = {};
      this.loadProgress();
    }

    getGrowtopiaTime() {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const gtOffset = -4; // EDT
      return new Date(utcTime + (3600000 * gtOffset));
    }

    getTimeUntilReset() {
      const gtNow = this.getGrowtopiaTime();
      const gtMidnight = new Date(gtNow);
      gtMidnight.setHours(24, 0, 0, 0);
      const diffMs = gtMidnight.getTime() - gtNow.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      return {
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
        totalSec: Math.floor(diffMs / 1000)
      };
    }

    getTodaysChallenges() {
      const gtNow = this.getGrowtopiaTime();
      const dateKey = `${gtNow.getFullYear()}-${gtNow.getMonth() + 1}-${gtNow.getDate()}`;
      const seed = gtNow.getFullYear() * 1000 + (gtNow.getMonth() + 1) * 50 + gtNow.getDate();

      const challenges = [];
      for (let i = 0; i < 3; i++) {
        const idx = (seed + i * 2) % CHALLENGE_POOL.length;
        const base = CHALLENGE_POOL[idx];
        const progress = this.savedProgress[`${dateKey}_${idx}`] || 0;
        challenges.push({
          ...base,
          id: `${dateKey}_${idx}`,
          progress: progress,
          isCompleted: progress >= base.targetAmount
        });
      }
      return { dateKey, challenges };
    }

    loadProgress() {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('gt_dc_progress') : null;
        if (raw) this.savedProgress = JSON.parse(raw);
      } catch (_) {
        this.savedProgress = {};
      }
    }

    saveProgress(id, val) {
      this.savedProgress[id] = Number(val);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('gt_dc_progress', JSON.stringify(this.savedProgress));
        }
      } catch (_) {}
    }

    render(containerId) {
      if (typeof document === 'undefined') return;
      const container = document.getElementById(containerId);
      if (!container) return;

      const { dateKey, challenges } = this.getTodaysChallenges();
      const gtTime = this.getGrowtopiaTime();
      const timeStr = gtTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      container.innerHTML = `
        <div class="dc-dashboard">
          <!-- Top Header & Live Server Clock Banner -->
          <div class="dc-hero-banner">
            <div class="dc-hero-left">
              <div class="dc-badge-live"><span class="pulse-dot"></span> LIVE GT SERVER SYNC</div>
              <h2 class="dc-hero-title">🏆 Daily Challenge & Clash Tracker</h2>
              <p class="dc-hero-subtitle">Complete daily missions to earn Growtokens, Quest XP & Clash contributions.</p>
            </div>
            <div class="dc-hero-right">
              <div class="dc-clock-card">
                <div class="dc-clock-label">RESET COUNTDOWN (00:00 GT)</div>
                <div class="dc-countdown" id="dc-countdown-display">--:--:--</div>
                <div class="dc-server-time">GT Server Time: <span id="dc-server-time-display">${timeStr} EDT</span></div>
              </div>
            </div>
          </div>

          <!-- Main 3-Column Daily Quests -->
          <h3 class="dc-section-title">🎯 Today's Daily Challenges (${dateKey})</h3>
          <div class="dc-grid">
            ${challenges.map((c, i) => `
              <div class="dc-card ${c.isCompleted ? 'completed' : ''}" id="dc-card-${c.id}">
                <div class="dc-card-top">
                  <div class="dc-card-icon">${c.icon}</div>
                  <div class="dc-card-meta">
                    <span class="dc-difficulty ${c.difficulty.toLowerCase()}">${c.difficulty}</span>
                    <span class="dc-category">${c.category}</span>
                  </div>
                </div>
                <h4 class="dc-card-title">${c.title}</h4>
                <p class="dc-card-desc">${c.description}</p>

                <!-- Progress Bar & Slider -->
                <div class="dc-progress-wrap">
                  <div class="dc-progress-header">
                    <span>Target: <strong>${c.targetItem}</strong></span>
                    <span class="dc-progress-text" id="dc-text-${c.id}">${c.progress} / ${c.targetAmount}</span>
                  </div>
                  <div class="dc-progress-bar-bg">
                    <div class="dc-progress-bar-fill" id="dc-bar-${c.id}" style="width: ${Math.min(100, (c.progress / c.targetAmount) * 100)}%;"></div>
                  </div>
                  <div class="dc-input-row">
                    <button class="dc-step-btn" data-id="${c.id}" data-delta="-50" title="-50">−</button>
                    <input type="range" class="dc-slider" min="0" max="${c.targetAmount}" value="${c.progress}" data-id="${c.id}" id="dc-slider-${c.id}">
                    <button class="dc-step-btn" data-id="${c.id}" data-delta="50" title="+50">+</button>
                  </div>
                </div>

                <!-- Reward Badges -->
                <div class="dc-rewards">
                  <span class="dc-reward-pill token">🏅 +${c.rewardTokens} Growtokens</span>
                  <span class="dc-reward-pill gems">💎 +${c.bonusGems.toLocaleString()} Gems</span>
                  <span class="dc-reward-pill xp">⚡ +${c.xp.toLocaleString()} XP</span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Seasonal Clash of Worlds Events -->
          <h3 class="dc-section-title" style="margin-top:28px;">⚔️ Clash of Worlds & Seasonal Events</h3>
          <div class="clash-grid">
            ${CLASH_EVENTS.map(ev => `
              <div class="clash-card">
                <div class="clash-card-header">
                  <span class="clash-status-badge ${ev.status.toLowerCase()}">${ev.status}</span>
                  <span class="clash-ends">⏳ ${ev.endsInDays} Days Remaining</span>
                </div>
                <h4 class="clash-name">${ev.name}</h4>
                <div class="clash-detail-row">
                  <span class="clash-detail-label">Active Bonus:</span>
                  <span class="clash-detail-val highlight">${ev.multiplier}</span>
                </div>
                <div class="clash-detail-row">
                  <span class="clash-detail-label">Grand Prize:</span>
                  <span class="clash-detail-val">${ev.topReward}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      this.bindEvents(container);
      this.startCountdownTimer();
    }

    bindEvents(container) {
      container.querySelectorAll('.dc-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const id = e.target.getAttribute('data-id');
          const val = Number(e.target.value);
          this.updateProgress(id, val);
        });
      });

      container.querySelectorAll('.dc-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = btn.getAttribute('data-id');
          const delta = Number(btn.getAttribute('data-delta'));
          const slider = document.getElementById(`dc-slider-${id}`);
          if (slider) {
            const nextVal = Math.max(0, Math.min(Number(slider.max), Number(slider.value) + delta));
            slider.value = nextVal;
            this.updateProgress(id, nextVal);
          }
        });
      });
    }

    updateProgress(id, val) {
      this.saveProgress(id, val);
      if (typeof document === 'undefined') return;
      const text = document.getElementById(`dc-text-${id}`);
      const bar = document.getElementById(`dc-bar-${id}`);
      const slider = document.getElementById(`dc-slider-${id}`);
      const card = document.getElementById(`dc-card-${id}`);

      if (slider) {
        const max = Number(slider.max);
        const pct = Math.min(100, (val / max) * 100);
        if (text) text.textContent = `${val} / ${max}`;
        if (bar) bar.style.width = `${pct}%`;
        if (card) card.classList.toggle('completed', val >= max);
      }
    }

    startCountdownTimer() {
      if (typeof window === 'undefined') return;
      if (this.timerInterval) clearInterval(this.timerInterval);

      const updateClock = () => {
        const display = document.getElementById('dc-countdown-display');
        const timeDisplay = document.getElementById('dc-server-time-display');
        if (!display) return;

        const { hours, minutes, seconds } = this.getTimeUntilReset();
        display.textContent = `${hours}:${minutes}:${seconds}`;

        if (timeDisplay) {
          const gtTime = this.getGrowtopiaTime();
          timeDisplay.textContent = gtTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' EDT';
        }
      };

      updateClock();
      this.timerInterval = setInterval(updateClock, 1000);
    }
  }

  if (typeof window !== 'undefined') {
    window.GTDailyChallenge = new GTDailyChallenge();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTDailyChallenge, CHALLENGE_POOL, CLASH_EVENTS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
