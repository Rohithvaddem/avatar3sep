/**
 * Aspirealty Avatar 3 - Standalone 3D Interactive Model
 * Features:
 *  - Full 3D Map Viewport (Satellite Terrain + Blueprint Layout Plane + Streetlights)
 *  - Plot Buttons with accurate schematic coordinates, status colors, and click details modal
 *  - Single Car roaming across the whole layout strictly on black road corridors
 *  - Lighting Modes (Day, Sunset, Night), Status Filters, and Search Jump
 */

(function () {
    'use strict';

    // ---------------- Module State ----------------
    let scene, camera, renderer, controls;
    let groundMesh, layoutTexture, layoutWorldGroup, satelliteMesh;
    const plotButtons = {};      // plotNo -> THREE.Sprite
    const plotMeshes = {};       // plotNo -> THREE.Mesh
    const customPlotStyles = {};
    let downloadedHouseTemplate = null;
    let downloadedHouseFullTemplate = null;
    let downloadedHouseFarTemplate = null;
    let fullHouseRequested = false;
    const houseLods = new Map();
    let downloadedHouseSize = null;
    let streetLightGroup = null;
    let streetLightBatches = [];
    let streetLightPlacements = [];
    let streetLightEmissiveMaterials = [];
    let lastStreetLightUpdate = -Infinity;
    try {
        const styles = JSON.parse(localStorage.getItem('avatar3_house_styles_v1'));
        if (styles && typeof styles === 'object') {
            for (const [plot, style] of Object.entries(styles)) {
                if (/^\d+$/.test(plot) && ['downloaded','villa','duplex','bungalow','open'].includes(style)) customPlotStyles[plot] = style;
            }
        }
    } catch (_) {}
    let globalDefaultStyle = 'villa';
    const plotGroups = {};       // plotNo -> THREE.Group
    let lights = {};
    let currentLightingMode = 'day';
    let isAutoRotating = false;
    let hoveredButton = null;
    let selectedPlotNo = null;
    let animFrameId = null;
    let isActive = false;
    let uiReady = false;
    let activeFilterStatus = 'ALL';
    let isLayoutOnly = false;

    // Highlight Beacon
    let beaconRing = null;
    let beaconLight = null;

    // Single Roaming Car State
    let singleCarMesh = null;
    let singleCarState = null;
    let headlightMat = null;
    let taillightMat = null;
    let lastFrameTime = performance.now();

    // Camera animation state
    let isCameraAnimating = false;
    let cameraStartPos = null;
    let cameraEndPos = null;
    let targetStartPos = null;
    let targetEndPos = null;
    let cameraAnimProgress = 1;
    const CAMERA_ANIM_SPEED = 0.045;

    // Dimensions & Calibration
    const LAYOUT_WIDTH = 250;
    const LAYOUT_HEIGHT = 140.6;

    const CAMERA_PRESETS = {
        isometric: { pos: [0, 180, 100], target: [0, 0, 0] },
        topDown: { pos: [0, 190, 0.01], target: [0, 0, 0] }
    };

    function layoutBounds() {
        layoutWorldGroup.updateMatrixWorld(true);
        const box=new THREE.Box3();
        Object.values(plotGroups).forEach(group=>box.expandByPoint(group.getWorldPosition(new THREE.Vector3())));
        if (plotGroups[1]) box.expandByPoint(parkEntranceEdge());
        if (plotGroups[206]) box.expandByPoint(parkFourEdge());
        box.expandByScalar(8*Math.max(calibration.scale,1)); return box;
    }
    function parkEntranceEdge() {
        const offset=new THREE.Vector3(28*calibration.scale*calibration.width,0,8*calibration.scale*calibration.depth);
        offset.applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(calibration.rotation));
        return plotGroups[1].getWorldPosition(new THREE.Vector3()).add(offset);
    }
    function parkFourEdge() {
        const offset=new THREE.Vector3(-16*calibration.scale*calibration.width,0,-10*calibration.scale*calibration.depth);
        offset.applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(calibration.rotation));
        return plotGroups[206].getWorldPosition(new THREE.Vector3()).add(offset);
    }
    function layoutFocusCenter() {
        if (renderer && renderer.domElement.clientWidth <= 600) {
            const points=Object.entries(plotGroups).filter(([no])=>Number(no)>6).map(([,group])=>group.getWorldPosition(new THREE.Vector3()));
            if(points.length) return new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
        }
        return layoutBounds().getCenter(new THREE.Vector3());
    }
    function fittedCameraPosition(preset) {
        const viewport=document.getElementById('threeCanvasContainer');
        camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1); camera.updateProjectionMatrix();
        const target=layoutFocusCenter();
        const points=Object.values(plotGroups).flatMap(group=>{
            const p=group.getWorldPosition(new THREE.Vector3());
            // Include the plan's park/entrance edges beyond the last plot centres.
            return [[-6,-6],[-6,6],[6,-6],[6,6]].map(([x,z])=>p.clone().add(new THREE.Vector3(x*calibration.scale,0,z*calibration.scale)));
        });
        points.push(parkEntranceEdge());
        points.push(parkFourEdge());
        const direction = new THREE.Vector3(...preset).normalize();
        let distance=60;
        const probe=camera.clone();
        for(let i=0;i<40;i++) {
            probe.position.copy(target).addScaledVector(direction,distance); probe.lookAt(target); probe.updateMatrixWorld();
            const fits=points.every(point=>{
                const p=point.clone().project(probe);return Math.abs(p.x)<.9&&Math.abs(p.y)<.88;
            });
            if(fits) break; distance*=1.07;
        }
        return target.clone().addScaledVector(direction, distance * (renderer.domElement.clientWidth <= 600 ? .65 : .9));
    }

    /**
     * Helper to get plot details from avatar3_data.js
     */
    function getPlotDetails(plotNo) {
        if (typeof plotDataRawAvatar3 !== 'undefined' && Array.isArray(plotDataRawAvatar3)) {
            const found = plotDataRawAvatar3.find(p => String(p.plot_no) === String(plotNo));
            if (found) return found;
        }
        return {
            plot_no: plotNo,
            plot_size: '200.00',
            extent_sq_mtrs: '167.22',
            facing: 'East',
            plot_status: 'AVAILABLE',
            dim_north: "36' 0\"",
            dim_south: "36' 0\"",
            dim_east: "50' 0\"",
            dim_west: "50' 0\"",
            reference_name: 'ASPIREALTY'
        };
    }

    function getPlotStatus(detail, plotNo) {
                if (detail && detail.plot_status) {
            const s = String(detail.plot_status).toUpperCase();
            if (s.includes('SOLD') || s.includes('BOOKED')) return 'SOLD';
            if (s.includes('MORTGAGE') || s.includes('MORTAGAGE')) return 'MORTGAGE';
        }
        return 'AVAILABLE';
    }

    function getStatusColorHex(status) {
        switch (status) {
            case 'AVAILABLE': return '#0A6AA3'; // Project inventory, not verification
            case 'SOLD': return '#55667A';      // Neutral status
            case 'MORTGAGE': return '#85530A';  // Amber status
            default: return '#0A6AA3';
        }
    }

    /**
     * Create compact plot number labels
     */
    function createPlotNumberSprite(plotNo, hexColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');

        // Light marker with dark type and a subtle status rim.
        ctx.beginPath();
        ctx.roundRect(6, 6, 116, 68, 12);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = hexColor || '#38bdf8';
        ctx.stroke();
        ctx.fillStyle = '#10283B';
        ctx.font = '600 60px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(plotNo), 64, 41);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        if (THREE.sRGBEncoding) {
            texture.encoding = THREE.sRGBEncoding;
        }
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 2, 1);
        sprite.renderOrder = 999;
        sprite.userData = { plotNo };
        return sprite;
    }

    function scalePlotLabel(label) {
        if (!camera || !renderer) return;
        const world = new THREE.Vector3();
        label.getWorldPosition(world);
        // Compact at overview distance; enlarge smoothly for close inspection.
        const depth = Math.max(.1, -world.clone().applyMatrix4(camera.matrixWorldInverse).z);
        const worldPerPixel = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
            / Math.max(renderer.domElement.clientHeight, 1);
        const projectedWidth = 2.4 * calibration.scale / worldPerPixel;
        const selected = selectedPlotNo === label.userData.plotNo;
        const pixels = THREE.MathUtils.clamp(projectedWidth, selected ? 22 : 13.5, selected ? 42 : 36);
        const size = pixels * worldPerPixel;
        label.scale.set(size / Math.max(calibration.scale * calibration.width, .01),
            size * .625 / Math.max(calibration.scale, .01), 1);
    }
    function updatePlotLabels() {
        Object.values(plotButtons).forEach(label => {
            scalePlotLabel(label);
            label.visible = !isLayoutOnly && label.parent.visible;
        });
    }

    /**
     * Initialize Three.js Scene, Camera, Renderer, Controls
     */
    function initThreeScene() {
        const container = document.getElementById('threeCanvasContainer');
        if (!container) return;

        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || (window.innerHeight - 64);
        const aspect = w / h;

        // 1. Scene - Sleek transparent 3D viewport (No solid background)
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xb8d5ed);
        scene.fog = new THREE.Fog(0xb8d5ed, 700, 1700);

        // 2. Camera
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 4000);
        camera.position.set(calibration.east+110*Math.max(1, calibration.scale), 95*Math.max(1, calibration.scale), -calibration.north+110*Math.max(1, calibration.scale));

        // 3. Renderer with alpha transparency support
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
        if (THREE.sRGBEncoding) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        }
        container.appendChild(renderer.domElement);

        // 4. OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.maxPolarAngle = Math.PI / 2 - 0.02;
        controls.minDistance = 2.0;
        controls.maxDistance = 1000;
        controls.target.set(calibration.east, 0, -calibration.north);

        // 5. Lighting
        setupLighting();

        // 6. Layout World Group (-7.30° rotation matching layout orientation)
        layoutWorldGroup = new THREE.Group();
        layoutWorldGroup.rotation.y = THREE.MathUtils.degToRad(-7.30);
        scene.add(layoutWorldGroup);
        window.layoutWorldGroup = layoutWorldGroup;
        window.scene = scene;

        // 7. Ground & Satellite Terrain
        setupGroundAndEnvironment();

        // 8. 3D Plots & Plot Buttons
        build3DPlotsAndButtons();

        // 10. Exactly ONE Roaming Car on the whole layout
        setupSingleRoamingCar();
        if (singleCarMesh) singleCarMesh.traverse(object => { object.castShadow = false; });
        setupStreetLights();

        // 11. Highlight Beacon
        setupBeacon();

        // 12. Interaction Listeners
        setupEventListeners(container);
        new ResizeObserver(() => {
            if (!isActive || !container.clientWidth || !container.clientHeight) return;
            camera.aspect=container.clientWidth/container.clientHeight; camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth,container.clientHeight);
            if (!selectedPlotNo && !isCameraAnimating) {
                const preset=document.querySelector('.btn-cam-preset.active')?.dataset.preset || 'isometric';
                controls.target.copy(layoutFocusCenter()); camera.position.copy(fittedCameraPosition(CAMERA_PRESETS[preset].pos));
            }
        }).observe(container);

        // Restore the user’s placement before rendering.
        applyCalibration();
        const initialPreset = renderer.domElement.clientWidth <= 600 ? 'topDown' : 'isometric';
        document.querySelectorAll('.btn-cam-preset').forEach(button=>button.classList.toggle('active',button.dataset.preset===initialPreset));
        controls.target.copy(layoutFocusCenter()); camera.position.copy(fittedCameraPosition(CAMERA_PRESETS[initialPreset].pos)); camera.lookAt(controls.target);
        // Start Animation Loop
        startAnimationLoop();
    }

    /**
     * Setup Sun & Ambient Lighting
     */
    function setupLighting() {
        lights.ambient = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(lights.ambient);

        lights.sun = new THREE.DirectionalLight(0xffffff, 1.05);
        lights.sun.position.set(120, 220, 100);
        lights.sun.castShadow = true;
        lights.sun.shadow.mapSize.width = 2048;
        lights.sun.shadow.mapSize.height = 2048;
        lights.sun.shadow.camera.near = 10;
        lights.sun.shadow.camera.far = 700;
        const d = 320;
        lights.sun.shadow.camera.left = -d;
        lights.sun.shadow.camera.right = d;
        lights.sun.shadow.camera.top = d;
        lights.sun.shadow.camera.bottom = -d;
        lights.sun.shadow.bias = -0.0004;
        scene.add(lights.sun);

        lights.hemi = new THREE.HemisphereLight(0x87ceeb, 0x1e293b, 0.45);
        scene.add(lights.hemi);
    }

    function applyLightingMode(mode) {
        currentLightingMode = mode;
        if (renderer) renderer.shadowMap.needsUpdate = true;
        const palette = {
            day: { sky: 0xb8d5ed, ground: 0xffffff, hemi: .45 },
            sunset: { sky: 0xd98665, ground: 0xffb176, hemi: .25 },
            night: { sky: 0x071323, ground: 0x354c78, hemi: .12 }
        }[mode] || { sky: 0xb8d5ed, ground: 0xffffff, hemi: .45 };
        scene.background = new THREE.Color(palette.sky);
        scene.fog = new THREE.Fog(palette.sky, 700, 1700);
        lights.hemi.intensity = palette.hemi;
        lights.hemi.color.set(palette.sky);

        if (mode === 'day') {
            lights.sun.intensity = 1.1;
            lights.sun.color.set(0xffffff);
            lights.sun.position.set(120, 220, 100);
            lights.ambient.intensity = 0.65;
            lights.ambient.color.set(0xffffff);
            if (headlightMat) headlightMat.emissiveIntensity = 1.0;
            if (taillightMat) taillightMat.emissiveIntensity = 1.0;
        } else if (mode === 'sunset') {
            lights.sun.intensity = 1.6;
            lights.sun.color.set(0xf97316);
            lights.sun.position.set(220, 60, -40);
            lights.ambient.intensity = 0.75;
            lights.ambient.color.set(0xfed7aa);
            if (headlightMat) headlightMat.emissiveIntensity = 2.4;
            if (taillightMat) taillightMat.emissiveIntensity = 2.2;
        } else if (mode === 'night') {
            lights.sun.intensity = 0.15;
            lights.sun.color.set(0x38bdf8);
            lights.sun.position.set(-60, 140, -60);
            lights.ambient.intensity = 0.45;
            lights.ambient.color.set(0x1e293b);
            if (headlightMat) headlightMat.emissiveIntensity = 3.6;
            if (taillightMat) taillightMat.emissiveIntensity = 3.0;
        }

        // Image-backed Basic materials ignore lights, so tint both ground maps explicitly.
        if (groundMesh && groundMesh.material) groundMesh.material.color.set(palette.ground);
        const aerialGround = scene.getObjectByName('Avatar3SatelliteTerrain');
        if (aerialGround) aerialGround.material.color.set(palette.ground);
        updateStreetLightGlow();
    }

    // NOAA fractional-year approximation. Coordinates are the existing project bounds;
    // world +X is east and -Z north. This models the sun, not surveyed building shadows.
    function solarPosition(dateString, hour) {
        const date = new Date(dateString + 'T12:00:00Z');
        if (!Number.isFinite(date.getTime())) return null;
        const year = date.getUTCFullYear();
        const day = (Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-Date.UTC(year,0,0))/86400000;
        const days = (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
        const g = 2*Math.PI/days*(day-1+(hour-12)/24);
        const eq = 229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
        const dec = .006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
        const lat = 16.931355*Math.PI/180;
        const ha = (hour*60+eq+4*78.538005-60*5.5)/4*Math.PI/180-Math.PI;
        const east = -Math.cos(dec)*Math.sin(ha);
        const north = Math.cos(lat)*Math.sin(dec)-Math.sin(lat)*Math.cos(dec)*Math.cos(ha);
        const up = Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha);
        return {east,north,up,elevation:Math.asin(up)*180/Math.PI,azimuth:(Math.atan2(east,north)*180/Math.PI+360)%360};
    }
    let sunMarker;
    window.disableAvatar3Sun = () => { if (sunMarker) sunMarker.visible=false; if(scene && lights.sun) applyLightingMode('day'); };
    window.setAvatar3Sun = (date, hour) => {
        if (!scene || !lights.sun) return null;
        const position = solarPosition(date,hour); if (!position) return null;
        currentLightingMode = 'day';
        const center = new THREE.Vector3(calibration.east,0,-calibration.north);
        lights.sun.target.position.copy(center); scene.add(lights.sun.target);
        lights.sun.position.copy(center).add(new THREE.Vector3(position.east,position.up,-position.north).multiplyScalar(220));
        lights.sun.intensity = position.up > 0 ? 1.2 : 0;
        lights.sun.color.set(0xffffff); lights.ambient.intensity=.4; lights.hemi.intensity=.3;
        if (!sunMarker) {
            sunMarker = new THREE.Mesh(new THREE.SphereGeometry(12,16,12),new THREE.MeshBasicMaterial({color:0xf6bc44})); scene.add(sunMarker);
        }
        sunMarker.userData.direction = new THREE.Vector3(position.east,position.up,-position.north);
        sunMarker.position.copy(camera.position).addScaledVector(sunMarker.userData.direction,1800);
        sunMarker.visible = position.up>0;
        renderer.shadowMap.needsUpdate=true;
        return position;
    };

    /**
     * Helper to load textures safely from Base64 or external file
     */
    function loadTextureSafe(b64Data, fallbackUrl, callback) {
        const hasB64 = (typeof b64Data === 'string' && b64Data.length > 50);
        const src = hasB64 ? b64Data : fallbackUrl;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const tex = new THREE.Texture(img);
            tex.anisotropy = 8;
            if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
            tex.needsUpdate = true;
            callback(tex);
        };
        img.onerror = (err) => {
            console.warn('Primary texture load failed, trying fallback...', err);
            if (fallbackUrl && src !== fallbackUrl) {
                const fbImg = new Image();
                fbImg.crossOrigin = 'anonymous';
                fbImg.onload = () => {
                    const tex = new THREE.Texture(fbImg);
                    tex.anisotropy = 8;
                    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
                    tex.needsUpdate = true;
                    callback(tex);
                };
                fbImg.src = fallbackUrl;
            }
        };
        img.src = src;
    }

    /**
     * Setup Blueprint Layout Plane (Transparent Background Cutout)
     */

    function removeExteriorWhite(texture) {
        const image = texture.image;
        if (!image || !image.width || !image.height) return texture;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const width = canvas.width, height = canvas.height, count = width*height;
            const visited = new Uint8Array(count), queue = new Uint32Array(count);
            let head = 0, tail = 0;
            function visit(index) {
                if (visited[index]) return;
                visited[index] = 1;
                const offset = index*4, data = pixels.data;
                if (data[offset+3] === 0 || (data[offset] >= 235 && data[offset+1] >= 235 && data[offset+2] >= 235)) {
                    data[offset+3] = 0; queue[tail++] = index;
                }
            }
            for (let x = 0; x < width; x++) { visit(x); visit((height-1)*width+x); }
            for (let y = 0; y < height; y++) { visit(y*width); visit(y*width+width-1); }
            while (head < tail) {
                const index = queue[head++], x = index%width;
                if (x) visit(index-1);
                if (x < width-1) visit(index+1);
                if (index >= width) visit(index-width);
                if (index < count-width) visit(index+width);
            }
            ctx.putImageData(pixels, 0, 0);
            const cutout = new THREE.CanvasTexture(canvas);
            cutout.encoding = THREE.sRGBEncoding;
            cutout.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.dispose();
            return cutout;
        } catch (error) {
            console.warn('Could not remove layout exterior:', error);
            return texture;
        }
    }

    function setupGroundAndEnvironment() {
        setupSatelliteBackdrop();
        // Blueprint Layout Ground Plane - Cutout layout with transparent background
        const layoutGeo = new THREE.PlaneGeometry(LAYOUT_WIDTH, LAYOUT_HEIGHT, 16, 16);
        const layoutMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.05,
            depthWrite: false,
            depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
        });
        groundMesh = new THREE.Mesh(layoutGeo, layoutMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.set(0, 0.02, 0);
        groundMesh.renderOrder = 10;
        layoutWorldGroup.add(groundMesh);
        const shadowSurface = new THREE.Mesh(layoutGeo.clone(), new THREE.ShadowMaterial({opacity:.4, depthWrite:false}));
        shadowSurface.rotation.x = -Math.PI/2; shadowSurface.position.y=.04;
        shadowSurface.receiveShadow=true; shadowSurface.renderOrder=11;
        layoutWorldGroup.add(shadowSurface);

        // Load transparent layout cutout
        const layoutB64 = (typeof AVATAR3_LAYOUT_TEXTURE_B64 !== 'undefined') ? AVATAR3_LAYOUT_TEXTURE_B64 : null;
        loadTextureSafe(layoutB64, 'avatar3_layout_transparent.png', (tex) => {
            groundMesh.material.map = removeExteriorWhite(tex);
            groundMesh.material.needsUpdate = true;
        });

        // 3. Add 3D Landscaped Trees throughout Park-1, Park-2, Park-3, Park-4 and Entrances
        setup3DLandscaping();
    }

    /**
     * Build lush 3D trees across parks and boulevard
     */
    function setup3DLandscaping() {
        const treesGroup = new THREE.Group();
        treesGroup.name = "Landscaping3D";

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
        const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
        const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });
        const foliageMat3 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 });
        const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5, side: THREE.DoubleSide });

        function addTree(x, z, s, isPalm) {
            const tree = new THREE.Group();
            tree.position.set(x, 0, z);

            if (isPalm) {
                // Curved trunk
                const trunkGeo = new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 3.8 * s, 7);
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.set(0, 1.9 * s, 0);
                trunk.rotation.z = (Math.random() - 0.5) * 0.15;
                trunk.castShadow = true;
                tree.add(trunk);

                // Palm Fronds
                for (let i = 0; i < 7; i++) {
                    const leafGeo = new THREE.ConeGeometry(0.8 * s, 2.6 * s, 4);
                    const leaf = new THREE.Mesh(leafGeo, palmLeafMat);
                    leaf.rotation.x = Math.PI / 2.3;
                    leaf.rotation.y = (i / 7) * Math.PI * 2;
                    leaf.position.set(0, 3.7 * s, 0);
                    leaf.castShadow = true;
                    tree.add(leaf);
                }
            } else {
                // Deciduous / Boulevard Shade Tree
                const trunkGeo = new THREE.CylinderGeometry(0.22 * s, 0.35 * s, 2.4 * s, 7);
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.set(0, 1.2 * s, 0);
                trunk.castShadow = true;
                tree.add(trunk);

                // Multi-tiered leafy canopy
                const tier1Geo = new THREE.DodecahedronGeometry(1.6 * s, 1);
                const tier1 = new THREE.Mesh(tier1Geo, foliageMat1);
                tier1.position.set(0, 2.7 * s, 0);
                tier1.castShadow = true;
                tree.add(tier1);

                const tier2Geo = new THREE.DodecahedronGeometry(1.2 * s, 1);
                const tier2 = new THREE.Mesh(tier2Geo, foliageMat2);
                tier2.position.set(0, 3.8 * s, 0);
                tier2.castShadow = true;
                tree.add(tier2);

                const tier3Geo = new THREE.DodecahedronGeometry(0.8 * s, 1);
                const tier3 = new THREE.Mesh(tier3Geo, foliageMat3);
                tier3.position.set(0, 4.7 * s, 0);
                tier3.castShadow = true;
                tree.add(tier3);
            }
            treesGroup.add(tree);
        }

        // Park-1 (East Entrance Boulevard & Garden)
        const park1Trees = [
            { x: 80, z: 9, s: 1.0 }, { x: 86, z: 12, s: 1.15 }, { x: 92, z: 14, s: 1.05 }
        ];
        park1Trees.forEach(t => addTree(t.x, t.z, t.s, false));

        // Park-2 (Southwest Palms & Playground)
        const park2Trees = [
            { x: -55, z: 38, s: 1.15, palm: true }, { x: -48, z: 42, s: 1.25, palm: true },
            { x: -52, z: 46, s: 1.1, palm: true }
        ];
        park2Trees.forEach(t => addTree(t.x, t.z, t.s, t.palm));

        // Park-3 (West Central Garden)
        const park3Trees = [
            { x: -64, z: 7, s: 1.1 }, { x: -60, z: 11, s: 1.15 }, { x: -65, z: 14, s: 1.0 }
        ];
        park3Trees.forEach(t => addTree(t.x, t.z, t.s, false));

        // Park-4 (Northwest Lawn)
        const park4Trees = [
            { x: -78, z: -55, s: 1.1 }, { x: -74, z: -50, s: 1.15 }, { x: -76, z: -45, s: 1.0 }
        ];
        park4Trees.forEach(t => addTree(t.x, t.z, t.s, false));


        // Small ornamental trees in park gaps; keep the car's road corridors clear.
        for (const [x, z] of [[78,14],[82,18],[87,20],[-56,43],[-51,48],[-47,46],[-66,8],[-69,13],[-80,-52],[-83,-48]]) {
            addTree(x, z, .65, false);
        }
        layoutWorldGroup.add(treesGroup);
    }

    /**
     * Build 3D Plots and Floating Circular Plot Buttons
     */
    function build3DPlotsAndButtons() {
        const coordsSource = (typeof plotCoordinatesAvatar3 !== 'undefined') ? plotCoordinatesAvatar3 : {};
        const plotNumbers = Object.keys(coordsSource);

        if (plotNumbers.length === 0) {
            console.warn('3D Layout: No plotCoordinates found.');
            return;
        }

        const cornerStoneGeo = new THREE.BoxGeometry(0.35, 0.6, 0.35);
        const cornerStoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

        plotNumbers.forEach(plotNo => {
            const coord = coordsSource[plotNo];
            if (!coord || typeof coord.left !== 'number' || typeof coord.top !== 'number') return;

            const normX = coord.left / 2500 - 0.5;
            const normZ = coord.top / 1579 - 0.5;
            const posX = normX * LAYOUT_WIDTH;
            const posZ = normZ * LAYOUT_HEIGHT;

            const detail = getPlotDetails(plotNo);
            const status = getPlotStatus(detail, plotNo);
            const colorHex = getStatusColorHex(status);
            const colorThree = new THREE.Color(colorHex);

            const areaSqYd = parseFloat(detail.plot_size) || 200;
            const sizeFactor = Math.min(Math.max(areaSqYd / 200, 0.85), 2.2);
            const pWidth = 3.6 * sizeFactor;
            const pDepth = 2.8 * sizeFactor;

            // 3D House Dimensions
            const houseW = pWidth * 0.72;
            const houseD = pDepth * 0.68;
            const houseH = 1.35;
            const plinthH = 0.16;
            const roofH = 1.05;

            const plotGroup = new THREE.Group();
            plotGroup.position.set(posX, 0, posZ);

            // 1. Plot Foundation Plinth / Base
            const plinthGeo = new THREE.BoxGeometry(pWidth * 0.94, plinthH, pDepth * 0.94);
            const plinthMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.85
            });
            const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
            plinthMesh.position.y = plinthH / 2 + 0.08;
            plinthMesh.receiveShadow = true;
            plotGroup.add(plinthMesh);

            // 2. Main 3D Architecture Model (Customizable: Villa, Duplex, Bungalow, Open Plot)
            const style = customPlotStyles[plotNo] || globalDefaultStyle || 'villa';
            const houseMesh = createPlotArchitectureMesh(plotNo, detail, status, colorHex, pWidth, pDepth, style, plotGroup);
            houseMesh.name = 'House-' + plotNo;
            plotGroup.name = 'Villa-' + plotNo;
            plotGroup.add(houseMesh);
            plotMeshes[plotNo] = houseMesh;

            // Plot Survey Corner Stones
            const hw = pWidth / 2;
            const hd = pDepth / 2;
            const corners = [
                [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]
            ];
            corners.forEach(([cx, cz]) => {
                const stone = new THREE.Mesh(cornerStoneGeo, cornerStoneMat);
                stone.position.set(cx, 0.25, cz);
                plotGroup.add(stone);
            });

            // Plot Number Sprite Floating Above Roof Peak
            const labelSprite = createPlotNumberSprite(plotNo, colorHex);
            labelSprite.position.set(0, houseMesh.userData.pHeight + 0.8, 0);
            labelSprite.name = 'PlotNumber-' + plotNo;
            labelSprite.userData = { plotNo, detail, status, statusHex: colorHex };
            plotGroup.traverse(object => {
                if (object.isMesh) Object.assign(object.userData, { plotNo, detail, status, statusHex: colorHex });
            });
            labelSprite.renderOrder = 999;
            plotGroup.add(labelSprite);
            plotButtons[plotNo] = labelSprite;

            layoutWorldGroup.add(plotGroup);
            plotGroups[plotNo] = plotGroup;
        });
    }



    function roadFacingYaw(plotGroup, detail) {
        const position = plotGroup.position;
        const path = singleCarState?.waypoints || [];
        let nearest = Infinity, yaw = 0;
        for (let i = 1; i < path.length; i++) {
            const a = path[i-1], b = path[i];
            const dx = b.x-a.x, dz = b.z-a.z;
            const lengthSquared = dx*dx+dz*dz;
            if (!lengthSquared) continue;
            const t = Math.max(0, Math.min(1, ((position.x-a.x)*dx+(position.z-a.z)*dz)/lengthSquared));
            const towardX = a.x+t*dx-position.x, towardZ = a.z+t*dz-position.z;
            const distance = towardX*towardX+towardZ*towardZ;
            if (distance < nearest) { nearest = distance; yaw = Math.atan2(towardX, towardZ); }
        }
        if (nearest < Infinity) return yaw;
        const facing = String(detail.facing || '').toLowerCase();
        return facing.includes('east') ? Math.PI/2 : facing.includes('west') ? -Math.PI/2 : facing.includes('north') ? Math.PI : 0;
    }

    function createPlotArchitectureMesh(plotNo, detail, status, colorHex, pWidth, pDepth, styleKey, plotGroup) {
        const style = styleKey || customPlotStyles[plotNo] || globalDefaultStyle || 'villa';
        if (style === 'downloaded' && downloadedHouseTemplate) {
            const wrapper = new THREE.Group();
            const house = new THREE.LOD();
            house.autoUpdate = false;
            if (downloadedHouseFullTemplate) house.addLevel(downloadedHouseFullTemplate.clone(true), 0);
            house.addLevel(downloadedHouseTemplate.clone(true), downloadedHouseFullTemplate ? 160 : 0);
            if (downloadedHouseFarTemplate) house.addLevel(downloadedHouseFarTemplate.clone(true), 600);
            houseLods.set(String(plotNo), house);
            const yaw = roadFacingYaw(plotGroup, detail);
            const rotatedWidth = Math.abs(Math.cos(yaw))*downloadedHouseSize.x + Math.abs(Math.sin(yaw))*downloadedHouseSize.z;
            const rotatedDepth = Math.abs(Math.sin(yaw))*downloadedHouseSize.x + Math.abs(Math.cos(yaw))*downloadedHouseSize.z;
            const scale = Math.min(pWidth * .86 / rotatedWidth, pDepth * .86 / rotatedDepth) * 1.10;
            house.scale.setScalar(scale);
            house.rotation.y = yaw;
            house.traverse(object => {
                if (!object.isMesh) return;
                object.material = object.material.clone();
                // The distant mesh needs planar faces; the exact model retains its source normals.
                object.material.flatShading = object.userData.distantHouse === true;
                object.castShadow = true;
                object.receiveShadow = true;
                object.userData.sharedHouseGeometry = true;
            });
            wrapper.add(house);
            const pickHeight = downloadedHouseSize.y * scale;
            const pickProxy = new THREE.Mesh(
                new THREE.BoxGeometry(rotatedWidth * scale, pickHeight, rotatedDepth * scale),
                new THREE.MeshBasicMaterial({visible:false})
            );
            pickProxy.position.y = pickHeight / 2;
            wrapper.add(pickProxy);
            wrapper.position.y = .24;
            wrapper.userData = {plotNo, detail, status, baseColorHex:colorHex,
                baseColor:new THREE.Color(colorHex), defaultY:.24, pWidth, pDepth,
                pHeight:downloadedHouseSize.y * scale + .24, parentGroup:plotGroup, styleKey:'downloaded'};
            return wrapper;
        }
        const colorThree = new THREE.Color(colorHex);
        const roofColor = colorThree.clone().multiplyScalar(0.70);
        const plinthH = 0.16;

        let mainMesh;
        let roofMesh = null;
        let totalH = plinthH + 1.2;
        let defaultY = 0;

        if (style === 'open') {
            // Open Residential Plot: Green lawn turf plinth + perimeter boundary walls + entry pillars
            const lawnH = 0.22;
            const lawnGeo = new THREE.BoxGeometry(pWidth * 0.90, lawnH, pDepth * 0.90);
            const lawnMat = new THREE.MeshStandardMaterial({
                color: 0x16a34a,
                roughness: 0.8,
                metalness: 0.05,
                emissive: 0x14532d,
                emissiveIntensity: 0.15
            });
            mainMesh = new THREE.Mesh(lawnGeo, lawnMat);
            defaultY = plinthH + lawnH / 2 + 0.08;
            mainMesh.position.y = defaultY;

            // Perimeter low boundary wall (0.35m high)
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
            const wallThick = 0.12;
            const wallH = 0.35;
            const wL = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, pDepth * 0.88), wallMat);
            wL.position.set(-pWidth * 0.44, wallH / 2 + lawnH / 2, 0);
            mainMesh.add(wL);

            const wR = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, pDepth * 0.88), wallMat);
            wR.position.set(pWidth * 0.44, wallH / 2 + lawnH / 2, 0);
            mainMesh.add(wR);

            const wB = new THREE.Mesh(new THREE.BoxGeometry(pWidth * 0.88, wallH, wallThick), wallMat);
            wB.position.set(0, wallH / 2 + lawnH / 2, -pDepth * 0.44);
            mainMesh.add(wB);

            // Front entry gate posts with status beacon
            const postGeo = new THREE.BoxGeometry(0.28, 0.65, 0.28);
            const postMat = new THREE.MeshStandardMaterial({ color: colorThree, emissive: colorThree, emissiveIntensity: 0.3 });
            const pL = new THREE.Mesh(postGeo, postMat);
            pL.position.set(-pWidth * 0.22, 0.32, pDepth * 0.44);
            mainMesh.add(pL);

            const pR = new THREE.Mesh(postGeo, postMat);
            pR.position.set(pWidth * 0.22, 0.32, pDepth * 0.44);
            mainMesh.add(pR);

            totalH = plinthH + lawnH + 0.65;

        } else if (style === 'duplex') {
            // Contemporary 2-Tier Stacked Duplex with cantilever & rooftop pergola terrace
            const houseW = pWidth * 0.74;
            const houseD = pDepth * 0.70;
            const floor1H = 0.95;
            const floor2H = 0.90;

            const houseMat = new THREE.MeshStandardMaterial({
                color: colorThree,
                roughness: 0.48,
                metalness: 0.08,
                emissive: colorThree,
                emissiveIntensity: 0.14
            });

            // Ground Floor
            const f1Geo = new THREE.BoxGeometry(houseW, floor1H, houseD);
            mainMesh = new THREE.Mesh(f1Geo, houseMat);
            defaultY = plinthH + floor1H / 2 + 0.08;
            mainMesh.position.y = defaultY;

            // Cantilevered Upper Floor (shifted slightly)
            const f2Geo = new THREE.BoxGeometry(houseW * 0.82, floor2H, houseD * 0.82);
            const f2Mat = new THREE.MeshStandardMaterial({
                color: colorThree.clone().lerp(new THREE.Color(0xffffff), 0.25),
                roughness: 0.42,
                emissive: colorThree,
                emissiveIntensity: 0.12
            });
            const f2Mesh = new THREE.Mesh(f2Geo, f2Mat);
            f2Mesh.position.set(-houseW * 0.06, floor1H / 2 + floor2H / 2, -houseD * 0.06);
            f2Mesh.castShadow = true;
            mainMesh.add(f2Mesh);

            // Rooftop Pergola Beams
            const pergolaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
            for (let i = -2; i <= 2; i++) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.65, 0.08, 0.08), pergolaMat);
                b.position.set(-houseW * 0.06, floor1H / 2 + floor2H + 0.40, -houseD * 0.06 + (i * houseD * 0.12));
                mainMesh.add(b);
            }

            // Glass Balcony Railing
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                roughness: 0.1,
                metalness: 0.7,
                transparent: true,
                opacity: 0.65
            });
            const bal = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.78, 0.32, 0.04), glassMat);
            bal.position.set(0, floor1H / 2 + 0.16, houseD / 2 + 0.02);
            mainMesh.add(bal);

            // Panoramic Front Window
            const winMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.3 });
            const win = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.38, 0.55, 0.04), winMat);
            win.position.set(houseW * 0.15, 0, houseD / 2 + 0.02);
            mainMesh.add(win);

            totalH = plinthH + floor1H + floor2H + 0.5;

        } else if (style === 'bungalow') {
            // Classic Single-Floor Sprawling Estate Bungalow with Columned Veranda
            const houseW = pWidth * 0.80;
            const houseD = pDepth * 0.76;
            const houseH = 1.05;
            const roofH = 0.80;

            const houseMat = new THREE.MeshStandardMaterial({
                color: colorThree,
                roughness: 0.55,
                metalness: 0.05,
                emissive: colorThree,
                emissiveIntensity: 0.12
            });
            const houseGeo = new THREE.BoxGeometry(houseW, houseH, houseD);
            mainMesh = new THREE.Mesh(houseGeo, houseMat);
            defaultY = plinthH + houseH / 2 + 0.08;
            mainMesh.position.y = defaultY;

            // Wide Overhanging Hipped Tiled Roof
            const rGeo = new THREE.ConeGeometry(Math.sqrt(Math.pow(houseW * 0.62, 2) + Math.pow(houseD * 0.62, 2)), roofH, 4);
            rGeo.rotateY(Math.PI / 4);
            const rMat = new THREE.MeshStandardMaterial({
                color: roofColor,
                roughness: 0.45,
                emissive: roofColor,
                emissiveIntensity: 0.10
            });
            roofMesh = new THREE.Mesh(rGeo, rMat);
            roofMesh.position.set(0, houseH / 2 + roofH / 2, 0);
            roofMesh.castShadow = true;
            mainMesh.add(roofMesh);

            // Front Veranda Porch with 4 White Columns
            const colMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
            const colGeo = new THREE.CylinderGeometry(0.08, 0.08, houseH * 0.88, 8);
            for (let c = -1.5; c <= 1.5; c += 1.0) {
                const col = new THREE.Mesh(colGeo, colMat);
                col.position.set(c * (houseW * 0.22), -houseH * 0.06, houseD / 2 + 0.28);
                mainMesh.add(col);
            }
            // Veranda Roof Overhang
            const vRoof = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.84, 0.08, 0.38), rMat);
            vRoof.position.set(0, houseH / 2 - 0.02, houseD / 2 + 0.18);
            mainMesh.add(vRoof);

            // Front Arched Door
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
            const door = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.20, 0.68, 0.04), doorMat);
            door.position.set(0, -houseH / 2 + 0.34, houseD / 2 + 0.02);
            mainMesh.add(door);

            totalH = plinthH + houseH + roofH;

        } else {
            // Default 'villa': Architectural 2-story Villa with pitched roof & chimney
            const houseW = pWidth * 0.72;
            const houseD = pDepth * 0.68;
            const houseH = 1.35;
            const roofH = 1.05;

            const houseMat = new THREE.MeshStandardMaterial({
                color: colorThree,
                roughness: 0.52,
                metalness: 0.05,
                emissive: colorThree,
                emissiveIntensity: 0.14,
                transparent: true,
                opacity: 0.96,
                depthWrite: true
            });
            const houseGeo = new THREE.BoxGeometry(houseW, houseH, houseD);
            mainMesh = new THREE.Mesh(houseGeo, houseMat);
            defaultY = plinthH + houseH / 2 + 0.08;
            mainMesh.position.y = defaultY;

            // Pitched Hip Roof
            const roofRadius = Math.sqrt(Math.pow(houseW * 0.58, 2) + Math.pow(houseD * 0.58, 2));
            const roofGeo = new THREE.ConeGeometry(roofRadius, roofH, 4);
            roofGeo.rotateY(Math.PI / 4);
            const rMat = new THREE.MeshStandardMaterial({
                color: roofColor,
                roughness: 0.45,
                metalness: 0.05,
                emissive: roofColor,
                emissiveIntensity: 0.08,
                transparent: true,
                opacity: 0.96,
                depthWrite: true
            });
            roofMesh = new THREE.Mesh(roofGeo, rMat);
            roofMesh.position.set(0, houseH / 2 + roofH / 2, 0);
            roofMesh.castShadow = true;
            roofMesh.renderOrder = 21;
            mainMesh.add(roofMesh);

            // Door
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
            const door = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.24, 0.75, 0.06), doorMat);
            door.position.set(0, -houseH / 2 + 0.38, houseD / 2 + 0.03);
            mainMesh.add(door);

            // Windows
            const winMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.6, emissive: 0x38bdf8, emissiveIntensity: 0.25 });
            const winL = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.20, 0.42, 0.05), winMat);
            winL.position.set(-houseW * 0.27, -0.05, houseD / 2 + 0.03);
            mainMesh.add(winL);
            const winR = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.20, 0.42, 0.05), winMat);
            winR.position.set(houseW * 0.27, -0.05, houseD / 2 + 0.03);
            mainMesh.add(winR);

            // Chimney
            const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.60, 0.32), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }));
            chimney.position.set(houseW * 0.24, houseH / 2 + roofH * 0.52, -houseD * 0.15);
            mainMesh.add(chimney);

            totalH = plinthH + houseH + roofH;
        }

        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        mainMesh.renderOrder = 20;

        mainMesh.userData = {
            plotNo,
            detail,
            status,
            baseColorHex: colorHex,
            baseColor: colorThree.clone(),
            roofColor: roofColor.clone(),
            roofMesh: roofMesh,
            defaultY: defaultY,
            pWidth,
            pDepth,
            pHeight: totalH,
            parentGroup: plotGroup,
            styleKey: style
        };
        if (roofMesh) roofMesh.userData = { plotNo, parentMesh: mainMesh };

        return mainMesh;
    }

    /**
     * Setup Streetlights along roads
     */
    function setupStreetLights() {
        if (!window.AVATAR3_STREETLIGHT_B64 || !THREE.GLTFLoader) return;
        const parse = b64 => new Promise((resolve, reject) => {
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            new THREE.GLTFLoader().parse(bytes.buffer, '', gltf => resolve(gltf.scene), reject);
        });
        Promise.all([parse(window.AVATAR3_STREETLIGHT_B64), parse(window.AVATAR3_STREETLIGHT_FAR_B64)])
            .then(([near, far]) => {
                // Alternate plots in spatial road-side order, rather than plot-number order.
                const rows = new Map();
                Object.entries(plotGroups).forEach(([plotNo, group]) => {
                    const yaw = roadFacingYaw(group, getPlotDetails(plotNo));
                    const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
                    const alongX = Math.abs(direction.x) > Math.abs(direction.z);
                    const side = alongX ? Math.sign(direction.x) : Math.sign(direction.z);
                    const rowKey = `${alongX ? 'x' : 'z'}:${side}:${Math.round((alongX ? group.position.x : group.position.z) / 3)}`;
                    if (!rows.has(rowKey)) rows.set(rowKey, []);
                    rows.get(rowKey).push({plotNo, group, yaw, direction, order:alongX ? group.position.z : group.position.x});
                });
                rows.forEach(row => {
                    row.sort((a, b) => a.order - b.order || Number(a.plotNo) - Number(b.plotNo));
                    row.forEach((item, index) => {
                        if (index % 2) return;
                        const data = plotMeshes[item.plotNo].userData;
                        const edge = (Math.abs(item.direction.x) * data.pWidth + Math.abs(item.direction.z) * data.pDepth) / 2;
                        const position = item.group.position.clone().addScaledVector(item.direction, edge + .45);
                        position.y = .12;
                        streetLightPlacements.push({plotNo:item.plotNo, position, yaw:item.yaw});
                    });
                });
                streetLightGroup = new THREE.Group();
                streetLightGroup.name = 'DownloadedStreetLights';
                layoutWorldGroup.add(streetLightGroup);
                [near, far].forEach((model, level) => {
                    const bounds = new THREE.Box3().setFromObject(model);
                    const center = bounds.getCenter(new THREE.Vector3());
                    const scale = 3.8 / bounds.getSize(new THREE.Vector3()).y;
                    const normalization = new THREE.Matrix4().makeScale(scale, scale, scale);
                    normalization.multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
                    model.updateMatrixWorld(true);
                    model.traverse(object => {
                        if (!object.isMesh) return;
                        const material = object.material.clone();
                        if (material.emissive && material.emissive.getHex() !== 0) streetLightEmissiveMaterials.push(material);
                        const mesh = new THREE.InstancedMesh(object.geometry, material, streetLightPlacements.length);
                        mesh.name = `StreetLamp-${level}-${object.name}`;
                        mesh.castShadow = false;
                        mesh.receiveShadow = true;
                        // Instance matrices change with LOD; disable the single-source bounding sphere.
                        mesh.frustumCulled = false;
                        mesh.count = 0;
                        streetLightGroup.add(mesh);
                        streetLightBatches.push({mesh, level, source:normalization.clone().multiply(object.matrixWorld)});
                    });
                });
                updateStreetLightGlow();
                updateStreetLightDetail(true);
            }).catch(error => console.error('Downloaded street lamps could not load:', error));
    }

    function updateStreetLightGlow() {
        streetLightEmissiveMaterials.forEach(material => {
            material.emissive.set(0xffdf9e);
            material.emissiveIntensity = currentLightingMode === 'night' ? 2.5 : currentLightingMode === 'sunset' ? 1.3 : .15;
        });
    }

    function updateStreetLightDetail(force = false) {
        if (!streetLightGroup) return;
        const now = performance.now();
        if (!force && now - lastStreetLightUpdate < 250) return;
        lastStreetLightUpdate = now;
        layoutWorldGroup.updateMatrixWorld(true);
        const ranked = streetLightPlacements.map(item => ({...item,
            distance:item.position.clone().applyMatrix4(layoutWorldGroup.matrixWorld).distanceTo(camera.position)}))
            .sort((a, b) => a.distance - b.distance);
        const nearby = new Set(ranked.filter(item => item.distance < 90).slice(0, 8).map(item => item.plotNo));
        streetLightBatches.forEach(batch => {
            let count = 0;
            streetLightPlacements.forEach(item => {
                if ((batch.level === 0) !== nearby.has(item.plotNo)) return;
                const matrix = new THREE.Matrix4().compose(item.position,
                    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.yaw), new THREE.Vector3(1, 1, 1));
                batch.mesh.setMatrixAt(count++, matrix.multiply(batch.source));
            });
            batch.mesh.count = count;
            batch.mesh.instanceMatrix.needsUpdate = true;
        });
    }

    /**
     * Setup Exactly ONE Roaming Car Touring the Entire Layout on Black Roads
     */
    function setupSingleRoamingCar() {
        const group = new THREE.Group();
        const color = 0xf8fafc; // Pearl White Modern SUV

        const bodyW = 1.9;
        const bodyL = 4.0;
        const bodyH = 1.3;

        // 1. Lower chassis / body
        const chassisGeo = new THREE.BoxGeometry(bodyW, bodyH * 0.48, bodyL);
        const paintMat = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.75,
            roughness: 0.25
        });
        const chassis = new THREE.Mesh(chassisGeo, paintMat);
        chassis.position.y = bodyH * 0.28 + 0.12;
        chassis.castShadow = true;
        group.add(chassis);

        // 2. Cabin / Tinted Glass
        const cabinW = bodyW * 0.84;
        const cabinL = bodyL * 0.54;
        const cabinH = bodyH * 0.56;
        const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.92
        });
        const cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, bodyH * 0.65 + 0.12, -bodyL * 0.05);
        cabin.castShadow = true;
        group.add(cabin);

        // 3. Cabin Roof Top
        const roofGeo = new THREE.BoxGeometry(cabinW * 0.96, 0.08, cabinL * 0.92);
        const roof = new THREE.Mesh(roofGeo, paintMat);
        roof.position.set(0, bodyH * 0.65 + cabinH / 2 + 0.16, -bodyL * 0.05);
        group.add(roof);

        // 4. Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });

        const wheels = [];
        const xOffset = bodyW / 2 + 0.02;
        const zFront = bodyL * 0.30;
        const zRear = -bodyL * 0.30;
        const wheelY = 0.34;

        [
            [-xOffset, wheelY, zFront],
            [xOffset, wheelY, zFront],
            [-xOffset, wheelY, zRear],
            [xOffset, wheelY, zRear]
        ].forEach(([wx, wy, wz]) => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(wx, wy, wz);
            const tire = new THREE.Mesh(wheelGeo, tireMat);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 8), rimMat);
            rim.rotateZ(Math.PI / 2);
            wheelGroup.add(tire);
            wheelGroup.add(rim);
            group.add(wheelGroup);
            wheels.push(tire);
        });

        // 5. Front Headlights (+Z Forward)
        headlightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfef08a,
            emissiveIntensity: 1.5
        });
        const headGeo = new THREE.BoxGeometry(0.4, 0.16, 0.1);
        const headL = new THREE.Mesh(headGeo, headlightMat);
        headL.position.set(-bodyW * 0.34, bodyH * 0.32 + 0.12, bodyL / 2 + 0.04);
        const headR = new THREE.Mesh(headGeo, headlightMat);
        headR.position.set(bodyW * 0.34, bodyH * 0.32 + 0.12, bodyL / 2 + 0.04);
        group.add(headL);
        group.add(headR);

        // Forward Beam Projection
        const beamGeo = new THREE.ConeGeometry(1.2, 5.0, 10);
        beamGeo.rotateX(-Math.PI / 2);
        beamGeo.translate(0, 0, 2.5);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, bodyH * 0.30, bodyL / 2 + 0.2);
        group.add(beam);

        // 6. Rear Taillights (-Z Rear)
        taillightMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xdc2626,
            emissiveIntensity: 1.4
        });
        const tailGeo = new THREE.BoxGeometry(0.4, 0.15, 0.08);
        const tailL = new THREE.Mesh(tailGeo, taillightMat);
        tailL.position.set(-bodyW * 0.34, bodyH * 0.34 + 0.12, -bodyL / 2 - 0.04);
        const tailR = new THREE.Mesh(tailGeo, taillightMat);
        tailR.position.set(bodyW * 0.34, bodyH * 0.34 + 0.12, -bodyL / 2 - 0.04);
        group.add(tailL);
        group.add(tailR);

        group.userData = { wheels, beam };

        // 48 Precision Waypoints strictly along Black Road Corridors (Zero Plot Collisions)
        const wholeLayoutWaypoints = [
            // 1. Entrance Road (Main Gate to Boulevard past Park-1)
            { x: 91.25, z: -9.01 },  // Main Entrance Gate
            { x: 75.00, z: -1.00 },  // Along Park-1
            { x: 60.00, z: 6.75 },
            { x: 47.50, z: 13.51 },
            { x: 41.25, z: 16.26 },  // Avenue 1 & Central Boulevard Junction

            // 2. Avenue 1 North & South
            { x: 41.00, z: -26.52 }, // Avenue 1 North end
            { x: 41.25, z: 16.26 },  // Return to Boulevard
            { x: 41.25, z: 44.78 },  // Avenue 1 South end
            { x: 41.25, z: 16.26 },  // Return to Boulevard

            // 3. Central Boulevard West to Avenue 2
            { x: 23.75, z: 16.26 },  // Avenue 2 Junction

            // 4. Avenue 2 North & South
            { x: 22.75, z: -26.52 }, // Avenue 2 North end
            { x: 23.75, z: 16.26 },  // Return to Boulevard
            { x: 24.25, z: 49.79 },  // Avenue 2 South end
            { x: 23.75, z: 16.26 },  // Return to Boulevard

            // 5. Central Boulevard West to Avenue 3
            { x: 6.00, z: 16.26 },   // Avenue 3 Junction

            // 6. Avenue 3 North & South
            { x: 5.75, z: -26.52 },  // Avenue 3 North end
            { x: 6.00, z: 16.26 },   // Return to Boulevard
            { x: 6.00, z: 54.79 },   // Avenue 3 South end
            { x: 6.00, z: 16.26 },   // Return to Boulevard

            // 7. Central Boulevard West to Avenue 4
            { x: -10.50, z: 16.26 }, // Avenue 4 Junction

            // 8. Avenue 4 North & South
            { x: -11.25, z: -26.52 },// Avenue 4 North end
            { x: -10.50, z: 16.26 }, // Return to Boulevard
            { x: -10.00, z: 54.79 }, // Avenue 4 South end
            { x: -10.50, z: 16.26 }, // Return to Boulevard

            // 9. Central Boulevard West to Avenue 5
            { x: -26.00, z: 16.26 }, // Avenue 5 Junction

            // 10. Avenue 5 North & South
            { x: -26.25, z: -26.52 },// Avenue 5 North end
            { x: -26.00, z: 16.26 }, // Return to Boulevard
            { x: -26.00, z: 46.03 }, // Avenue 5 South end
            { x: -26.00, z: 16.26 }, // Return to Boulevard

            // 11. Central Boulevard West into Avenue 6 & Upper Northwest Loop (Plots 167-206)
            { x: -42.50, z: 16.26 }, // West Boulevard Junction
            { x: -58.75, z: 16.26 }, // Turn onto Avenue 6
            { x: -58.25, z: -10.26 },// Along Avenue 6 Northbound
            { x: -58.75, z: -35.29 },// Mid Horizontal Crossing Junction
            { x: -59.25, z: -56.56 },// Northwest Top Turn
            { x: -43.50, z: -56.56 },// Top Road Eastward
            { x: -43.50, z: -36.54 },// Northeast Turn Southward
            { x: -58.75, z: -36.54 },// Cross back to Avenue 6
            { x: -58.25, z: -10.26 },// Southward along Avenue 6
            { x: -58.75, z: 16.26 }, // Reach Boulevard
            { x: -42.50, z: 16.26 }, // Boulevard Eastbound

            // 12. Return Journey Eastbound along Central Boulevard to Entrance Gate
            { x: -26.00, z: 16.26 },
            { x: -10.50, z: 16.26 },
            { x: 6.00, z: 16.26 },
            { x: 23.75, z: 16.26 },
            { x: 41.25, z: 16.26 }, // Reach Entrance Road Junction
            { x: 47.50, z: 13.51 }, // Eastbound alongside Park-1
            { x: 60.00, z: 6.75 },
            { x: 75.00, z: -1.00 }
        ];

        singleCarMesh = group;
        singleCarMesh.position.set(wholeLayoutWaypoints[0].x, 0.45, wholeLayoutWaypoints[0].z);
        layoutWorldGroup.add(singleCarMesh);

        singleCarState = {
            mesh: singleCarMesh,
            waypoints: wholeLayoutWaypoints,
            targetIndex: 1,
            speed: 15.0,
            currentYaw: 0
        };

        console.log('✅ Deployed single Pearl White SUV roaming continuously across the entire layout.');
    }

    function lerpAngle(start, end, amount) {
        let diff = (end - start) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return start + diff * amount;
    }

    /**
     * Animate Single Car Movement and Wheel Rotations
     */
    function updateSingleCar(deltaTime) {
        if (!singleCarState) return;
        const dt = Math.min(deltaTime, 0.05);
        const v = singleCarState;

        const targetWp = v.waypoints[v.targetIndex];
        const mesh = v.mesh;
        const dx = targetWp.x - mesh.position.x;
        const dz = targetWp.z - mesh.position.z;
        const dist = Math.hypot(dx, dz);
        const step = v.speed * dt;

        if (dist <= step * 1.2 || dist < 0.6) {
            mesh.position.x = targetWp.x;
            mesh.position.z = targetWp.z;
            v.targetIndex = (v.targetIndex + 1) % v.waypoints.length;
        } else {
            const dirX = dx / dist;
            const dirZ = dz / dist;
            const targetYaw = Math.atan2(dx, dz);
            v.currentYaw = lerpAngle(v.currentYaw, targetYaw, Math.min(dt * 10.0, 0.45));
            mesh.rotation.y = v.currentYaw;

            mesh.position.x += dirX * step;
            mesh.position.z += dirZ * step;
            mesh.position.y = 0.45;
        }

        // Rotate wheels
        if (mesh.userData && mesh.userData.wheels) {
            mesh.userData.wheels.forEach(tire => {
                tire.rotation.x += step * 3.5;
            });
        }
    }

    /**
     * Setup Ground Highlight Beacon Ring
     */
    function setupBeacon() {
        const ringGeo = new THREE.RingGeometry(2.5, 3.4, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        beaconRing = new THREE.Mesh(ringGeo, ringMat);
        beaconRing.rotation.x = -Math.PI / 2;
        beaconRing.position.y = 0.15;
        beaconRing.visible = false;
        layoutWorldGroup.add(beaconRing);

        beaconLight = new THREE.PointLight(0x38bdf8, 0, 40);
        beaconLight.position.y = 6;
        layoutWorldGroup.add(beaconLight);
    }

    /**
     * Main Render Loop
     */
    function startAnimationLoop() {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        lastFrameTime = performance.now();

        function animate() {
            if (!isActive) return;
            animFrameId = requestAnimationFrame(animate);

            const now = performance.now();
            const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
            lastFrameTime = now;

            // Move the single car across the layout
            updateSingleCar(delta);

            // Smooth camera glide
            if (isCameraAnimating) {
                cameraAnimProgress += CAMERA_ANIM_SPEED;
                if (cameraAnimProgress >= 1) {
                    cameraAnimProgress = 1;
                    isCameraAnimating = false;
                }
                const t = 1 - Math.pow(1 - cameraAnimProgress, 3);
                camera.position.lerpVectors(cameraStartPos, cameraEndPos, t);
                if (controls) controls.target.lerpVectors(targetStartPos, targetEndPos, t);
            }

            if (isAutoRotating && !isCameraAnimating && controls) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 1.2;
            } else if (controls) {
                controls.autoRotate = false;
            }

            // Beacon pulsing
            if (beaconRing && beaconRing.visible) {
                const s = 1 + Math.sin(performance.now() * 0.003) * 0.15;
                beaconRing.scale.set(s, s, 1);
            }

            if (controls) controls.update();
            updatePlotLabels();
            if (sunMarker && sunMarker.visible) sunMarker.position.copy(camera.position).addScaledVector(sunMarker.userData.direction,1800);
            updateHouseDetailLevels();
            updateStreetLightDetail();
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }

        animate();
    }

    const houseWorldPosition = new THREE.Vector3();
    function updateHouseDetailLevels() {
        if (!camera || !scene || !houseLods.size) return;
        scene.updateMatrixWorld();
        const nearby = [];
        houseLods.forEach((lod, plotNo) => {
            if (!plotGroups[plotNo]?.visible) return;
            lod.getWorldPosition(houseWorldPosition);
            nearby.push({lod, distance:camera.position.distanceTo(houseWorldPosition), plotNo});
        });
        nearby.sort((a,b) => a.distance-b.distance);
        if (nearby[0]?.distance < 65 && !downloadedHouseFullTemplate) loadFullHouseOnDemand();
        let fullCount = 0, mediumCount = 0;
        nearby.forEach(({lod,distance,plotNo}) => {
            let level = lod.levels.length-1;
            if (downloadedHouseFullTemplate && distance < 65 && fullCount < 1) {
                level = 0; fullCount++;
            } else if (distance < 180 && mediumCount < 8) {
                level = downloadedHouseFullTemplate ? 1 : 0; mediumCount++;
            }
            lod.levels.forEach((entry,index) => entry.object.visible = index === level);
        });
    }

    /**
     * Camera Animation Helper
     */
    function animateCameraTo(newCamPos, newTargetPos) {
        if (!camera || !controls) return;
        cameraStartPos = camera.position.clone();
        cameraEndPos = newCamPos.clone();
        targetStartPos = controls.target.clone();
        targetEndPos = newTargetPos.clone();
        cameraAnimProgress = 0;
        isCameraAnimating = true;
    }

    /**
     * Select Plot: Focus Camera, Highlight Beacon, Open Details Modal
     */
    function selectPlot(plotNo, smoothFocus = true) {
        const btn = plotButtons[plotNo];
        if (!btn) return;

        selectedPlotNo = plotNo;
        const u = btn.userData;
        const group = plotGroups[plotNo];

        if (beaconRing && group) {
            beaconRing.position.set(group.position.x, 0.15, group.position.z);
            beaconRing.visible = true;
            beaconLight.position.set(group.position.x, 7, group.position.z);
            beaconLight.color.set(u.statusHex);
            beaconLight.intensity = 2.5;
        }

        // Camera flight to plot
        if (smoothFocus && group) {
            const worldPos = new THREE.Vector3();
            group.getWorldPosition(worldPos);
            const camOffset = new THREE.Vector3(16, 24, 24);
            animateCameraTo(worldPos.clone().add(camOffset), worldPos);
        }

        populateReferenceDrawer(u.detail, plotNo, u.status, u.statusHex);
        document.getElementById('threeInspectDrawer')?.classList.remove('open');
        showPlotModal(u.detail, plotNo, u.status, u.statusHex);
        const appearance=document.querySelector('#threeInspectDetailsBody .house-style-section');
        if(appearance) { const fold=document.createElement('details'); fold.className='rt-appearance'; const title=document.createElement('summary'); title.textContent='Illustrative house style'; fold.append(title,appearance); document.getElementById('modalBody').appendChild(fold); }
    }

    /**
     * Show Plot Details Modal Card
     */
    function showPlotModal(detail, plotNo, status, statusColor) {
        if (typeof openPlotModal === 'function') { openPlotModal(plotNo); return; }
        const modal = document.getElementById('plotDetailsModal');
        if (!modal) return;

        document.getElementById('modalPlotTitle').textContent = `Plot #${plotNo}`;
        const statusBadge = document.getElementById('modalPlotStatus');
        statusBadge.textContent = status;
        statusBadge.style.background = statusColor;

        const size = detail.plot_size ? `${detail.plot_size} Sq. Yds` : '200.00 Sq. Yds';
        const sqMtr = detail.extent_sq_mtrs ? `(${detail.extent_sq_mtrs} Sq. Mtrs)` : '(167.22 Sq. Mtrs)';
        document.getElementById('modalPlotArea').textContent = size;
        document.getElementById('modalPlotSqMtr').textContent = sqMtr;

        const facing = detail.facing || 'East';
        document.getElementById('modalPlotFacing').textContent = `${facing} Facing`;

        document.getElementById('modalDimN').textContent = detail.dim_north || "36' 0\"";
        document.getElementById('modalDimS').textContent = detail.dim_south || "36' 0\"";
        document.getElementById('modalDimE').textContent = detail.dim_east || "50' 0\"";
        document.getElementById('modalDimW').textContent = detail.dim_west || "50' 0\"";

        const custRow = document.getElementById('modalCustomerRow');
        if (detail.customer_name && detail.customer_name.trim().length > 0) {
            custRow.style.display = 'flex';
            document.getElementById('modalCustomerName').textContent = detail.customer_name;
        } else {
            custRow.style.display = 'none';
        }

        modal.classList.add('show');
    }

    function hidePlotModal() {
        const modal = document.getElementById('plotDetailsModal');
        if (modal) modal.classList.remove('show');
        if (beaconRing) beaconRing.visible = false;
        if (beaconLight) beaconLight.intensity = 0;
        selectedPlotNo = null;
    }

    /**
     * Hover Tooltip
     */
    function showHoverTooltip(userData, clientX, clientY) {
        const tooltip = document.getElementById('threePlotTooltip');
        if (!tooltip) return;

        const d = userData.detail || {};
        const plotNo = userData.plotNo;
        const status = userData.status;
        const color = userData.statusHex;
        const size = d.plot_size ? `${d.plot_size} Sq. Yds` : '200 Sq. Yds';
        const facing = d.facing || 'East';

        tooltip.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 800; font-size: 13px; color: #fff;">Plot #${plotNo}</span>
                <span style="font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #24443a; color: #dce9d5;">${status}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
                <div>📐 ${size} &bull; 🧭 ${facing}</div>
            </div>
            <div style="font-size: 9.5px; color: #38bdf8; margin-top: 4px; font-weight: 600;">
                <i class="fa-solid fa-hand-pointer"></i> Click house to view details
            </div>
        `;

        tooltip.style.position = 'fixed';
        tooltip.style.left = `${clientX + 16}px`;
        tooltip.style.top = `${clientY + 16}px`;
        tooltip.style.display = 'block';
    }

    function hideHoverTooltip() {
        const tooltip = document.getElementById('threePlotTooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    /**
     * Filter Plots (All, Available, Sold, Mortgage)
     */
    function filterPlots(status) {
        activeFilterStatus = String(status || 'ALL').toUpperCase();

        Object.keys(plotButtons).forEach(pNo => {
            const btn = plotButtons[pNo];
            const mesh = plotMeshes[pNo];
            if (!btn) return;

            const plotStatus = String(btn.userData.status || '').toUpperCase();
            let match = false;
            if (activeFilterStatus === 'ALL') {
                match = true;
            } else if (activeFilterStatus === plotStatus || (activeFilterStatus === 'AVAILABLE' && ['MORTGAGE', 'RESALE'].includes(plotStatus))) {
                match = true;
            }

            btn.visible = match;
            if (plotGroups[pNo]) plotGroups[pNo].visible = match && !isLayoutOnly;
        });
    }

    /**
     * Mouse & Click Interaction Setup
     */
    function setupEventListeners(container) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        function getCanvasCoords(e) {
            const rect = container.getBoundingClientRect();
            return {
                x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
                y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
                clientX: e.clientX,
                clientY: e.clientY
            };
        }

        container.addEventListener('mousemove', (e) => {
            const c = getCanvasCoords(e);
            mouse.x = c.x;
            mouse.y = c.y;

            raycaster.setFromCamera(mouse, camera);
            const targets = [];
            Object.values(plotGroups).filter(group => group.visible).forEach(group => group.traverseVisible(object => {
                if ((object.isMesh && !object.userData.sharedHouseGeometry) || object.isSprite) targets.push(object);
            }));
            const hits = raycaster.intersectObjects(targets, false);

            if (hits.length > 0) {
                const hitObj = hits[0].object;
                const plotNo = hitObj.userData.plotNo;
                if (plotNo) {
                    container.style.cursor = 'pointer';
                    const btn = plotButtons[plotNo];
                    if (hoveredButton !== btn) {
                        if (hoveredButton) scalePlotLabel(hoveredButton);
                        hoveredButton = btn;
                        if (btn) scalePlotLabel(btn);
                    }
                    showHoverTooltip(hitObj.userData, c.clientX, c.clientY);
                    return;
                }
            }

            container.style.cursor = 'grab';
            if (hoveredButton) {
                scalePlotLabel(hoveredButton);
                hoveredButton = null;
            }
            hideHoverTooltip();
        });

        container.addEventListener('mouseleave', () => {
            if (hoveredButton) {
                scalePlotLabel(hoveredButton);
                hoveredButton = null;
            }
            hideHoverTooltip();
        });

        container.addEventListener('click', (e) => {
            const c = getCanvasCoords(e);
            mouse.x = c.x;
            mouse.y = c.y;

            raycaster.setFromCamera(mouse, camera);
            const targets = [];
            Object.values(plotGroups).filter(group => group.visible).forEach(group => group.traverseVisible(object => {
                if ((object.isMesh && !object.userData.sharedHouseGeometry) || object.isSprite) targets.push(object);
            }));
            const hits = raycaster.intersectObjects(targets, false);

            if (hits.length > 0) {
                const plotNo = hits[0].object.userData.plotNo;
                if (plotNo) {
                    selectPlot(plotNo, true);
                }
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            const w = container.clientWidth || window.innerWidth;
            const h = container.clientHeight || (window.innerHeight - 64);
            if (w === 0 || h === 0) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
    }

    /**
     * UI Buttons and Controls
     */
    function loadDownloadedHouse() {
        if (!window.AVATAR3_DOWNLOADED_HOUSE_B64 || !THREE.GLTFLoader) return;
        const parseModel = encoded => new Promise((resolve, reject) => {
            const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
            new THREE.GLTFLoader().parse(bytes.buffer, '', gltf => resolve(gltf.scene), reject);
        });
        Promise.all([
            parseModel(window.AVATAR3_DOWNLOADED_HOUSE_B64),
            Promise.resolve(null),
            window.AVATAR3_DOWNLOADED_HOUSE_FAR_B64 ? parseModel(window.AVATAR3_DOWNLOADED_HOUSE_FAR_B64) : Promise.resolve(null)
        ]).then(([model, full, far]) => {
            const bounds = new THREE.Box3().setFromObject(model);
            downloadedHouseSize = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            model.position.set(-center.x, -bounds.min.y, -center.z);
            downloadedHouseTemplate = new THREE.Group();
            model.traverse(object => { if (object.isMesh) object.userData.distantHouse = true; });
            downloadedHouseTemplate.add(model);
            if (far) {
                const farBounds = new THREE.Box3().setFromObject(far);
                const farCenter = farBounds.getCenter(new THREE.Vector3());
                far.position.set(-farCenter.x, -farBounds.min.y, -farCenter.z);
                far.traverse(object => { if (object.isMesh) object.userData.distantHouse = true; });
                downloadedHouseFarTemplate = new THREE.Group();
                downloadedHouseFarTemplate.add(far);
            }
            if (full) {
                const fullBounds = new THREE.Box3().setFromObject(full);
                const fullCenter = fullBounds.getCenter(new THREE.Vector3());
                downloadedHouseSize = fullBounds.getSize(new THREE.Vector3());
                full.position.set(-fullCenter.x, -fullBounds.min.y, -fullCenter.z);
                downloadedHouseFullTemplate = new THREE.Group();
                downloadedHouseFullTemplate.add(full);
            }
            globalDefaultStyle = 'downloaded';
            Object.keys(plotMeshes).forEach(plotNo => {
                customPlotStyles[plotNo] = 'downloaded';
                rebuildPlotModel(plotNo, 'downloaded', false, false);
            });
            try { localStorage.setItem('avatar3_house_styles_v1', JSON.stringify(customPlotStyles)); } catch (_) {}
            if (selectedPlotNo) {
                const data = plotMeshes[selectedPlotNo].userData;
                populateReferenceDrawer(data.detail, selectedPlotNo, data.status, data.baseColorHex);
            }
        }).catch(error => console.error('Downloaded house could not be loaded:', error));
    }

    function loadFullHouseOnDemand() {
        if (fullHouseRequested || !downloadedHouseTemplate) return;
        fullHouseRequested = true;
        const script = document.createElement('script');
        script.src = 'downloaded_house_full_data.js';
        script.onload = () => {
            const bytes = Uint8Array.from(atob(window.AVATAR3_DOWNLOADED_HOUSE_FULL_B64), c => c.charCodeAt(0));
            new THREE.GLTFLoader().parse(bytes.buffer, '', gltf => {
                const model = gltf.scene;
                const bounds = new THREE.Box3().setFromObject(model);
                const center = bounds.getCenter(new THREE.Vector3());
                model.position.set(-center.x, -bounds.min.y, -center.z);
                downloadedHouseFullTemplate = new THREE.Group();
                downloadedHouseFullTemplate.add(model);
                Object.keys(plotMeshes).forEach(plotNo => {
                    if (plotMeshes[plotNo].userData.styleKey === 'downloaded') rebuildPlotModel(plotNo, 'downloaded', false, false);
                });
                delete window.AVATAR3_DOWNLOADED_HOUSE_FULL_B64;
                script.remove();
            }, error => console.error('Close-up house could not load:', error));
        };
        script.onerror = () => console.error('Close-up house asset could not load.');
        document.head.appendChild(script);
    }

    function setupUI() {
        setupReferenceControls();
        loadDownloadedHouse();
        // Lighting Buttons
        document.querySelectorAll('.btn-light-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-light-mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyLightingMode(btn.dataset.mode);
            });
        });

        // Reset View
        const resetBtn = document.getElementById('threeResetViewBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                window.reset3DCamera();
            });
        }

        // Auto Orbit
        const orbitBtn = document.getElementById('threeAutoRotateBtn');
        if (orbitBtn) {
            orbitBtn.addEventListener('click', () => {
                isAutoRotating = !isAutoRotating;
                orbitBtn.classList.toggle('active', isAutoRotating);
            });
        }

        // Status Filters
        document.querySelectorAll('.three-filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.three-filter-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterPlots(btn.dataset.status);
            });
        });

        // Search Input
        const searchInput = document.getElementById('plotSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const plotNo = searchInput.value.trim();
                    if (plotButtons[plotNo]) {
                        selectPlot(plotNo, true);
                    } else {
                        searchInput.style.outline = '2px solid #ef4444';
                        setTimeout(() => searchInput.style.outline = 'none', 1200);
                    }
                }
            });
        }

        // Close Modal
        const closeBtn = document.getElementById('modalCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hidePlotModal);
        }

        // Download Proper 3D File (.GLB)
        const downloadBtn = document.getElementById('btnDownloadGLB');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', download3DModelGLB);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hidePlotModal();
        });
    }

    /**
     * Export & Download Complete 3D Architectural Scene as binary .GLB file
     */
    function download3DModelGLB() {
        const btn = document.getElementById('btnDownloadGLB');
        if (typeof THREE.GLTFExporter === 'undefined') {
            alert('GLTFExporter is loading, please try again in a moment.');
            return;
        }

        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading 3D...';

        // 1. Direct download of the verified complete 3D GLB model
        const downloadLink = document.createElement('a');
        downloadLink.href = 'avatar3_3d_layout.glb';
        downloadLink.download = 'avatar3_3d_layout.glb';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        setTimeout(() => {
            if (btn) btn.innerHTML = '<i class="fa-solid fa-cube"></i> 3D File (.GLB)';
        }, 1200);
    }





    function populateReferenceDrawer(detail, plotNo, status, colorHex) {
        const drawer = document.getElementById('threeInspectDrawer');
        if (!drawer) return;

        const size = (!detail || !detail.plot_size || detail.plot_size === 'N/A') ? 'N/A' : detail.plot_size + ' Sq. Yards';
        const facing = (detail && detail.facing) ? detail.facing : 'N/A';
        const refName = (detail && detail.reference_name) ? detail.reference_name : 'ASPIREALTY';
        const dimN = (detail && detail.dim_north) ? detail.dim_north : '-';
        const dimS = (detail && detail.dim_south) ? detail.dim_south : '-';
        const dimE = (detail && detail.dim_east) ? detail.dim_east : '-';
        const dimW = (detail && detail.dim_west) ? detail.dim_west : '-';

        const titleEl = document.getElementById('threeInspectPlotTitle');
        if (titleEl) {
            titleEl.innerHTML = `
                <span>Plot #${plotNo}</span>
                <span class="status-badge" style="--badge-color: ${colorHex}; --badge-glow: ${colorHex}; font-size: 10.5px; padding: 2px 8px;">${status}</span>
            `;
        }

        const bodyEl = document.getElementById('threeInspectDetailsBody');
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="detail-row" style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-secondary);">Plot Area</span>
                    <strong style="color: var(--text-primary); font-weight: 700;">${size}</strong>
                </div>
                <div class="detail-row" style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-secondary);">Facing</span>
                    <strong style="color: var(--text-primary); font-weight: 700;">${facing}</strong>
                </div>
                <div class="detail-row" style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; font-size: 12px;">
                    <span style="color: var(--text-secondary);">Reference</span>
                    <strong style="color: #60a5fa; font-weight: 700;">${refName}</strong>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #94a3b8;">Dimensions:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: rgba(0,0,0,0.25); padding: 6px; border-radius: 6px;">
                        <div>N: <strong style="color: #fff;">${dimN}</strong></div>
                        <div>S: <strong style="color: #fff;">${dimS}</strong></div>
                        <div>E: <strong style="color: #fff;">${dimE}</strong></div>
                        <div>W: <strong style="color: #fff;">${dimW}</strong></div>
                    </div>
                </div>

                <!-- 3D House Customization Section -->
                <div class="house-style-section">
                    <div class="house-style-title">
                        <span><i class="fa-solid fa-house-chimney" style="color: #38bdf8;"></i> House Style Customizer</span>
                        <span style="font-size: 9.5px; color: #94a3b8;">Real-Time 3D</span>
                    </div>
                    <div class="house-style-grid">
                        <div class="house-style-card ${(customPlotStyles[plotNo] || globalDefaultStyle) === 'downloaded' ? 'active' : ''}" data-style="downloaded" title="Your downloaded Modern Lego House by Arrcaz">
                            <i class="fa-solid fa-house house-style-icon"></i>
                            <div class="house-style-name">Downloaded House</div>
                            <div class="house-style-desc">Modern Lego House</div>
                        </div>
                        <div class="house-style-card ${(customPlotStyles[plotNo] || globalDefaultStyle || 'villa') === 'villa' ? 'active' : ''}" data-style="villa" title="Modern Villa with pitched hip roof & panoramic windows">
                            <i class="fa-solid fa-hotel house-style-icon"></i>
                            <div class="house-style-name">Modern Villa</div>
                            <div class="house-style-desc">Gabled Roof & Porch</div>
                        </div>
                        <div class="house-style-card ${(customPlotStyles[plotNo] || globalDefaultStyle) === 'duplex' ? 'active' : ''}" data-style="duplex" title="Contemporary Duplex with cantilevered floor & rooftop pergola">
                            <i class="fa-solid fa-building house-style-icon"></i>
                            <div class="house-style-name">Luxury Duplex</div>
                            <div class="house-style-desc">2-Tier & Pergola</div>
                        </div>
                        <div class="house-style-card ${(customPlotStyles[plotNo] || globalDefaultStyle) === 'bungalow' ? 'active' : ''}" data-style="bungalow" title="Sprawling Estate Bungalow with wrap-around columned veranda">
                            <i class="fa-solid fa-house-chimney-window house-style-icon"></i>
                            <div class="house-style-name">Bungalow</div>
                            <div class="house-style-desc">Porch & Columns</div>
                        </div>
                        <div class="house-style-card ${(customPlotStyles[plotNo] || globalDefaultStyle) === 'open' ? 'active' : ''}" data-style="open" title="Open Residential Plot with green turf lawn & boundary wall">
                            <i class="fa-solid fa-vector-square house-style-icon"></i>
                            <div class="house-style-name">Open Plot</div>
                            <div class="house-style-desc">Fenced Lawn Turf</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button class="three-drawer-btn" id="threeApplyStyleToAllBtn" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #7dd3fc; font-size: 10.5px; padding: 6px;">
                            <i class="fa-solid fa-city"></i> Apply Style to All 206 Plots
                        </button>
                    </div>
                </div>
            `;

            // Attach House Style click listeners
            bodyEl.querySelectorAll('.house-style-card').forEach(card => {
                card.addEventListener('click', () => {
                    const newStyle = card.dataset.style;
                    bodyEl.querySelectorAll('.house-style-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    rebuildPlotModel(plotNo, newStyle);
                });
            });

            const applyAllBtn = document.getElementById('threeApplyStyleToAllBtn');
            if (applyAllBtn) {
                applyAllBtn.onclick = () => {
                    const activeCard = bodyEl.querySelector('.house-style-card.active');
                    const st = activeCard ? activeCard.dataset.style : 'villa';
                    applyHouseStyleToAll(st);
                };
            }
        }

        const openFullModalBtn = document.getElementById('threeOpenFullPlotModalBtn');
        if (openFullModalBtn) {
            openFullModalBtn.onclick = () => {
                if (typeof openPlotModal === 'function') {
                    openPlotModal(plotNo);
                }
            };
        }

        const view2DBtn = document.getElementById('threeViewIn2DBtn');
        if (view2DBtn) {
            view2DBtn.onclick = () => {
                document.getElementById('btnSchematicView').click();
                if (typeof focusOnPlot === 'function') {
                    focusOnPlot(plotNo);
                }
                if (typeof openPlotModal === 'function') {
                    openPlotModal(plotNo);
                }
            };
        }

        // Used only to assemble the optional appearance controls; details open directly.
    }

    function rebuildPlotModel(plotNo, styleKey, animate = true, persist = true) {
        const oldMesh = plotMeshes[plotNo];
        const group = plotGroups[plotNo];
        if (!oldMesh || !group) return;

        customPlotStyles[plotNo] = styleKey;
        if (persist) { try { localStorage.setItem('avatar3_house_styles_v1', JSON.stringify(customPlotStyles)); } catch (_) {} }
        houseLods.delete(String(plotNo));
        if (renderer) renderer.shadowMap.needsUpdate = true;
        const u = oldMesh.userData;

        // Animate out scale
        group.remove(oldMesh);

        const geometries = new Set(), materials = new Set();
        oldMesh.traverse(object => {
            if (object.geometry && !object.userData.sharedHouseGeometry) geometries.add(object.geometry);
            if (object.material) materials.add(object.material);
        });
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());

        const newMesh = createPlotArchitectureMesh(plotNo, u.detail, u.status, u.baseColorHex, u.pWidth, u.pDepth, styleKey, group);

        newMesh.name = 'House-' + plotNo;
        newMesh.traverse(object => {
            if (object.isMesh) Object.assign(object.userData, { plotNo, detail: u.detail, status: u.status, statusHex: u.baseColorHex });
        });
        group.add(newMesh);
        plotMeshes[plotNo] = newMesh;

        // Update plot label height
        if (plotButtons[plotNo]) {
            plotButtons[plotNo].position.y = newMesh.userData.pHeight + 0.8;
        }

        // Quick pop-in animation
        if (!animate) return;
        newMesh.scale.set(0.2, 0.2, 0.2);
        let scale = 0.2;
        const growInterval = setInterval(() => {
            scale += 0.2;
            if (scale >= 1.0) {
                scale = 1.0;
                clearInterval(growInterval);
            }
            newMesh.scale.set(scale, scale, scale);
        }, 16);
    }

    function applyHouseStyleToAll(styleKey) {
        globalDefaultStyle = styleKey;
        Object.keys(plotMeshes).forEach(plotNo => {
            rebuildPlotModel(plotNo, styleKey);
        });
        console.log(`✅ Applied architectural house style '${styleKey}' to all 206 plots.`);
    }



    function setupReferenceControls() {
        document.getElementById('threeInspectCloseBtn')?.addEventListener('click', () => {
            document.getElementById('threeInspectDrawer').classList.remove('open');
        });


        const center = layoutFocusCenter;
        const factor = () => Math.max(1, calibration.scale);
        document.querySelectorAll('.btn-cam-preset').forEach(button => {
            button.addEventListener('click', () => {
                isAutoRotating = false;
                document.getElementById('threeAutoRotateBtn')?.classList.remove('active');
                document.querySelectorAll('.btn-cam-preset').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                const preset = (CAMERA_PRESETS[button.dataset.preset] || CAMERA_PRESETS.isometric).pos;
                animateCameraTo(fittedCameraPosition(preset), center());
            });
        });
        document.getElementById('threeToggleLayoutBtn')?.addEventListener('click', event => {
            groundMesh.visible = !groundMesh.visible;
            event.currentTarget.classList.toggle('active', groundMesh.visible);
        });

        document.getElementById('threeSoloLayoutBtn')?.addEventListener('click', event => {
            isLayoutOnly = !isLayoutOnly;
            Object.values(plotGroups).forEach(group => group.visible = !isLayoutOnly);
            if (!isLayoutOnly) filterPlots(activeFilterStatus);
            event.currentTarget.classList.toggle('active', isLayoutOnly);
        });
        let xray = false;
        document.getElementById('threeXRayBtn')?.addEventListener('click', event => {
            xray = !xray;
            Object.values(plotGroups).forEach(group => group.traverse(object => {
                if (!object.isMesh) return;
                object.material.transparent = xray;
                object.material.opacity = xray ? .25 : .96;
                object.material.depthWrite = !xray;
                object.material.needsUpdate = true;
            }));
            event.currentTarget.classList.toggle('active', xray);
        });
        document.getElementById('threeFullscreenBtn')?.addEventListener('click', async () => {
            const container = document.getElementById('threeMapContainer');
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await container.requestFullscreen();
            } catch (error) { console.warn('Fullscreen unavailable:', error); }
        });
    }

    const calibrationDefaults = { scale: 1.94, width: 1.27, depth: 1.13, rotation: -7.6, east: 14, north: -25 };
    const calibrationLimits = { scale: [0.1, 5], width: [0.25, 3], depth: [0.25, 3], rotation: [-180, 180], east: [-600, 600], north: [-600, 600] };
    const calibrationStorageKey = 'avatar3_layout_calibration_v1';
    let calibration = { ...calibrationDefaults };
    try {
        const saved = JSON.parse(localStorage.getItem(calibrationStorageKey));
        if (saved && typeof saved === 'object') {
            for (const key of Object.keys(calibrationDefaults)) {
                if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) {
                    const [min, max] = calibrationLimits[key];
                    calibration[key] = Math.max(min, Math.min(max, saved[key]));
                }
            }
        }
    } catch (_) { /* Storage may be unavailable for local file pages. */ }

    function applyCalibration() {
        if (!layoutWorldGroup) return;
        layoutWorldGroup.position.set(calibration.east, 0, -calibration.north);
        layoutWorldGroup.rotation.y = THREE.MathUtils.degToRad(calibration.rotation);
        layoutWorldGroup.scale.set(
            calibration.scale * calibration.width,
            calibration.scale,
            calibration.scale * calibration.depth
        );
        layoutWorldGroup.updateMatrixWorld(true);
    }

    window.getAvatar3Calibration = () => ({ ...calibration });

    // A separate view owns the live scene; it never replaces the satellite map.
    window.activateAvatar3View = function(active) {
        isActive = active;
        if (!active) {
            if (animFrameId) cancelAnimationFrame(animFrameId);
            animFrameId = null;
            hideHoverTooltip();
            return;
        }
        if (!renderer) {
            initThreeScene();
            if (!uiReady) { setupUI(); uiReady = true; }
        } else {
            const container = document.getElementById('threeCanvasContainer');
            camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            startAnimationLoop();
        }
    };
    window.activate3DSatelliteView = active => {
        if (!active) window.activateAvatar3View(false);
    };
    window.zoom3DCamera = factor => {
        if (!camera || !controls) return;
        camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    };
    window.reset3DCamera = () => {
        if (!camera) return;
        const presetName = renderer.domElement.clientWidth <= 600 ? 'topDown' : 'isometric';
        document.querySelectorAll('.btn-cam-preset').forEach(button=>button.classList.toggle('active',button.dataset.preset===presetName));
        const preset = CAMERA_PRESETS[presetName];
        const target = layoutFocusCenter();
        animateCameraTo(fittedCameraPosition(preset.pos), target);
    };
    window.getAvatar3SceneState = () => ({
        active: isActive, plotCount: Object.keys(plotGroups).length,
        carPosition: singleCarMesh ? singleCarMesh.position.toArray() : null,
        cameraPosition: camera ? camera.position.toArray() : null
    });

    function setupSatelliteBackdrop() {
        // A single baked aerial surface prevents depth fighting and transparent sorting flicker.
        const aerial = window.AVATAR3_WIDE_AERIAL;
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(aerial ? aerial.width : 1400, aerial ? aerial.depth : 933),
            new THREE.MeshBasicMaterial({
                color:0xffffff, side:THREE.DoubleSide,
                transparent:false, depthWrite:true,
                polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1
            })
        );
        ground.rotation.x = -Math.PI/2;
        ground.position.set(aerial ? aerial.x : 0, -0.5, aerial ? aerial.z : 60);
        ground.name = 'Avatar3SatelliteTerrain';
        scene.add(ground);
        new THREE.TextureLoader().load(
            aerial ? aerial.texture : (window.AVATAR3_SATELLITE_TEXTURE || 'avatar3_satellite_ground.jpg'),
            texture => {
                texture.encoding = THREE.sRGBEncoding;
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                ground.material.map = texture;
                ground.material.needsUpdate = true;
            }
        );
    }
    // Global helpers
    window.select3DPlot = selectPlot;
    window.layoutWorldGroup = layoutWorldGroup;
    window.scene = scene;
    window.download3DModelGLB = download3DModelGLB;

})();
