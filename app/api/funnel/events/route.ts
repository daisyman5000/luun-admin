export const dynamic='force-dynamic';
export async function OPTIONS(){return new Response(null,{status:410,headers:{'Cache-Control':'no-store'}});}
export async function POST(){return new Response(null,{status:410,headers:{'Cache-Control':'no-store'}});}
