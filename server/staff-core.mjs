const projects = ['avatar1','avatar2','avatar3'];
const fields=['plot_size','facing','plot_status','customer_name','customer_phone','customer_email','lead_source','crm_notes'];
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export function createHandler(deps) {
 return async request=>{
  try {
   const url=new URL(request.url), action=url.searchParams.get('action');
   if(request.method!=='GET') deps.verifyRequestOrigin(request);
   if(action==='login' && request.method==='POST') {
    const {email,password}=await request.json();
    if(typeof email!=='string'||typeof password!=='string'||password.length>256) return json({error:'Invalid login'},400);
    await deps.login(email,password);
    return json({ok:true});
   }
   if(action==='logout' && request.method==='POST') {await deps.logout();return json({ok:true});}
   const user=await deps.getUser();
   if(!user) return json({error:'Sign in required'},401);
   const role=user.roles?.includes('director')?'director':user.roles?.includes('staff')?'staff':null;
   if(!role) return json({error:'Staff access required'},403);
   if(action==='session' && request.method==='GET') return json({role});
   if(action!=='plots') return json({error:'Not found'},404);
   const project=url.searchParams.get('project');
   if(!projects.includes(project)) return json({error:'Invalid project'},400);
   const store=deps.store();
   const seed=await deps.seed(project);
   const current=await store.getWithMetadata(project,{type:'json'});
   const rows=current?.data || seed;
   if(request.method==='GET') return json({plots:rows,version:current?.etag || 'seed'});
   if(request.method!=='PATCH') return json({error:'Method not allowed'},405);
   const body=await request.json(), plotNo=String(body.plotNo);
   const idx=rows.findIndex(row=>String(row.plot_no)===plotNo);
   if(idx<0) return json({error:'Unknown plot'},404);
   if(body.version!==(current?.etag || 'seed')) return json({error:'Another user changed this project. Refresh and retry.'},409);
   const patch=body.patch;
   if(!patch || typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!fields.includes(key))) return json({error:'Invalid fields'},400);
   for(const [key,value] of Object.entries(patch)) {
    if(key==='crm_notes') {if(!Array.isArray(value)||value.length>200||value.some(v=>typeof v!=='string'||v.length>2000)) return json({error:'Invalid notes'},400);}
    else if(typeof value!=='string'||value.length>500) return json({error:'Invalid field value'},400);
   }
   if(patch.plot_status && !['AVAILABLE','SOLD','REGISTERED','HOLD','INVESTOR','MORTGAGE','RESALE','BOOKED'].includes(patch.plot_status)) return json({error:'Invalid status'},400);
   if(patch.facing && !['East','West','North','South','North-East','North-West','South-East','South-West'].includes(patch.facing)) return json({error:'Invalid facing'},400);
   if(patch.plot_size && (!Number.isFinite(Number(patch.plot_size))||Number(patch.plot_size)<=0)) return json({error:'Invalid area'},400);
   rows[idx]={...rows[idx],...patch,updated_at:new Date().toISOString(),updated_by:user.id};
   const result=await store.setJSON(project,rows,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
   if(!result.modified) return json({error:'Concurrent update. Refresh and retry.'},409);
   return json({plot:rows[idx],version:result.etag});
  } catch(error) {
   if(error.status===403||error.statusCode===403) return json({error:'Request rejected'},403);
   return json({error:'Unable to complete request'},500);
  }
 };
}
