import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/staff-core.mjs';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
function fixture(user) {
 let record=null,etag='v1',writes=0;
 const store={getWithMetadata:async()=>record&&{data:structuredClone(record),etag},setJSON:async(_key,value,options)=>{
  if(options.onlyIfMatch&&options.onlyIfMatch!==etag)return {modified:false};
  record=structuredClone(value);etag='v'+(++writes+1);return {modified:true,etag};
 }};
 const handler=createHandler({getUser:async()=>user,login:async()=>{},logout:async()=>{},verifyRequestOrigin:req=>{if(req.headers.get('origin')!==new URL(req.url).origin)throw {status:403};},store:()=>store,seed:async()=>[{plot_no:'1',plot_size:'150',plot_status:'AVAILABLE',reference_name:'preserved'}]});
 const request=(method='GET',body,origin='https://staff.example')=>new Request('https://staff.example/.netlify/functions/staff?action=plots&project=avatar3',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 return {handler,request,writes:()=>writes};
}
test('anonymous and unassigned accounts cannot read or write',async()=>{
 for(const user of [null,{id:'x',roles:[]}]){
  const f=fixture(user);for(const method of ['GET','PATCH'])assert.equal((await f.handler(f.request(method,method==='PATCH'?{}:undefined))).status,user?403:401);
  assert.equal(f.writes(),0);
 }
});
test('staff and director save shared data, preserve seed metadata, and reject stale writes',async()=>{
 for(const role of ['staff','director']){
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
