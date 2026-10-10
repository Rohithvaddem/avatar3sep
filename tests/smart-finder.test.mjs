import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync('app.js','utf8');const start=source.indexOf('function matchesSmartFinder('),end=source.indexOf('function applySmartFinderHighlights()',start);const ctx={};vm.runInNewContext(source.slice(start,end),ctx);
test('finder matches inventory independently of rendered markers in every view',()=>{
 const c={size:'201-300',facing:'East',status:'AVAILABLE'};
 for(const status of ['AVAILABLE','MORTGAGE','MORTAGAGE','RESALE']) assert.equal(ctx.matchesSmartFinder({plot_size:'220',facing:'East',plot_status:status},c,'avatar3'),true);
 assert.equal(ctx.matchesSmartFinder({plot_size:'220',facing:'East',plot_status:'SOLD'},c,'avatar3'),false);
 assert.equal(ctx.matchesSmartFinder({plot_size:'200',facing:'East',plot_status:'AVAILABLE'},c,'avatar3'),false);
 assert.equal(ctx.matchesSmartFinder({plot_size:'220',facing:'West',plot_status:'AVAILABLE'},c,'avatar3'),false);
 assert.equal(ctx.matchesSmartFinder({plot_size:'220',facing:'East',plot_status:'SOLD'},{...c,status:'ALL'},'avatar3'),true);
});
test('shared highlights reach both schematic and satellite, and clear the 3D adapter',()=>{
 const elements=['1','2'].flatMap(no=>[{dataset:{plotNo:no},classes:new Set()},{dataset:{plot:no},classes:new Set()}]);
 elements.forEach(e=>e.classList={toggle:(name,on)=>on?e.classes.add(name):e.classes.delete(name)});
 let count,forwarded;const banner={style:{}};
 const scope={avatarDataPool:{avatar3:[{plot_no:1,plot_size:220,facing:'East',plot_status:'AVAILABLE'},{plot_no:2,plot_size:150,facing:'West',plot_status:'SOLD'}]},currentProject:'avatar3',window:{setAvatar3FinderMatches:n=>forwarded=n},document:{querySelectorAll:()=>elements,getElementById:id=>id==='facingCompass'?null:id==='matchedPlotCount'?{replaceChildren:v=>count=v}:banner}};
 vm.runInNewContext(source.slice(source.indexOf('let smartFinderCriteria=null;'),source.indexOf('function setupSmartPlotFinder()',start)),scope);
 vm.runInNewContext("smartFinderCriteria={size:'201-300',facing:'East',status:'AVAILABLE'};applySmartFinderHighlights();",scope);
 assert.equal(count,'1');assert.deepEqual(Array.from(forwarded),['1']);assert.ok(elements[0].classes.has('matched-finder-dot'));assert.ok(elements[1].classes.has('matched-finder-dot'));assert.ok(elements[2].classes.has('dimmed-finder-dot'));
 vm.runInNewContext('smartFinderCriteria=null;applySmartFinderHighlights();',scope);assert.equal(forwarded,null);assert.equal(banner.style.display,'none');assert.ok(elements.every(e=>e.classes.size===0));
});
