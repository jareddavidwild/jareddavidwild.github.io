import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import cubeTexture from './assets/cubeTexture.jpg'
import moonSurface from './assets/moonSurface.jpg'
import normalMoon from './assets/normalMoon.jpeg'
import wideFire from './assets/wideFire.jpeg'
import highresSpace from './assets/highresSpace.jpg'

const canvas = document.querySelector('#bg')
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
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight)
    const renderer = new THREE.WebGLRenderer({ canvas })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.setZ(30)
    renderer.render(scene, camera)

    const loader = new THREE.TextureLoader()

    scene.background = loader.load(highresSpace)

    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(10, 3, 16, 100),
        new THREE.MeshStandardMaterial({ color: 0xFF6347, map: loader.load(highresSpace) })
    )
    scene.add(torus)

    const pointLight = new THREE.PointLight(0xFFFFFF)
    pointLight.position.set(-355, 355, -355)
    const ambientLight = new THREE.AmbientLight(0xe1e6ed)
    scene.add(ambientLight, pointLight)

    const controls = new OrbitControls(camera, renderer.domElement)

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

    const cloudIntel = new THREE.Mesh(
        new THREE.BoxGeometry(65, 20, 65),
        new THREE.MeshBasicMaterial({ map: loader.load(cubeTexture) })
    )
    cloudIntel.position.set(39, 50, 60)
    scene.add(cloudIntel)

    const jupiterObj = new THREE.Mesh(
        new THREE.SphereGeometry(24, 32, 32),
        new THREE.MeshStandardMaterial({
            map: loader.load(moonSurface),
            normalMap: loader.load(normalMoon)
        })
    )
    jupiterObj.position.set(-10, 1, -100)
    scene.add(jupiterObj)

    const fireObj = new THREE.Mesh(
        new THREE.BoxGeometry(25, 25, 25),
        new THREE.MeshBasicMaterial({ map: loader.load(wideFire) })
    )
    fireObj.position.set(40, 0, -30)
    scene.add(fireObj)

    function moveCamera() {
        const t = document.body.getBoundingClientRect().top
        cloudIntel.rotation.x += 0.05
        cloudIntel.rotation.y += 0.075
        cloudIntel.rotation.z += 0.05
        jupiterObj.rotation.y += 0.01
        fireObj.rotation.x += 0.01
        fireObj.rotation.y += 0.015
        fireObj.rotation.z += 0.01
        camera.position.z = t * -0.01
        camera.position.x = t * -0.035
        camera.position.y = t * -0.025
    }
    document.body.onscroll = moveCamera

    function animate() {
        requestAnimationFrame(animate)
        torus.rotation.x += 0.01
        torus.rotation.y += 0.005
        torus.rotation.z += 0.01
        jupiterObj.rotation.y += 0.01
        cloudIntel.rotation.y += 0.01
        controls.update()
        renderer.render(scene, camera)
    }
    animate()
} else {
    if (canvas) canvas.style.display = 'none'
}

// Animate stat counters when scrolled into view
function animateNumber(el, target, duration = 1200) {
    const start = performance.now()
    function step(now) {
        const t = Math.min((now - start) / duration, 1)
        el.textContent = Math.floor(target * t)
        if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
}

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
    statsBlock.querySelectorAll('.stat-number').forEach(n =>
        animateNumber(n, parseInt(n.getAttribute('data-target') || '0', 10))
    )
}

// Button ripple effect
function bindButtonRipples() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect()
            const size = Math.max(rect.width, rect.height) * 1.2
            const ripple = document.createElement('span')
            ripple.className = 'ripple'
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
