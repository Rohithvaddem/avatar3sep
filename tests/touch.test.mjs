import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('touch picking tolerates label offsets after focus, picks model geometry, and ignores gestures',async()=>{
 const source=(await readFile('avatar3_live_view.js','utf8')).replace(/\r\n/g,'\n');
 const start=source.indexOf('    function setupEventListeners(container) {');
 const end=source.indexOf('    /**\n     * UI Buttons',start);
 const listeners={},selected=[];
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
 const container={...canvas,addEventListener:(type,fn)=>{listeners[type]=fn;}};
 class Vector {set(x,y){this.x=x;this.y=y;} project(){return this;}}
 let hits=[];
 const mesh={isMesh:true,userData:{sharedHouseGeometry:true}};
 const group={visible:true,traverseVisible:fn=>fn(mesh)};
 const label={visible:true,getWorldPosition:v=>Object.assign(v,{x:0,y:0,z:0})};
 const scope={THREE:{Vector2:Vector,Vector3:Vector,Raycaster:class {setFromCamera(){} intersectObjects(targets){return hits.filter(x=>targets.includes(x.object));}}},renderer:{domElement:canvas},camera:{updateMatrixWorld(){}},scene:{updateMatrixWorld(){}},plotGroups:{23:group},plotButtons:{23:label},selectPlot:no=>selected.push(String(no)),window:{addEventListener(){}},Date};
 vm.runInNewContext(source.slice(start,end)+'\nsetupEventListeners(container)',{...scope,container});
 const event=(id,x,y)=>({pointerId:id,pointerType:'touch',target:canvas,clientX:x,clientY:y});
 const tap=(x,y)=>{listeners.pointerdown(event(1,x,y));listeners.pointerup(event(1,x,y));};
 tap(68,50);assert.deepEqual(selected,['23']); // Finger lands next to a tiny number.
 label.getWorldPosition=v=>Object.assign(v,{x:.5,y:0,z:0});tap(78,50);assert.equal(selected.length,2); // Camera focus changes screen position.
 hits=[{object:mesh}];tap(5,5);assert.equal(selected.length,3); // Downloaded/shared house geometry is selectable.
 listeners.pointerdown(event(1,5,5));listeners.pointermove(event(1,35,5));listeners.pointerup(event(1,35,5));assert.equal(selected.length,3);
 listeners.pointerdown(event(1,5,5));listeners.pointerdown(event(2,50,50));listeners.pointerup(event(1,5,5));listeners.pointerup(event(2,50,50));assert.equal(selected.length,3);
});

