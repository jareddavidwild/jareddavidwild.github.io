import './style.css'

import * as THREE from 'three'

// ─── Three.js Ocean Scene ─────────────────────────────────────────────────
// Camera sits at (0,0,30) looking toward -Z.
// Scroll drives the camera forward into -Z (diving through the ocean).
// All objects are spread along Z depth so they come into view as you scroll.

const canvas = document.querySelector('#bg')

// Let Three.js create the WebGL context itself so it gets the correct attributes
// (alpha: true, antialias: true). Pre-calling canvas.getContext() would lock in
// the wrong attributes and break transparency compositing.
let renderer
try {
    if (canvas) {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    }
} catch (e) {
    console.error('THREE.WebGLRenderer failed to initialise:', e)
    // Canvas stays hidden at opacity:0 (its CSS default) — sailboat photo shows as fallback
}

if (renderer) {
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500)
    camera.position.set(0, 0, 30)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })

    scene.fog = new THREE.FogExp2(0x2a6080, 0.008)

    scene.add(new THREE.AmbientLight(0x0d2244, 3))
    const sun = new THREE.DirectionalLight(0x3377bb, 4)
    sun.position.set(10, 80, 0)
    scene.add(sun)

    // Single point light that follows the camera — simulates a diver's torch.
    // One moving light costs far less than 7+ static point lights scattered around the scene.
    const camLight = new THREE.PointLight(0x4499cc, 2.2, 110)
    scene.add(camLight)

    // ── Procedural wave normal map ─────────────────────────────────────────
    // Generates a DataTexture by layering three sine/cosine waves at different
    // frequencies, producing an organic rippled-water bump pattern.
    function createWaveNormalMap(size = 256) {
        const data = new Uint8Array(size * size * 4)
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const idx = (row * size + col) * 4
                const u   = col / size * Math.PI * 10
                const v   = row / size * Math.PI * 10
                const nx  = Math.sin(u) * 0.50 + Math.sin(u * 2.3 + 1.1) * 0.28 + Math.sin(u * 0.5) * 0.22
                const ny  = Math.cos(v * 0.9) * 0.50 + Math.cos(v * 1.8 + 0.9) * 0.28 + Math.cos(v * 0.4) * 0.22
                data[idx]     = Math.floor((nx * 0.38 + 0.5) * 255)
                data[idx + 1] = Math.floor((ny * 0.38 + 0.5) * 255)
                data[idx + 2] = 210
                data[idx + 3] = 255
            }
        }
        const tex = new THREE.DataTexture(data, size, size)
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(8, 8)
        tex.needsUpdate = true
        return tex
    }

    // Two separate instances so we can animate the water surface UV offset
    // without affecting the static normal maps on floor / coral / jellyfish.
    const normalTex      = createWaveNormalMap()  // shared static surfaces
    const waterNormalTex = createWaveNormalMap()  // water surface only (UV animated)

    // ── God-ray shafts ─────────────────────────────────────────────────────
    const godRays = []
    for (let i = 0; i < 5; i++) {
        const shaft = new THREE.Mesh(
            new THREE.ConeGeometry(18 + Math.random() * 14, 240, 5, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x4488bb, transparent: true,
                opacity: 0.03 + Math.random() * 0.025, side: THREE.DoubleSide,
                depthWrite: false
            })
        )
        shaft.position.set(
            (Math.random() - 0.5) * 100,
            90,
            -(i * 60 + Math.random() * 30)
        )
        shaft.rotation.z        = (Math.random() - 0.5) * 0.25
        shaft.userData.baseOpac = shaft.material.opacity
        shaft.userData.phase    = Math.random() * Math.PI * 2
        scene.add(shaft)
        godRays.push(shaft)
    }

    // ── Water surface — translucent plane, normal map scrolls to fake ripple ──
    const waterSurface = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshPhongMaterial({
            color: 0x1a3a5c, transparent: true, opacity: 0.18,
            side: THREE.DoubleSide, shininess: 200,
            normalMap: waterNormalTex, normalScale: new THREE.Vector2(0.5, 0.5)
        })
    )
    waterSurface.rotation.x = -Math.PI / 2
    waterSurface.position.set(0, 14, -150)
    scene.add(waterSurface)

    // ── Circular soft-edged sprite (avoids the default square PointsMaterial) ──
    // Drawn on a small offscreen canvas, converted to a CanvasTexture.
    // The radial gradient fades to transparent so particles look like glowing orbs.
    function makeCircleSprite(innerSize = 64) {
        const c   = document.createElement('canvas')
        c.width   = c.height = innerSize
        const ctx = c.getContext('2d')
        const g   = ctx.createRadialGradient(innerSize / 2, innerSize / 2, 0, innerSize / 2, innerSize / 2, innerSize / 2)
        g.addColorStop(0,    'rgba(255,255,255,1)')
        g.addColorStop(0.42, 'rgba(255,255,255,0.65)')
        g.addColorStop(1,    'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, innerSize, innerSize)
        return new THREE.CanvasTexture(c)
    }
    const circleTex = makeCircleSprite()

    // ── Particles — fine plankton + large glowing orbs ─────────────────────
    function makeParticleCloud(count, size, color, opacity, zRange, spread) {
        const pos = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            pos[i * 3]     = (Math.random() - 0.5) * spread
            pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.75
            pos[i * 3 + 2] = -(Math.random() * zRange)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        return new THREE.Points(geo, new THREE.PointsMaterial({
            color, size, transparent: true, opacity,
            map: circleTex, alphaTest: 0.008, depthWrite: false
        }))
    }

    const plankton  = makeParticleCloud(2200, 1.5, 0x88c4e8, 0.55, 700, 250)
    const glowOrbs  = makeParticleCloud(  50, 5.5, 0xd0a0ff, 0.30, 600, 180)
    scene.add(plankton)
    scene.add(glowOrbs)

    // ── Marine snow — fine white particles drifting slowly downward ────────
    // Gives the "stuff floating in water" feel that makes underwater scenes convincing.
    const snowCount = 700
    const snowPos   = new Float32Array(snowCount * 3)
    for (let i = 0; i < snowCount; i++) {
        snowPos[i * 3]     = (Math.random() - 0.5) * 320
        snowPos[i * 3 + 1] = (Math.random() - 0.5) * 260
        snowPos[i * 3 + 2] = -(Math.random() * 700)
    }
    const snowGeo = new THREE.BufferGeometry()
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
        color: 0xe8eef8, size: 0.7, transparent: true, opacity: 0.40,
        map: circleTex, alphaTest: 0.01, depthWrite: false
    }))
    scene.add(snow)

    // ── Bubbles ────────────────────────────────────────────────────────────
    const sharedBubbleMat = new THREE.MeshBasicMaterial({
        color: 0xaadcff, transparent: true, opacity: 0.22, depthWrite: false
    })
    const sharedBubbleGeo = new THREE.SphereGeometry(1, 5, 4)
    const bubbles = Array.from({ length: 28 }, () => {
        const b = new THREE.Mesh(sharedBubbleGeo, sharedBubbleMat)
        b.scale.setScalar(0.4 + Math.random() * 0.9)
        b.position.set(
            (Math.random() - 0.5) * 160,
            (Math.random() - 0.5) * 100,
            -(Math.random() * 400)
        )
        b.userData.speed = 0.04 + Math.random() * 0.06
        b.userData.drift = (Math.random() - 0.5) * 0.012
        scene.add(b)
        return b
    })

    // ── Jellyfish — bell + tendrils + additive glow (no PointLight) ──────────
    // PointLights were the #1 perf killer — each one forces a lighting pass over
    // every mesh in a 35-unit radius. Replaced with a cheap additive-blend sphere.
    const bellPts = [
        new THREE.Vector2(0.0,  5.5),
        new THREE.Vector2(1.2,  5.2),
        new THREE.Vector2(3.2,  4.4),
        new THREE.Vector2(5.0,  2.8),
        new THREE.Vector2(6.2,  1.2),
        new THREE.Vector2(6.6,  0.0),
        new THREE.Vector2(6.2, -0.6),
        new THREE.Vector2(5.2, -1.4),
        new THREE.Vector2(3.8, -1.9),
    ]
    const sharedBellGeo   = new THREE.LatheGeometry(bellPts, 20)
    const sharedTendrilMat = new THREE.MeshBasicMaterial({ color: 0xd8b8f0, transparent: true, opacity: 0.35, depthWrite: false })
    const sharedArmMat     = new THREE.MeshBasicMaterial({ color: 0xe0b8f0, transparent: true, opacity: 0.45, depthWrite: false })

    function makeJellyfish(x, y, z) {
        const group = new THREE.Group()

        group.add(new THREE.Mesh(
            sharedBellGeo,
            new THREE.MeshPhongMaterial({
                color: 0xc090c8, transparent: true, opacity: 0.52,
                side: THREE.DoubleSide, shininess: 120,
                normalMap: normalTex, normalScale: new THREE.Vector2(0.3, 0.3)
            })
        ))

        // Inner glow dome
        group.add(new THREE.Mesh(
            new THREE.SphereGeometry(4.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
            new THREE.MeshBasicMaterial({ color: 0xf0c0f8, transparent: true, opacity: 0.15, side: THREE.BackSide, depthWrite: false })
        ))

        // Oral arms — 2 central tendrils (was 4)
        for (let i = 0; i < 2; i++) {
            const a   = (i / 2) * Math.PI * 2
            const len = 12 + Math.random() * 6
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.06, len, 5), sharedArmMat)
            arm.position.set(Math.cos(a) * 1.8, -len / 2 - 1, Math.sin(a) * 1.8)
            group.add(arm)
        }

        // Outer tendrils — 8 filaments (was 16)
        for (let i = 0; i < 8; i++) {
            const a   = (i / 8) * Math.PI * 2
            const len = 14 + Math.random() * 12
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.01, len, 3), sharedTendrilMat)
            rod.position.set(Math.cos(a) * 5.5, -len / 2 - 0.8, Math.sin(a) * 5.5)
            group.add(rod)
        }

        // Additive glow — visually similar to a point light, costs nothing for other meshes
        const glowMesh = new THREE.Mesh(
            new THREE.SphereGeometry(4, 7, 5),
            new THREE.MeshBasicMaterial({
                color: 0xd090d0, transparent: true, opacity: 0.2,
                blending: THREE.AdditiveBlending, depthWrite: false
            })
        )
        glowMesh.position.set(0, 1, 0)
        group.add(glowMesh)

        group.userData = { glowMesh, phase: Math.random() * Math.PI * 2, bobSpeed: 0.22 + Math.random() * 0.25, baseY: y }
        group.position.set(x, y, z)
        scene.add(group)
        return group
    }

    const jellyfish = [
        makeJellyfish(-15,  2,  -20),
        makeJellyfish( 22, -4,  -65),
        makeJellyfish(-28,  8, -120),
        makeJellyfish( 18, -8, -185),
        makeJellyfish(-22,  4, -260),
        makeJellyfish( 30, -5, -330),
        makeJellyfish(-18,  6, -400),
    ]

    // ── Terrain helpers ────────────────────────────────────────────────────
    function smoothstep(lo, hi, x) {
        const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
        return t * t * (3 - 2 * t)
    }
    // Layered sine noise — produces organic undulating sea-bed heights
    function terrainH(x, z) {
        return (
            Math.sin(x * 0.030 + 0.9) * 15 +
            Math.sin(z * 0.026 + 2.0) * 11 +
            Math.sin((x + z) * 0.054 + 0.4) * 6 +
            Math.sin(x * 0.14 - z * 0.11 + 1.5) * 3.5 +
            Math.cos(x * 0.38 + z * 0.32 + 0.2) * 1.3
        )
    }

    const coralCols = [0x7a3060, 0x986195, 0x5a2050, 0x8f4080, 0xc05080]

    // ── Elevated coral shelf (3000 wide so X-edges are always beyond fog) ───
    // Near edge z≈-175, far edge z≈-335. Camera travels through this zone.
    const SHELF_Y = -46
    const SHELF_Z = -255

    const shelfGeo = new THREE.PlaneGeometry(3000, 160, 50, 14)
    shelfGeo.rotateX(-Math.PI / 2)
    ;(function () {
        const sv = shelfGeo.attributes.position
        for (let i = 0; i < sv.count; i++) {
            sv.setY(i,
                Math.sin(sv.getX(i) * 0.065 + sv.getZ(i) * 0.045) * 2.8 +
                Math.sin(sv.getX(i) * 0.17  + 0.3) * 1.3 +
                Math.sin(sv.getZ(i) * 0.11  + 1.1) * 0.9
            )
        }
        shelfGeo.computeVertexNormals()
    })()
    const shelfMesh = new THREE.Mesh(shelfGeo, new THREE.MeshLambertMaterial({ color: 0x111228 }))
    shelfMesh.position.set(0, SHELF_Y, SHELF_Z)
    scene.add(shelfMesh)

    // ── Cliff face ────────────────────────────────────────────────────────
    const CLIFF_Z  = -342
    const CLIFF_H  = 30
    const cliffGeo = new THREE.PlaneGeometry(3000, CLIFF_H, 30, 6)
    ;(function () {
        const cv = cliffGeo.attributes.position
        for (let i = 0; i < cv.count; i++) {
            cv.setZ(i,
                Math.sin(cv.getX(i) * 0.045 + cv.getY(i) * 0.13) * 3.5 +
                Math.sin(cv.getX(i) * 0.19  - cv.getY(i) * 0.09) * 1.8
            )
        }
        cliffGeo.computeVertexNormals()
    })()
    const cliffMesh = new THREE.Mesh(cliffGeo, new THREE.MeshLambertMaterial({ color: 0x0b0a1c, side: THREE.DoubleSide }))
    cliffMesh.position.set(0, SHELF_Y - CLIFF_H / 2, CLIFF_Z)
    scene.add(cliffMesh)

    // ── Valley floor — 3000 wide, 700 deep, centred at z=-700 ─────────────
    // Near edge z≈-350, far edge z≈-1050. Camera (max z=-490) is always well
    // inside the Z range, so no far-edge cliff is ever visible.
    const VALLEY_Y = -68
    const VALLEY_Z = -700

    const valGeo = new THREE.PlaneGeometry(3000, 700, 60, 35)
    valGeo.rotateX(-Math.PI / 2)
    ;(function () {
        const vv = valGeo.attributes.position
        for (let i = 0; i < vv.count; i++) {
            const vx = vv.getX(i), vz = vv.getZ(i)
            const base    = terrainH(vx, vz)
            const chFac   = smoothstep(0, 40, Math.abs(vx + 45)) *
                            (1 - smoothstep(70, 100, Math.abs(vx + 45)))
            const channel = -chFac * 14 *
                            smoothstep(-80, -50, vz) * (1 - smoothstep(30, 60, vz))
            const ridge   = smoothstep(80, 100, vx) * (1 - smoothstep(130, 160, vx)) *
                            10 * smoothstep(-100, -60, vz)
            vv.setY(i, base + channel + ridge)
        }
        valGeo.computeVertexNormals()
    })()
    const valMesh = new THREE.Mesh(valGeo, new THREE.MeshLambertMaterial({ color: 0x090812 }))
    valMesh.position.set(0, VALLEY_Y, VALLEY_Z)
    scene.add(valMesh)

    // ── Abyss — flat plane far beyond the valley; fog swallows it completely ─
    // Exists only so there is never empty transparent canvas visible in any direction.
    const abyssMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(8000, 4000, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x04040c })
    )
    abyssMesh.rotation.x = -Math.PI / 2
    abyssMesh.position.set(0, VALLEY_Y - 15, -2200)
    scene.add(abyssMesh)

    // ── Boulders ──────────────────────────────────────────────────────────
    const boulderCols = [0x0c0918, 0x110d22, 0x0e0c1a]
    for (let i = 0; i < 18; i++) {
        const r = 2.5 + Math.random() * 8
        const b = new THREE.Mesh(
            new THREE.SphereGeometry(r, 7, 5),
            new THREE.MeshLambertMaterial({ color: boulderCols[i % 3] })
        )
        b.scale.set(0.85 + Math.random() * 0.5, 0.4 + Math.random() * 0.35, 0.75 + Math.random() * 0.5)
        b.position.set(
            (Math.random() - 0.5) * 220,
            VALLEY_Y + r * 0.35,
            -(360 + Math.random() * 600)   // z from -360 to -960, within new valley range
        )
        b.rotation.y = Math.random() * Math.PI
        scene.add(b)
    }

    // ── Coral pillars ─────────────────────────────────────────────────────
    for (let i = 0; i < 22; i++) {
        const h       = 14 + Math.random() * 22
        const onShelf = i < 13
        const baseY   = onShelf ? SHELF_Y : VALLEY_Y
        const zMin    = onShelf ? 180 : 360
        const zSpread = onShelf ? 140 : 580   // valley: z from -360 to -940

        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4 + Math.random() * 0.6, 1.0 + Math.random() * 0.7, h, 6),
            new THREE.MeshLambertMaterial({ color: coralCols[i % coralCols.length] })
        )
        pillar.position.set(
            (Math.random() - 0.5) * 200,
            baseY + h / 2,
            -(zMin + Math.random() * zSpread)
        )
        scene.add(pillar)
    }

    // ── Fan coral ─────────────────────────────────────────────────────────
    for (let i = 0; i < 14; i++) {
        const r       = 5 + Math.random() * 9
        const onShelf = i < 8
        const baseY   = onShelf ? SHELF_Y : VALLEY_Y
        const fan = new THREE.Mesh(
            new THREE.CircleGeometry(r, 14, 0, Math.PI),
            new THREE.MeshLambertMaterial({
                color: coralCols[i % coralCols.length], transparent: true, opacity: 0.58,
                side: THREE.DoubleSide
            })
        )
        fan.position.set(
            (Math.random() - 0.5) * 180,
            baseY + r * 0.8,
            onShelf ? -(185 + Math.random() * 130) : -(365 + Math.random() * 560)
        )
        fan.rotation.y = Math.random() * Math.PI * 2
        scene.add(fan)
    }

    // ── Sea anemones ──────────────────────────────────────────────────────
    const anemones = []
    const anemCols = [0xff6688, 0xff9944, 0xffaa44, 0xee4466]
    for (let i = 0; i < 18; i++) {
        const grp     = new THREE.Group()
        const cnt     = 6 + Math.floor(Math.random() * 5)
        const col     = anemCols[i % anemCols.length]
        const onShelf = i < 10
        const baseY   = onShelf ? SHELF_Y : VALLEY_Y
        const mat     = new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.80 })

        for (let j = 0; j < cnt; j++) {
            const a = (j / cnt) * Math.PI * 2
            const h = 2.5 + Math.random() * 3.5
            const r = 0.4 + Math.random() * 0.9
            const t = new THREE.Mesh(new THREE.ConeGeometry(0.14, h, 5), mat)
            t.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r)
            t.rotation.z = (Math.random() - 0.5) * 0.4
            grp.add(t)
        }
        grp.position.set(
            (Math.random() - 0.5) * 180,
            baseY - 1,
            onShelf ? -(188 + Math.random() * 130) : -(360 + Math.random() * 570)
        )
        grp.userData.phase = Math.random() * Math.PI * 2
        scene.add(grp)
        anemones.push(grp)
    }

    // ── Kelp ──────────────────────────────────────────────────────────────
    const kelpStrips = []
    for (let i = 0; i < 28; i++) {
        const h       = 12 + Math.random() * 22
        const onShelf = i < 16
        const baseY   = onShelf ? SHELF_Y : VALLEY_Y
        const k = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9 + Math.random() * 1.5, h, 1, 1),
            new THREE.MeshLambertMaterial({
                color: onShelf ? 0x1d7a40 : 0x155030,
                transparent: true, opacity: 0.65,
                side: THREE.DoubleSide
            })
        )
        k.position.set(
            (Math.random() - 0.5) * 200,
            baseY + h / 2,
            onShelf ? -(178 + Math.random() * 145) : -(360 + Math.random() * 570)
        )
        k.rotation.y        = Math.random() * Math.PI * 2
        k.userData.phase     = Math.random() * Math.PI * 2
        k.userData.sway      = 0.02 + Math.random() * 0.025
        k.userData.swaySpeed = 0.35 + Math.random() * 0.45
        scene.add(k)
        kelpStrips.push(k)
    }

    // ── Depth-driven atmosphere ────────────────────────────────────────────
    // Three colour stops so the photo blends into bright ocean blue first,
    // then darkens naturally as the camera dives deeper.
    const shallowCol = new THREE.Color(0x2a6080)  // bright ocean blue — just below the surface
    const midCol     = new THREE.Color(0x0a1e3a)  // dark navy — mid ocean
    const deepCol    = new THREE.Color(0x020308)  // near black — deep ocean

    function moveCamera() {
        const t = -window.scrollY   // negative when scrolled down

        // t is negative on scroll; positive multiplier makes camera.z decrease (dive into -Z)
        // 0.13 means the camera travels ~520 units by end-of-page, reaching the valley floor
        camera.position.z = 30 + t * 0.13
        camera.position.y = t * 0.015   // gentler descent — stays above the valley floor
        camera.position.x = t * -0.003

        const dived = 30 - camera.position.z
        const depth = Math.min(Math.max(dived / 250, 0), 1)

        // Tilt camera down as depth increases — lets the floor come into view naturally
        camera.rotation.x = -depth * 0.12   // max ≈ 7° downward at full depth

        // Lerp through three stops: shallow blue → dark navy → near black
        const col = depth < 0.5
            ? shallowCol.clone().lerp(midCol, depth * 2)
            : midCol.clone().lerp(deepCol, (depth - 0.5) * 2)

        scene.fog.color.copy(col)
        // Dense fog at surface (hides floor even at partial canvas opacity);
        // thins slightly with depth so deep structures become visible.
        scene.fog.density = 0.008 + depth * 0.006
        renderer.setClearColor(col, Math.min(depth * 0.75, 0.85))

        // Move camera torch with the camera so nearby objects are always lit
        camLight.position.copy(camera.position)

        // Fade in quickly (1.8x), fade out just as fast so the transition is snappy
        canvas.style.opacity = Math.min(depth * 1.8, 1).toFixed(2)
    }
    window.addEventListener('scroll', moveCamera, { passive: true })
    moveCamera()

    // ── Render loop ────────────────────────────────────────────────────────
    let tick = 0
    function animate() {
        requestAnimationFrame(animate)
        tick += 0.01

        // Bubbles rise and drift; wrap when they leave the top
        bubbles.forEach(b => {
            b.position.y += b.userData.speed
            b.position.x += b.userData.drift
            if (b.position.y > 80) b.position.y = -80
        })

        // Jellyfish bob on Y, slowly spin; additive glow pulses opacity
        jellyfish.forEach(j => {
            j.position.y = j.userData.baseY + Math.sin(tick * j.userData.bobSpeed + j.userData.phase) * 4
            j.rotation.y += 0.003
            j.userData.glowMesh.material.opacity = 0.14 + Math.sin(tick * 1.8 + j.userData.phase) * 0.08
        })

        // Kelp sways around its base
        kelpStrips.forEach(k => {
            k.rotation.z = Math.sin(tick * k.userData.swaySpeed + k.userData.phase) * k.userData.sway
        })

        // Anemones pulse gently in the current
        anemones.forEach(a => {
            a.rotation.y = Math.sin(tick * 0.38 + a.userData.phase) * 0.07
        })

        // God rays shimmer opacity
        godRays.forEach(r => {
            r.material.opacity = r.userData.baseOpac + Math.sin(tick * 0.55 + r.userData.phase) * 0.01
        })

        // Water surface ripple — scroll the normal map UV to simulate movement
        waterNormalTex.offset.x = tick * 0.015
        waterNormalTex.offset.y = tick * 0.012

        // Marine snow drifts downward; reset as a whole cloud when it travels too far
        snow.position.y -= 0.018
        snow.position.x  = Math.sin(tick * 0.08) * 1.2   // gentle lateral drift
        if (snow.position.y < -180) snow.position.y = 0

        plankton.rotation.y += 0.0001
        glowOrbs.rotation.y -= 0.00015

        renderer.render(scene, camera)
    }
    animate()

}

// ─── Stat Counter Animation ───────────────────────────────────────────────

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

// ─── Button Ripple Effect ─────────────────────────────────────────────────

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

// ─── Header auto-hide on scroll ───────────────────────────────────────────

;(function () {
    const header = document.querySelector('.site-header')
    const hero   = document.querySelector('.hero')
    if (!header) return

    let lastY = window.scrollY

    window.addEventListener('scroll', () => {
        const y      = window.scrollY
        const heroH  = hero ? hero.offsetHeight : 0
        const goingDown = y > lastY

        if (goingDown && y > heroH) {
            header.classList.add('header-hidden')
        } else {
            header.classList.remove('header-hidden')
        }
        lastY = y
    }, { passive: true })
})()
