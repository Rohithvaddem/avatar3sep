/* Render only the supplied Avatar 3 model, georeferenced to its KML overlay. */
(function () {
    'use strict';
    window.createAvatar3ModelLayer = function (bounds, rotation) {
        const ModelLayer = L.Layer.extend({
            onAdd(map) {
                this.map = map;
                this.host = L.DomUtil.create('div', 'avatar3-model-overlay', map.getContainer());
                Object.assign(this.host.style, {
                    position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '450'
                });
                try {
                    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
                } catch (error) {
                    console.error('Avatar 3 model renderer unavailable:', error);
                    this.host.remove();
                    this.fire('modelerror');
                    return;
                }
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                this.renderer.setClearColor(0, 0);
                this.renderer.outputEncoding = THREE.sRGBEncoding;
                this.host.appendChild(this.renderer.domElement);
                this.scene = new THREE.Scene();
                this.camera = new THREE.OrthographicCamera();
                this.camera.up.set(0, 0, -1);
                this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
                const sun = new THREE.DirectionalLight(0xffffff, 1.3);
                sun.position.set(-500, 1000, -500);
                this.scene.add(sun);
                this.anchor = new THREE.Group();
                this.scene.add(this.anchor);
                map.on('move zoom resize zoomanim', this.update, this);
                // Cache the load across satellite/schematic and layer visibility toggles.
                if (!this.loading) {
                    this.loading = new Promise((resolve, reject) => {
                        const loader = new THREE.GLTFLoader();
                        if (window.location.protocol === 'file:' && window.AVATAR3_MODEL_BASE64) {
                            const bytes = Uint8Array.from(atob(window.AVATAR3_MODEL_BASE64), c => c.charCodeAt(0));
                            loader.parse(bytes.buffer, '', resolve, reject);
                        } else {
                            loader.load('avatar3_3d_layout.glb', resolve, undefined, reject);
                        }
                    });
                }
                this.loading.then(gltf => {
                    if (!this.map) return;
                    this.model = gltf.scene.children[0];
                    // The export contains its own -7.3 degree display rotation.
                    // KML supplies the geographic rotation instead.
                    this.model.rotation.set(0, 0, 0);
                    this.model.position.set(0, 0, 0);
                    this.model.scale.set(1, 1, 1);
                    this.anchor.add(this.model);
                    this.fire('modelload');
                    this.update();
                }).catch(error => {
                    console.error('Could not load Avatar 3 model:', error);
                    this.fire('modelerror');
                });
                this.update();
            },
            update(event) {
                if (!this.renderer || !this.map) return;
                const map = this.map;
                const size = map.getSize();
                const zoom = event && event.type === 'zoomanim' ? event.zoom : map.getZoom();
                const center = event && event.type === 'zoomanim' ? event.center : map.getCenter();
                const origin = map.project(center, zoom).subtract(size.divideBy(2));
                const nw = map.project(bounds.getNorthWest(), zoom).subtract(origin);
                const se = map.project(bounds.getSouthEast(), zoom).subtract(origin);
                const width = se.x - nw.x;
                const height = se.y - nw.y;
                this.anchor.position.set((nw.x + se.x) / 2, 0, (nw.y + se.y) / 2);
                // Put anisotropic footprint scaling inside the rotation, matching KML.
                this.anchor.rotation.y = THREE.MathUtils.degToRad(rotation);
                if (this.model) this.model.scale.set(width / 250, width / 250, height / 140.6);
                this.camera.left = -size.x / 2;
                this.camera.right = size.x / 2;
                this.camera.top = size.y / 2;
                this.camera.bottom = -size.y / 2;
                this.camera.near = 0.1;
                this.camera.far = 100000;
                this.camera.position.set(size.x / 2, 50000, size.y / 2);
                this.camera.lookAt(size.x / 2, 0, size.y / 2);
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(size.x, size.y);
                this.renderer.render(this.scene, this.camera);
            },
            onRemove(map) {
                map.off('move zoom resize zoomanim', this.update, this);
                this.map = null;
                if (this.model && this.anchor) this.anchor.remove(this.model);
                if (this.renderer) this.renderer.dispose();
                if (this.host) this.host.remove();
                this.renderer = null;
            }
        });
        return new ModelLayer();
    };
})();
