import * as THREE from 'three';
import { DRONE_CONFIGS } from './droneConfig.js';

// ── State ──
sessionStorage.clear();
const state = {
    pilotName: localStorage.getItem('pilotName') || 'PILOT-01',
    droneType: localStorage.getItem('droneType') || 'vortex',
    droneColor: localStorage.getItem('droneColor') || '#00f5ff'
};

// ── DOM refs ──
const elName = document.getElementById('pilot-name');
const elColor = document.getElementById('drone-color');
const grid = document.getElementById('drone-grid');
const previewContainer = document.getElementById('preview-container');

// ── Populate drone grid ──
Object.values(DRONE_CONFIGS).forEach(d => {
    const card = document.createElement('div');
    card.className = 'drone-card';
    card.dataset.id = d.id;
    card.style.setProperty('--card-color', d.color);
    card.innerHTML = `<span class="dc-icon">${d.icon}</span><span class="dc-name">${d.name}</span><span class="dc-class">${d.class}</span>`;
    card.addEventListener('click', () => selectDrone(d.id));
    grid.appendChild(card);
});

// ── Select drone ──
function selectDrone(id) {
    state.droneType = id;
    const cfg = DRONE_CONFIGS[id];
    // Cards
    document.querySelectorAll('.drone-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
    // Intel panel
    const accent = cfg.color;
    document.documentElement.style.setProperty('--accent', accent);
    document.getElementById('intel-name').textContent = cfg.name;
    document.getElementById('intel-class').textContent = cfg.class;
    document.getElementById('intel-class').style.background = accent;
    document.getElementById('intel-icon').textContent = cfg.icon;
    document.getElementById('intel-desc').textContent = cfg.desc;
    // Stat bars
    ['speed','agility','armor','battery'].forEach(s => {
        document.getElementById('bar-' + s).style.width = cfg.stats[s] + '%';
        document.getElementById('val-' + s).textContent = cfg.stats[s];
    });
    // Rebuild 3D preview
    buildPreviewMesh(cfg);
}

// ── Color swatches ──
document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
        state.droneColor = btn.dataset.color;
        elColor.value = btn.dataset.color;
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updatePreviewColor();
    });
});

// ── Init UI ──
elName.value = state.pilotName;
elColor.value = state.droneColor;
elName.addEventListener('input', e => { state.pilotName = e.target.value.replace(/[<>&"']/g, ''); });
elColor.addEventListener('input', e => { state.droneColor = e.target.value; updatePreviewColor(); });

// ── Launch ──
document.getElementById('btn-launch').addEventListener('click', () => {
    const name = state.pilotName.trim() || 'UNKNOWN PILOT';
    localStorage.setItem('pilotName', name);
    localStorage.setItem('droneType', state.droneType);
    localStorage.setItem('droneColor', state.droneColor);
    document.body.style.opacity = '0';
    setTimeout(() => window.location.href = '/mode-select.html', 300);
});

// ── Socket (session pairing) ──
const socket = window.io();
socket.on('connect', () => socket.emit('session:init'));
socket.on('session:code', code => {
    document.getElementById('session-code-display').textContent = code;
    sessionStorage.setItem('sessionCode', code);
    document.getElementById('session-status').textContent = 'WAITING FOR CONTROLLER...';
    document.getElementById('session-status').style.color = '#eab308';
});
socket.on('session:phoneConnected', () => {
    document.getElementById('session-status').textContent = 'CONTROLLER CONNECTED ✓';
    document.getElementById('session-status').style.color = '#39ff14';
});
document.getElementById('btn-refresh-code').addEventListener('click', () => socket.emit('session:init'));
document.getElementById('btn-copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.origin + '/controller.html');
    const btn = document.getElementById('btn-copy-link');
    btn.textContent = 'COPIED!';
    setTimeout(() => btn.textContent = 'COPY LINK', 2000);
});
document.getElementById('btn-phone-ui').addEventListener('click', () => window.open('/controller.html', '_blank'));

// ── Leaderboard ──
async function fetchLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        const el = document.getElementById('leaderboard-content');
        if (!data.length) { el.textContent = 'NO SCORES YET'; return; }
        let html = '<table class="leaderboard-table"><tr><th>Rank</th><th>Pilot</th><th>Time</th><th>Class</th></tr>';
        data.forEach((e, i) => {
            const rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
            const me = e.pilotName === state.pilotName ? 'row-me' : '';
            html += `<tr class="${me}"><td class="${rc}">#${i+1}</td><td>${e.pilotName}</td><td>${e.time.toFixed(2)}s</td><td>${e.droneType}</td></tr>`;
        });
        el.innerHTML = html + '</table>';
    } catch { document.getElementById('leaderboard-content').textContent = 'OFFLINE'; }
}
fetchLeaderboard();
setInterval(fetchLeaderboard, 30000);

// ── Three.js 3D Preview ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, previewContainer.clientWidth / previewContainer.clientHeight, 0.1, 100);
camera.position.set(0, 2.5, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
previewContainer.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dl = new THREE.DirectionalLight(0xffffff, 1);
dl.position.set(5, 5, 5);
scene.add(dl);

// Grid floor in preview
const gridH = new THREE.GridHelper(8, 16, 0x004455, 0x002233);
gridH.position.y = -1.2;
scene.add(gridH);

let droneGroup = null;
let props = [];
let accentMat = new THREE.MeshStandardMaterial({ color: state.droneColor, emissive: state.droneColor, emissiveIntensity: 0.6 });
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.85 });

