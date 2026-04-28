import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.init();
    }

    init() {
        // 1. Sky and Fog
        // Dark night sky (solid dark blue/black)
        this.scene.background = new THREE.Color(0x05050a);
        // Dark fog: starts at 100, full at 400
        this.scene.fog = new THREE.Fog(0x05050a, 100, 400);

        // 2. Lights
        // Dim ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambientLight);

        // Directional light from above
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        const d = 100;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        this.scene.add(dirLight);

        // 3. Grid Floor (dark with neon cyan lines)
        const gridSize = 500;
        const gridDivisions = 50;
        // The floor plane to catch shadows
        const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a0f,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // The neon grid helper
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00f5ff, 0x004455);
        gridHelper.position.y = 0.1; // slightly above floor to avoid z-fighting
        this.scene.add(gridHelper);

        // 4. Buildings
        this.createCity();
    }

    createCity() {
        // 15-20 box-geometry buildings in a grid pattern
        const numBuildings = 20;
        const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Material with emissive dark/neon color to fake glowing windows
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x111115,
            roughness: 0.7,
            metalness: 0.3,
            emissive: 0x002233,
            emissiveIntensity: 0.5
        });

        const gridSize = 200;
        
        for (let i = 0; i < numBuildings; i++) {
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            // Random dimensions
            const width = 10 + Math.random() * 15;
            const depth = 10 + Math.random() * 15;
            const height = 20 + Math.random() * 60; // Random height between 20 and 80
            
            building.scale.set(width, height, depth);
            
            // Random position within the grid, snapped somewhat to a grid
            const x = (Math.random() - 0.5) * gridSize;
            const z = (Math.random() - 0.5) * gridSize;
            
            // Ensure buildings aren't spawned exactly at the origin (0,0) where the drone starts
            if (Math.abs(x) < 20 && Math.abs(z) < 20) {
                building.position.set(x + 30, height / 2, z + 30);
            } else {
                building.position.set(x, height / 2, z);
            }
            
            building.castShadow = true;
            building.receiveShadow = true;
            
            this.scene.add(building);
            this.buildings.push(building);
        }
    }

    update(deltaTime) {
        // Any environmental animations can go here
    }
}
