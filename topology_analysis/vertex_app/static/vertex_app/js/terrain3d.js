// static/vertex_app/js/terrain3d.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class TerrainViewer {
    constructor() {
        this.container = document.getElementById('terrain3d');
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.width/this.height, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.setupScene();
        this.loadTerrain();
        this.animate();
    }

    setupScene() {
        this.camera.position.set(50, 50, 50);
        this.scene.add(new THREE.DirectionalLight(0xffffff, 1));
        this.scene.add(new THREE.AmbientLight(0x404040));
        this.scene.background = new THREE.Color(0x222222);
    }

    loadTerrain() {
        fetch('/get-terrain-points/')
            .then(response => response.json())
            .then(data => {
                if (data.points && data.points.length > 0) {
                    const geometry = new THREE.BufferGeometry();
                    const vertices = new Float32Array(data.points.length * 3);
                    const colors = new Float32Array(data.points.length * 3);

                    // Normalisation des coordonnées
                    const xValues = data.points.map(p => p.x);
                    const yValues = data.points.map(p => p.y);
                    const zValues = data.points.map(p => p.z);
                    const minX = Math.min(...xValues);
                    const maxX = Math.max(...xValues);
                    const minY = Math.min(...yValues);
                    const maxY = Math.max(...yValues);
                    const minZ = Math.min(...zValues);
                    const maxZ = Math.max(...zValues);

                    data.points.forEach((point, i) => {
                        // Normalisation des coordonnées sur une échelle -50 à 50
                        const x = ((point.x - minX) / (maxX - minX) - 0.5) * 100;
                        const y = ((point.y - minY) / (maxY - minY) - 0.5) * 100;
                        const z = ((point.z - minZ) / (maxZ - minZ)) * 20;

                        vertices[i * 3] = x;
                        vertices[i * 3 + 1] = z;  // L'altitude devient la hauteur en Y
                        vertices[i * 3 + 2] = y;

                        // Couleur basée sur l'altitude
                        const heightColor = new THREE.Color().setHSL(
                            0.6 - (z/20) * 0.4, // Bleu à rouge
                            0.7,
                            0.5 + (z/20) * 0.3
                        );
                        
                        colors[i * 3] = heightColor.r;
                        colors[i * 3 + 1] = heightColor.g;
                        colors[i * 3 + 2] = heightColor.b;
                    });

                    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                    const material = new THREE.PointsMaterial({
                        size: 0.5,
                        vertexColors: true
                    });

                    const points = new THREE.Points(geometry, material);
                    this.scene.add(points);
                }
            });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialiser la vue 3D
const viewer = new TerrainViewer();

// Gérer le redimensionnement
window.addEventListener('resize', () => {
    const width = viewer.container.clientWidth;
    const height = viewer.container.clientHeight;
    viewer.camera.aspect = width / height;
    viewer.camera.updateProjectionMatrix();
    viewer.renderer.setSize(width, height);
});