import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('avatar3_live_view.js','utf8');
const sandbox={console}; vm.createContext(sandbox);
vm.runInContext(readFileSync('three.min.js','utf8'),sandbox);
const THREE=sandbox.THREE;
const helper=source.slice(source.indexOf('    function metricPropMatrix('),source.indexOf('    function instanceLandscapeModel('));
test('tree and lamp dimensions stay uniform under stretched layout calibration at every heading',()=>{
 for(const yaw of [0,.4,Math.PI/2,2.6]) {
  const calibration={scale:1.94,width:1.27,depth:1.13};
  const context={THREE,calibration};vm.runInNewContext(helper,context);
  const parent=new THREE.Matrix4().makeScale(calibration.scale*calibration.width,calibration.scale,calibration.scale*calibration.depth);
  const world=parent.multiply(context.metricPropMatrix(new THREE.Vector3(20,0,10),yaw));
  const scales=new THREE.Vector3().setFromMatrixScale(world);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(scales[axis]-calibration.scale)<1e-9);
 }
});
test('roaming car world speed is consistent across road directions and calibration',()=>{
 const updater=source.slice(source.indexOf('    function updateSingleCar('),source.indexOf('    function setupBeacon('));
 for(const end of [{x:100,z:0},{x:0,z:100},{x:100,z:100}]) {
  const mesh={position:new THREE.Vector3(),userData:{heading:{rotation:{}},wheels:[]}};
  const calibration={scale:1.94,width:1.27,depth:1.13};
  const state={mesh,waypoints:[end],targetIndex:0,speed:5.5,currentYaw:0};
  const context={singleCarState:state,calibration,lerpAngle:(a,b,t)=>a+(b-a)*t};
  vm.runInNewContext(updater,context);context.updateSingleCar(.05);
  const distance=Math.hypot(mesh.position.x*calibration.scale*calibration.width,mesh.position.z*calibration.scale*calibration.depth);
  assert.ok(Math.abs(distance-5.5*.05)<1e-9);
  assert.ok(Math.abs(mesh.position.y*calibration.scale-.06)<1e-9);
 }
});
test('detailed car is self-contained and the production build retains its loader and credits',()=>{
 const asset=readFileSync('assets/car/car-concept.glb');
 assert.equal(asset.toString('utf8',0,4),'glTF');
 const document=JSON.parse(asset.toString('utf8',20,20+asset.readUInt32LE(12)));
 assert.ok(document.nodes.some(node=>node.name==='BodyHeadlights'));
 assert.ok(document.buffers.every(buffer=>!buffer.uri));
 assert.ok(document.images.every(image=>image.bufferView!==undefined));
 assert.ok(!document.extensionsRequired?.includes('KHR_draco_mesh_compression'));
 const embedded=readFileSync('downloaded_car_data.js','utf8').match(/AVATAR3_CAR_B64 = "([^"]+)"/)[1];
 assert.ok(Buffer.from(embedded,'base64').equals(asset));
 assert.ok(readFileSync('dist/downloaded_car_data.js','utf8').includes('AVATAR3_CAR_B64'));
 assert.ok(readFileSync('dist/avatar 3.html','utf8').includes('Car Concept — Eric Chadwick / DGG'));
});
