import * as THREE from 'three';

export class Mission {
    constructor(scene, drone, hud, audio, world) {
        this.scene = scene;
        this.drone = drone;
        this.hud = hud;
        this.audio = audio;
        this.world = world;

        this.active = false;
        this.currentRingIndex = 0;
        this.timeRemaining = 180;
        this.elapsedTime = 0;
        this.maxTime = 180;

        this.ringPositions = [
            { x: 0, y: 15, z: -50 },     // Ring 1: Straight ahead
            { x: -40, y: 30, z: -100 },  // Ring 2: Up and left
            { x: 50, y: 20, z: -150 },   // Ring 3: Down and right
            { x: 100, y: 40, z: -80 },   // Ring 4: High up, sharp right
            { x: 20, y: 10, z: 20 },     // Ring 5: Low, looping back
            { x: 0, y: 5, z: 0 }         // Ring 6: Near start, very low
        ];

        this.rings = [];
        this.buildRings();
        this.cacheDOM();
        this.initEvents();
        
        // Hide overlay initially
        if (this.elOverlay) this.elOverlay.style.display = 'none';
    }

    buildRings() {
        const ringGeom = new THREE.TorusGeometry(5, 0.5, 16, 100);
        
        this.matInactive = new THREE.MeshStandardMaterial({
            color: 0x555555,
            emissive: 0x222222,
            emissiveIntensity: 0.5
        });

        this.matActive = new THREE.MeshStandardMaterial({
            color: 0x00f5ff,
            emissive: 0x00f5ff,
            emissiveIntensity: 1.0
        });

        this.matCompleted = new THREE.MeshStandardMaterial({
            color: 0x39ff14,
            emissive: 0x39ff14,
            emissiveIntensity: 1.0
        });

        // Generate 6 random ring positions
        this.ringPositions = [];
        for (let i = 0; i < 6; i++) {
            let x, y, z;
            let isValid = false;
            let attempts = 0;

            while (!isValid && attempts < 50) {
                x = (Math.random() - 0.5) * 150;
                z = (Math.random() - 0.5) * 150;
                y = 10 + Math.random() * 50; 
                
                if (i === 0) {
                    x = (Math.random() - 0.5) * 50;
                    z = -20 - Math.random() * 30;
                }

                isValid = true;
                if (this.world && this.world.buildings) {
                    const testPos = new THREE.Vector3(x, y, z);
                    for (let b of this.world.buildings) {
                        const box = new THREE.Box3().setFromObject(b);
                        box.expandByScalar(6); // 5 is ring radius, 1 is safety margin
                        if (box.containsPoint(testPos)) {
                            isValid = false;
                            break;
                        }
                    }
                }
                attempts++;
            }

            this.ringPositions.push(new THREE.Vector3(x, y, z));
        }

        this.ringPositions.forEach((pos, index) => {
            const ring = new THREE.Mesh(ringGeom, this.matInactive.clone());
            ring.position.copy(pos);
            
            if (index < this.ringPositions.length - 1) {
                ring.lookAt(this.ringPositions[index + 1]);
            } else {
                ring.lookAt(new THREE.Vector3(0, 0, 0));
            }

            this.scene.add(ring);
            this.rings.push({ mesh: ring, completed: false });
        });
    }

    cacheDOM() {
        this.elOverlay = document.getElementById('mission-end-overlay');
        this.elTitle = document.getElementById('mission-end-title');
        this.elTime = document.getElementById('mission-time');
        this.elBestTime = document.getElementById('mission-best-time');
        this.elLeaderboardPos = document.getElementById('mission-leaderboard-pos');
        this.btnStart = document.getElementById('btn-start-mission');
        this.btnRestart = document.getElementById('btn-restart-mission');
        this.btnChangeMode = document.getElementById('btn-change-mode');
        this.btnGarage = document.getElementById('btn-garage');
    }

    initEvents() {
        if (this.btnStart) this.btnStart.addEventListener('click', () => this.startMission());
        if (this.btnRestart) this.btnRestart.addEventListener('click', () => this.startMission());
        if (this.btnChangeMode) this.btnChangeMode.addEventListener('click', () => {
            document.body.style.opacity = '0';
            setTimeout(() => window.location.href = '/mode-select.html', 300);
        });
        if (this.btnGarage) this.btnGarage.addEventListener('click', () => {
            document.body.style.opacity = '0';
            setTimeout(() => window.location.href = '/garage.html', 300);
        });
    }

    startMission() {
        this.active = true;
        this.currentRingIndex = 0;
        this.timeRemaining = this.maxTime;
        this.elapsedTime = 0;
        
        this.elOverlay.style.display = 'none';
        this.btnStart.style.display = 'none';

        // Reset drone position to start (optional, but good for racing)
        this.drone.mesh.position.set(0, 10, 0);
        this.drone.velocity.set(0, 0, 0);
        this.drone.rotation.set(0, 0, 0);

        this.resetRings();
        this.activateRing(0);

        if (this.hud && typeof this.hud.showMinimap === 'function') {
            this.hud.showMinimap();
        }

        this.hud.showMissionStatus(`MISSION: 0 / ${this.rings.length} RINGS`);
        this.hud.showAlert("MISSION START", 2000);
    }

    resetRings() {
        this.rings.forEach(ring => {
            ring.completed = false;
            ring.mesh.material = this.matInactive;
            ring.mesh.visible = true;
        });
    }

