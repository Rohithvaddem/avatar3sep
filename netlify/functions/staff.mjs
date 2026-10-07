import {login, logout, verifyRequestOrigin} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../../server/staff-core.mjs';
const files={avatar1:'avatar1_data.json',avatar2:'avatar2_digi/data.json',avatar3:'avatar3_data.json'};
async function verifiedUser(request) {
 const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('nf_jwt='));
 if(!raw) return null;
 let token;try {token=decodeURIComponent(raw.slice(7));}catch{return null;}
 if(!token || token.length>16000) return null;
 try {
  const response=await fetch(new URL('/.netlify/identity/user',request.url),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const user=await response.json();
  return {id:user.id,email:user.email,roles:Array.isArray(user.app_metadata?.roles)?user.app_metadata.roles:[]};
 }catch{return null;}
}
export default createHandler({getUser:verifiedUser,login,logout,verifyRequestOrigin,
  store:()=>getStore({name:'staff-plots',consistency:'strong'}),
  seed:async project=>JSON.parse((await readFile(files[project],'utf8')).replace(/^\uFEFF/,''))
});
