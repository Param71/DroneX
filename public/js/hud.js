export class HUD {
    constructor(drone) {
        this.drone = drone;
        this.container = document.getElementById('hud');
        
        this.pilotName = localStorage.getItem('pilotName') || 'PILOT-01';
        
        this.initHTML();
        this.cacheDOM();
        this.initFlicker();
        this.initEvents();
    }

    initHTML() {
        this.container.innerHTML = `
            <!-- Signal and Pilot -->
            <div id="hud-signal-container" class="hud-element">
                <div id="hud-signal">SIGNAL STRONG</div>
                <div id="hud-pilot">${this.pilotName}</div>
            </div>

            <!-- Minimap -->
            <div id="hud-minimap" class="hud-element" style="display: none;">
                <div class="minimap-bg"></div>
                <div id="minimap-drone"></div>
                <div id="minimap-ring"></div>
            </div>

            <!-- Battery -->
            <div id="hud-battery-container" class="hud-element">
                <div class="battery-outline">
                    <div id="hud-battery-fill" class="battery-fill"></div>
                </div>
                <div id="hud-battery-text">BATTERY 100%</div>
            </div>

            <!-- Compass -->
            <div id="hud-compass" class="hud-element">
                <div id="hud-compass-arrow" class="compass-tick"></div>
                <div id="hud-heading-text">HDG 000</div>
            </div>

            <!-- Speed -->
            <div id="hud-speed" class="hud-element">
                <span id="speed-val">0</span><span class="unit"> km/h</span>
            </div>

            <!-- Altitude -->
            <div id="hud-altitude" class="hud-element">
                <span id="alt-val">0.0</span><span class="unit"> m</span>
            </div>

            <!-- Mission Status -->
            <div id="hud-mission" class="hud-element">
                MISSION STATUS
            </div>
            
            <!-- Mission Timer -->
            <div id="hud-timer" class="hud-element" style="display: none; top: 150px; left: 50%; transform: translateX(-50%); font-size: 2rem; color: var(--neon-cyan); border: none; background: none; text-shadow: 0 0 10px var(--neon-cyan);">
                00:00.00
            </div>

            <!-- Alert Text -->
            <div id="hud-alert" class="hud-element">
                WARNING
            </div>

            <!-- FPV Button -->
            <button id="btn-fpv-laptop">FPV: OFF</button>
        `;
    }

    cacheDOM() {
        this.elSpeed = document.getElementById('speed-val');
        this.elAlt = document.getElementById('alt-val');
        
        this.elBatFill = document.getElementById('hud-battery-fill');
        this.elBatText = document.getElementById('hud-battery-text');
        
        this.elSignal = document.getElementById('hud-signal');
        
        this.elCompassArrow = document.getElementById('hud-compass-arrow');
        this.elHeadingText = document.getElementById('hud-heading-text');

        this.elMission = document.getElementById('hud-mission');
        this.elTimer = document.getElementById('hud-timer');
        this.elAlert = document.getElementById('hud-alert');
        this.btnFpv = document.getElementById('btn-fpv-laptop');
        this.elFpvOverlay = document.getElementById('fpv-overlay');

        this.elMinimap = document.getElementById('hud-minimap');
        this.elMinimapDrone = document.getElementById('minimap-drone');
        this.elMinimapRing = document.getElementById('minimap-ring');
    }

    initFlicker() {
        // Random CSS opacity flicker every 3-8 seconds
        const triggerFlicker = () => {
            this.elSignal.classList.add('flicker');
            setTimeout(() => {
                this.elSignal.classList.remove('flicker');
                const nextDelay = 3000 + Math.random() * 5000;
                setTimeout(triggerFlicker, nextDelay);
            }, 100);
        };
        setTimeout(triggerFlicker, 2000);
    }

    initEvents() {
        this.btnFpv.addEventListener('click', () => {
            this.toggleFPV();
        });
    }

    toggleFPV() {
        if (!this.drone || typeof this.drone.toggleFPV !== 'function') return;
        
        const fpvActive = this.drone.toggleFPV();
        
        if (fpvActive) {
            this.elFpvOverlay.style.display = 'block';
            this.btnFpv.innerText = '3RD PERSON';
            this.btnFpv.classList.add('active');
        } else {
            this.elFpvOverlay.style.display = 'none';
            this.btnFpv.innerText = 'FPV: OFF';
            this.btnFpv.classList.remove('active');
        }
    }

    update() {
        if (!this.drone) return;

        // Throttle DOM updates to every 3rd frame (~20fps instead of 60fps)
        this._frameCount = (this._frameCount || 0) + 1;
        if (this._frameCount % 3 !== 0) return;

        // 1. Speed & Altitude — only update if changed
        const speed = this.drone.getSpeed();
        const alt = this.drone.getAltitude();
        if (this._lastSpeed !== speed) { this.elSpeed.textContent = speed; this._lastSpeed = speed; }
        if (this._lastAlt !== alt) { this.elAlt.textContent = alt; this._lastAlt = alt; }

        // 2. Battery — only update if changed (rounded)
        const bat = Math.round(this.drone.getBattery());
        if (this._lastBat !== bat) {
            this._lastBat = bat;
            this.elBatFill.style.width = bat + '%';
            if (bat <= 20) {
                this.elBatFill.classList.add('warning');
                this.elBatText.classList.add('text-warning');
                this.elBatText.textContent = `LOW BATTERY - RTH (${bat}%)`;
            } else {
                this.elBatFill.classList.remove('warning');
                this.elBatText.classList.remove('text-warning');
                this.elBatText.textContent = `BATTERY ${bat}%`;
            }
        }

        // 3. Compass — only update if heading changed by ≥1°
        let heading = (this.drone.rotation.y * 180 / Math.PI) % 360;
        if (heading < 0) heading += 360;
        const headingRound = Math.round(heading);
        if (this._lastHeading !== headingRound) {
            this._lastHeading = headingRound;
            this.elHeadingText.textContent = `HDG ${headingRound.toString().padStart(3, '0')}`;
            this.elCompassArrow.style.transform = `rotate(${headingRound}deg)`;
        }
    }

    // Public API
    showMissionStatus(text) {
        this.elMission.innerText = text;
        this.elMission.style.display = 'block';
    }

    hideMissionStatus() {
        this.elMission.style.display = 'none';
        if (this.elTimer) this.elTimer.style.display = 'none';
    }

    updateMissionTimer(seconds) {
        if (!this.elTimer) return;
        if (seconds < 0) seconds = 0;
        
        if (this.elTimer.style.display === 'none') {
            this.elTimer.style.display = 'block';
        }
        
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        
        this.elTimer.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        
        if (seconds <= 10) {
            this.elTimer.style.color = 'var(--alert-red)';
            this.elTimer.style.textShadow = '0 0 10px var(--alert-red)';
        } else {
            this.elTimer.style.color = 'var(--neon-cyan)';
            this.elTimer.style.textShadow = '0 0 10px var(--neon-cyan)';
        }
    }

    showAlert(text, duration = 3000) {
        this.elAlert.innerText = text;
        this.elAlert.style.display = 'block';
        
        // Clear previous timeout if exists
        if (this.alertTimeout) clearTimeout(this.alertTimeout);
        
        this.alertTimeout = setTimeout(() => {
            this.elAlert.style.display = 'none';
        }, duration);
    }

    showMinimap() {
        if (this.elMinimap) this.elMinimap.style.display = 'block';
    }

    hideMinimap() {
        if (this.elMinimap) this.elMinimap.style.display = 'none';
    }

    updateMinimap(dronePos, ringPos, droneYaw) {
        if (!this.elMinimap || this.elMinimap.style.display === 'none') return;
        
        // Map size is 150px radius (300x300 map scale for world, say 200 units = 75px)
        const scale = 75 / 150; // Every world unit is 0.5 px
        
        // Position ring relative to drone
        const dx = ringPos.x - dronePos.x;
        const dz = ringPos.z - dronePos.z;
        
        // Constrain ring to minimap bounds if it's too far
        const dist = Math.sqrt(dx*dx + dz*dz);
        let drawX = dx * scale;
        let drawY = dz * scale;
        
        if (dist * scale > 70) {
            const angle = Math.atan2(drawY, drawX);
            drawX = Math.cos(angle) * 70;
            drawY = Math.sin(angle) * 70;
        }

        // Center is 75, 75
        this.elMinimapRing.style.left = (75 + drawX) + 'px';
        this.elMinimapRing.style.top = (75 + drawY) + 'px';
        
        // Rotate drone icon
        const yawDeg = (-droneYaw * 180 / Math.PI);
        this.elMinimapDrone.style.transform = `translate(-50%, -50%) rotate(${yawDeg}deg)`;
    }
}
