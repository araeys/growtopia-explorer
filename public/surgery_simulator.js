/**
 * Growtopia Surgery Simulator & Smart Assistant Mini-Game
 * Authentic Hospital Operation Room, 11 Surgical Tools, Vitals Monitor & Anti-Fail Guide
 */
(function(window) {
  'use strict';

  const SURGERY_TOOLS = [
    { id: 'sponge', name: 'Sponge', icon: '🧽', key: '1', desc: 'Soak up bleeding and clean incision sites.' },
    { id: 'scalpel', name: 'Scalpel', icon: '🗡️', key: '2', desc: 'Make precise surgical incisions.' },
    { id: 'anesthetic', name: 'Anesthetic', icon: '💉', key: '3', desc: 'Put patient to sleep and maintain anesthesia.' },
    { id: 'antibiotic', name: 'Antibiotic', icon: '💊', key: '4', desc: 'Reduce high fever and kill surgical infections.' },
    { id: 'stitches', name: 'Stitches', icon: '🧵', key: '5', desc: 'Close open incisions after operation.' },
    { id: 'defibrillator', name: 'Defibrillator', icon: '⚡', key: '6', desc: 'Shock heart to restore pulse during cardiac arrest.' },
    { id: 'pins', name: 'Pins', icon: '📌', key: '7', desc: 'Align and fix fractured/broken bones.' },
    { id: 'transfusion', name: 'Transfusion', icon: '🩸', key: '8', desc: 'Restore dangerously low blood levels.' },
    { id: 'ultrasound', name: 'Ultrasound', icon: '📡', key: '9', desc: 'Scan and locate hidden internal objects/tumors.' },
    { id: 'clamp', name: 'Clamp', icon: '🗜️', key: '0', desc: 'Clamp hemorrhaging arteries to halt severe bleeding.' },
    { id: 'labkit', name: 'Lab Kit', icon: '🧪', key: 'L', desc: 'Analyze mysterious bacterial infections.' }
  ];

  const SURGERY_DIAGNOSES = [
    {
      name: 'Severe Appendicitis',
      icon: '🦠',
      requiredIncisions: 3,
      requiresFix: 'Organ Removed',
      feverRisk: 'High',
      desc: 'Patient suffering acute appendix inflammation. Needs 3 incisions, antibiotic, organ removal, and closure.'
    },
    {
      name: 'Compound Broken Femur',
      icon: '🦴',
      requiredIncisions: 2,
      brokenBones: 2,
      requiresFix: 'Bones Pinned',
      feverRisk: 'Medium',
      desc: 'Severe shattered bone fracture. Needs 2 incisions, pins to align bones, and wound closure.'
    },
    {
      name: 'Massive Heart Attack',
      icon: '🫀',
      requiredIncisions: 4,
      requiresFix: 'Bypass Complete',
      feverRisk: 'Low',
      pulseRisk: 'Critical',
      desc: 'Cardiovascular blockage. Maintain heart rate, make 4 incisions, fix bypass, and stitch wounds.'
    },
    {
      name: 'Alien Parasite Infection',
      icon: '👾',
      requiredIncisions: 3,
      requiresScan: true,
      requiresFix: 'Parasite Extracted',
      feverRisk: 'Critical',
      desc: 'Extraterrestrial pathogen inside abdomen. Use Ultrasound/Lab Kit, lower fever, extract parasite, and close.'
    },
    {
      name: 'Kidney Stone Obstruction',
      icon: '💎',
      requiredIncisions: 2,
      requiresFix: 'Stone Removed',
      feverRisk: 'Medium',
      desc: 'Large calcified obstruction. Incise, clamp hemorrhage, remove stone, and close.'
    }
  ];

  class GTSurgerySimulator {
    constructor() {
      this.active = false;
      this.patient = null;
      this.stats = { completed: 0, failed: 0, skillLevel: 1, xp: 0 };
      this.log = [];
      this.timer = null;
      this.loadStats();
    }

    loadStats() {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('gt_surge_stats') : null;
        if (raw) this.stats = JSON.parse(raw);
      } catch (_) {
        this.stats = { completed: 0, failed: 0, skillLevel: 1, xp: 0 };
      }
    }

    saveStats() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('gt_surge_stats', JSON.stringify(this.stats));
        }
      } catch (_) {}
    }

    startNewSurgery() {
      const diag = SURGERY_DIAGNOSES[Math.floor(Math.random() * SURGERY_DIAGNOSES.length)];
      this.active = true;
      this.patient = {
        name: ['Dr. Growtopian', 'Seth Patient', 'Hamumu Survivor', 'World Lock Fan', 'Cosmic Explorer'][Math.floor(Math.random() * 5)],
        diagnosis: diag,
        pulse: 75,
        temp: 98.6 + (diag.feverRisk === 'High' ? 3.5 : (diag.feverRisk === 'Critical' ? 6.0 : 0.5)),
        status: 'Awake', // Awake, Falling Asleep, Anesthetized, Waking Up
        anesthesiaDuration: 0,
        bleeding: 0, // 0 to 5
        incisions: 0,
        fixed: false,
        scanned: !diag.requiresScan,
        brokenBones: diag.brokenBones || 0,
        bonesFixed: 0,
        timeElapsed: 0
      };

      this.log = [`🏥 Patient ${this.patient.name} admitted on surgical table. Diagnosis: ${diag.name}`];
      this.playSfx('switch', 1.0, 0.4);
      this.updateAdvisor();
      this.render();
      this.startLoop();
    }

    startLoop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (!this.active || !this.patient) return;
        this.patient.timeElapsed += 1;

        // Anesthesia wear off
        if (this.patient.anesthesiaDuration > 0) {
          this.patient.anesthesiaDuration -= 1;
          if (this.patient.anesthesiaDuration <= 2) {
            this.patient.status = 'Waking Up';
          }
        } else if (this.patient.status === 'Anesthetized' || this.patient.status === 'Waking Up') {
          this.patient.status = 'Awake';
          this.addLog('⚠️ Patient woke up from anesthesia!');
          this.patient.pulse += 25;
        }

        // Bleeding increases heart rate and lowers survival
        if (this.patient.bleeding > 0) {
          this.patient.pulse += this.patient.bleeding * 1.5;
          if (Math.random() < 0.25) this.addLog('🩸 Patient is losing blood rapidly!');
        }

        // Fever progression
        if (this.patient.temp > 104) {
          this.patient.pulse += 4;
        }

        // Check Cardiac Arrest
        if (this.patient.pulse > 160) {
          this.patient.pulse = 0;
          this.patient.status = 'Cardiac Arrest';
          this.addLog('⚡ FLATLINE! Heart stopped! Use Defibrillator immediately!');
          this.playSfx('ouch', 0.8, 0.8);
        } else if (this.patient.pulse < 40 && this.patient.pulse > 0) {
          this.patient.pulse = 0;
          this.patient.status = 'Cardiac Arrest';
          this.addLog('⚡ Flatline! Severe bradycardia heart failure!');
          this.playSfx('ouch', 0.8, 0.8);
        }

        // Check Failure
        if (this.patient.pulse === 0 && this.patient.timeElapsed % 8 === 0 && this.patient.status === 'Cardiac Arrest') {
          this.failSurgery('Patient succumbed to cardiac arrest.');
          return;
        }

        this.updateAdvisor();
        this.renderVitalsOnly();
      }, 1000);
    }

    useTool(toolId) {
      if (!this.active || !this.patient) return;
      const p = this.patient;

      switch(toolId) {
        case 'anesthetic':
          if (p.status === 'Anesthetized' && p.anesthesiaDuration > 10) {
            p.pulse -= 15;
            this.addLog('💉 Too much anesthetic! Pulse dropped.');
          } else {
            p.status = 'Anesthetized';
            p.anesthesiaDuration = 18;
            p.pulse = Math.max(60, p.pulse - 10);
            this.addLog('💉 Anesthetic administered. Patient is peacefully asleep.');
            this.playSfx('squish', 1.0, 0.5);
          }
          break;

        case 'scalpel':
          if (p.status !== 'Anesthetized') {
            p.pulse += 35;
            p.bleeding = Math.min(5, p.bleeding + 2);
            this.addLog('⚠️ Scalpel used while patient was awake! Severe trauma!');
            this.playSfx('ouch', 1.0, 0.7);
          } else if (p.incisions >= p.diagnosis.requiredIncisions) {
            p.bleeding = Math.min(5, p.bleeding + 2);
            this.addLog('⚠️ Unnecessary incision made! Bleeding increased.');
          } else {
            p.incisions += 1;
            p.bleeding = Math.min(5, p.bleeding + 1);
            this.addLog(`🗡️ Incision ${p.incisions}/${p.diagnosis.requiredIncisions} created.`);
            this.playSfx('pop', 1.2, 0.5);

            if (p.incisions >= p.diagnosis.requiredIncisions && p.scanned) {
              p.fixed = true;
              this.addLog(`✅ Surgical site reached: ${p.diagnosis.requiresFix}!`);
            }
          }
          break;

        case 'sponge':
          if (p.bleeding > 0) {
            p.bleeding = Math.max(0, p.bleeding - 2);
            this.addLog('🧽 Sponge soaked up bleeding site.');
            this.playSfx('squish', 1.1, 0.5);
          } else {
            this.addLog('🧽 Surgical area is clean.');
          }
          break;

        case 'antibiotic':
          if (p.temp > 98.6) {
            p.temp = Math.max(98.6, p.temp - 2.8);
            this.addLog(`💊 Antibiotic reduced fever to ${p.temp.toFixed(1)}°F.`);
            this.playSfx('pop', 0.9, 0.5);
          } else {
            this.addLog('💊 Antibiotics administered preventative.');
          }
          break;

        case 'stitches':
          if (p.incisions > 0) {
            if (!p.fixed && p.incisions >= p.diagnosis.requiredIncisions) {
              this.addLog('⚠️ Warning: Internal operation not finished before stitching!');
            }
            p.incisions -= 1;
            p.bleeding = Math.max(0, p.bleeding - 1);
            this.addLog(`🧵 Stitched incision. ${p.incisions} remaining.`);
            this.playSfx('pop', 1.4, 0.5);

            // Check Victory
            if (p.incisions === 0 && p.fixed && (p.brokenBones === 0 || p.bonesFixed >= p.brokenBones)) {
              this.winSurgery();
              return;
            }
          } else {
            this.addLog('🧵 No open incisions to stitch.');
          }
          break;

        case 'defibrillator':
          if (p.pulse === 0 || p.status === 'Cardiac Arrest') {
            p.pulse = 72;
            p.status = 'Anesthetized';
            this.addLog('⚡ CLEAR! Defibrillator shock revived the heart! Pulse 72 BPM.');
            this.playSfx('spark', 1.2, 0.8);
          } else {
            p.pulse += 30;
            this.addLog('⚡ Defibrillator shocked an active heart! Arrhythmia triggered!');
            this.playSfx('spark', 0.8, 0.6);
          }
          break;

        case 'pins':
          if (p.brokenBones > 0 && p.bonesFixed < p.brokenBones) {
            if (p.incisions > 0) {
              p.bonesFixed += 1;
              this.addLog(`📌 Surgical pin placed! Bone fracture ${p.bonesFixed}/${p.brokenBones} fixed.`);
              this.playSfx('pop', 1.3, 0.6);
              if (p.bonesFixed >= p.brokenBones) p.fixed = true;
            } else {
              this.addLog('📌 Cannot pin bones through closed skin! Make incision first.');
            }
          } else {
            this.addLog('📌 No broken bones require pinning.');
          }
          break;

        case 'transfusion':
          p.pulse = Math.max(65, Math.min(95, p.pulse + 15));
          this.addLog('🩸 Blood transfusion administered. Patient vitals stabilized.');
          this.playSfx('squish', 0.9, 0.5);
          break;

        case 'ultrasound':
          p.scanned = true;
          this.addLog('📡 Ultrasound scan complete. Internal pathology pinpointed!');
          if (p.incisions >= p.diagnosis.requiredIncisions) p.fixed = true;
          this.playSfx('pop', 0.8, 0.6);
          break;

        case 'clamp':
          if (p.bleeding > 0) {
            p.bleeding = 0;
            this.addLog('🗜️ Surgical clamp attached! Bleeding completely halted.');
            this.playSfx('pop', 1.5, 0.5);
          } else {
            this.addLog('🗜️ No active hemorrhage to clamp.');
          }
          break;

        case 'labkit':
          p.temp = Math.max(98.6, p.temp - 4.0);
          this.addLog('🧪 Lab kit identified pathogen and created tailored antidote!');
          this.playSfx('pop', 1.1, 0.6);
          break;
      }

      this.updateAdvisor();
      this.render();
    }

    updateAdvisor() {
      const p = this.patient;
      if (!p) return;
      let advice = '✅ Patient stable. Proceed with operation.';
      let recTool = 'scalpel';

      if (p.status === 'Cardiac Arrest' || p.pulse === 0) {
        advice = '🚨 EMERGENCY! Flatline detected! Use DEFIBRILLATOR immediately!';
        recTool = 'defibrillator';
      } else if (p.status === 'Awake') {
        advice = '💉 Patient is awake! Administer ANESTHETIC before operating.';
        recTool = 'anesthetic';
      } else if (p.status === 'Waking Up') {
        advice = '💉 Anesthesia is wearing off! Administer ANESTHETIC to keep patient asleep.';
        recTool = 'anesthetic';
      } else if (p.bleeding >= 3) {
        advice = '🩸 Heavy bleeding! Use CLAMP or SPONGE to stop blood loss.';
        recTool = 'clamp';
      } else if (p.bleeding > 0) {
        advice = '🧽 Active bleeding. Use SPONGE to clean incision site.';
        recTool = 'sponge';
      } else if (p.temp > 102.5) {
        advice = '🌡️ High fever detected! Administer ANTIBIOTIC to lower infection.';
        recTool = 'antibiotic';
      } else if (p.diagnosis.requiresScan && !p.scanned) {
        advice = '📡 Internal anomaly unknown. Run ULTRASOUND scan.';
        recTool = 'ultrasound';
      } else if (p.incisions < p.diagnosis.requiredIncisions) {
        advice = `🗡️ Make incision (${p.incisions}/${p.diagnosis.requiredIncisions}) with SCALPEL.`;
        recTool = 'scalpel';
      } else if (p.brokenBones > 0 && p.bonesFixed < p.brokenBones) {
        advice = `📌 Align and fix broken bones (${p.bonesFixed}/${p.brokenBones}) with PINS.`;
        recTool = 'pins';
      } else if (p.incisions > 0) {
        advice = `🧵 Operation complete! Close all incisions (${p.incisions} remaining) with STITCHES.`;
        recTool = 'stitches';
      } else if (p.fixed && p.incisions === 0) {
        advice = '🎉 All incisions closed and pathology cured! Surgery complete!';
        recTool = 'stitches';
      }

      this.currentAdvice = { advice, recTool };
    }

    winSurgery() {
      this.active = false;
      if (this.timer) clearInterval(this.timer);
      this.stats.completed += 1;
      this.stats.xp += 1000;
      this.stats.skillLevel = Math.floor(this.stats.xp / 3000) + 1;
      this.saveStats();

      this.addLog(`🎉 SUCCESS! ${this.patient.name} was successfully cured and saved!`);
      this.playSfx('success', 1.0, 0.8);
      this.render();
    }

    failSurgery(reason) {
      this.active = false;
      if (this.timer) clearInterval(this.timer);
      this.stats.failed += 1;
      this.saveStats();

      this.addLog(`💀 SURGERY FAILED! ${reason}`);
      this.playSfx('ouch', 0.8, 0.8);
      this.render();
    }

    addLog(msg) {
      this.log.unshift(msg);
      if (this.log.length > 20) this.log.pop();
    }

    playSfx(name, rate = 1.0, vol = 0.5) {
      try {
        const audio = new Audio(`audio/${name}.wav`);
        audio.playbackRate = rate;
        audio.volume = vol;
        audio.play().catch(() => {});
      } catch (_) {}
    }

    render(containerId = 'surgery-container') {
      if (typeof document === 'undefined') return;
      const container = document.getElementById(containerId);
      if (!container) return;

      const p = this.patient;
      const adv = this.currentAdvice || { advice: 'Ready to operate.', recTool: 'anesthetic' };

      container.innerHTML = `
        <div class="surge-dashboard">
          <!-- Top Stats Bar -->
          <div class="surge-stats-bar">
            <div class="surge-stat-item">
              <span class="surge-stat-val text-cyan">Level ${this.stats.skillLevel}</span>
              <span class="surge-stat-lbl">Surgeon Rank</span>
            </div>
            <div class="surge-stat-item">
              <span class="surge-stat-val text-green">${this.stats.completed}</span>
              <span class="surge-stat-lbl">Surgeries Saved</span>
            </div>
            <div class="surge-stat-item">
              <span class="surge-stat-val text-red">${this.stats.failed}</span>
              <span class="surge-stat-lbl">Failed</span>
            </div>
            <div class="surge-stat-item">
              <span class="surge-stat-val text-yellow">⚡ ${this.stats.xp.toLocaleString()}</span>
              <span class="surge-stat-lbl">Surgeon XP</span>
            </div>
            <button class="btn-start-surge" id="btn-start-surge">
              ${this.active ? '🔄 Restart Surgery' : '🏥 Start New Surgery'}
            </button>
          </div>

          ${p ? `
            <div class="surge-workspace">
              <!-- Left: Hospital Vitals Monitor -->
              <div class="surge-monitor-card">
                <div class="surge-monitor-header">
                  <div class="surge-patient-title">
                    <span class="surge-patient-avatar">👤</span>
                    <div>
                      <h4 class="surge-patient-name">${p.name}</h4>
                      <div class="surge-diagnosis-badge">${p.diagnosis.icon} ${p.diagnosis.name}</div>
                    </div>
                  </div>
                  <div class="surge-timer-badge">⏱️ ${p.timeElapsed}s</div>
                </div>

                <div class="surge-vitals-grid">
                  <!-- Heart Rate / Pulse -->
                  <div class="surge-vital-box ${p.pulse === 0 ? 'critical' : (p.pulse > 110 ? 'warning' : 'normal')}">
                    <div class="vital-title">🫀 HEART RATE</div>
                    <div class="vital-value" id="vital-pulse">${p.pulse} <small>BPM</small></div>
                    <div class="ecg-line-wrap"><div class="ecg-pulse-anim ${p.pulse === 0 ? 'flatline' : ''}"></div></div>
                  </div>

                  <!-- Temperature -->
                  <div class="surge-vital-box ${p.temp > 103 ? 'critical' : (p.temp > 100 ? 'warning' : 'normal')}">
                    <div class="vital-title">🌡️ TEMPERATURE</div>
                    <div class="vital-value" id="vital-temp">${p.temp.toFixed(1)} <small>°F</small></div>
                    <div class="vital-sub">${p.temp > 100 ? 'High Fever' : 'Normal'}</div>
                  </div>

                  <!-- Consciousness / Anesthesia -->
                  <div class="surge-vital-box ${p.status === 'Awake' ? 'warning' : 'normal'}">
                    <div class="vital-title">💉 ANESTHESIA</div>
                    <div class="vital-value" id="vital-status">${p.status}</div>
                    <div class="vital-sub">Sleep timer: ${p.anesthesiaDuration}s</div>
                  </div>

                  <!-- Bleeding & Incisions -->
                  <div class="surge-vital-box ${p.bleeding > 2 ? 'critical' : (p.bleeding > 0 ? 'warning' : 'normal')}">
                    <div class="vital-title">🩸 BLEEDING & WOUNDS</div>
                    <div class="vital-value" id="vital-bleed">${p.bleeding > 0 ? 'Level ' + p.bleeding : 'None'}</div>
                    <div class="vital-sub">Open Incisions: ${p.incisions}</div>
                  </div>
                </div>

                <!-- Smart Surgery Assistant Advice Box -->
                <div class="surge-advisor-card">
                  <div class="advisor-title">🤖 SMART SURGERY ASSISTANT (ANTI-FAIL GUIDE)</div>
                  <div class="advisor-text">${adv.advice}</div>
                </div>

                <!-- Live Surgery Log -->
                <div class="surge-log-box">
                  <div class="surge-log-header">📋 Operation Log</div>
                  <div class="surge-log-list">
                    ${this.log.map(l => `<div class="surge-log-line">${l}</div>`).join('')}
                  </div>
                </div>
              </div>

              <!-- Right: Surgical Tools Tray -->
              <div class="surge-tools-panel">
                <h3 class="surge-tools-title">🧰 Surgical Instrument Tray</h3>
                <div class="surge-tools-grid">
                  ${SURGERY_TOOLS.map(t => `
                    <button class="surge-tool-btn ${adv.recTool === t.id ? 'recommended' : ''}" data-tool="${t.id}" title="${t.name}: ${t.desc}">
                      <div class="surge-tool-icon">${t.icon}</div>
                      <div class="surge-tool-name">${t.name}</div>
                      <div class="surge-tool-key">[${t.key}]</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : `
            <div class="surge-empty-state">
              <div class="empty-icon">🏥</div>
              <h3>Hospital Operating Theater Ready</h3>
              <p>Click "Start New Surgery" above to receive an incoming Growtopia medical emergency!</p>
            </div>
          `}
        </div>
      `;

      this.bindEvents(container);
    }

    renderVitalsOnly() {
      if (!this.patient) return;
      const p = this.patient;
      const pulseEl = document.getElementById('vital-pulse');
      const tempEl = document.getElementById('vital-temp');
      const statusEl = document.getElementById('vital-status');
      const bleedEl = document.getElementById('vital-bleed');

      if (pulseEl) pulseEl.innerHTML = `${p.pulse} <small>BPM</small>`;
      if (tempEl) tempEl.innerHTML = `${p.temp.toFixed(1)} <small>°F</small>`;
      if (statusEl) statusEl.textContent = p.status;
      if (bleedEl) bleedEl.textContent = p.bleeding > 0 ? 'Level ' + p.bleeding : 'None';
    }

    bindEvents(container) {
      const startBtn = container.querySelector('#btn-start-surge');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.startNewSurgery());
      }

      container.querySelectorAll('.surge-tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const toolId = btn.getAttribute('data-tool');
          this.useTool(toolId);
        });
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.GTSurgerySimulator = new GTSurgerySimulator();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTSurgerySimulator, SURGERY_TOOLS, SURGERY_DIAGNOSES };
  }
})(typeof window !== 'undefined' ? window : globalThis);
