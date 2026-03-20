import './style.css'

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// cube texture (separate from hero avatar)
import cubeTexture from './assets/cubeTexture.jpg';
// We'll choose the best available image format at runtime (avif -> webp -> jpg/jpeg)
// using a small fetch probe. This allows the build to include modern formats
// when available while keeping fallbacks.
import moon from './assets/moonSurface.jpg';
import normal from './assets/normalMoon.jpeg';

// Check WebGL availability. If unavailable (headless browsers, restricted contexts),
// skip initializing Three.js to avoid runtime errors.
const canvas = document.querySelector('#bg');
let _webglAvailable = false;
try {
    if (canvas) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        _webglAvailable = !!gl;
    }
} catch (e) {
    _webglAvailable = false;
}

if (_webglAvailable) {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);

    const renderer = new THREE.WebGLRenderer({ canvas });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.setZ(30);

    renderer.render(scene, camera);

    const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
    const material = new THREE.MeshStandardMaterial({ color: 0xFF6347});
    const torus = new THREE.Mesh(geometry, material);

    scene.add(torus);

    const pointLight = new THREE.PointLight(0xFFFFFF);
    pointLight.position.set(-355,355,-355);

    const ambientLight = new THREE.AmbientLight(0xe1e6ed);
    scene.add(ambientLight, pointLight);

    /*const lightHelper = new THREE.PointLightHelper(pointLight);
    const gridHelper = new THREE.GridHelper(200, 50);
    scene.add(gridHelper);*/

    const controls = new OrbitControls(camera, renderer.domElement);

    function addStar() {
        const geometry = new THREE.SphereGeometry(0.25, 24, 24);
        const material = new THREE.MeshStandardMaterial({color:0xffffff});
        const star = new THREE.Mesh(geometry, material);

        const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(500));

        star.position.set(x, y, z);
        scene.add(star);
    }
    Array(500).fill().forEach(addStar);
// Helper: probe for best image variant. Attempts .avif, .webp, then provided fallback.
async function chooseBestImage(basePath) {
    const exts = ['.avif', '.webp', '.jpg', '.jpeg'];
    for (const ext of exts) {
        const url = `${basePath}${ext}`;
        // Try HEAD first (cheap on servers that support it)
        try {
            const resp = await fetch(url, { method: 'HEAD' });
            if (resp && resp.ok && resp.headers.get('content-type')?.startsWith('image')) {
                return url;
            }
        } catch (e) {
            // HEAD may be blocked by some hosts — fall through to a GET probe below
        }

        // HEAD didn't work or wasn't acceptable; try a GET probe (we won't read the body)
        try {
            const respGet = await fetch(url, { method: 'GET' });
            if (respGet && respGet.ok && respGet.headers.get('content-type')?.startsWith('image')) {
                return url;
            }
        } catch (e) {
            // ignore and try next
        }
    }

    // as a final fallback, return the jpg
    return `${basePath}.jpg`;
}

//Space (load best format available)
(async () => {
    const spaceUrl = await chooseBestImage('./assets/optimized/highresSpace');
    const spaceTexture = new THREE.TextureLoader().load(spaceUrl);
    scene.background = spaceTexture;
})();
// Cube (use a separate cube texture so hero avatar is not applied to the 3D cube)
const cloudTexture = new THREE.TextureLoader().load(cubeTexture)
const cloudIntel = new THREE.Mesh(
    new THREE.BoxGeometry(65,20,65),
    new THREE.MeshBasicMaterial({map: cloudTexture})
);

scene.add(cloudIntel);

const moonTexture = new THREE.TextureLoader().load(moon)
const normalTexture = new THREE.TextureLoader().load(normal)

const jupiterObj = new THREE.Mesh(
    new THREE.SphereGeometry(24, 32, 32),
    new THREE.MeshStandardMaterial({map: moonTexture,
    normalMap: normalTexture})
);

scene.add(jupiterObj);

// fire texture: prefer optimized variants if present
let fireTextureUrl = './assets/optimized/wideFire';
(async () => {
    fireTextureUrl = await chooseBestImage('./assets/optimized/wideFire');
    const fireTexture = new THREE.TextureLoader().load(fireTextureUrl);
    fireObj.material.map = fireTexture;
})();
const fireObj = new THREE.Mesh(
    new THREE.BoxGeometry(25,25,25),
    new THREE.MeshBasicMaterial({map: null})
);

scene.add(fireObj);

cloudIntel.position.z = 60;
cloudIntel.position.x = 39;
cloudIntel.position.y = 50;
jupiterObj.position.z = -100;
jupiterObj.position.y = 1;
jupiterObj.position.x = -10;
fireObj.position.z = -30;
fireObj.position.x = 40;

function moveCamera() {
    const t = document.body.getBoundingClientRect().top;
    cloudIntel.rotation.x += 0.05;
    cloudIntel.rotation.y += 0.075;
    cloudIntel.rotation.z += 0.05;

    jupiterObj.rotation.y += 0.01;

    fireObj.rotation.x += 0.01;
    fireObj.rotation.y += 0.015;
    fireObj.rotation.z += 0.01;

    camera.position.z = t * -0.01;
    camera.position.x = t * -0.035;
    camera.position.y = t * -0.025;
}

document.body.onscroll = moveCamera;

function animate() {
    requestAnimationFrame(animate);

    torus.rotation.x += 0.01;
    torus.rotation.y += 0.005;
    torus.rotation.z += 0.01;
    jupiterObj.rotation.y += 0.01;
    cloudIntel.rotation.y += 0.01;

    controls.update();

    renderer.render(scene, camera);
}

animate();

    // end Three.js block
} else {
    // WebGL not available: hide the canvas to avoid visual noise
    if (canvas) canvas.style.display = 'none';
}

// Simple stat counter: animate numbers when the stats block becomes visible
function animateNumber(el, target, duration = 1200) {
    const start = performance.now();
    const from = 0;
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const val = Math.floor(from + (target - from) * t);
        el.textContent = val;
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

const statsBlock = document.querySelector('.stats');
if (statsBlock && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const numbers = statsBlock.querySelectorAll('.stat-number');
                numbers.forEach(n => {
                    const target = parseInt(n.getAttribute('data-target') || '0', 10);
                    animateNumber(n, target, 1200 + Math.random() * 600);
                });
                obs.disconnect();
            }
        });
    }, { threshold: 0.4 });
    observer.observe(statsBlock);
} else if (statsBlock) {
    // fallback: run immediately
    statsBlock.querySelectorAll('.stat-number').forEach(n => {
        const target = parseInt(n.getAttribute('data-target') || '0', 10);
        animateNumber(n, target, 1200);
    });
}

// Ripple effect for buttons: create and remove a ripple span at click position
function bindButtonRipples() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.2;
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            this.appendChild(ripple);

            ripple.addEventListener('animationend', () => ripple.remove());
        });
    });
}

// initialize ripples after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtonRipples);
} else {
    bindButtonRipples();
}