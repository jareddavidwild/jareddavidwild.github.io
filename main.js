import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// Texture assets — processed by Vite's asset pipeline
import cubeTexture  from './assets/cubeTexture.jpg'
import normalMoon   from './assets/normalMoon.jpeg'
import highresSpace from './assets/sailBackground.jpg'
import cliffTexture from './assets/cliffTexture.jpg'

// ─── Three.js Background Scene ────────────────────────────────────────────

const canvas = document.querySelector('#bg')

// Guard against browsers without WebGL support
let webglAvailable = false
try {
    if (canvas) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        webglAvailable = !!gl
    }
} catch (e) {
    webglAvailable = false
}

if (webglAvailable) {
    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight)
    const renderer = new THREE.WebGLRenderer({ canvas })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.setZ(30)

    const loader = new THREE.TextureLoader()

    // Load the background once and reuse on the sphere material
    const bgTexture = loader.load(highresSpace)
    scene.background = bgTexture

    // Lighting
    const pointLight = new THREE.PointLight(0xFFFFFF)
    pointLight.position.set(-355, 355, -355)
    const ambientLight = new THREE.AmbientLight(0xe1e6ed)
    scene.add(ambientLight, pointLight)

    const controls = new OrbitControls(camera, renderer.domElement)

    // Scatter 500 stars randomly through the scene volume
    function addStar() {
        const star = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 24, 24),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        )
        const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(500))
        star.position.set(x, y, z)
        scene.add(star)
    }
    Array(500).fill().forEach(addStar)

    // Large textured cube — visible in the upper-mid background as you scroll
    const cubeObj = new THREE.Mesh(
        new THREE.BoxGeometry(65, 20, 65),
        new THREE.MeshBasicMaterial({ map: loader.load(cubeTexture) })
    )
    cubeObj.position.set(39, 50, 60)
    scene.add(cubeObj)

    // Textured sphere — deep in the scene, becomes visible on scroll
    const sphereObj = new THREE.Mesh(
        new THREE.SphereGeometry(24, 32, 32),
        new THREE.MeshStandardMaterial({
            map:       loader.load(cliffTexture),
            normalMap: loader.load(normalMoon)
        })
    )
    sphereObj.position.set(-10, 1, -100)
    scene.add(sphereObj)

    // Move the camera in 3D as the user scrolls down the page
    function moveCamera() {
        const t = document.body.getBoundingClientRect().top
        camera.position.z = t * -0.01
        camera.position.x = t * -0.035
        camera.position.y = t * -0.025
    }
    document.body.onscroll = moveCamera

    // Main render loop
    function animate() {
        requestAnimationFrame(animate)
        sphereObj.rotation.y += 0.01
        cubeObj.rotation.y   += 0.01
        controls.update()
        renderer.render(scene, camera)
    }
    animate()
} else {
    // Hide the canvas placeholder when WebGL is unavailable
    if (canvas) canvas.style.display = 'none'
}

// ─── Stat Counter Animation ───────────────────────────────────────────────

// Counts a number element from 0 to its data-target value over `duration` ms.
// Appends data-suffix (e.g. "+") once the count reaches the target.
function animateNumber(el, target, duration = 1200) {
    const suffix = el.getAttribute('data-suffix') || ''
    const start  = performance.now()
    function step(now) {
        const t   = Math.min((now - start) / duration, 1)
        const val = Math.floor(target * t)
        el.textContent = val.toLocaleString() + (t >= 1 ? suffix : '')
        if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
}

// Trigger counters only when the stats block enters the viewport
const statsBlock = document.querySelector('.stats')
if (statsBlock && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                statsBlock.querySelectorAll('.stat-number').forEach(n =>
                    animateNumber(n, parseInt(n.getAttribute('data-target') || '0', 10))
                )
                obs.disconnect()
            }
        })
    }, { threshold: 0.4 })
    observer.observe(statsBlock)
} else if (statsBlock) {
    // Fallback for browsers without IntersectionObserver
    statsBlock.querySelectorAll('.stat-number').forEach(n =>
        animateNumber(n, parseInt(n.getAttribute('data-target') || '0', 10))
    )
}

// ─── Button Ripple Effect ─────────────────────────────────────────────────

// Creates a circular ripple that expands from the click point and removes itself
function bindButtonRipples() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const rect   = this.getBoundingClientRect()
            const size   = Math.max(rect.width, rect.height) * 1.2
            const ripple = document.createElement('span')
            ripple.className     = 'ripple'
            ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`
            this.appendChild(ripple)
            ripple.addEventListener('animationend', () => ripple.remove())
        })
    })
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtonRipples)
} else {
    bindButtonRipples()
}
