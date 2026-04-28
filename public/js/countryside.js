import * as THREE from 'three';

export class Countryside {
    constructor(scene) {
        this.scene = scene;
        this.buildings = []; // No collision buildings in freefly for now
        this.init();
    }

    init() {
        // Sunset sky background
        this.scene.background = new THREE.Color(0xff7744);
        this.scene.fog = new THREE.FogExp2(0xff7744, 0.002);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffaa55, 0x443355, 0.6);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffddaa, 1.5);
        dirLight.position.set(-100, 50, -100);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 80;
        dirLight.shadow.camera.bottom = -80;
        dirLight.shadow.camera.left = -80;
        dirLight.shadow.camera.right = 80;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        // Rolling hills terrain
        const planeGeom = new THREE.PlaneGeometry(1000, 1000, 64, 64);
        planeGeom.rotateX(-Math.PI / 2);
        
        const pos = planeGeom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            
            // Perlin-like hills using sin/cos
            let y = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 20;
            y += Math.sin(x * 0.03) * Math.cos(z * 0.02) * 5;
            
            // River depression
            const riverDist = Math.abs(x + Math.sin(z * 0.01) * 50);
            if (riverDist < 30) {
                y -= (30 - riverDist) * 0.5;
            }

            pos.setY(i, y);
        }
        planeGeom.computeVertexNormals();

        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x2d4c1e,
            roughness: 0.8,
            metalness: 0.1
        });

        const terrain = new THREE.Mesh(planeGeom, planeMat);
        terrain.receiveShadow = true;
        this.scene.add(terrain);

        // River water
        const waterGeom = new THREE.PlaneGeometry(500, 500);
        waterGeom.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.8
        });
        const water = new THREE.Mesh(waterGeom, waterMat);
        water.position.y = -5; // Base water level
        this.scene.add(water);

        // Instanced trees
        this.createTrees(planeGeom);
    }

    createTrees(terrainGeom) {
        const treeCount = 300;
        const trunkGeom = new THREE.CylinderGeometry(0.5, 0.8, 4, 8);
        trunkGeom.translate(0, 2, 0);
        const leavesGeom = new THREE.ConeGeometry(3, 8, 8);
        leavesGeom.translate(0, 8, 0);

        const treeGeom = new THREE.BufferGeometry();
        
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1f3d0c });

        const trunkMesh = new THREE.InstancedMesh(trunkGeom, trunkMat, treeCount);
        const leavesMesh = new THREE.InstancedMesh(leavesGeom, leavesMat, treeCount);

        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        leavesMesh.castShadow = true;
        leavesMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const posAttr = terrainGeom.attributes.position;
        let count = 0;
        
        this.treePositions = [];

        for (let i = 0; i < treeCount; i++) {
            const idx = Math.floor(Math.random() * posAttr.count);
            const x = posAttr.getX(idx);
            const y = posAttr.getY(idx);
            const z = posAttr.getZ(idx);

            // Don't place trees in water or on steep hills
            if (y > -2 && y < 15) {
                dummy.position.set(x, y, z);
                
                // random scale
                const scale = 0.5 + Math.random() * 1.5;
                dummy.scale.set(scale, scale, scale);
                dummy.rotation.y = Math.random() * Math.PI * 2;
                dummy.updateMatrix();

                trunkMesh.setMatrixAt(count, dummy.matrix);
                leavesMesh.setMatrixAt(count, dummy.matrix);
                
                this.treePositions.push({ x, y, z, scale });
                count++;
            }
        }

        trunkMesh.count = count;
        leavesMesh.count = count;

        this.scene.add(trunkMesh);
        this.scene.add(leavesMesh);
    }
    
    getGroundHeight(x, z) {
        let y = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 20;
        y += Math.sin(x * 0.03) * Math.cos(z * 0.02) * 5;
        const riverDist = Math.abs(x + Math.sin(z * 0.01) * 50);
        if (riverDist < 30) {
            y -= (30 - riverDist) * 0.5;
        }
        return Math.max(y, -5); // Solid water surface
    }

    checkCollision(box) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        for (let t of this.treePositions) {
            const dx = center.x - t.x;
            const dz = center.z - t.z;
            const distSq = dx * dx + dz * dz;
            
            // Tree max radius is ~3. So radiusSq = 9 * scale^2. Height is ~12 * scale.
            const radiusSq = 9 * t.scale * t.scale;
            if (distSq < radiusSq && center.y >= t.y && center.y <= t.y + (12 * t.scale)) {
                return true;
            }
        }
        return false;
    }

    update(deltaTime) {
        // Any animations (e.g. water texture shifting) can go here
    }
}