function clearDrone() {
    if (droneGroup) {
        droneGroup.traverse(c => { if (c.isMesh) { c.geometry.dispose(); } });
        scene.remove(droneGroup);
    }
    props = [];
}

function buildPreviewMesh(cfg) {
    clearDrone();
    droneGroup = new THREE.Group();
    const s = cfg.physics.scale;

    // Body shape by type
    let bodyGeom;
    switch (cfg.shape) {
        case 'tri':   bodyGeom = new THREE.ConeGeometry(0.5*s, 1.2*s, 3); break;
        case 'sphere': bodyGeom = new THREE.SphereGeometry(0.35*s, 12, 12); break;
        case 'hex':   bodyGeom = new THREE.CylinderGeometry(0.7*s, 0.7*s, 0.35*s, 6); break;
        case 'wing':  bodyGeom = new THREE.BoxGeometry(2.2*s, 0.12*s, 0.7*s); break;
        case 'octo':  bodyGeom = new THREE.CylinderGeometry(0.9*s, 0.9*s, 0.45*s, 8); break;
        default:      bodyGeom = new THREE.BoxGeometry(1.2*s, 0.3*s, 1.2*s); break;
    }
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    droneGroup.add(body);

    // Arms + propellers
    const armCount = cfg.shape === 'hex' ? 6 : cfg.shape === 'octo' ? 8 : 4;
    const armLen = (cfg.shape === 'wing' ? 0.5 : 1.1) * s;
    for (let i = 0; i < armCount; i++) {
        const angle = (i / armCount) * Math.PI * 2;
        const ax = Math.cos(angle) * armLen;
        const az = Math.sin(angle) * armLen;
        // Arm
        const ag = new THREE.CylinderGeometry(0.03*s, 0.03*s, armLen);
        ag.rotateZ(Math.PI / 2);
        const arm = new THREE.Mesh(ag, bodyMat);
        arm.position.set(ax/2, 0, az/2);
        arm.lookAt(ax, 0, az);
        droneGroup.add(arm);
        // Hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08*s, 0.08*s, 0.15*s, 12), accentMat);
        hub.position.set(ax, 0.08*s, az);
        droneGroup.add(hub);
        // Propeller
        const pg = new THREE.CylinderGeometry(0.32*s, 0.32*s, 0.015*s, 16);
        const prop = new THREE.Mesh(pg, bodyMat);
        prop.position.set(ax, 0.16*s, az);
        droneGroup.add(prop);
        props.push(prop);
    }

    // LEDs
    [0xff0000, 0x00ff00].forEach((c, idx) => {
        const led = new THREE.PointLight(c, 0.8, 3);
        led.position.set(idx === 0 ? -0.3*s : 0.3*s, -0.1*s, -0.5*s);
        droneGroup.add(led);
    });

    scene.add(droneGroup);
    updatePreviewColor();
}

function updatePreviewColor() {
    accentMat.color.set(state.droneColor);
    accentMat.emissive.set(state.droneColor);
}

// Animation loop
const clock = new THREE.Clock();
(function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (droneGroup) {
        droneGroup.rotation.y += dt * 0.45;
        droneGroup.position.y = Math.sin(Date.now() * 0.001) * 0.08; // gentle hover bob
    }
    props.forEach((p, i) => { p.rotation.y += (i % 2 === 0 ? 1 : -1) * dt * 22; });
    renderer.render(scene, camera);
})();

window.addEventListener('resize', () => {
    if (!previewContainer.clientWidth) return;
    camera.aspect = previewContainer.clientWidth / previewContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
});

// ── Boot ──
selectDrone(state.droneType);
