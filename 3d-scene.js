/* EarnHub cinematic 3D background. Visual-only: no app data, forms or controls. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

(() => {
    const host = document.getElementById('eh3d-background');
    if (!host || !window.WebGLRenderingContext) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smallScreen = window.matchMedia('(max-width: 700px)').matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050817, smallScreen ? 0.035 : 0.027);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(0, 1.1, 15.5);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: !smallScreen,
            powerPreference: 'low-power',
            stencil: false,
            depth: true
        });
    } catch (error) {
        console.warn('EarnHub 3D background unavailable:', error);
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1 : 1.5));
    renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0x9cbaff, 0x080b1d, 1.25);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xb9c7ff, 2.1);
    keyLight.position.set(-5, 8, 8);
    scene.add(keyLight);
    const violetLight = new THREE.PointLight(0x7657ff, 34, 22, 2);
    violetLight.position.set(5, 1, 4);
    scene.add(violetLight);
    const cyanLight = new THREE.PointLight(0x21d4b4, 20, 18, 2);
    cyanLight.position.set(-6, -1, 2);
    scene.add(cyanLight);

    const world = new THREE.Group();
    scene.add(world);

    // Layered, rolling dark terrain inspired by the reference video's 3D surface.
    function makeTerrain(width, depth, segmentsX, segmentsZ, yOffset, color, opacity) {
        const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const z = position.getY(i);
            const ridge = Math.sin(x * 0.19 + z * 0.08) * 0.62
                + Math.cos(x * 0.11 - z * 0.16) * 0.44
                + Math.sin(x * 0.34 + z * 0.23) * 0.16;
            position.setZ(i, ridge);
        }
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.48,
            roughness: 0.62,
            transparent: opacity < 1,
            opacity,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2.15;
        mesh.position.set(0, yOffset, -3.8);
        return mesh;
    }
    world.add(makeTerrain(32, 23, 90, 65, -4.15, 0x18223d, 0.95));
    world.add(makeTerrain(38, 28, 64, 45, -5.0, 0x0b142b, 0.72));

    // Fine metallic contour lines on the landscape create depth without a heavy texture.
    const contourMaterial = new THREE.LineBasicMaterial({ color: 0x536da7, transparent: true, opacity: 0.16 });
    for (let row = 0; row < 9; row++) {
        const points = [];
        for (let i = 0; i <= 80; i++) {
            const x = -15 + i * 0.375;
            const z = -7 + row * 0.56;
            const y = -4.1 + Math.sin(x * 0.19 + z * 0.08) * 0.62
                + Math.cos(x * 0.11 - z * 0.16) * 0.44
                + Math.sin(x * 0.34 + z * 0.23) * 0.16;
            points.push(new THREE.Vector3(x, y, z - 3.8));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), contourMaterial);
        world.add(line);
    }

    const objects = [];
    const coinFaceTexture = (() => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = '#fff4d1';
        ctx.font = 'bold 142px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₨', 128, 133);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    })();

    function addCoin(x, y, z, radius, tint, phase) {
        const group = new THREE.Group();
        const depth = radius * 0.22;
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, depth, 64, 1, false),
            new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0.92, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.16 })
        );
        body.rotation.x = Math.PI / 2;
        group.add(body);
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 0.88, radius * 0.045, 10, 64),
            new THREE.MeshStandardMaterial({ color: 0xe3d5ff, metalness: 0.95, roughness: 0.2 })
        );
        rim.position.z = depth * 0.53;
        group.add(rim);
        const face = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 0.68, 48),
            new THREE.MeshBasicMaterial({ map: coinFaceTexture, transparent: true, side: THREE.DoubleSide })
        );
        face.position.z = depth * 0.57;
        group.add(face);
        group.position.set(x, y, z);
        group.userData = { baseY: y, phase, spin: 0.18 + Math.random() * 0.12 };
        world.add(group);
        objects.push(group);
    }

    function addGem(x, y, z, size, color, phase) {
        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(size, 1),
            new THREE.MeshPhysicalMaterial({ color, metalness: 0.7, roughness: 0.16, transmission: 0.12, thickness: 0.7, clearcoat: 1 })
        );
        gem.position.set(x, y, z);
        gem.userData = { baseY: y, phase, spin: 0.28 };
        world.add(gem); objects.push(gem);
    }

    function addRewardTile(x, y, z, phase) {
        const tile = new THREE.Group();
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 1.35, 0.22),
            new THREE.MeshPhysicalMaterial({ color: 0x18284a, metalness: 0.72, roughness: 0.24, clearcoat: 1 })
        );
        tile.add(base);
        const edge = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.36, 1.36, 0.23)),
            new THREE.LineBasicMaterial({ color: 0x9a83ff, transparent: true, opacity: 0.9 })
        );
        tile.add(edge);
        const mark = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.055, 12, 48),
            new THREE.MeshStandardMaterial({ color: 0x21d4b4, metalness: 0.7, emissive: 0x0b615a, emissiveIntensity: 0.55 })
        );
        mark.position.z = 0.15;
        tile.add(mark);
        const center = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 20, 16),
            new THREE.MeshStandardMaterial({ color: 0xd9fff7, emissive: 0x21d4b4, emissiveIntensity: 0.8 })
        );
        center.position.z = 0.18;
        tile.add(center);
        tile.position.set(x, y, z);
        tile.rotation.set(0.18, -0.32, -0.18);
        tile.userData = { baseY: y, phase, spin: 0.12 };
        world.add(tile); objects.push(tile);
    }

    addCoin(-5.2, 1.6, -1.2, 1.12, 0x8060df, 0.4);
    addCoin(4.6, -0.35, 0.4, 0.83, 0xc79b47, 1.7);
    addCoin(1.1, 3.2, -2.5, 0.48, 0x7657ff, 2.5);
    addGem(6.1, 2.15, -1.5, 0.82, 0x35d9c1, 0.8);
    addGem(-3.2, -1.0, 1.0, 0.48, 0x8f79ff, 2.1);
    addRewardTile(-1.0, 0.25, 1.3, 1.2);

    // Small distant particles give the scene a cinematic sense of scale.
    const particleCount = smallScreen ? 180 : 420;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 31;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        particlePositions[i * 3 + 2] = -8 + Math.random() * 13;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0x9ebaff, size: smallScreen ? 0.025 : 0.035, transparent: true, opacity: 0.52, sizeAttenuation: true }));
    scene.add(particles);

    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
    let scrollProgress = 0;
    let lastFrame = 0;
    let frameId = 0;
    const frameInterval = smallScreen ? 1000 / 24 : 1000 / 30;

    function onPointerMove(event) {
        targetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 0.8;
        targetY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 0.45;
    }
    function onScroll() {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollProgress = window.scrollY / maxScroll;
    }
    function resize() {
        const width = Math.max(1, host.clientWidth || window.innerWidth);
        const height = Math.max(1, host.clientHeight || window.innerHeight);
        camera.aspect = width / height;
        camera.position.z = width < 600 ? 18.5 : 15.5;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }

    function animate(now) {
        frameId = requestAnimationFrame(animate);
        if (document.hidden || now - lastFrame < frameInterval) return;
        const delta = Math.min((now - (lastFrame || now)) / 1000, 0.05);
        lastFrame = now;
        const time = now * 0.00035;

        pointerX += (targetX - pointerX) * 0.035;
        pointerY += (targetY - pointerY) * 0.035;
        world.rotation.y = pointerX * 0.16 + (scrollProgress - 0.5) * 0.2;
        world.rotation.x = -0.035 + pointerY * 0.06;
        world.position.y = Math.sin(time * 0.7) * 0.08 - scrollProgress * 0.42;
        world.position.x = Math.sin(scrollProgress * Math.PI * 2) * 0.45;
        camera.position.x += (pointerX * 0.55 - camera.position.x) * 0.018;
        camera.position.y += (1.1 - pointerY * 0.35 - camera.position.y) * 0.018;
        camera.lookAt(0, -0.35 - scrollProgress * 0.2, -1.0);

        for (const object of objects) {
            const data = object.userData;
            object.position.y = data.baseY + Math.sin(time * 2.1 + data.phase) * (0.16 + delta * 0.15);
            object.rotation.y += data.spin * delta;
            object.rotation.x += data.spin * 0.18 * delta;
        }
        particles.rotation.y = time * 0.12 + scrollProgress * 0.4;
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !frameId) frameId = requestAnimationFrame(animate);
    });
    resize(); onScroll();
    if (reduceMotion) {
        camera.lookAt(0, -0.35, -1);
        renderer.render(scene, camera);
    } else {
        frameId = requestAnimationFrame(animate);
    }
})();
