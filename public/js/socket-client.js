export class SocketClient {
    constructor(drone, hud) {
        this.drone = drone;
        this.hud = hud;
        // The io() function is available globally from the <script> tag in index.html
        this.socket = window.io();
        
        this.latestControls = {
            throttle: 0,
            pitch: 0,
            roll: 0,
            yaw: 0
        };
        this.lastControlTime = Date.now();
        
        this.initEvents();
        this.startStatusInterval();
        
        // Start the control application loop
        this.applyControlsLoop();
    }

    initEvents() {
        this.socket.on('connect', () => {
            console.log("Laptop simulation connected to server.");
            const sessionCode = sessionStorage.getItem('sessionCode');
            if (sessionCode) {
                this.socket.emit('session:restore', sessionCode);
            }
        });

        this.socket.on('session:phoneConnected', () => {
            console.log("Phone paired successfully!");
            if (this.hud) {
                this.hud.showAlert("CONTROLLER CONNECTED", 2000);
            }
        });

        // Listen for control commands from the phone
        this.socket.on('drone:control', (data) => {
            this.latestControls = data;
            this.lastControlTime = Date.now();
        });

        // Listen for FPV toggle from the phone
        this.socket.on('drone:toggleFPV', () => {
            this.toggleFPV();
        });

        // Listen for menu actions from the phone
        this.socket.on('drone:menu', (action) => {
            if (action === 'garage') {
                document.body.style.opacity = '0';
                document.body.style.transition = 'opacity 0.3s';
                setTimeout(() => window.location.href = '/garage.html', 300);
            } else if (action === 'pause') {
                window.dispatchEvent(new CustomEvent('droneMenu', { detail: 'pause' }));
            } else if (action === 'settings') {
                window.dispatchEvent(new CustomEvent('droneMenu', { detail: 'settings' }));
            } else if (action === 'music') {
                window.dispatchEvent(new CustomEvent('droneMenu', { detail: 'music' }));
            }
        });
    }

    applyControlsLoop() {
        if (this.drone) {
            const timeSinceLastControl = Date.now() - this.lastControlTime;
            
            // Connection safety fallback
            if (timeSinceLastControl > 500) {
                // Gradually lerp all inputs toward 0
                this.latestControls.throttle *= 0.8;
                this.latestControls.pitch *= 0.8;
                this.latestControls.roll *= 0.8;
                this.latestControls.yaw *= 0.8;
                
                // Snap to 0 if very small to prevent endless floating point math
                if (Math.abs(this.latestControls.throttle) < 0.01) this.latestControls.throttle = 0;
                if (Math.abs(this.latestControls.pitch) < 0.01) this.latestControls.pitch = 0;
                if (Math.abs(this.latestControls.roll) < 0.01) this.latestControls.roll = 0;
                if (Math.abs(this.latestControls.yaw) < 0.01) this.latestControls.yaw = 0;
            }

            // Apply latest controls every single frame
            this.drone.applyControls(
                this.latestControls.throttle || 0,
                this.latestControls.pitch || 0,
                this.latestControls.roll || 0,
                this.latestControls.yaw || 0
            );
        }
        
        // Loop recursively using requestAnimationFrame for 60fps smoothing
        requestAnimationFrame(() => this.applyControlsLoop());
    }

    startStatusInterval() {
        // Emit telemetry data to the server every 100ms (10 times a second)
        setInterval(() => {
            if (this.drone) {
                const status = {
                    speed: this.drone.getSpeed(),
                    altitude: this.drone.getAltitude(),
                    battery: this.drone.getBattery()
                };
                this.socket.emit('drone:status', status);
            }
        }, 100);
    }

    toggleFPV() {
        console.log("FPV Toggle requested by controller.");
        if (this.hud) {
            this.hud.toggleFPV();
        } else if (this.drone) {
            this.drone.toggleFPV();
        }
    }
}
