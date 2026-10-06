import { getUser } from '@netlify/identity';
export default async function(request, context) {
  const path = new URL(request.url).pathname;
  if (path === '/login.html' || path === '/staff-auth.js' || path === '/aspirealty_label.png' || path.startsWith('/.netlify/')) return context.next();
  const user = await getUser();
  if (!user || !user.roles.some(role => ['staff','director'].includes(role))) {
    return new Response(null, {status:302, headers:{Location:'/login.html','Cache-Control':'no-store'}});
  }
  return context.next();
}
