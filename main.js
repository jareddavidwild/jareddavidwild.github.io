import './style.css'

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

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
// Create placeholder meshes first, then load textures asynchronously from
// the optimized asset folder and attach them when available. This avoids
// runtime errors if a texture isn't present and gives us a place to log
// load errors for easier debugging.
const loader = new THREE.TextureLoader();

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
        const cubeUrl = await chooseBestImage('./assets/optimized/cubeTexture');
        loader.load(cubeUrl,
            tex => {
                cloudIntel.material.map = tex;
                cloudIntel.material.needsUpdate = true;
                console.log('cloud texture loaded:', cubeUrl);
            },
            undefined,
            err => console.error('cloud texture load error', err)
        );

        // Torus (donut) texture: use an existing optimized texture file. By
        // default we apply the 'cloudIntelligence' asset, but this can be
        // changed to any other optimized asset present in `assets/optimized`.
        const torusUrl = await chooseBestImage('./assets/optimized/cloudIntelligence');
        loader.load(torusUrl,
            tex => {
                if (torus && torus.material) {
                    torus.material.map = tex;
                    torus.material.needsUpdate = true;
                    console.log('torus texture loaded:', torusUrl);
                }
            },
            undefined,
            err => console.error('torus texture load error', err)
        );

        const moonUrl = await chooseBestImage('./assets/optimized/moonSurface');
        loader.load(moonUrl,
            tex => {
                jupiterObj.material.map = tex;
                jupiterObj.material.needsUpdate = true;
                console.log('moon texture loaded:', moonUrl);
            },
            undefined,
            err => console.error('moon texture load error', err)
        );

        const normalUrl = await chooseBestImage('./assets/optimized/normalMoon');
        loader.load(normalUrl,
            tex => {
                jupiterObj.material.normalMap = tex;
                jupiterObj.material.needsUpdate = true;
                console.log('normal map loaded:', normalUrl);
            },
            undefined,
            err => console.error('normal map load error', err)
        );

        const fireUrl = await chooseBestImage('./assets/optimized/wideFire');
        loader.load(fireUrl,
            tex => {
                fireObj.material.map = tex;
                fireObj.material.needsUpdate = true;
                console.log('fire texture loaded:', fireUrl);
            },
            undefined,
            err => console.error('fire texture load error', err)
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