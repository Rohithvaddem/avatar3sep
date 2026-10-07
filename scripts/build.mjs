import {readFile,writeFile,mkdir,cp,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const publish=resolve('dist');
if(publish!==resolve(process.cwd(),'dist')) throw new Error('Invalid publish path');
await rm(publish,{recursive:true,force:true});
await mkdir(publish,{recursive:true});
const entries=await readdir('.',{withFileTypes:true});
for(const entry of entries) {
 const name=entry.name;
 if(entry.isFile() && /\.(css|png|jpg|jpeg|webp|svg|kml|js)$/.test(name) && name!=='app.js' && !/^(data|avatar[123]_data)\.js$/.test(name) && name!=='verify_landscaping.cjs') await cp(name,'dist/'+name);
}
await cp('assets','dist/assets',{recursive:true});
await cp('files','dist/files',{recursive:true});
await cp('avatar3_3d_layout.glb','dist/avatar3_3d_layout.glb');
await mkdir('dist/avatar2_digi',{recursive:true});
await cp('avatar2_digi/map_layout.jpg','dist/avatar2_digi/map_layout.jpg');
for(const name of ['avatar1_plot_coords.json','avatar2_plot_coords.json','avatar3_plot_coords.json']) await cp(name,'dist/'+name);
let html=await readFile('avatar 3.html','utf8');
html=html.replace('<head>', '<head><script>if(/invite_token|recovery_token|confirmation_token|access_token/.test(location.hash))location.replace("/login.html"+location.hash);</script>');
html=html.replace(/\s*<script src="(?:data|avatar[123]_data)\.js"><\/script>/g,'');
html=html.replace('<script src="app.js?v=30"></script>','<script src="staff-session.js"></script><script src="app.js"></script>');
if(!html.includes('staff-session.js')) throw new Error('App script entry changed; update build transform');
html=html.replace('Username / Login ID','Staff email').replace('Login as Staff','Sign in').replace(/Staff Username|Director Login ID/g,'Staff email').replace(/Enter staff username|Enter Director ID \(Aspirealty Avatar\)/g,'Staff email address');
const lazyScripts=[];
html=html.replace(/<script src="([^"]+)"><\/script>/g,(tag,src)=>{
 if(/^(three\.min|OrbitControls|GLTFLoader|avatar3_texture_data|avatar3_satellite_texture|avatar3_satellite_wide_texture|downloaded_house_data|downloaded_house_far_data|downloaded_streetlight_data|downloaded_trees_data|downloaded_bench_data|avatar3_live_view)\.js/.test(src)) {lazyScripts.push(src);return '';}
 return tag;
});
html=html.replace(/<script>\s*if \(typeof THREE[\s\S]*?<\/script>/,'');
html=html.replace('<script src="staff-session.js">','<script src="lazy-3d.js"></script><script src="staff-session.js">');
await writeFile('dist/lazy-3d.js',`let modelReady=false,modelLoading;
 const host=document.getElementById('threeMapContainer');
 const loading=document.createElement('div');loading.className='three-loading-state';loading.setAttribute('role','status');loading.hidden=true;host.appendChild(loading);
 document.getElementById('btn3DView').addEventListener('click',async()=>{
 if(modelReady)return;loading.hidden=false;loading.textContent='Loading 3D layout…';
 try {modelLoading ||= (async()=>{await Promise.all(${JSON.stringify(lazyScripts)}.map(src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=false;script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('3D download failed'));document.body.appendChild(script);})));})();await modelLoading;modelReady=true;loading.hidden=true;if(document.body.dataset.view==='3d')window.activateAvatar3View?.(true);}
 catch{modelLoading=null;loading.textContent='3D could not load. Tap 3D View to retry.';}
 },true);`);
html=html.replaceAll('map_layout.png','map_layout-park1.svg');
await writeFile('dist/avatar 3.html',html);
await writeFile('dist/index.html',html);
let app=(await readFile('app.js','utf8')).replace(/\r\n/g,'\n');
const start=app.indexOf('    // Load Avatar 3 data from local storage if exists');
const end=app.indexOf('    // Fallback coordinates fetch',start);
if(start<0||end<0) throw new Error('Data loader boundary changed');
app=app.slice(0,start)+`    const fetch3=currentProject==='avatar3'?staffLoadProject('avatar3'):Promise.resolve(), fetch2=currentProject==='avatar2'?staffLoadProject('avatar2'):Promise.resolve(), fetch1=currentProject==='avatar1'?staffLoadProject('avatar1'):Promise.resolve();\n`+app.slice(end);
app=app.replace(/let userRole = sessionStorage[^;]+;/,'let userRole = null;');
const loginStart=app.indexOf('            // Credentials check for Director vs Staff');
const loginEnd=app.indexOf('\n        });',loginStart);
if(loginStart<0||loginEnd<0) throw new Error('Login boundary changed');
app=app.slice(0,loginStart)+`            staffSignIn(username,password).then(()=>location.reload()).catch(()=>{loginError.textContent='Sign-in failed. Use your invited staff email and password.';loginError.style.display='block';});`+app.slice(loginEnd);
app=app.replace('function performLogout() {','async function performLogout() {\n            await staffRequest("logout",{method:"POST"});');
app=app.replace('function savePlotEdits(plotNo) {','async function savePlotEdits(plotNo) {');
const commit=app.indexOf('    if (idx !== -1) {\n        plotData[idx] = updatedPlot;',app.indexOf('async function savePlotEdits'));
const commitEnd=app.indexOf('    renderPlotDots();',commit);
if(commit<0||commitEnd<0) throw new Error('Save boundary changed');
app=app.slice(0,commit)+`    const button=document.getElementById('savePlotEditBtn');\n    button.disabled=true;\n    try {\n      const fields=['plot_size','facing','plot_status','customer_name','customer_phone','customer_email','lead_source','crm_notes'];\n      const patch=Object.fromEntries(fields.map(key=>[key,updatedPlot[key]]));\n      const saved=await staffRequest('plots',{method:'PATCH',body:JSON.stringify({plotNo,patch,version:staffVersions[currentProject]})},currentProject);\n      staffVersions[currentProject]=saved.version;\n      plotData[idx]=saved.plot;\n    } catch(error) { alert(error.message); button.disabled=false; return; }\n`+app.slice(commitEnd);
const cloud=app.indexOf("const FIREBASE_DB_URL =");
const cloudEnd=app.indexOf('// Global DOM Ready initializer',cloud);
app=app.slice(0,cloud)+`async function startRealtimeCloudSync() {\n  const session=await staffRequest('session');\n  userRole=session.role;isAdminLoggedIn=!!userRole;isDirectorLoggedIn=['director','admin'].includes(userRole);isStaffLoggedIn=userRole==='staff';\n  setupAdminState();\n  document.getElementById('resetDbBtn')?.remove();\n  document.getElementById('loginUsername')?.setAttribute('placeholder','Staff email address');\n  setInterval(async()=>{\n    if(document.getElementById('savePlotEditBtn') && document.getElementById('plotModalBackdrop')?.classList.contains('show')) return;\n    try {if(await staffLoadProject(currentProject)){plotData=avatarDataPool[currentProject];renderPlotDots();updateStatistics();}} catch {}\n  },15000);\n}\n\n`+app.slice(cloudEnd);
app=app.replace(/Staff Username|Director Login ID/g,'Staff email').replace(/Enter staff username|Enter Director ID \(Aspirealty Avatar\)/g,'Staff email address');
app=app.replace('function updateSimulatedLocks() {','function updateSimulatedLocks() { simulatedLocks={}; return;');
// Encode untrusted plot values in both text nodes and quoted input attributes.
app=app.replace(/\$\{(item\.[a-zA-Z_]+(?: \|\| '[^']*')?)\}/g,'${staffEscape($1)}');
app=app.replace("currentProject === 'avatar3' ? '<div class=\"detail-row\"><span class=\"detail-label\">Reference / Share","currentProject === 'avatar3' && isAdminLoggedIn ? '<div class=\"detail-row\"><span class=\"detail-label\">Reference / Share");
app=app.replace('${note}</div>','${staffEscape(note)}</div>');
app=app.replace("(item.reference_name || 'ASPIREALTY')","staffEscape(item.reference_name || 'ASPIREALTY')");
if(/FIREBASE_DB_URL|password ===|localStorage\.setItem\(storageKey/.test(app)) throw new Error('Legacy authorization or persistence remains');
app=app.replaceAll('map_layout.png','map_layout-park1.svg');
app=app.replace("btn.addEventListener('click', (e) => {\n            e.stopPropagation();\n            if (btn.getAttribute('href'))","btn.addEventListener('click', async (e) => {\n            e.stopPropagation();\n            if (btn.getAttribute('href'))");
app=app.replace('const project = btn.dataset.project;',"const project = btn.dataset.project;\n            if(!avatarDataPool[project]?.length) {try {await staffLoadProject(project);} catch {alert('Could not load this project. Please retry.');return;}}");
await writeFile('dist/app.js',app);
await cp('staff/login.html','dist/login.html');
await cp('staff/staff-session.js','dist/staff-session.js');
await build({entryPoints:['staff/auth-client.js'],bundle:true,platform:'browser',format:'esm',outfile:'dist/staff-auth.js'});
console.log('Public layout built; staff writes and customer data remain server-protected.');
