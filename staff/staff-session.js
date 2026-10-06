const staffVersions={};
function staffEscape(value) {
 return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
async function staffRequest(action,options={},project) {
 const url='/.netlify/functions/staff?action='+action+(project?'&project='+project:'');
 const response=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
 const body=await response.json();
 if(response.status===401) location.replace('/login.html');
 if(!response.ok) throw new Error(body.error||'Request failed');
 return body;
}
async function staffLoadProject(project) {
 const body=await staffRequest('plots',{},project);
 staffVersions[project]=body.version;avatarDataPool[project]=body.plots;
}
async function staffSignIn(email,password) {
 return staffRequest('login',{method:'POST',body:JSON.stringify({email,password})});
}
