// droneConfig.js — Central drone roster & physics profiles
export const DRONE_CONFIGS = {
    vortex: {
        id: 'vortex',
        name: 'Vortex-R',
        class: 'Racing Quad',
        desc: 'Maximum thrust, highest top speed, aggressive handling. Built for racing and acrobatics.',
        icon: '⚡',
        color: '#39ff14',
        stats: { speed: 95, agility: 80, armor: 30, battery: 40 },
        physics: { mass: 1.0, thrustMul: 2.5, drag: 0.08, scale: 1.0 },
        // Three.js preview builder key
        shape: 'quad'
    },
    garuda: {
        id: 'garuda',
        name: 'Garuda',
        class: 'Spy Drone',
        desc: 'Bird-inspired biomimetic frame. Featherweight, silent, and extremely agile.',
        icon: '🦅',
        color: '#00f5ff',
        stats: { speed: 70, agility: 95, armor: 15, battery: 65 },
        physics: { mass: 0.5, thrustMul: 1.2, drag: 0.02, scale: 0.9 },
        shape: 'tri'
    },
    minidro: {
        id: 'minidro',
        name: 'MiniDro',
        class: 'Pocket Drone',
        desc: 'Compact micro-drone with snappy controls. Fits through tight gaps others can\'t.',
        icon: '🔬',
        color: '#ff00e6',
        stats: { speed: 55, agility: 90, armor: 10, battery: 80 },
        physics: { mass: 0.2, thrustMul: 0.8, drag: 0.15, scale: 0.4 },
        shape: 'sphere'
    },
    courier: {
        id: 'courier',
        name: 'The Courier',
        class: 'Delivery Hex',
        desc: 'Heavy-duty hexacopter. Massive inertia, sluggish turns, but nearly impossible to destabilize.',
        icon: '📦',
        color: '#ffaa00',
        stats: { speed: 40, agility: 25, armor: 90, battery: 50 },
        physics: { mass: 3.5, thrustMul: 2.0, drag: 0.05, scale: 1.5 },
        shape: 'hex'
    },
    phantom: {
        id: 'phantom',
        name: 'Phantom-X',
        class: 'Stealth Wing',
        desc: 'Low-observable fixed-wing hybrid. Exceptional range, smooth glide, minimal radar signature.',
        icon: '👻',
        color: '#8b5cf6',
        stats: { speed: 80, agility: 50, armor: 45, battery: 90 },
        physics: { mass: 1.2, thrustMul: 1.8, drag: 0.03, scale: 1.1 },
        shape: 'wing'
    },
    titan: {
        id: 'titan',
        name: 'Titan Mk-IV',
        class: 'Heavy Assault',
        desc: 'Military-grade octocopter. The slowest, heaviest, and most resilient unit in the fleet.',
        icon: '🛡️',
        color: '#ef4444',
        stats: { speed: 30, agility: 15, armor: 100, battery: 35 },
        physics: { mass: 5.0, thrustMul: 3.0, drag: 0.04, scale: 1.8 },
        shape: 'octo'
    }
};
