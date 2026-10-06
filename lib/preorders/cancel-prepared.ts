import {createAdminClient} from '@/lib/supabase/admin';
export async function cancelPreparedCart(cartId:unknown){
 if(typeof cartId!=='string'||cartId.length>512||!/^gid:\/\/shopify\/Cart\/[A-Za-z0-9_-]+\?key=[A-Za-z0-9_%=-]+$/.test(cartId))throw new Error('Invalid checkout reference.');
 const db=createAdminClient();
 const existing=await db.from('preorder_reservations').select('id,shopify_order_id,released_at').eq('cart_id',cartId).maybeSingle();
 if(existing.error)throw new Error('Could not confirm the checkout reservation.');
 if(!existing.data||existing.data.released_at)return true;
 if(existing.data.shopify_order_id)throw new Error('This checkout has already become an order.');
 const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
 if(!domain||!/^[A-Za-z0-9-]+\.myshopify\.com$/.test(domain)||!token)throw new Error('Checkout is not configured.');
 async function request(query:string,variables:Record<string,unknown>){
  const response=await fetch(`https://${domain}/api/2026-01/graphql.json`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token!},body:JSON.stringify({query,variables})});
  const result=await response.json();if(!response.ok||result.errors?.length)throw new Error('Could not cancel the prepared checkout.');return result.data;
 }
 const result=await request('query($id:ID!){cart(id:$id){lines(first:100){pageInfo{hasNextPage} nodes{id}}}}',{id:cartId});
 if(!result.cart||result.cart.lines.pageInfo.hasNextPage)throw new Error('Checkout completion could not be ruled out.');
 const ids=result.cart.lines.nodes.map((line:{id:string})=>line.id);
 if(ids.length){
  const removed=await request('mutation($cartId:ID!,$lineIds:[ID!]!){cartLinesRemove(cartId:$cartId,lineIds:$lineIds){cart{lines(first:1){nodes{id}}} userErrors{message}}}',{cartId,lineIds:ids});
  if(removed.cartLinesRemove.userErrors?.length||!removed.cartLinesRemove.cart||removed.cartLinesRemove.cart.lines.nodes.length)throw new Error('Could not empty the prepared checkout.');
 }
 const released=await db.rpc('release_abandoned_preorder_inventory',{reservation_id:existing.data.id});
 if(released.error||released.data!==true)throw new Error('Could not release the checkout reservation.');
 return true;
}
