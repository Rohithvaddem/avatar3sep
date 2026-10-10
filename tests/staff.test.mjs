import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/staff-core.mjs';
import {readFile,readdir,access} from 'node:fs/promises';
import vm from 'node:vm';
function fixture(user, seedRows) {
 let record=null,etag='v1',writes=0;
 const store={getWithMetadata:async()=>record&&{data:structuredClone(record),etag},setJSON:async(_key,value,options)=>{
  if(options.onlyIfMatch&&options.onlyIfMatch!==etag)return {modified:false};
  record=structuredClone(value);etag='v'+(++writes+1);return {modified:true,etag};
 }};
 const handler=createHandler({getUser:async()=>user,login:async()=>{},logout:async()=>{},verifyRequestOrigin:req=>{if(req.headers.get('origin')!==new URL(req.url).origin)throw {status:403};},store:()=>store,seed:async()=>seedRows || [{plot_no:'1',plot_size:'150',plot_status:'AVAILABLE',reference_name:'preserved',customer_name:'Private customer',customer_phone:'Private phone',crm_notes:['Private note']},{plot_no:'Total',plot_status:'AVAILABLE'}]});
 const request=(method='GET',body,origin='https://staff.example')=>new Request('https://staff.example/.netlify/functions/staff?action=plots&project=avatar3',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 return {handler,request,writes:()=>writes};
}
test('public visitors get only plot information and cannot write',async()=>{
 for(const user of [null,{id:'x',roles:[]}]){
  const f=fixture(user);const response=await f.handler(f.request());assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.plots.length,1);assert.equal(body.plots[0].plot_no,'1');
  for(const key of ['customer_name','customer_phone','crm_notes','reference_name','updated_by']) assert.ok(!(key in body.plots[0]));
  assert.ok(!('version' in body));
  assert.equal((await f.handler(f.request('PATCH',{}))).status,user?403:401);
  assert.equal(f.writes(),0);
 }
});
test('staff and director save shared data, preserve seed metadata, and reject stale writes',async()=>{
 for(const role of ['staff','director','admin']){
  const f=fixture({id:'trusted',roles:[role]});
  const read=await (await f.handler(f.request())).json();assert.equal(read.version,'seed');
  const response=await f.handler(f.request('PATCH',{plotNo:'1',version:'seed',patch:{plot_status:'SOLD',customer_name:'Test customer'}}));assert.equal(response.status,200);
  const saved=await response.json();assert.equal(saved.plot.reference_name,'preserved');
  const next=await (await f.handler(f.request())).json();assert.equal(next.plots[0].plot_status,'SOLD');
  assert.equal((await f.handler(f.request('PATCH',{plotNo:'1',version:'seed',patch:{plot_status:'AVAILABLE'}}))).status,409);
 }
});
test('cross-origin requests, role injection, invalid fields and unknown plots cannot write',async()=>{
 const f=fixture({id:'trusted',roles:['staff']});
 assert.equal((await f.handler(f.request('PATCH',{},'https://attacker.example'))).status,403);
 for(const body of [{plotNo:'1',version:'seed',patch:{roles:['director']}},{plotNo:'1',version:'seed',patch:{plot_size:'NaN'}},{plotNo:'999',version:'seed',patch:{plot_status:'SOLD'}}]) assert.ok([400,404].includes((await f.handler(f.request('PATCH',body))).status));
 assert.equal(f.writes(),0);
});
test('private build excludes raw data and credentials and escapes stored HTML',async()=>{
 const files=await readdir('dist');
 for(const name of ['data.js','data.json','avatar1_data.js','avatar1_data.json','avatar2_data.js','avatar3_data.js','avatar3_data.json']) assert.ok(!files.includes(name),name);
 const app=await readFile('dist/app.js','utf8');
 assert.ok(!/password ===|FIREBASE_DB_URL|sessionStorage.getItem\('userRole'/.test(app));
 assert.ok(app.includes('staffEscape(item.customer_name'));
 assert.ok(app.includes('staffEscape(note)'));
 const scope=vm.createContext({});vm.runInContext(await readFile('staff/staff-session.js','utf8'),scope);
 const encoded=vm.runInContext('staffEscape(`<img src=x onerror=alert(1)>"`)',scope);
 assert.equal(encoded,'&lt;img src=x onerror=alert(1)&gt;&quot;');
 assert.ok(files.includes('avatar3_3d_layout.glb'));
});

test('satellite overlays referenced by KML are published',async()=>{
 const kml=await readFile('doc.kml','utf8');
 const paths=[...kml.matchAll(/<href>(files\/[^<]+)<\/href>/g)].map(match=>match[1]);
 assert.ok(paths.length>0);
 for(const path of paths) await access('dist/'+path);
});

test('root opens the layout directly without loading 3D assets',async()=>{
 const root=await readFile('dist/index.html','utf8');
 assert.equal(root,await readFile('dist/avatar 3.html','utf8'));
 assert.ok(!root.includes('Open Avatar 3'));
 assert.ok(!root.includes('<script src="three.min.js">'));
 assert.ok(!root.includes('<script src="downloaded_house_data.js'));
 assert.ok(root.includes('lazy-3d.js'));
});

test('session derives admin, director and staff only from trusted roles',async()=>{
 for(const role of ['admin','director','staff']) {
  const f=fixture({id:'trusted',roles:[role]});
  const response=await f.handler(new Request('https://staff.example/.netlify/functions/staff?action=session'));
  assert.equal((await response.json()).role,role);
 }
 const f=fixture({id:'unassigned',roles:[],user_metadata:{role:'admin'}});
 const response=await f.handler(new Request('https://staff.example/.netlify/functions/staff?action=session'));
 assert.equal((await response.json()).role,null);
});


test('mortgage reference survives sale and reopening for every staff role and stays private',async()=>{
 for(const role of ['staff','director','admin']) {
  const user={id:'trusted',roles:[role]};
  const f=fixture(user,[{plot_no:'1',plot_size:'150',facing:'East',plot_status:'MORTGAGE'}]);
  const original=await (await f.handler(f.request())).json();
  assert.equal(original.plots[0].mortgage_reference,true);
  const sold=await (await f.handler(f.request('PATCH',{plotNo:'1',version:'seed',patch:{plot_status:'SOLD'}}))).json();
  assert.equal(sold.plot.plot_status,'SOLD');assert.equal(sold.plot.mortgage_reference,true);
  const reopened=await (await f.handler(f.request('PATCH',{plotNo:'1',version:sold.version,patch:{plot_status:'AVAILABLE'}}))).json();
  assert.equal(reopened.plot.mortgage_reference,true);
  const forged=await f.handler(f.request('PATCH',{plotNo:'1',version:reopened.version,patch:{mortgage_reference:false}}));
  assert.equal(forged.status,400);
  user.roles=[];
  const publicRead=await (await f.handler(f.request())).json();
  assert.equal(publicRead.plots[0].plot_status,'AVAILABLE');assert.ok(!('mortgage_reference' in publicRead.plots[0]));
 }
});
test('new mortgage assignment is retained as a reference after sale',async()=>{
 const f=fixture({id:'trusted',roles:['admin']});
 const mortgage=await (await f.handler(f.request('PATCH',{plotNo:'1',version:'seed',patch:{plot_status:'MORTGAGE'}}))).json();
 const sold=await (await f.handler(f.request('PATCH',{plotNo:'1',version:mortgage.version,patch:{plot_status:'SOLD'}}))).json();
 assert.equal(sold.plot.mortgage_reference,true);
});
