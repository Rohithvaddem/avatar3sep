import {handleAuthCallback,acceptInvite,updateUser} from '@netlify/identity';
let callback;
const message=document.getElementById('message');
if(!/invite_token|recovery_token|confirmation_token|access_token/.test(location.hash)) location.replace('/');
try {
 callback=await handleAuthCallback();
 if(callback && ['invite','recovery','confirmation','oauth'].includes(callback.type)) {
  document.getElementById('emailLabel').hidden=true;document.getElementById('email').required=false;
  document.getElementById('intro').textContent='Set your staff account password.';
  document.getElementById('submit').textContent='Set password';
  document.getElementById('password').autocomplete='new-password';document.getElementById('passwordHelp').hidden=false;
 }
} catch {message.textContent='This invitation or recovery link is invalid or expired.';}
document.getElementById('authForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=document.getElementById('submit');button.disabled=true;
 try {
  const password=document.getElementById('password').value;
  if(callback?.type==='invite') await acceptInvite(callback.token,password);
  else if(callback && ['recovery','confirmation','oauth'].includes(callback.type)) await updateUser({password});
  else {
   const response=await fetch('/.netlify/functions/staff?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password})});
   if(!response.ok) throw new Error('Sign-in failed. Check your email and password.');
  }
  const session=await fetch('/.netlify/functions/staff?action=session');
  if(!session.ok || !(await session.json()).role) throw new Error('Your account needs a staff, director or admin role. Contact your administrator.');
  location.replace('/');
 }catch(error){message.textContent=error.message;button.disabled=false;}
});
