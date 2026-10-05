const fs = require('fs'), vm = require('vm'), assert = require('assert');
global.window = {};
const THREE = require('./three.min.js');
// Texture pixels require a browser; use a stub only for this geometry/placement check.
THREE.TextureLoader.prototype.load = function(url, ready) { const texture = new THREE.Texture(); queueMicrotask(() => ready(texture)); return texture; };
vm.runInNewContext(fs.readFileSync('GLTFLoader.js','utf8'), {THREE, TextDecoder, console, Blob, URL, self:{URL}});
const context = {THREE, console, atob, Uint8Array, Promise, window:{}, LAYOUT_WIDTH:250, LAYOUT_HEIGHT:140.6,
    plotGroups:{}, layoutWorldGroup:new THREE.Group(), renderer:{shadowMap:{}}};
vm.createContext(context);
for (const asset of ['downloaded_trees_data.js','downloaded_bench_data.js']) vm.runInContext(fs.readFileSync(asset,'utf8'),context);
vm.runInContext(fs.readFileSync('avatar3_plot_coords.js','utf8')+'\nthis.coords=plotCoordinatesAvatar3;',context);
for (const [key,coord] of Object.entries(context.coords)) {
    const group = new THREE.Group();
    group.position.set((coord.left/2500-.5)*250,0,(coord.top/1579-.5)*140.6);
    context.plotGroups[key] = group;
}
const source = fs.readFileSync('avatar3_live_view.js','utf8');
vm.runInContext(source.slice(source.indexOf('    function setupDownloadedLandscaping('), source.indexOf('    function setup3DLandscaping('))+'\nsetupDownloadedLandscaping();',context);
(async () => {
    for (let i=0;i<100;i++) {
        if (context.layoutWorldGroup.getObjectByName('DownloadedParkLandscaping')) break;
        await new Promise(resolve => setImmediate(resolve));
    }
    const group = context.layoutWorldGroup.getObjectByName('DownloadedParkLandscaping');
    assert(group,'Tree and bench GLB files load');
    assert.strictEqual(group.userData.benchCount,8);
    assert(group.userData.parkBenches.every(park => park.count===2));
    assert(group.userData.treeCount>80);
    assert(group.children.length<=7,'Merged tree variants and benches use at most seven draw calls');
    const matrix = new THREE.Matrix4();
    for (const mesh of group.children) {
        assert(mesh.isInstancedMesh && mesh.geometry.attributes.uv && mesh.geometry.attributes.normal);
        for (let i=0;i<mesh.count;i++) {
            mesh.getMatrixAt(i,matrix);
            assert(matrix.elements.every(Number.isFinite));
            assert(matrix.determinant()>0,'Source models retain non-mirrored proportions');
        }
    }
    console.log(`Verified ${group.userData.treeCount} trees, two benches in each of four parks, preserved UVs/normals, valid transforms and ${group.children.length} instanced draw calls.`);
})().catch(error => {console.error(error);process.exitCode=1;});
