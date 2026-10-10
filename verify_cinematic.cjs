const fs=require('fs'),vm=require('vm'),assert=require('assert');
const threeContext={window:{},console};
vm.createContext(threeContext);
vm.runInContext(fs.readFileSync('three.min.js','utf8'),threeContext);
const THREE=threeContext.THREE || threeContext.window.THREE;
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',classList:{add(){},remove(){}}});return elements.get(id);};
const camera=new THREE.PerspectiveCamera(45,16/9,.1,2000);camera.position.set(120,150,130);
const original=camera.position.clone();const car=new THREE.Group();car.position.set(25,.45,10);
const context={THREE,performance:{now:()=>0},document:{getElementById:get},camera,
 controls:{target:new THREE.Vector3(),enabled:true,autoRotate:false,update(){}},
 layoutWorldGroup:new THREE.Group(),plotButtons:{1:{visible:true}},singleCarMesh:car,
 singleCarState:{targetIndex:4,currentYaw:.2},isAutoRotating:false,isCameraAnimating:false,
 layoutBounds:()=>new THREE.Box3(new THREE.Vector3(-200,0,-120),new THREE.Vector3(230,10,130)),
 hideHoverTooltip(){}};
context.layoutWorldGroup.scale.set(2.46,1.94,2.19);
context.layoutWorldGroup.rotation.y=-.13;
vm.createContext(context);
const source=fs.readFileSync('avatar3_live_view.js','utf8');
vm.runInContext('let cinematic=null;'+source.slice(source.indexOf('    function startCinematic('),source.indexOf('    function updateHouseDetailLevels(')),context);
context.startCinematic('road',true);
assert(!context.controls.enabled && !context.plotButtons[1].visible);
const local=context.camera.position.clone().applyMatrix4(context.layoutWorldGroup.matrixWorld.clone().invert());
assert(local.distanceTo(new THREE.Vector3(6,1.7,52))<1e-8);
context.updateCinematic(2000);
const halfway=context.camera.position.clone().applyMatrix4(context.layoutWorldGroup.matrixWorld.clone().invert());
assert(halfway.distanceTo(new THREE.Vector3(6,1.7,43))<1e-8);
context.updateCinematic(4000);context.updateCinematic(9000);
assert(get('threeCinematicCaption').textContent.includes('Aerial'));
assert(context.camera.position.y>100);
context.updateCinematic(14000);
assert(context.controls.enabled && context.plotButtons[1].visible);
assert(context.camera.position.distanceTo(original)<1e-8);
assert(car.position.distanceTo(new THREE.Vector3(25,.45,10))<1e-8);
assert.strictEqual(context.singleCarState.targetIndex,4);
context.startCinematic('aerial');context.stopCinematic();
assert(get('threeCinematicOverlay').hidden);
console.log('Verified four-second road tracking, ten-second aerial sequence, transformed road coordinates, hidden labels, cancellation, camera/control/car restoration.');
