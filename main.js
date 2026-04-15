import './style.css'

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Statically import common textures so Vite emits reliable hashed URLs
// that we can use at runtime. These provide the most deterministic
// source for TextureLoader in production builds.
import cubeTextureStatic from './assets/cubeTexture.jpg';
import moonSurfaceStatic from './assets/moonSurface.jpg';
import normalMoonStatic from './assets/normalMoon.jpeg';
import wideFireStatic from './assets/wideFire.jpeg';
import highresSpaceStatic from './assets/highresSpace.jpg';

// cube texture (separate from hero avatar)
// Texture files are resolved at runtime from the optimized folder so we can
// prefer modern formats (avif/webp) while keeping fallbacks. Do not statically
// import heavy image assets here - load them asynchronously below and attach
// them to materials when available.

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
    // Build a list of candidate URLs to try. basePath is usually like
    // './assets/optimized/highresSpace' in source, but in production Vite
    // often emits hashed files under '/assets/'. We'll try (in order):
    // 1. emitted filename via findEmittedAsset
    // 2. asset under the same assets folder as the running module
    // 3. absolute /assets/ path
    // 4. original basePath + ext
    const exts = ['.avif', '.webp', '.jpg', '.jpeg', '.png'];

    // Helper: derive assets base from the currently executing module/script
    function assetsBaseFromScript() {
        try {
            const script = document.querySelector('script[type="module"][src]');
            if (!script) return '/assets/';
            const url = new URL(script.src, location.href);
            // script.src points to .../assets/index-<hash>.js — replace last segment
            url.pathname = url.pathname.replace(/\/[^/]*$/, '/');
            return url.pathname;
        } catch (e) {
            return '/assets/';
        }
    }

    const assetsBase = assetsBaseFromScript();

    // If basePath contains 'optimized', extract the baseName (e.g. highresSpace)
    const m = /(?:\/(?:assets\/)?optimized\/|\.\/assets\/optimized\/)([A-Za-z0-9_\-]+)$/i.exec(basePath);
    const baseName = m ? m[1] : basePath.split('/').pop();

    const candidates = [];
    // prefer emitted asset (if Vite included it)
    const emitted = findEmittedAsset(baseName);
    if (emitted) candidates.push(emitted);

    // try under assetsBase (same folder as built module)
    for (const ext of exts) candidates.push(`${assetsBase}${baseName}${ext}`);

    // try absolute /assets/
    for (const ext of exts) candidates.push(`/assets/${baseName}${ext}`);

    // fallback to the original basePath variants
    for (const ext of exts) candidates.push(`${basePath}${ext}`);

    // De-duplicate while preserving order
    const seen = new Set();
    const uniq = candidates.filter(u => {
        if (!u || seen.has(u)) return false;
        seen.add(u);
        return true;
    });

    for (const url of uniq) {
        try {
            const resp = await fetch(url, { method: 'HEAD' });
            if (resp && resp.ok && resp.headers.get('content-type')?.startsWith('image')) {
                return url;
            }
        } catch (e) {
            // HEAD may be blocked; try GET
        }

        try {
            const respGet = await fetch(url, { method: 'GET' });
            if (respGet && respGet.ok && respGet.headers.get('content-type')?.startsWith('image')) {
                return url;
            }
        } catch (e) {
            // swallow and continue
        }
    }

    // last-resort: return the first unique candidate so TextureLoader attempts it
    return uniq[0] || `${basePath}.jpg`;
}

// Build a map of emitted assets (both top-level `assets/` and
// `assets/optimized/`) using import.meta.glob so we can resolve hashed
// filenames created by the bundler instead of guessing filenames at
// runtime. The mapping keys are source paths; values are final URLs.
const emittedAssets = (typeof import.meta !== 'undefined' && import.meta.glob)
    ? import.meta.glob('./assets/**/*.{avif,webp,jpg,jpeg,png}', { as: 'url', eager: true })
    : {};

// Find an emitted asset by base name. We try exact matches first, then
// fallback to substring matching so we pick up hashed filenames like
// `highresSpace-kCZFFUe8.avif` emitted by Vite.
function findEmittedAsset(baseName) {
    if (!emittedAssets) return null;
    // exact filename candidates
    const exts = ['.avif', '.webp', '.jpg', '.jpeg', '.png', '.png'];
    for (const ext of exts) {
        const key1 = `./assets/optimized/${baseName}${ext}`;
        const key2 = `./assets/${baseName}${ext}`;
        if (Object.prototype.hasOwnProperty.call(emittedAssets, key1)) return emittedAssets[key1];
        if (Object.prototype.hasOwnProperty.call(emittedAssets, key2)) return emittedAssets[key2];
    }

    // substring match (handles hashed filenames)
    for (const k of Object.keys(emittedAssets)) {
        if (k.indexOf(baseName) !== -1) return emittedAssets[k];
    }
    return null;
}