    activateRing(index) {
        if (index < this.rings.length) {
            this.rings[index].mesh.material = this.matActive;
        }
    }

    update(deltaTime) {
        // Slowly rotate active ring and update minimap
        if (this.currentRingIndex < this.rings.length) {
            const activeRing = this.rings[this.currentRingIndex].mesh;
            activeRing.rotation.z += deltaTime;
            
            // Update HUD Minimap
            if (this.hud && typeof this.hud.updateMinimap === 'function') {
                this.hud.updateMinimap(this.drone.mesh.position, activeRing.position, this.drone.rotation.y);
            }
        }

        if (!this.active) return;

        this.elapsedTime += deltaTime;
        this.timeRemaining -= deltaTime;

        // Update HUD timer
        if (this.hud && typeof this.hud.updateMissionTimer === 'function') {
            this.hud.updateMissionTimer(this.timeRemaining);
        }

        // Timer out
        if (this.timeRemaining <= 0) {
            this.endMission(false);
            return;
        }

        // Collision Check
        const currentRing = this.rings[this.currentRingIndex];
        if (!currentRing.completed) {
            const distance = this.drone.mesh.position.distanceTo(currentRing.mesh.position);
            // 5 units is roughly the radius of the torus
            if (distance < 5) {
                this.collectRing();
            }
        }
    }

    collectRing() {
        const ring = this.rings[this.currentRingIndex];
        ring.completed = true;
        ring.mesh.material = this.matCompleted;
        
        // Phase 9 audio
        if (this.audio) this.audio.missionCompleteChime(false);
        
        window.dispatchEvent(new CustomEvent('droneEvent', { detail: 'ring' }));

        setTimeout(() => {
            ring.mesh.visible = false;
        }, 500); // Disappear after half second

        this.currentRingIndex++;
        
        if (this.currentRingIndex >= this.rings.length) {
            this.endMission(true);
        } else {
            this.activateRing(this.currentRingIndex);
            this.hud.showMissionStatus(`MISSION: ${this.currentRingIndex} / ${this.rings.length} RINGS`);
            this.hud.showAlert("RING SECURED", 1000);
        }
    }

    async endMission(success) {
        this.active = false;
        this.elOverlay.style.display = 'flex';
        if (this.elLeaderboardPos) this.elLeaderboardPos.innerText = "";
        
        // Update mission status to show final time instead of hiding it
        this.hud.showMissionStatus(`FINAL TIME: ${this.elapsedTime.toFixed(2)}s`);

        if (success) {
            if (this.audio) this.audio.missionCompleteChime(true);
            window.dispatchEvent(new CustomEvent('droneEvent', { detail: 'missionComplete' }));
            
            this.elTitle.innerText = "MISSION COMPLETE";
            this.elTitle.style.color = "var(--neon-green)";
            this.elTitle.style.textShadow = "0 0 20px var(--neon-green)";
            
            const timeStr = this.elapsedTime.toFixed(2) + "s";
            this.elTime.innerText = `Time: ${timeStr}`;
            
            // Save best time
            let bestTime = localStorage.getItem('personalBest');
            if (!bestTime || this.elapsedTime < parseFloat(bestTime)) {
                bestTime = this.elapsedTime.toFixed(2);
                localStorage.setItem('personalBest', bestTime);
                this.elTime.innerText += " (NEW RECORD!)";
            }
            this.elBestTime.innerText = `Best: ${bestTime}s`;

            if (this.elLeaderboardPos) {
                this.elLeaderboardPos.innerText = "SUBMITTING SCORE...";
                this.elLeaderboardPos.style.color = "yellow";
            }
            
            try {
                const payload = {
                    pilotName: localStorage.getItem('pilotName') || 'UNKNOWN',
                    time: parseFloat(this.elapsedTime.toFixed(2)),
                    droneType: localStorage.getItem('droneType') || 'racing'
                };
                const res = await fetch('/api/leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    let myRank = data.findIndex(e => e.pilotName === payload.pilotName && e.time === payload.time) + 1;
                    if (myRank > 0 && myRank <= 10) {
                        this.elLeaderboardPos.innerText = `SCORE SUBMITTED! Global Rank: #${myRank}`;
                        this.elLeaderboardPos.style.color = "var(--neon-green)";
                    } else {
                        this.elLeaderboardPos.innerText = `SCORE SUBMITTED! (Outside Top 10)`;
                        this.elLeaderboardPos.style.color = "var(--neon-cyan)";
                    }
                } else {
                    if (this.elLeaderboardPos) {
                        this.elLeaderboardPos.innerText = "OFFLINE — Score saved locally only";
                        this.elLeaderboardPos.style.color = "gray";
                    }
                }
            } catch (e) {
                if (this.elLeaderboardPos) {
                    this.elLeaderboardPos.innerText = "OFFLINE — Score saved locally only";
                    this.elLeaderboardPos.style.color = "gray";
                }
            }

        } else {
            if (this.audio) this.audio.missionFailSound();
            
            this.elTitle.innerText = "MISSION FAILED";
            this.elTitle.style.color = "var(--alert-red)";
            this.elTitle.style.textShadow = "0 0 20px var(--alert-red)";
            this.elTime.innerText = "Time Expired";
            
            const bestTime = localStorage.getItem('personalBest') || "---";
            this.elBestTime.innerText = `Best: ${bestTime}s`;
        }

        if (this.hud && typeof this.hud.hideMinimap === 'function') {
            this.hud.hideMinimap();
        }
    }
}
