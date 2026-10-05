const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
global.window = {};
const THREE = require('./three.min.js');
vm.runInNewContext(fs.readFileSync('GLTFLoader.js', 'utf8'), {THREE, TextDecoder, console});
const source = fs.readFileSync('avatar3_live_view.js', 'utf8');
const context = {THREE, console, performance, atob, window:{}, Map, Set, Promise, Uint8Array};
vm.createContext(context);
vm.runInContext(fs.readFileSync('downloaded_streetlight_data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('avatar3_plot_coords.js', 'utf8') + '\nthis.coords = plotCoordinatesAvatar3;', context);
vm.runInContext(fs.readFileSync('avatar3_data.js', 'utf8') + '\nthis.details = plotDataRawAvatar3;', context);
context.plotGroups = {};
context.plotMeshes = {};
for (const [plot, coord] of Object.entries(context.coords)) {
    const group = new THREE.Group();
    group.position.set((coord.left / 2500 - .5) * 250, 0, (coord.top / 1579 - .5) * 140.6);
    context.plotGroups[plot] = group;
    const size = Math.min(Math.max((parseFloat(context.details.find(d => String(d.plot_no) === plot)?.plot_size) || 200) / 200, .85), 2.2);
    context.plotMeshes[plot] = {userData:{pWidth:3.6 * size, pDepth:2.8 * size}};
}
context.getPlotDetails = plot => context.details.find(d => String(d.plot_no) === String(plot)) || {};
context.singleCarState = {waypoints:vm.runInContext(source.match(/const wholeLayoutWaypoints = (\[[\s\S]*?\]);/)[1], context)};
context.layoutWorldGroup = new THREE.Group();
context.layoutWorldGroup.scale.set(1.94 * 1.27, 1.94, 1.94 * 1.13);
context.camera = new THREE.PerspectiveCamera();
context.camera.position.set(1000, 1000, 1000);
vm.runInContext(`let streetLightGroup = null, streetLightBatches = [], streetLightPlacements = [], streetLightEmissiveMaterials = [], lastStreetLightUpdate = -Infinity, currentLightingMode = 'day';
    ${source.slice(source.indexOf('    function roadFacingYaw('), source.indexOf('    function createPlotArchitectureMesh('))}
    ${source.slice(source.indexOf('    function setupStreetLights('), source.indexOf('    function setupSingleRoamingCar('))}
    this.inspect = () => ({streetLightGroup, streetLightBatches, streetLightPlacements, streetLightEmissiveMaterials});
    this.night = () => { currentLightingMode = 'night'; updateStreetLightGlow(); };
    this.day = () => { currentLightingMode = 'day'; updateStreetLightGlow(); };
    this.update = () => updateStreetLightDetail(true);
    setupStreetLights();`, context);
(async () => {
    for (let i = 0; i < 100 && !context.inspect().streetLightGroup; i++) await new Promise(resolve => setImmediate(resolve));
    const state = context.inspect();
    assert(state.streetLightGroup, 'Both GLB models must load');
    const count = state.streetLightPlacements.length;
    assert(count >= 100 && count <= 115, 'Alternate houses should produce about half as many lamps');
    assert.strictEqual(state.streetLightBatches.length, 6, 'Three source materials per LOD, instanced');
    assert(state.streetLightBatches.filter(b => b.level === 0).every(b => b.mesh.count === 0), 'Overview uses distant geometry');
    assert(state.streetLightBatches.filter(b => b.level === 1).every(b => b.mesh.count === count));
    for (const item of state.streetLightPlacements) {
        const group = context.plotGroups[item.plotNo];
        const data = context.plotMeshes[item.plotNo].userData;
        const edge = (Math.abs(Math.sin(item.yaw)) * data.pWidth + Math.abs(Math.cos(item.yaw)) * data.pDepth) / 2;
        const horizontalDistance = Math.hypot(item.position.x - group.position.x, item.position.z - group.position.z);
        assert(Math.abs(horizontalDistance - edge - .45) < 1e-8, 'Lamps must sit outside the plot edge toward the road');
        assert(Number.isFinite(item.yaw));
    }
    context.night();
    assert(state.streetLightEmissiveMaterials.every(m => m.emissiveIntensity === 2.5));
    context.day();
    assert(state.streetLightEmissiveMaterials.every(m => m.emissiveIntensity === .15));
    context.camera.position.copy(state.streetLightPlacements[0].position.clone().applyMatrix4(context.layoutWorldGroup.matrixWorld));
    context.update();
    assert(state.streetLightBatches.filter(b => b.level === 0).every(b => b.mesh.count > 0 && b.mesh.count <= 8));
    const matrix = new THREE.Matrix4();
    const near = state.streetLightBatches.find(b => b.level === 0);
    near.mesh.getMatrixAt(0, matrix);
    assert(matrix.elements.every(Number.isFinite), 'Instance transforms must be finite');
    console.log(`Verified ${count} alternating roadside lamps, original/distant GLB parsing, six instanced batches, eight-lamp near-detail cap, placement and day/night glow.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