//Space (load best format available)
(async () => {
    // Prefer build-time emitted optimized asset if available.
    let spaceUrl = findEmittedAsset('highresSpace');
    if (!spaceUrl) spaceUrl = await chooseBestImage('./assets/optimized/highresSpace');
    const spaceTexture = new THREE.TextureLoader().load(spaceUrl);
    scene.background = spaceTexture;
})();
// Create placeholder meshes first, then load textures asynchronously from
// the optimized asset folder and attach them when available. This avoids
// runtime errors if a texture isn't present and gives us a place to log
// load errors for easier debugging.
const loader = new THREE.TextureLoader();

    // Small on-screen debug overlay for texture load statuses.
    function createDebugOverlay() {
        const existing = document.getElementById('texture-debug');
        if (existing) return existing;
        const box = document.createElement('div');
        box.id = 'texture-debug';
        box.innerHTML = `
            <div class="texture-line" data-name="cloud"> <span class="name">cloud</span> <span class="status">pending</span> </div>
            <div class="texture-line" data-name="moon">  <span class="name">moon</span>  <span class="status">pending</span> </div>
            <div class="texture-line" data-name="normal"> <span class="name">normal</span> <span class="status">pending</span> </div>
            <div class="texture-line" data-name="fire">   <span class="name">fire</span>   <span class="status">pending</span> </div>
            <div class="texture-line" data-name="torus">  <span class="name">torus</span>  <span class="status">pending</span> </div>
        `;
        document.body.appendChild(box);
        return box;
    }

    function updateTextureStatus(name, state, info) {
        const box = createDebugOverlay();
        const line = box.querySelector(`.texture-line[data-name="${name}"]`);
        if (!line) return;
        const statusSpan = line.querySelector('.status');
        statusSpan.textContent = state;
        line.classList.remove('loaded','error','pending');
        line.classList.add(state);
        if (info) {
            statusSpan.title = info;
        }
    }

const cloudIntel = new THREE.Mesh(
    new THREE.BoxGeometry(65,20,65),
    new THREE.MeshBasicMaterial({color: 0x888888})
);
scene.add(cloudIntel);

const jupiterObj = new THREE.Mesh(
    new THREE.SphereGeometry(24, 32, 32),
    new THREE.MeshStandardMaterial({color: 0x999999})
);
scene.add(jupiterObj);

const fireObj = new THREE.Mesh(
    new THREE.BoxGeometry(25,25,25),
    new THREE.MeshBasicMaterial({map: null})
);
scene.add(fireObj);

// Load textures (preferring optimized variants) and attach to materials.
(async () => {
    try {
    const cubeUrl = findEmittedAsset('cubeTexture') || cubeTextureStatic || await chooseBestImage('./assets/optimized/cubeTexture');
        loader.load(cubeUrl,
            tex => {
                cloudIntel.material.map = tex;
                cloudIntel.material.needsUpdate = true;
                console.log('cloud texture loaded:', cubeUrl);
                updateTextureStatus('cloud', 'loaded', cubeUrl);
            },
            undefined,
            err => {
                console.error('cloud texture load error', cubeUrl, err);
                updateTextureStatus('cloud', 'error', cubeUrl + ' — ' + String(err));
            }
        );

        // Torus (donut) texture: use an existing optimized texture file. By
        // default we apply the 'cloudIntelligence' asset, but this can be
        // changed to any other optimized asset present in `assets/optimized`.
    const torusUrl = findEmittedAsset('highresSpace') || highresSpaceStatic || await chooseBestImage('./assets/optimized/highresSpace');
        loader.load(torusUrl,
            tex => {
                if (torus && torus.material) {
                    torus.material.map = tex;
                    torus.material.needsUpdate = true;
                    console.log('torus texture loaded:', torusUrl);
                    updateTextureStatus('torus', 'loaded', torusUrl);
                }
            },
            undefined,
            err => {
                console.error('torus texture load error', torusUrl, err)
                updateTextureStatus('torus', 'error', torusUrl + ' — ' + String(err));
            }
        );

    const moonUrl = findEmittedAsset('moonSurface') || moonSurfaceStatic || await chooseBestImage('./assets/optimized/moonSurface');
        loader.load(moonUrl,
            tex => {
                jupiterObj.material.map = tex;
                jupiterObj.material.needsUpdate = true;
                console.log('moon texture loaded:', moonUrl);
                updateTextureStatus('moon', 'loaded', moonUrl);
            },
            undefined,
            err => {
                console.error('moon texture load error', moonUrl, err);
                updateTextureStatus('moon', 'error', moonUrl + ' — ' + String(err));
            }
        );

    const normalUrl = findEmittedAsset('normalMoon') || normalMoonStatic || await chooseBestImage('./assets/optimized/normalMoon');
        loader.load(normalUrl,
            tex => {
                jupiterObj.material.normalMap = tex;
                jupiterObj.material.needsUpdate = true;
                console.log('normal map loaded:', normalUrl);
                updateTextureStatus('normal', 'loaded', normalUrl);
            },
            undefined,
            err => {
                console.error('normal map load error', normalUrl, err);
                updateTextureStatus('normal', 'error', normalUrl + ' — ' + String(err));
            }
        );

    const fireUrl = findEmittedAsset('wideFire') || wideFireStatic || await chooseBestImage('./assets/optimized/wideFire');
        loader.load(fireUrl,
            tex => {
                fireObj.material.map = tex;
                fireObj.material.needsUpdate = true;
                console.log('fire texture loaded:', fireUrl);
                updateTextureStatus('fire', 'loaded', fireUrl);
            },
            undefined,
            err => {
                console.error('fire texture load error', fireUrl, err);
                updateTextureStatus('fire', 'error', fireUrl + ' — ' + String(err));
            }
        );
    } catch (e) {
        console.error('Error loading textures:', e);
    }
})();

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