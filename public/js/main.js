import * as THREE from 'three';
import { World } from './world.js';
import { Countryside } from './countryside.js';
import { Drone } from './drone.js';
import { HUD } from './hud.js';
import { Mission } from './mission.js';
import { SocketClient } from './socket-client.js';
import { AudioSystem } from './audio.js';

class Simulation {
    constructor() {
        this.init();
    }

    init() {
        // 1. Scene Setup
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        // 2. Camera Setup (Placeholder for now, Drone will manage its own camera later)
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 30);
        this.camera.lookAt(0, 0, 0);

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // 4. Initialize Modules
        this.audio = new AudioSystem();
        
        const isFreefly = window.location.pathname.includes('freefly');
        
        if (isFreefly) {
            this.world = new Countryside(this.scene);
            this.drone = new Drone(this.scene, this.camera, this.audio, this.world);
            this.hud = new HUD(this.drone);
            if (this.hud && typeof this.hud.hideMissionStatus === 'function') this.hud.hideMissionStatus();
            if (this.hud && typeof this.hud.hideMinimap === 'function') this.hud.hideMinimap();
            this.socketClient = new SocketClient(this.drone, this.hud);
        } else {
            this.world = new World(this.scene);
            this.drone = new Drone(this.scene, this.camera, this.audio, this.world);
            this.hud = new HUD(this.drone);
            this.mission = new Mission(this.scene, this.drone, this.hud, this.audio, this.world);
            this.socketClient = new SocketClient(this.drone, this.hud);
        }

        this.isPaused = false;

        window.addEventListener('droneEvent', (e) => {
            if (this.socketClient && this.socketClient.socket) {
                this.socketClient.socket.emit('drone:event', e.detail);
            }
        });

        window.addEventListener('droneMenu', (e) => {
            if (e.detail === 'pause') {
                this.isPaused = !this.isPaused;
                if (this.hud) {
                    if (this.isPaused) {
                        this.hud.showAlert("PAUSED", 999999);
                    } else {
                        this.hud.showAlert("RESUMED", 1000);
                    }
                }
            } else if (e.detail === 'music') {
                // Ignore for now, handled in garage or future update
            }
        });

        // Quality Toggle
        const btnQuality = document.getElementById('btn-quality');
        let lowQuality = false;
        if (btnQuality) {
            btnQuality.addEventListener('click', () => {
                lowQuality = !lowQuality;
                this.setQuality(lowQuality);
                btnQuality.innerText = lowQuality ? 'PERF: LOW' : 'PERF: HIGH';
            });
        }

        // Window Resize Handler
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Loading Animation
        const loadingScreen = document.getElementById('loading-screen');
        const loadingBar = document.getElementById('loading-bar-fill');
        const loadingComplete = document.getElementById('loading-text-complete');
        if (loadingScreen && loadingBar) {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 100) progress = 100;
                loadingBar.style.width = progress + '%';
                
                if (progress === 100) {
                    clearInterval(interval);
                    this.audio.initAudio();
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => loadingScreen.remove(), 500);
                }
            }, 200);
        }

        // 6. Start Animation Loop
        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        if (this.drone && this.drone.fpvCamera) {
            this.drone.fpvCamera.aspect = window.innerWidth / window.innerHeight;
            this.drone.fpvCamera.updateProjectionMatrix();
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setQuality(lowQuality) {
        this.renderer.shadowMap.enabled = !lowQuality;
        if (this.scene.fog) {
            this.scene.fog.density = lowQuality ? 0.001 : 0.005;
        }
        
        this.scene.traverse(child => {
            if (child.isLight && child.castShadow !== undefined) {
                child.castShadow = !lowQuality;
            }
            if (child.isMesh) {
                child.castShadow = !lowQuality;
                child.receiveShadow = !lowQuality;
                if (child.material) child.material.needsUpdate = true;
            }
        });
    }

    animate() {
        const deltaTime = this.clock.getDelta();

        if (!this.isPaused) {
            // Update modules
            if (this.world) this.world.update(deltaTime);
            if (this.drone) this.drone.update(deltaTime);
            if (this.mission) this.mission.update(deltaTime);
        }
        
        // HUD still updates to show text overlays
        if (this.hud) this.hud.update();

        // Render scene using the active camera
        this.renderer.render(this.scene, this.drone ? this.drone.getActiveCamera() : this.camera);
    }
}

// Start simulation when DOM is ready
window.onload = () => {
    new Simulation();
};
