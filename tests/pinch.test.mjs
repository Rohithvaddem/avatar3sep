import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf("mapViewport.addEventListener('touchstart'");
const end=source.indexOf('// Scroll wheel to zoom',start);
function harness(){
 const events={};
 const state={Math,chromeTarget:()=>false,isSatelliteActive:false,is3DViewActive:false,isDragging:false,startX:0,startY:0,mouseDownPos:{},panX:12,panY:240,zoomScale:.4,minPresetZoomScale:.4,applyTransform:()=>{},fadeMapTip:()=>{},handleMapClick:()=>assert.fail('pinch must not open plot details'),mapViewport:{addEventListener:(name,fn)=>events[name]=fn,getBoundingClientRect:()=>({left:0,top:56})}};
 vm.runInNewContext('let pinchStart=null;'+source.slice(start,end),state);
 return {events,state};
}
const gesture=(points)=>({target:{},touches:points.map(([clientX,clientY])=>({clientX,clientY})),preventDefault(){}});
test('schematic pinch anchors the midpoint, clamps zoom and does not select a plot',()=>{
 const {events,state}=harness();
 const mapX=(195-state.panX)/state.zoomScale,mapY=(420-56-state.panY)/state.zoomScale;
 events.touchstart(gesture([[160,420],[230,420]]));
 events.touchmove(gesture([[110,420],[280,420]]));
 assert.ok(state.zoomScale>.4);
 assert.ok(Math.abs((195-state.panX)/state.zoomScale-mapX)<1e-9);
 assert.ok(Math.abs((420-56-state.panY)/state.zoomScale-mapY)<1e-9);
 events.touchmove(gesture([[194,420],[196,420]]));assert.equal(state.zoomScale,.4);
 events.touchend({changedTouches:[{clientX:195,clientY:420}]});assert.equal(state.isDragging,false);
});
test('schematic gesture handler leaves satellite and 3D touch engines alone',()=>{
 for(const mode of ['isSatelliteActive','is3DViewActive']){const {events,state}=harness();state[mode]=true;events.touchstart(gesture([[160,420],[230,420]]));events.touchmove(gesture([[110,420],[280,420]]));assert.equal(state.zoomScale,.4);}
});
