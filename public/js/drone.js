import * as THREE from 'three';
import { DRONE_CONFIGS } from './droneConfig.js';

// Base physics constants — these get scaled per-drone in initConfig()
const BASE_PHYSICS = {
  throttleAccel: 0.02,
  pitchAccel: 0.015,
  rollAccel: 0.015,
  yawAccel: 0.08,
  horizontalDrag: 0.95,
  verticalDrag: 0.90,
  yawDrag: 0.88,
  gravity: 0.004,
  maxHorizontalSpeed: 1.5,
  maxVerticalSpeed: 1.0,
  maxYawSpeed: 0.15,
  tiltAmount: 0.45,
  tiltSmoothing: 0.12,
};

// Active physics — cloned from BASE and scaled per-drone
let PHYSICS = { ...BASE_PHYSICS };

export class Drone {
    constructor(scene, camera, audio, world) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.world = world;
        this.stunnedTimer = 0;
        
        this.initConfig();
        this.fpvActive = false;
        this.initFPVCamera();
        
        this.buildModel();
        this.initPhysics();
        this.initControls();
        
        // Start battery
        this.battery = 100;
    }

    initFPVCamera() {
        this.fpvCamera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.fpvBasePosition = new THREE.Vector3(0, 0.4, -0.6);
        this.fpvCamera.position.copy(this.fpvBasePosition);
        this.fpvCamera.rotation.y = 0;
    }

    initConfig() {
        this.color = localStorage.getItem('droneColor') || '#00f5ff';
        this.type = localStorage.getItem('droneType') || 'vortex';
        this.droneConfig = DRONE_CONFIGS[this.type] || DRONE_CONFIGS['vortex'];

        // Reset physics to base, then scale by this drone's profile
        PHYSICS = { ...BASE_PHYSICS };
        const p = this.droneConfig.physics;

        // Thrust multiplier scales all acceleration
        PHYSICS.throttleAccel *= p.thrustMul;
        PHYSICS.pitchAccel    *= p.thrustMul;
        PHYSICS.rollAccel     *= p.thrustMul;

        // Drag from config (higher = stops faster)
        PHYSICS.horizontalDrag = 1 - p.drag;
        PHYSICS.verticalDrag   = 1 - p.drag;

        // Heavier drones feel more gravity and have lower top yaw speed
        PHYSICS.gravity *= p.mass;
        PHYSICS.maxYawSpeed /= Math.sqrt(p.mass);

        // Battery drain scales with thrust
        this.batteryDrainRate = (1 / 20) * p.thrustMul;
    }

    buildModel() {
        this.mesh = new THREE.Group();
        const cfg = this.droneConfig;
        const s = cfg.physics.scale;

        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.85 });
        const accentMat = new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.5 });

        // Body shape per drone type
        let bodyGeom;
        switch (cfg.shape) {
            case 'tri':    bodyGeom = new THREE.ConeGeometry(0.5*s, 1.2*s, 3); break;
            case 'sphere': bodyGeom = new THREE.SphereGeometry(0.35*s, 12, 12); break;
            case 'hex':    bodyGeom = new THREE.CylinderGeometry(0.7*s, 0.7*s, 0.35*s, 6); break;
            case 'wing':   bodyGeom = new THREE.BoxGeometry(2.2*s, 0.12*s, 0.7*s); break;
            case 'octo':   bodyGeom = new THREE.CylinderGeometry(0.9*s, 0.9*s, 0.45*s, 8); break;
            default:       bodyGeom = new THREE.BoxGeometry(1.2*s, 0.3*s, 1.2*s); break;
        }
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        this.mesh.add(bodyMesh);

        // Arms + propellers
        this.propellers = [];
        this.leds = [];
        const armCount = cfg.shape === 'hex' ? 6 : cfg.shape === 'octo' ? 8 : 4;
        const armLen = (cfg.shape === 'wing' ? 0.5 : 1.1) * s;

        for (let i = 0; i < armCount; i++) {
            const angle = (i / armCount) * Math.PI * 2;
            const ax = Math.cos(angle) * armLen;
            const az = Math.sin(angle) * armLen;

            const ag = new THREE.CylinderGeometry(0.04*s, 0.04*s, armLen);
            ag.rotateZ(Math.PI / 2);
            const arm = new THREE.Mesh(ag, bodyMat);
            arm.position.set(ax/2, 0, az/2);
            arm.lookAt(ax, 0, az);
            this.mesh.add(arm);

            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08*s, 0.08*s, 0.15*s, 12), accentMat);
            hub.position.set(ax, 0.08*s, az);
            this.mesh.add(hub);

            const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.35*s, 0.35*s, 0.015*s, 16), bodyMat);
            prop.position.set(ax, 0.16*s, az);
            prop.castShadow = true;
            this.mesh.add(prop);
            this.propellers.push(prop);

            const isFront = (i < armCount / 2);
            const led = new THREE.PointLight(isFront ? 0xffffff : 0xff0000, 0.8, 3);
            led.position.set(ax, 0.05*s, az);
            this.mesh.add(led);
            this.leds.push(led);
        }

        this.mesh.add(this.fpvCamera);
        this.mesh.position.set(0, 10, 0);
        this.scene.add(this.mesh);
    }

    initPhysics() {
        this.velocity = new THREE.Vector3();
        this.yawVelocity = 0;
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        
        this.inputs = {
            throttle: 0,
            pitch: 0,
            roll: 0,
            yaw: 0
        };
        
        this.socketInputs = {
            throttle: 0,
            pitch: 0,
            roll: 0,
            yaw: 0
        };
        
        this.mouseYaw = 0;

        this.keyState = {};
        this.pointerLocked = false;

        // Pre-allocate reusable objects to avoid per-frame GC
        this._direction = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._yAxis = new THREE.Vector3(0, 1, 0);
        this._newPos = new THREE.Vector3();
        this._droneBox = new THREE.Box3();
        this._buildingBox = new THREE.Box3();

        // Cache building bounding boxes once (buildings don't move)
        this._cachedBuildingBoxes = null;
    }

    initControls() {
        window.addEventListener('keydown', (e) => {
            this.keyState[e.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keyState[e.key.toLowerCase()] = false;
        });

        const canvas = this.scene.parent || document.body; // Using document.body for ease
        
        document.body.addEventListener('click', () => {
            if (!this.pointerLocked) {
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === document.body;
            const hint = document.getElementById('mouse-lock-hint');
            if (hint) {
                hint.style.display = this.pointerLocked ? 'none' : 'block';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouseYaw = THREE.MathUtils.clamp(e.movementX * 0.003, -1, 1);
                
                clearTimeout(this.mouseTimer);
                this.mouseTimer = setTimeout(() => { this.mouseYaw = 0; }, 50);
            }
        });

        // Add hint to HTML dynamically
        const hint = document.createElement('div');
        hint.id = 'mouse-lock-hint';
        hint.innerText = "CLICK TO LOCK MOUSE";
        hint.style.position = 'fixed';
        hint.style.bottom = '20px';
        hint.style.left = '50%';
        hint.style.transform = 'translateX(-50%)';
        hint.style.color = 'var(--neon-cyan)';
        hint.style.fontFamily = 'var(--font-main)';
        hint.style.textShadow = '0 0 5px var(--neon-cyan)';
        hint.style.zIndex = '1000';
        hint.style.pointerEvents = 'none';
        document.body.appendChild(hint);
    }

    applyControls(throttle, pitch, roll, yaw) {
        this.socketInputs = { throttle, pitch, roll, yaw };
    }

    updateKeyboardInputs() {
        // Start with socket inputs
        let throttle = this.socketInputs.throttle;
        let pitch = this.socketInputs.pitch;
        let roll = this.socketInputs.roll;
        
        // If socket yaw is active use it, otherwise fallback to mouse
        let yaw = this.socketInputs.yaw !== 0 ? this.socketInputs.yaw : this.mouseYaw;

        if (this.keyState['w']) pitch = -1;
        if (this.keyState['s']) pitch = 1;

        if (this.keyState['a']) roll = -1;
        if (this.keyState['d']) roll = 1;

        if (this.keyState['q'] || this.keyState[' ']) throttle = 1;
        if (this.keyState['e'] || this.keyState['shift']) throttle = -1;

        if (this.keyState['arrowleft']) yaw = 1;
        if (this.keyState['arrowright']) yaw = -1;

        this.inputs.pitch = pitch;
        this.inputs.roll = roll;
        this.inputs.throttle = throttle;
        this.inputs.yaw = yaw;
    }

    update(deltaTime) {
        if (this.stunnedTimer > 0) {
            this.stunnedTimer -= deltaTime;
            this.inputs.throttle = 0;
            this.inputs.pitch = 0;
            this.inputs.roll = 0;
            this.inputs.yaw = 0;
        } else {
            this.updateKeyboardInputs();
        }

        // Audio updates
        if (this.audio) {
            this.audio.motorHum(this.inputs.throttle);
            this.audio.windSound(this.getSpeed());
        }

        // 1. Update Battery
        this.battery = Math.max(0, this.battery - (this.batteryDrainRate * deltaTime));
        if (this.battery <= 0) this.inputs.throttle = -1;

        // 2. Apply Acceleration (reuse pre-allocated vectors)
        this._direction.set(0, 0, -1).applyAxisAngle(this._yAxis, this.rotation.y);
        this._right.set(1, 0, 0).applyAxisAngle(this._yAxis, this.rotation.y);

        this.velocity.x += this._direction.x * (-this.inputs.pitch * PHYSICS.pitchAccel) + this._right.x * (this.inputs.roll * PHYSICS.rollAccel);
        this.velocity.z += this._direction.z * (-this.inputs.pitch * PHYSICS.pitchAccel) + this._right.z * (this.inputs.roll * PHYSICS.rollAccel);
        this.velocity.y += this.inputs.throttle * PHYSICS.throttleAccel;
        this.yawVelocity += this.inputs.yaw * PHYSICS.yawAccel;

        // 3. Apply Gravity
        this.velocity.y -= PHYSICS.gravity;

        // 4. Apply Drag
        this.velocity.x *= PHYSICS.horizontalDrag;
        this.velocity.z *= PHYSICS.horizontalDrag;
        this.velocity.y *= PHYSICS.verticalDrag;
        this.yawVelocity *= PHYSICS.yawDrag;

        // 5. Clamp Velocities
        const mh = PHYSICS.maxHorizontalSpeed, mv = PHYSICS.maxVerticalSpeed, my = PHYSICS.maxYawSpeed;
        if (this.velocity.x > mh) this.velocity.x = mh; else if (this.velocity.x < -mh) this.velocity.x = -mh;
        if (this.velocity.z > mh) this.velocity.z = mh; else if (this.velocity.z < -mh) this.velocity.z = -mh;
        if (this.velocity.y > mv) this.velocity.y = mv; else if (this.velocity.y < -mv) this.velocity.y = -mv;
        if (this.yawVelocity > my) this.yawVelocity = my; else if (this.yawVelocity < -my) this.yawVelocity = -my;

        // 6. Apply Movement and Rotation
        this._newPos.copy(this.mesh.position).add(this.velocity);

        // Building Collision Check (reuse pre-allocated Box3)
        let collision = false;
        this._droneBox.setFromObject(this.mesh);
        this._droneBox.min.add(this.velocity);
        this._droneBox.max.add(this.velocity);
        this._droneBox.expandByScalar(-0.2);
        
        if (this.world && typeof this.world.checkCollision === 'function') {
            collision = this.world.checkCollision(this._droneBox);
        }
        
        if (!collision && this.world && this.world.buildings) {
            // Cache building boxes on first use (they never move)
            if (!this._cachedBuildingBoxes) {
                this._cachedBuildingBoxes = this.world.buildings.map(b => new THREE.Box3().setFromObject(b));
            }
            for (let i = 0; i < this._cachedBuildingBoxes.length; i++) {
                if (this._cachedBuildingBoxes[i].intersectsBox(this._droneBox)) {
                    collision = true;
                    break;
                }
            }
        }

        if (collision) {
            this.triggerCrash();
            this.velocity.multiplyScalar(-0.5);
            this.mesh.position.add(this.velocity);
        } else {
            this.mesh.position.copy(this._newPos);
        }
        
        // Rotate
        this.rotation.y -= this.yawVelocity; // Negative because WebGL Y-rotation is counter-clockwise, and we want right (+1) to rotate clockwise

        // 7. Ground collision
        let groundHeight = 0.5;
        if (this.world && typeof this.world.getGroundHeight === 'function') {
            groundHeight = this.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z) + 0.5;
        }

        if (this.mesh.position.y < groundHeight) {
            if (this.velocity.y < -0.1 || Math.abs(this.velocity.x) > 0.2 || Math.abs(this.velocity.z) > 0.2) {
                this.triggerCrash();
            }
            this.mesh.position.y = groundHeight;
            this.velocity.y = Math.max(0, this.velocity.y);
            this.velocity.x *= 0.5; // ground friction
            this.velocity.z *= 0.5;
        }

        // 8. Visual Tilt
        const targetPitch = this.inputs.pitch * PHYSICS.tiltAmount;
        const targetRoll = this.inputs.roll * PHYSICS.tiltAmount;
        
        this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, PHYSICS.tiltSmoothing);
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -targetRoll, PHYSICS.tiltSmoothing);
        this.mesh.rotation.y = this.rotation.y;

        // 9. Propellers & LEDs
        const spinSpeed = 10 + (this.inputs.throttle * 15);
        this.propellers.forEach((prop, index) => {
            const dir = (index % 2 === 0) ? 1 : -1;
            prop.rotation.y += spinSpeed * dir * deltaTime;
        });
        
        const time = Date.now() * 0.01;
        this.leds.forEach(led => {
            led.intensity = 1 + Math.sin(time) * 0.5 * (Math.abs(spinSpeed) / 25);
        });

        // 10. Update Cameras
        this.updateCamera(deltaTime);
    }

    updateCamera(deltaTime) {
        if (!this.fpvActive) {
            const offset = new THREE.Vector3(0, 3, 10);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
            
            const targetCamPos = this.mesh.position.clone().add(offset);
            
            const camLerp = 1 - Math.exp(-8 * deltaTime);
            this.camera.position.lerp(targetCamPos, camLerp);
            
            const lookTarget = this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
            this.camera.lookAt(lookTarget);
        }

        if (this.fpvActive) {
            const speed = this.velocity.length();
            if (speed > 0.05) {
                const shakeAmount = (speed / PHYSICS.maxHorizontalSpeed) * 0.05;
                const time = Date.now() * 0.05;
                this.fpvCamera.position.x = this.fpvBasePosition.x + Math.sin(time) * shakeAmount;
                this.fpvCamera.position.y = this.fpvBasePosition.y + Math.cos(time * 0.8) * shakeAmount;
            } else {
                this.fpvCamera.position.copy(this.fpvBasePosition);
            }
        }
    }

    toggleFPV() {
        this.fpvActive = !this.fpvActive;
        return this.fpvActive;
    }

    getActiveCamera() {
        return this.fpvActive ? this.fpvCamera : this.camera;
    }

    getSpeed() {
        return Math.floor(this.velocity.length() * 100);
    }

    getAltitude() {
        let groundHeight = 0.5;
        if (this.world && typeof this.world.getGroundHeight === 'function') {
            groundHeight = this.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z) + 0.5;
        }
        return Math.max(0, this.mesh.position.y - groundHeight).toFixed(1);
    }

    getBattery() {
        return this.battery;
    }

    triggerCrash() {
        if (this.stunnedTimer > 0) return;
        
        if (this.audio) this.audio.crashSound();
        this.stunnedTimer = 1.0;
        this.velocity.set(0, 0, 0);
        this.yawVelocity = 0;
        
        window.dispatchEvent(new CustomEvent('droneEvent', { detail: 'crash' }));
        
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0'; flash.style.left = '0';
        flash.style.width = '100vw'; flash.style.height = '100vh';
        flash.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '999';
        flash.style.transition = 'opacity 0.5s';
        document.body.appendChild(flash);
        
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 500);
        }, 50);
        
        const alertEl = document.getElementById('hud-alert');
        if (alertEl) {
            alertEl.innerText = "DRONE DAMAGED";
            alertEl.style.display = 'block';
            alertEl.style.color = "var(--alert-red)";
            alertEl.style.textShadow = "0 0 10px var(--alert-red)";
            setTimeout(() => { 
                alertEl.style.display = 'none'; 
                // Auto restart after drone damaged
                this.mesh.position.set(0, 10, 0);
                this.velocity.set(0, 0, 0);
                this.rotation.set(0, 0, 0);
                this.yawVelocity = 0;
            }, 1000);
        } else {
            setTimeout(() => {
                this.mesh.position.set(0, 10, 0);
                this.velocity.set(0, 0, 0);
                this.rotation.set(0, 0, 0);
                this.yawVelocity = 0;
            }, 1000);
        }
    }
}
