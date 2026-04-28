# DroneX Simulation

A browser-based, high-fidelity 3D drone flight simulation built for MDM-II — Drone Technology. DroneX acts as a sandbox for drone physics, featuring multi-modal controls, custom networking, and immersive web environments.

## 🚀 Features

- **Premium Drone Selection Garage Overhaul:** 
  - Choose from 6 highly specialized classes: **Vortex-R (Racing Quad)**, **Garuda (Spy Drone)**, **MiniDro (Pocket Drone)**, **The Courier (Delivery Hex)**, **Phantom-X (Stealth Wing)**, and **Titan Mk-IV (Heavy Assault)**.
  - Real-time stat visualizations (Speed, Agility, Armor, Battery) with a modular color swatch picker.
  - Unique procedural 3D layouts mapped automatically per drone type (Tri, Sphere, Hex, Wing, Octo builds).
- **Advanced Flight Physics Engine:** 
  - Scaled mass response, drag profiles, and battery depletion based on the chosen unit class.
- **Multi-Mode Gameplay:** 
  - **Race Mode:** A full time-attack mission with glowing rings, collision detection, and best-time tracking inside a glowing neon city.
  - **Freefly Mode:** Explore a beautiful, procedurally generated countryside with rolling hills, a winding river, and a sunset skybox.
- **Highly Optimized Three.js Rendering:** Zero garbage collection pressure via pre-allocated vector and collision math matrices, throttled DOM paint cycles, and smart geometric instancing.
- **Global Leaderboard:** Server-side persistence of the fastest racing times, with dynamic top-10 ranking displayed directly in the Garage.
- **Secure Phone Pairing:** Connect your smartphone as a controller seamlessly using a 4-digit code generated in the Garage — no messy IP typing required!
- **Refined Mobile Controls:** Experience custom D-Pad and Throttle Slider controls, full-screen touch yaw tracking, and **Gyroscope Tilt Steering** directly from your phone.
- **First-Person View (FPV):** Nose-mounted camera with speed-shake and CRT scanline post-processing.
- **Web Audio API Soundscape:** Fully synthesized motor hum, wind noise, crash effects, and mission chimes (zero external audio files).
- **Security & Deployment:** Ready for production with Content Security Policy (CSP) headers, input sanitization, and Railway Nixpacks deployment configuration.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6 Modules)
- **3D Engine:** [Three.js](https://threejs.org/)
- **Networking/Real-time:** Node.js, Express, Socket.io
- **Audio:** Web Audio API (Synthesized procedural audio)
- **Deployment:** Railway (Nixpacks)

## 🏃 How to Run Locally

1. **Install Dependencies:**
   Ensure you have Node.js v18+ installed.
   ```bash
   npm install
   ```

2. **Start the Server:**
   ```bash
   npm start
   ```

3. **Launch the Simulation:**
   - On your laptop, open your browser and navigate to: `http://localhost:3000`
   - You will be greeted by the **Garage** screen to configure your drone.

4. **Connect Your Phone (Controller):**
   - Click **OPEN PHONE UI** in the garage, or visit `http://<YOUR_IP>:3000/controller.html` on your mobile device.
   - Enter the **4-digit session code** displayed in the Garage's top-left corner.
   - Once paired, your phone is permanently mapped to your laptop's session!

## 🎮 Controls

### Laptop Keyboard (Fallback)
- **W / S:** Pitch (Forward / Backward)
- **A / D:** Roll (Strafe Left / Right)
- **Q / Space:** Throttle Up
- **E / Shift:** Throttle Down
- **Arrow Left / Right:** Yaw (Rotate Left / Right)

### Smartphone Controller (Primary)
- **Left Slider:** Throttle (Up / Down)
- **Right D-Pad:** Pitch (Up / Down) & Roll (Left / Right)
- **Background Swipe:** Yaw (Rotate Left / Right)
- **TILT STEER:** Toggle to use your phone's physical gyroscope to pitch and roll instead of the D-Pad.
- **Menu Buttons:** FPV toggle, Garage navigation, Pause, Music, Settings.

## 👥 Team Members

- Param Mehta
- Smit Chauhan
- Tanisha Jethwa
- Aryan Meshram
- Revan Chennae
